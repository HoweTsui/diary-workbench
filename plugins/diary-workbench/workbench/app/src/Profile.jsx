import { useMemo, useState } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { PosterPreview } from './PosterPreview.jsx';
import { activityByDate, localToday } from './activity.mjs';
import { dateLabel, hasRecord } from './model.mjs';
import { libraryLinks } from './library.mjs';
import { MonoActivityHeatmap } from './MonoActivityHeatmap.jsx';

export function Profile({ draft, catalog, loading, error, onBack, onEditDate, onOpenLibrary }) {
  const today = localToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const counts = useMemo(() => activityByDate(catalog?.entries), [catalog]);
  const entries = (catalog?.entries || []).filter(entry => entry.date === selectedDate && !entry.isBlank);
  const written = hasRecord(draft.days[selectedDate]);
  const count = counts[selectedDate] || 0;
  return <main className="workbench profile-page">
    <button className="back-link" onClick={onBack}><ArrowLeftIcon size={17} />返回工作台</button>
    <header className="profile-heading"><ProfileAvatar catalog={catalog} /><div><h1>{catalog?.profile?.name || '我的日记'}</h1><p>{catalog?.workspace ? `已连接 ${catalog.workspace.label} · ${catalog.workspace.title}` : '把日常，写成值得回看的日子。'}</p></div></header>
    <section className="profile-calendar"><div className="profile-section-heading"><h2>日记日历</h2><span className="muted">近 20 周</span></div><p className="muted">颜色越深，海报事件越多；未写不着色，虚线表示待统计。</p>
      {loading ? <p className="catalog-state" role="status">正在读取日记…</p> : error ? <p className="catalog-state error" role="alert">日记记录暂未读取，当前不显示统计。</p> : <MonoActivityHeatmap counts={counts} today={today} selectedDate={selectedDate} onSelect={setSelectedDate} />}
    </section>
    <section className="selected-day" aria-label="选中日期的日记"><div className="profile-section-heading"><h3>{dateLabel(selectedDate)}</h3><button onClick={() => onEditDate(selectedDate)}>{written || entries.length ? '编辑当天记录' : '写这天'}</button></div>
      <p className="muted">{loading ? '正在读取日记…' : error ? '日记记录读取失败；本地草稿仍可编辑。' : counts[selectedDate] === null ? '已有海报，事件数待统计。' : count ? `海报包含 ${count} 个事件` : written ? '草稿已填写，尚无海报。' : entries.length ? '已写日记，尚无海报。' : '还没有写日记。'}</p>
      {entries.map(entry => <div className="profile-entry" key={entry.id || entry.posterSrc}><div><h3>{entry.title}</h3><p>{entry.summary}</p></div>{entry.posterSrc ? <PosterPreview className="profile-image-trigger" src={libraryLinks.asset(entry.posterSrc)} alt={entry.title} label="查看插画">查看插画</PosterPreview> : null}</div>)}
    </section>
    <nav className="profile-library" aria-label="日记资料入口"><a href={libraryLinks.book} onClick={onOpenLibrary}>3D 日记本<ArrowRightIcon size={17} /></a><a href={libraryLinks.graph} onClick={onOpenLibrary}>人物关系图谱<ArrowRightIcon size={17} /></a></nav>
  </main>;
}
