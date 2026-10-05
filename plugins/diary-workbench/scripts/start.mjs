import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'workbench/app');
if (Number(process.versions.node.split('.')[0]) < 22) throw Error('需要 Node.js 22 或更新版本。');
process.env.DIARY_WORKBENCH_DATA ||= path.join(process.env.LOCALAPPDATA || path.join(homedir(), '.local/share'), 'diary-workbench-default');
process.env.DIARY_SKILL_PATH = path.join(root, 'skills/cartoon-diary-journal/SKILL.md');
process.env.DIARY_DEFAULT_LIBRARY = path.join(app, 'default-library');
process.env.DIARY_ASSETS_PATH = path.join(root, 'skills/cartoon-diary-journal/assets');
process.env.DIARY_WORKBENCH_PORT ||= '8185';

if (!existsSync(path.join(app, 'node_modules/vite/package.json'))) {
  if (process.argv.includes('--check')) { console.error('首次启动尚未安装工作台依赖。'); process.exit(1); }
  console.log('首次启动：安装工作台依赖…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['ci', '--no-audit', '--no-fund'], { cwd: app, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) throw Error('依赖安装失败，请确认 Node.js/npm 可用后重试。');
}
await import(path.join(app, 'scripts/start-local.mjs'));
