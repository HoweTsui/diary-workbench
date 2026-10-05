// Adapted from Subhan-code/Amicro--Micro-transitions-/MonoActivityHeatmap.
// MIT attribution is retained in THIRD_PARTY_NOTICES.md. No random demo data.
import { useMemo, useState } from 'react';
import { activityWeeks } from './activity.mjs';

const colors = ['#f4f4f5', '#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6'];
export function MonoActivityHeatmap({ counts, today, selectedDate, onSelect }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const weeks = useMemo(() => activityWeeks(today, counts), [today, counts]);
  const selected = hoveredDay || { date: selectedDate, count: counts[selectedDate] ?? 0 };
  const countLabel = day => counts[day.date] === null ? '事件数待统计' : `${day.count} 个事件`;
  let previousMonth = '';
  return <div className="activity-heatmap" aria-label="日记海报事件热力日历">
    <div className="heatmap-scroll"><div className="heatmap-months" aria-hidden="true">{weeks.map(week => {
      const marker = week.find(day => day.date.slice(8) === '01') || week[0];
      const month = marker.date.slice(0, 7), show = month !== previousMonth; previousMonth = month;
      return <span key={week[0].date}>{show ? `${Number(marker.date.slice(5, 7))}月` : ''}</span>;
    })}</div>
      <div className="heatmap-grid" onPointerLeave={() => setHoveredDay(null)}>{weeks.map(week => <div className="heatmap-week" key={week[0].date}>{week.map(day => <button
        key={day.date} className={`heatmap-day${day.date === selectedDate ? ' selected' : ''}`} disabled={day.future}
        style={{ backgroundColor: colors[day.level], borderStyle: counts[day.date] === null ? 'dashed' : undefined, borderColor: counts[day.date] === null ? '#d4d4d8' : undefined }} aria-label={`${day.date}，${countLabel(day)}`} aria-pressed={day.date === selectedDate}
        title={`${day.date} · ${countLabel(day)}`} onPointerEnter={() => setHoveredDay(day)} onFocus={() => setHoveredDay(day)} onBlur={() => setHoveredDay(null)} onClick={() => { setHoveredDay(null); onSelect(day.date); }}
      />)}</div>)}</div>
    </div>
    <p className="heatmap-detail" role="status">{selected.date} · {countLabel(selected)}</p>
    <div className="heatmap-legend" aria-label="海报事件数量对应颜色"><span>无事件</span>{colors.map((color, index) => <span className="legend-item" key={color}><i style={{ background: color }} /><span>{['0', '1', '2', '3–4', '5+'][index]}</span></span>)}<span>个事件</span></div>
  </div>;
}
