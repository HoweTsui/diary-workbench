import { imageMime } from './image-formats.mjs';

const previews = new WeakMap();
const browserTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml', 'image/bmp', 'image/x-icon']);
function decodes(blob) {
  const url = URL.createObjectURL(blob), image = new Image();
  return new Promise(resolve => {
    image.onload = () => { URL.revokeObjectURL(url); resolve(true); };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    image.src = url;
  });
}
async function prepare(blob, name) {
  const type = blob.type.startsWith('image/') ? blob.type : imageMime({ name, type: blob.type });
  const typed = blob.type === type ? blob : blob.slice(0, blob.size, type);
  if (browserTypes.has(type) && await decodes(typed)) return typed;
  const session = await fetch('/api/diary/session', { cache: 'no-store' });
  if (!session.ok) throw Error('本地图片预览服务未连接；原文件已保留。');
  const { token } = await session.json();
  const response = await fetch('/api/diary/image-preview', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-diary-token': token, 'x-image-name': encodeURIComponent(name || 'image') }, body: blob });
  if (!response.ok) { const error = await response.json(); throw Error(error.error || '图片无法预览；原文件已保留。'); }
  const result = await response.blob();
  if (!await decodes(result)) throw Error('图片预览无法显示；原文件已保留。');
  return result;
}
export function previewBlob(blob, name) {
  let pending = previews.get(blob);
  if (!pending) { pending = prepare(blob, name).catch(error => { previews.delete(blob); throw error; }); previews.set(blob, pending); }
  return pending;
}
