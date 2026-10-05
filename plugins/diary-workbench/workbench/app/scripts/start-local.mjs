import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.DIARY_WORKBENCH_PORT || 8185);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('本地端口无效。');
const url = `http://127.0.0.1:${port}/`;
async function existing() {
  try {
    const response = await fetch(url + 'api/diary/session', { signal: AbortSignal.timeout(1500) });
    if (response.ok) { const data = await response.json(); if (data.engine === 'codex-app-server') return data; }
  } catch { /* A stopped server is normal: start it below. */ }
}
const current = await existing();
if (current) {
  console.log(`工作台已运行：${url}\n日记库：${current.workspace?.label || '独立测试库'}`);
} else if (process.argv.includes('--check')) {
  console.error('工作台尚未运行。双击 diary-workbench/start.command 启动。'); process.exitCode = 1;
} else {
  const server = await createServer({ root: app, configFile: path.join(app, 'vite.config.mjs'), server: { host: '127.0.0.1', port, strictPort: true } });
  await server.listen();
  console.log(`日记工作台已启动：${url}\n保持此窗口打开；在 Codex 右侧浏览器打开这个地址即可操作。`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
}
