import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export const historySignature = (body, photos) => hash(JSON.stringify({ body, photos: photos.map(p => ({ source: p.source, originalSource: p.originalSource })) }));
export function historyEvents(date, body, photos, association) {
  let groups;
  if (association?.signature === historySignature(body, photos) && Array.isArray(association.groups)) {
    const used = new Set();
    let valid = true;
    groups = association.groups.map(group => {
      const [start, end] = group.range || [];
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > body.length) valid = false;
      const assigned = (group.photos || []).map(index => { if (!Number.isInteger(index) || !photos[index] || used.has(index)) valid = false; used.add(index); return photos[index]; }).filter(Boolean);
      return { text: body.slice(start, end), photos: assigned };
    });
    if (!valid || groups.map(g => g.text).join('').replace(/\s/g, '') !== body.replace(/\s/g, '')) groups = null;
  }
  if (!groups) groups = body.split(/\n\s*\n/).filter(text => text.trim()).map(text => ({ text, photos: [] }));
  const assigned = new Set(groups.flatMap(group => group.photos.map(photo => photo.id)));
  const unassigned = photos.filter(photo => !assigned.has(photo.id));
  if (unassigned.length) groups.push({ text: '', photos: unassigned, unassigned: true });
  return groups.map((group, index) => ({ id: `history-${date}-event-${index}`, ...group }));
}
