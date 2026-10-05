export const busyStates = new Set(['awaiting_chat', 'queued', 'connecting', 'running', 'waiting', 'validating', 'archiving']);
export const jobLabels = { queued: '等待生成', connecting: '连接 Codex', running: '正在生成', waiting: '需要回应', validating: '核对结果', ready: '待确认', archiving: '正在归档', archived: '已存入测试库', failed: '生成未完成', needs_input: '需要补充资料', interrupted: '任务中断', cancelled: '已取消' };
export { dayInputKey } from './model.mjs';
export function generationStatus(job) {
  if (job?.status === 'awaiting_chat') return '等待左侧聊天接手';
  if ((job?.phase === 'reconnecting' || /Reconnecting/i.test(job?.message || '')) && busyStates.has(job.status)) return '连接重试中…';
  if (job?.status === 'queued') return '等待生成…';
  if (job?.status === 'connecting') return '正在连接 Codex…';
  if (job?.status === 'waiting') return '等待你的确认';
  if (job?.status === 'validating') return '正在整理海报…';
  if (job?.status === 'archiving') return '正在保存…';
  if (job?.status === 'running') return job.phase === 'drawing' ? '正在绘制插画…' : '正在准备素材…';
  if (job?.status === 'failed' && job.failureKind === 'connection') return 'Codex 连接失败，请重试。';
  return '';
}
export function activeGeneration(jobs, dates) {
  return jobs.find(job => dates.includes(job.date) && busyStates.has(job.status));
}
export async function diaryRequest(url, token, body) {
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Diary-Token': token }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw Error(data?.error || '未连接本地日记执行器；草稿不受影响。');
  return data;
}
