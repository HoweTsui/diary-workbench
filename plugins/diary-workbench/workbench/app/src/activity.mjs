import { dateRange, shiftDate, weekDates } from './model.mjs';

export function illustrationCount(entry) {
  if (entry.isBlank) return 0;
  if (!entry.posterSrc) return 0;
  if (Number.isInteger(entry.eventCount) && entry.eventCount >= 0) return entry.eventCount;
  // Current archive writes this from the final poster brief, unlike legacy imports.
  if (entry.approval === 'approved' && Number.isInteger(entry.illustrationCount)) return entry.illustrationCount;
  return null;
}
export const activityLevel = count => count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
export function activityByDate(entries) {
  const counts = {};
  for (const entry of entries || []) counts[entry.date] = illustrationCount(entry);
  return counts;
}
export function activityWeeks(today, counts, totalWeeks = 20) {
  const end = weekDates(today).at(-1);
  const dates = dateRange(shiftDate(end, -(totalWeeks * 7 - 1)), end);
  return Array.from({ length: totalWeeks }, (_, index) => dates.slice(index * 7, (index + 1) * 7).map(date => ({ date, count: counts[date] || 0, level: activityLevel(counts[date] || 0), future: date > today })));
}
export const localToday = () => {
  const time = new Date();
  return `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`;
};
