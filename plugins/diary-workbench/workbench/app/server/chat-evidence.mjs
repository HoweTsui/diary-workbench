import { promises as fs, createReadStream } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function localPath(value) {
  if (typeof value !== 'string' || !value) return null;
  if (!value.startsWith('file:')) return path.isAbsolute(value) ? value : null;
  try { return fileURLToPath(value); } catch { return null; }
}

export function collectEvidence(record, since, evidence) {
  // Host events only, never diary prose, prompts or command stdout.
  if (record.type !== 'event_msg' || record.payload?.type !== 'item_completed') return;
  const p = record.payload, item = p.item;
  const at = Number(p.completed_at_ms || Date.parse(record.timestamp));
  if (!Number.isFinite(at) || at < since) return;
  const type = String(item?.type || '').replaceAll('_', '').toLowerCase();
  const generated = type === 'imagegeneration' || (type === 'extension' && item.kind === 'image_gen.generation');
  if (generated && item.status === 'completed' && !item.failure) {
    const savedPath = localPath(item.savedPath || item.saved_path);
    if (savedPath) evidence.generations.push({ id: item.id, savedPath, status: 'completed' });
  }
  if (type === 'imageview') {
    const viewed = localPath(item.path || item.image_path);
    if (viewed) evidence.views.push(viewed);
  }
}
async function* records(file) {
  let line = '', overflow = false;
  for await (const chunk of createReadStream(file, { encoding: 'utf8' })) {
    const parts = chunk.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (!overflow) { line += parts[i]; if (line.length > 4 * 1024 * 1024) { overflow = true; line = ''; } }
      if (i < parts.length - 1) { if (!overflow) { try { yield JSON.parse(line); } catch { /* partial host record */ } } line = ''; overflow = false; }
    }
  }
}
export async function readChatEvidence(threadId, startedAt, root = path.join(process.env.CODEX_HOME || path.join(homedir(), '.codex'), 'sessions')) {
  if (!/^[a-f0-9-]{36}$/.test(threadId || '') || !Number.isFinite(Date.parse(startedAt))) throw Error('聊天凭据无效。');
  const evidence = { generations: [], views: [] };
  for (const relative of await fs.readdir(root, { recursive: true })) {
    const filename = path.basename(relative);
    if (!new RegExp(`-${threadId}(?:_[a-f0-9-]{36})?\\.jsonl$`).test(filename)) continue;
    let sameThread = false;
    for await (const record of records(path.join(root, relative))) {
      if (record.type === 'session_meta') sameThread = record.payload?.id === threadId;
      if (sameThread) collectEvidence(record, Date.parse(startedAt), evidence);
    }
  }
  if (!evidence.generations.length) throw Error('尚未读取到本聊天的真实生图记录；未交付为成品。');
  return evidence;
}
