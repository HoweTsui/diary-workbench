import { promises as fs, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DiaryJobs, safeFile } from './jobs.mjs';
import { createArchive } from './archive.mjs';
import { DiaryWorkspace, fileUrl } from './workspace.mjs';
import { createVaultArchive } from './vault-archive.mjs';
import { imagePreview, maxImageBytes } from './image-preview.mjs';
import { imageExtensions } from '../src/image-formats.mjs';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const localRoot = process.env.DIARY_WORKBENCH_DATA ? path.resolve(process.env.DIARY_WORKBENCH_DATA) : path.join(process.env.LOCALAPPDATA || path.join(homedir(), '.local/share'), 'diary-workbench-default');
export const diaryWorkspace = new DiaryWorkspace({ root: localRoot });
const bundledPython = path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
export const pythonCommand = process.env.DIARY_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');
const skillPath = process.env.DIARY_SKILL_PATH || path.resolve(app, '../../skills/cartoon-diary-journal/SKILL.md');
export const mime = { ...Object.fromEntries(Object.entries(imageExtensions).map(([extension, type]) => [`.${extension}`, type])), '.html': 'text/html; charset=utf-8', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json' };
export function localRequest(req) {
  const host = new URL(`http://${req.headers.host || 'invalid'}`);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname)) return false;
  const remote = req.socket?.remoteAddress;
  if (remote && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return false;
  if (req.headers.origin && req.headers.origin !== host.origin) return false;
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
  return true;
}
async function readBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Error('请求必须为 JSON。');
  const chunks = []; let total = 0;
  for await (const chunk of req) { total += chunk.length; if (total > 256 * 1024 * 1024) throw Error('本次资料超过256MB，请分日期提交；不会删除草稿或原图。'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function diaryGateway({ demoRoot, readerRoot, root = localRoot, skill = skillPath, python = pythonCommand, clientFactory, workspace = root === localRoot ? diaryWorkspace : new DiaryWorkspace({ root }) } = {}) {
  const token = randomBytes(32).toString('hex');
  const testArchive = createArchive({ root, demoRoot, readerRoot, skill, python });
  const vaultArchive = createVaultArchive({ root, workspace, skill, python });
  const jobs = new DiaryJobs({ root, skill, demoRoot, clientFactory, python, workspace, archive: async (job, folder) => (await workspace.target()) ? vaultArchive(job, folder) : testArchive(job, folder) });
  let loaded;
  return {
    name: 'local-diary-execution',
    buildEnd() { jobs.close(); },
    configureServer(server) {
      loaded = jobs.load();
      server.watcher.add(path.join(root, 'library/reader/data/manifest.json'));
      server.httpServer?.once('close', () => jobs.close());
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/diary/')) return next();
        const json = (code, data) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
        try {
          if (!localRequest(req)) return json(403, { error: '本地日记执行器仅支持本机同源工作台。' });
          await loaded;
          const pathname = new URL(req.url, 'http://localhost').pathname;
          if (req.method === 'GET' && pathname === '/api/diary/session') { const target = await workspace.summary(); return json(200, { token, mode: target.mode, workspace: target, skillAvailable: existsSync(skill), engine: 'codex-app-server', jobs: jobs.list() }); }
          if (req.method === 'GET' && pathname === '/api/diary/jobs') return json(200, { jobs: jobs.list() });
          if (req.method === 'GET' && pathname === '/api/diary/catalog') {
            const catalog = await workspace.catalog();
            if (catalog) return json(200, catalog);
            const active = path.join(root, 'library/diary/diary-book-data.json');
            return json(200, JSON.parse(await fs.readFile(existsSync(active) ? active : path.join(demoRoot, 'diary-book-data.json'), 'utf8')));
          }
          const recordMatch = /^\/api\/diary\/(records|notes)\/(\d{4}-\d{2}-\d{2})$/.exec(pathname);
          if (req.method === 'GET' && recordMatch) {
            const record = await workspace.record(recordMatch[2]);
            if (!record) return json(404, { error: '尚未连接个人日记库。' });
            if (recordMatch[1] === 'records') return json(200, record);
            if (!record.exists) return json(404, { error: '这一天还没有日记。' });
            const escape = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
            const target = await workspace.target();
            const font = fileUrl(target.relative.reader + '/fonts/Yozai-Regular.ttf');
            res.setHeader('Content-Type', mime['.html']);
            return res.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${record.date} 日记</title><style>@font-face{font-family:Yozai;src:url('${font}')}body{font-family:Yozai,system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 20px;line-height:1.8;color:#111;background:white}a{color:inherit}.body{white-space:pre-wrap}.poster{display:block;width:100%;height:auto}.photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.photos img{width:100%;height:180px;object-fit:contain}@media(max-width:600px){.photos img{height:110px}}</style></head><body><a href="/?date=${record.date}#review">← 返回工作台</a><h1>${record.date}</h1><div class="body">${escape(record.body)}</div>${record.posterUrl ? `<h2>日记海报${record.approval === 'draft' ? '（预览）' : ''}</h2><img class="poster" src="${escape(record.posterUrl)}" alt="完整海报">` : ''}${record.photos.length ? `<h2>原照片</h2><div class="photos">${record.photos.map(photo => `<a href="${escape(photo.originalSource || photo.source)}"><img src="${escape(photo.source)}" alt="${escape(photo.name)}"></a>`).join('')}</div>` : ''}</body></html>`);
          }
          if (['GET', 'HEAD'].includes(req.method) && pathname.startsWith('/api/diary/vault/')) {
            const file = await workspace.file(decodeURIComponent(pathname.slice('/api/diary/vault/'.length)));
            if (!mime[path.extname(file).toLowerCase()]) return json(404, { error: '此文件不是日记媒体。' });
            res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()]);
            return res.end(req.method === 'HEAD' ? undefined : await fs.readFile(file));
          }
          if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-diary-token'] !== token) return json(403, { error: '工作台连接已变化，请刷新后重试。' });
          if (req.method === 'POST' && pathname === '/api/diary/image-preview') {
            const chunks = []; let size = 0;
            for await (const chunk of req) { size += chunk.length; if (size > maxImageBytes) throw Error('图片超过64MB；原文件仍保留。'); chunks.push(chunk); }
            const preview = await imagePreview(Buffer.concat(chunks), decodeURIComponent(req.headers['x-image-name'] || 'image'), { python });
            res.setHeader('Content-Type', 'image/png');
            return res.end(preview);
          }
          if (req.method === 'POST' && pathname === '/api/diary/jobs') {
            const body = await readBody(req); return json(202, await jobs.create(body.day, body.inputKey, body.force === true, body.executor || 'chat'));
          }
          const chat = /^\/api\/diary\/jobs\/([a-f0-9-]{36})\/(handoff|chat\/(take|complete|fail))$/.exec(pathname);
          if (chat) {
            if (req.method === 'GET' && chat[2] === 'handoff') return json(200, await jobs.handoff(chat[1], `http://${req.headers.host}`));
            if (req.method === 'POST' && chat[3]) {
              const body = await readBody(req);
              if (chat[3] === 'take') return json(200, await jobs.takeChat(chat[1], body.threadId));
              if (chat[3] === 'complete') return json(200, await jobs.finishChat(chat[1], body.threadId, body.resultFile));
              return json(200, await jobs.failChat(chat[1], body.threadId));
            }
          }
          const match = /^\/api\/diary\/jobs\/([a-f0-9-]{36})(?:\/(poster|cards\/[^/]+|avatars\/[^/]+|cancel|respond|confirm|retry))?$/.exec(pathname);
          if (match) {
            const job = jobs.get(match[1]), action = match[2];
            if (req.method === 'GET' && !action) return json(200, jobs.public(job));
            if (req.method === 'GET' && (action === 'poster' || action?.startsWith('cards/') || action?.startsWith('avatars/'))) {
              if (!job.result) return json(404, { error: '真实海报尚未生成。' });
              const relative = action === 'poster' ? job.result.poster : job.characters.find(c => c.id === decodeURIComponent(action.split('/')[1]))?.[action.startsWith('avatars/') ? 'avatar' : 'card'];
              const file = await safeFile(path.join(jobs.folder(job), 'result'), relative);
              res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); return res.end(await fs.readFile(file));
            }
            if (req.method === 'POST' && action === 'cancel') return json(200, await jobs.cancel(job.id));
            if (req.method === 'POST' && action === 'respond') { const body = await readBody(req); return json(200, await jobs.respond(job.id, body.pendingId, body)); }
            if (req.method === 'POST' && action === 'retry') { const body = await readBody(req); return json(202, await jobs.retry(job.id, body.inputKey, body.identitySources)); }
            if (req.method === 'POST' && action === 'confirm') { const body = await readBody(req); return json(200, await jobs.confirm(job.id, body.inputKey, body.approvedCharacters, body.relationships)); }
          }
          if (req.method === 'GET' && pathname.startsWith('/api/diary/library/notes/')) {
            const file = await safeFile(path.join(root, 'library/notes'), decodeURIComponent(pathname.slice('/api/diary/library/notes/'.length)));
            res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); return res.end(await fs.readFile(file));
          }
          return json(404, { error: '接口不存在。' });
        } catch (error) { if (!res.headersSent) json(400, { error: error.message }); else res.end(); }
      });
    },
  };
}
