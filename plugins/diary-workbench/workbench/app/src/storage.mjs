import { imageMime } from './image-formats.mjs';
let database;
function open() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('diary-workbench-default', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
  return database;
}
export async function loadDraft() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts', 'readonly').objectStore('drafts').get('current');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function saveDraft(draft) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readwrite');
    transaction.objectStore('drafts').put(draft, 'current'); transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
export function dataUrl(blob) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
}
export async function serializeDay(draft, date) {
  return { date, events: await Promise.all((draft.days[date] || []).filter(event => event.text.trim() || event.photos.length).map(async event => ({
    id: event.id, text: event.text,
    photos: await Promise.all(event.photos.map(async photo => {
      const blob = photo.file || await fetch(photo.originalSource || photo.source).then(response => { if (!response.ok) throw new Error('原图片读取失败，尚未提交'); return response.blob(); });
      const type = blob.type.startsWith('image/') ? blob.type : imageMime({ name: photo.name, type: blob.type });
      return { name: photo.name, type, original: await dataUrl(blob.type === type ? blob : blob.slice(0, blob.size, type)), demo: !!photo.demo };
    })),
  }))) };
}
export async function exportDraft(draft) {
  const days = await Promise.all(draft.dates.map(date => serializeDay(draft, date)));
  const file = new Blob([JSON.stringify({ version: 1, kind: 'diary-input', status: 'not-generated', maxPosterRows: 5, preserveAllEventsAndOriginals: true, days }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `日记资料-${draft.dates[0]}-${draft.dates.at(-1)}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
