import { Photo } from './controls.jsx';
import { PosterPreview } from './PosterPreview.jsx';
import { dateLabel } from './model.mjs';
export function HistoryPreview({ date, record, loading, onEdit, draftEvents }) {
  const events = record?.events || [];
  return <section className="history-preview" aria-label="历史日记只读预览"><div className="editor-heading"><h2>{dateLabel(date)}的日记</h2><button disabled={loading || !record} onClick={onEdit}>编辑</button></div>
    {loading ? <p className="muted" role="status">正在读取日记…</p> : !record ? <p className="muted">暂时无法读取，请刷新重试。</p> : <>
      {record.posterUrl ? <PosterPreview className="history-poster" src={record.posterUrl} alt={`${dateLabel(date)}已有海报`} label="放大查看已有海报" /> : null}
      {draftEvents ? <p className="muted">有未归档修改，点击编辑继续。</p> : null}
      <div className="history-events">{events.map((event, index) => <article className="history-event" key={event.id} aria-label={event.unassigned ? '待关联图片' : `历史事件 ${index + 1}`}><h3>{event.unassigned ? '待关联图片' : `事件 ${String(index + 1).padStart(2, '0')}`}</h3>{event.text ? <p className="event-text">{event.text}</p> : null}{event.photos.length ? <div className="photo-list">{event.photos.map(photo => <Photo key={photo.id} photo={photo} />)}</div> : null}</article>)}</div>
    </>}
  </section>;
}
