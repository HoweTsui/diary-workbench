import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { imageExtensions } from '../src/image-formats.mjs';

const execute = promisify(execFile);
export const maxImageBytes = 64 * 1024 * 1024;
const pillowDecoder = `import sys
from PIL import Image, ImageOps
try:
 import pillow_heif
 pillow_heif.register_heif_opener()
except ImportError:
 pass
with Image.open(sys.argv[1]) as original:
 image = ImageOps.exif_transpose(original).convert('RGBA')
 image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
 image.save(sys.argv[2], 'PNG')
`;

// Only a temporary copy is decoded. User files, draft originals and the vault
// are never overwritten; successful and failed requests both clean up.
export async function imagePreview(bytes, name, { python = 'python3' } = {}) {
  if (!bytes.length || bytes.length > maxImageBytes) throw Error('图片为空或超过64MB；原文件仍保留。');
  const suffix = String(name || '').split('.').at(-1).toLowerCase();
  const root = await fs.mkdtemp(path.join(tmpdir(), 'diary-image-preview-'));
  const input = path.join(root, `input.${imageExtensions[suffix] ? suffix : 'image'}`), output = path.join(root, 'preview.png');
  try {
    await fs.writeFile(input, bytes);
    if (process.platform === 'darwin') {
      await execute('/usr/bin/sips', ['-s', 'format', 'png', input, '--out', output], { timeout: 45000, maxBuffer: 1024 * 1024 });
      const png = await fs.readFile(output);
      if (png.length >= 24 && Math.max(png.readUInt32BE(16), png.readUInt32BE(20)) > 2048) {
        await execute('/usr/bin/sips', ['-Z', '2048', output], { timeout: 45000, maxBuffer: 1024 * 1024 });
      }
    }
    else await execute(python, ['-c', pillowDecoder, input, output], { timeout: 45000, maxBuffer: 1024 * 1024 });
    const result = await fs.readFile(output);
    if (result.length < 33 || !result.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || !result.readUInt32BE(16) || !result.readUInt32BE(20)) throw Error('Invalid preview');
    return result;
  } catch {
    throw Error('这张图片暂时无法解码；原文件已保留，可换用 JPG 或 PNG 预览。');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
