import { copyFileSync, cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptLibraryPage } from './library-pages.mjs';
import { adaptReaderScript } from './reader-performance.mjs';
import { localRoot, localRequest, diaryWorkspace } from './server/gateway.mjs';
import { insideFile } from './server/workspace.mjs';

const app = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(process.env.DIARY_ASSETS_PATH || path.join(app, '../../skills/cartoon-diary-journal/assets'));
export const diaryRoot = path.resolve(process.env.DIARY_DEFAULT_LIBRARY || path.join(app, 'default-library'));
export const readerRoot = path.join(assets, 'diary-reader-v3/runtime');
const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function resolveLibraryFile(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const active = existsSync(path.join(localRoot, 'library/reader/data/manifest.json'));
  const currentDiary = active ? path.join(localRoot, 'library/diary') : diaryRoot;
  const currentReader = active ? path.join(localRoot, 'library/reader') : readerRoot;
  let root, relative;
  if (pathname === '/library/book/data/manifest.json') return active ? path.join(currentReader, 'data/manifest.json') : path.join(currentDiary, 'diary-book-data.json');
  if (pathname.startsWith('/library/book/data/')) { root = active ? path.join(currentReader, 'data') : currentDiary; relative = pathname.slice('/library/book/data/'.length); }
  else if (pathname.startsWith('/library/book/')) { root = currentReader; relative = pathname.slice('/library/book/'.length); }
  else if (pathname.startsWith('/library/diary/')) { root = currentDiary; relative = pathname.slice('/library/diary/'.length); }
  else return null;
  const file = path.resolve(root, relative || 'index.html');
  return file.startsWith(root + path.sep) ? file : null;
}
async function middleware(req, res, next) {
  if (!req.url.startsWith('/library/')) return next();
  if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; return res.end(); }
  let file, displayTitle, avatarFrames;
  try {
    const target = await diaryWorkspace.target();
    displayTitle = target?.displayTitle;
    avatarFrames = target?.readerAvatarFrames;
    if ((target || existsSync(path.join(localRoot, 'library/reader/data/manifest.json'))) && !localRequest(req)) { res.statusCode = 403; return res.end('本地日记仅供本机查看'); }
    if (target) {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let relative;
      if (pathname.startsWith('/library/book/')) relative = path.posix.join(target.relative.reader, pathname.slice('/library/book/'.length) || 'index.html');
      else if (pathname.startsWith('/library/regular/')) relative = path.posix.join(target.relative.regular, pathname.slice('/library/regular/'.length) || 'index.html');
      else if (pathname.startsWith('/library/diary/')) relative = path.posix.join(path.posix.dirname(target.relative.graph), pathname.slice('/library/diary/'.length) || 'character-graph.html');
      if (relative) file = await insideFile(target.diaryRoot, relative);
    } else file = resolveLibraryFile(req.url);
  } catch { res.statusCode = 404; return res.end('日记资料暂时无法读取，请确认已连接的目录仍可用。'); }
  if (!file || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; return res.end('日记资料文件不存在'); }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const kind = pathname === '/library/book/index.html' ? 'book' : pathname === '/library/diary/character-graph.html' ? 'graph' : null;
  if (pathname === '/library/book/data/manifest.json') {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (displayTitle) data.book = { ...data.book, title: displayTitle, coverTitle: displayTitle };
    for (const character of data.characters || []) {
      const frame = avatarFrames?.[character.id];
      if (frame && frame.source === character.avatarSrc) character.avatarFrame = frame;
    }
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
  }
  if (pathname.startsWith('/library/book/assets/') && path.extname(file) === '.js') {
    return res.end(req.method === 'HEAD' ? undefined : adaptReaderScript(readFileSync(file, 'utf8')));
  }
  res.end(req.method === 'HEAD' ? undefined : kind ? adaptLibraryPage(readFileSync(file, 'utf8'), kind) : readFileSync(file));
}
export function libraryAssets() {
  return {
    name: 'existing-diary-library',
    configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next).catch(next); }); },
    closeBundle() {
      // Package read-only copies; never modify the original reader/graph files.
      const target = path.join(app, 'dist/client/library');
      cpSync(readerRoot, path.join(target, 'book'), { recursive: true });
      for (const name of readdirSync(path.join(target, 'book/assets'))) {
        if (!name.endsWith('.js')) continue;
        const file = path.join(target, 'book/assets', name);
        writeFileSync(file, adaptReaderScript(readFileSync(file, 'utf8')));
      }
      cpSync(diaryRoot, path.join(target, 'book/data'), { recursive: true });
      copyFileSync(path.join(diaryRoot, 'diary-book-data.json'), path.join(target, 'book/data/manifest.json'));
      cpSync(diaryRoot, path.join(target, 'diary'), { recursive: true });
      for (const [relative, kind] of [['book/index.html', 'book'], ['diary/character-graph.html', 'graph'], ['book/data/character-graph.html', 'graph']]) {
        const file = path.join(target, relative);
        writeFileSync(file, adaptLibraryPage(readFileSync(file, 'utf8'), kind));
      }
    },
  };
}
