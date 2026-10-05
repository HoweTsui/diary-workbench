export const id = () => crypto.randomUUID();
export const newEvent = () => ({ id: id(), text: '', photos: [] });
export function blankDraft(date) { return { version: 1, dates: [date], activeDate: date, days: { [date]: [newEvent()] }, importedDates: {} }; }
export function workspaceDraft(saved, workspaceId, date) {
  if (saved?.version === 1 && saved.workspaceId === workspaceId) return saved;
  const previousDrafts = { ...saved?.previousDrafts };
  if (saved?.version === 1) {
    const { previousDrafts: ignored, ...previous } = saved;
    previousDrafts[saved.workspaceId || 'legacy-test'] = previous;
  }
  return { ...(previousDrafts[workspaceId] || blankDraft(date)), workspaceId, previousDrafts };
}
export function dayInputKey(draft, date) {
  return JSON.stringify((draft.days[date] || []).filter(e => e.text.trim() || e.photos.length).map(e => ({ id: e.id, text: e.text, photos: e.photos.map(p => ({ id: p.id, name: p.name, size: p.file?.size, modified: p.file?.lastModified, source: p.source, originalSource: p.originalSource })) })));
}
export const unchangedHistory = (draft, date) => draft.importedDates?.[date] === dayInputKey(draft, date);
export const dateLabel = date => { const [, m, d] = date.split('-').map(Number); return `${m}月${d}日`; };
export const weekday = date => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T12:00:00`).getDay()];
export function dateRange(start, end = start) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error('请选择有效日期。');
  const first = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) throw new Error('结束日期不能早于开始日期。');
  const result = [];
  for (let time = first; time <= last; time += 86400000) result.push(new Date(time).toISOString().slice(0, 10));
  return result;
}
export function seedDraft() { return blankDraft(new Date().toLocaleDateString('sv-SE')); }
export function moveEvent(events, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= events.length) return events;
  const copy = [...events]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy;
}
export function selectDates(draft, dates) {
  const days = { ...draft.days };
  dates.forEach(date => { if (!days[date]) days[date] = [newEvent()]; });
  return { ...draft, dates, days, activeDate: dates.includes(draft.activeDate) ? draft.activeDate : dates[0] };
}
export function reviewDay(draft, date = draft.activeDate) {
  return { date, events: (draft.days[date] || []).filter(event => event.text.trim() || event.photos.length) };
}
export function reviewDays(draft) {
  return draft.dates.map(date => reviewDay(draft, date));
}
export function previewSummary(draft) {
  const days = reviewDays(draft).filter(day => day.events.length && !unchangedHistory(draft, day.date));
  const eventCount = days.reduce((count, day) => count + day.events.length, 0);
  return { days, dayCount: days.length, eventCount, label: days.length ? `预览 ${days.length} 天 · ${eventCount} 件事` : '预览日记' };
}
export const photoCount = events => events.reduce((count, event) => count + event.photos.length, 0);
export const hasRecord = events => (events || []).some(event => event.text.trim() || event.photos.length);
export function shiftDate(date, offset) {
  const time = new Date(`${date}T12:00:00Z`);
  time.setUTCDate(time.getUTCDate() + offset);
  return time.toISOString().slice(0, 10);
}
export function weekDates(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(date, -((day + 6) % 7));
  return dateRange(monday, shiftDate(monday, 6));
}
