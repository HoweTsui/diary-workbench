import { isImageFile } from './image-formats.mjs';
export const photoDragType = 'application/x-diary-photo';
export function transferPhoto(events, sourceEventId, photoId, targetEventId) {
  if (sourceEventId === targetEventId || !events.some(e => e.id === targetEventId)) return events;
  const photo = events.find(e => e.id === sourceEventId)?.photos.find(p => p.id === photoId);
  if (!photo) return events;
  return events.map(event => event.id === sourceEventId ? { ...event, photos: event.photos.filter(p => p.id !== photoId) } : event.id === targetEventId ? { ...event, photos: [...event.photos, photo] } : event);
}
export function clipboardImages(data) {
  const files = Array.from(data?.files || []).filter(isImageFile);
  const signature = file => `${file.name || ''}:${file.size || 0}:${file.lastModified || 0}:${file.type || ''}`;
  const seen = new Set(files.map(signature));
  for (const file of Array.from(data?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(isImageFile)) {
    if (!files.includes(file) && !seen.has(signature(file))) { files.push(file); seen.add(signature(file)); }
  }
  return files;
}
export function reorderPhotos(photos, sourceId, targetId) {
  const from = photos.findIndex(photo => photo.id === sourceId), to = photos.findIndex(photo => photo.id === targetId);
  if (from < 0 || to < 0 || from === to) return photos;
  const result = [...photos];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}
