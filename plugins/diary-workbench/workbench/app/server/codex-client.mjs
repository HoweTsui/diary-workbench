import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const codexCommand = process.env.DIARY_CODEX_PATH || [
  '/Applications/Codex.app/Contents/Resources/codex',
  '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
  path.join(homedir(), '.local/bin/codex'),
].find(existsSync) || 'codex';

// One local stdio connection. No API keys, shell interpolation or desktop-chat creation.
export class CodexClient extends EventEmitter {
  constructor({ command = codexCommand, spawnProcess = spawn } = {}) {
    super();
    this.pending = new Map(); this.nextId = 0; this.closed = false;
    this.process = spawnProcess(command, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    // Do not expose process logs: they may contain account information or diary text.
    this.process.stderr.on('data', () => {});
    this.process.on('error', () => this.fail(new Error('无法启动本机 Codex，请检查 Codex 是否已安装。')));
    this.process.on('exit', () => this.fail(new Error('Codex 连接已断开；未完成的任务不会标记为成功。')));
    this.lines = createInterface({ input: this.process.stdout });
    this.lines.on('line', line => {
      let message; try { message = JSON.parse(line); } catch { return; }
      if (message.method && message.id !== undefined) this.emit('request', message);
      else if (message.method) this.emit('notification', message);
      else if (this.pending.has(message.id)) {
        const pending = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
      }
    });
  }
  fail(error) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear(); this.emit('disconnect', error);
  }
  send(message) {
    if (this.closed || !this.process.stdin.writable) throw new Error('Codex 尚未连接。');
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }
  call(method, params = {}, timeout = 45000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex 接口等待超时：${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { this.pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  reply(id, result) { this.send({ id, result }); }
  reject(id, message = '工作台不支持此请求') { this.send({ id, error: { code: -32601, message } }); }
  async initialize() {
    const result = await this.call('initialize', { clientInfo: { name: 'diary_workbench', title: '日记工作台', version: '0.2.0' }, capabilities: { experimentalApi: true } });
    this.send({ method: 'initialized', params: {} }); return result;
  }
  close() { this.fail(new Error('工作台服务已关闭。')); this.lines.close(); this.process.stdin.end(); this.process.kill(); }
}
