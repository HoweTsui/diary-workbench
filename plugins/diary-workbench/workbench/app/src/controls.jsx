import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpIcon } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowDownIcon } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { ImageIcon } from '@phosphor-icons/react/dist/csr/Image';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { dateLabel, dateRange, hasRecord, id, weekday } from './model.mjs';
import { clipboardImages, photoDragType, reorderPhotos } from './photo-input.mjs';
import { PosterPreview } from './PosterPreview.jsx';
import { imageAccept, isImageFile } from './image-formats.mjs';
import { previewBlob } from './photo-preview.mjs';
export { ArrowLeftIcon, ArrowRightIcon, CaretLeftIcon, CheckIcon, PlusIcon };
export function IconButton({ label, children, ...props }) {
  return <button className="icon-button" type="button" aria-label={label} title={label} {...props}>{children}</button>;
}
export function Stepper({ step }) {
  return <ol className="stepper" aria-label="日记流程">{['填写', '预览', '归档'].map((name, index) => <li key={name} className={step === index ? 'current' : ''} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span><b>{name}</b></li>)}</ol>;
}
export function DateStrip({ dates, activeDate, days, recordedDates, writingDates, onSelect, onEdit, onShift }) {
  return <section className="date-section" aria-label="日期选择"><div className="date-range">
    <IconButton label="上一周" onClick={() => onShift(-1)}><CaretLeftIcon /></IconButton>
    <button className="range-trigger" onClick={onEdit}>{dates.length === 1 ? dateLabel(dates[0]) : `${dateLabel(dates[0])} — ${dateLabel(dates.at(-1))}`}<CalendarBlankIcon size={18} /></button>
    <IconButton label="下一周" onClick={() => onShift(1)}><CaretRightIcon /></IconButton>
  </div><div className="date-tabs" role="tablist" aria-label="切换当天记录">{dates.map(date => {
    const written = hasRecord(days[date]) || recordedDates.has(date);
    const writing = writingDates?.has(date), status = writing ? '正在填写' : written ? '' : '未写';
    return <button key={date} role="tab" aria-label={`${dateLabel(date)} ${weekday(date)}${status ? ` ${status}` : ''}`} aria-selected={activeDate === date} className={date === activeDate ? 'selected' : ''} onClick={() => onSelect(date)}><strong>{Number(date.slice(-2))}</strong><span>{weekday(date)}</span>{status ? <small className={`unwritten-label${writing ? ' writing-label' : ''}`}>{status}</small> : null}</button>;
  })}</div></section>;
}
export function DateDialog({ dates, onClose, onApply }) {
  const dialog = useRef(null);
  const [multi, setMulti] = useState(dates.length > 1), [start, setStart] = useState(dates[0]), [end, setEnd] = useState(dates.at(-1)), [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="date-dialog" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}><form onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); const first = values.get('start'); try { onApply(dateRange(first, multi ? values.get('end') : first)); } catch (problem) { setError(problem.message); } }}>
    <div className="dialog-heading"><h2>选择日期</h2><IconButton label="关闭日期选择" onClick={onClose}><XIcon /></IconButton></div>
    <div className="segmented"><button type="button" className={!multi ? 'selected' : ''} onClick={() => setMulti(false)}>单天</button><button type="button" className={multi ? 'selected' : ''} onClick={() => setMulti(true)}>多天</button></div>
    <label>{multi ? '开始日期' : '日期'}<input type="date" name="start" required value={start} onChange={event => { setStart(event.target.value); setError(''); }} /></label>
    {multi ? <label>结束日期<input type="date" name="end" required min={start} value={end} onChange={event => { setEnd(event.target.value); setError(''); }} /></label> : null}
    <p className="muted">更换日期不会删除已经填写的草稿。</p>{error ? <p className="error" role="alert">{error}</p> : null}
    <div className="dialog-footer"><button type="button" onClick={onClose}>取消</button><button className="primary" type="submit">应用日期</button></div>
  </form></dialog>;
}
export function Photo({ photo, onRemove, onReorder, previous, next, eventId, onTransfer }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, objectUrl;
    setUrl(''); setError('');
    (async () => {
      const blob = photo.file || await fetch(photo.source || photo.originalSource).then(response => { if (!response.ok) throw Error('图片暂时无法读取；原文件已保留。'); return response.blob(); });
      const result = await previewBlob(blob, photo.name);
      if (!cancelled) { objectUrl = URL.createObjectURL(result); setUrl(objectUrl); }
    })().catch(problem => { if (!cancelled) setError(problem.message); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.file, photo.source, photo.originalSource, photo.name, attempt]);
  return <div className="photo-frame" draggable={Boolean(onReorder)} title={onReorder ? '拖拽调整图片顺序' : undefined}
    onDragStart={input => { if (!onReorder) return; input.dataTransfer.setData(photoDragType, JSON.stringify({ eventId, photoId: photo.id })); input.dataTransfer.effectAllowed = 'move'; }}
    onDragOver={input => { if (onReorder && input.dataTransfer.types.includes(photoDragType)) { input.preventDefault(); input.dataTransfer.dropEffect = 'move'; } }}
    onDrop={input => { if (!onReorder || !input.dataTransfer.types.includes(photoDragType)) return; input.preventDefault(); input.stopPropagation(); try { const source = JSON.parse(input.dataTransfer.getData(photoDragType)); if (source.eventId === eventId) onReorder(source.photoId, photo.id); else onTransfer?.(source.eventId, source.photoId); } catch {} }}>
    {url ? <PosterPreview className="photo-preview" src={url} alt={photo.name} label={`查看原图：${photo.name}`} /> : error ? <div className="photo-decode-state" role="status"><span>无法预览</span><button onClick={() => setAttempt(value => value + 1)} title={error}>重试</button></div> : <span className="photo-decode-state" role="status">正在读取图片…</span>}
    {onRemove ? <button className="remove-photo" aria-label={`移除图片：${photo.name}`} onClick={onRemove}><XIcon size={16} weight="bold" /></button> : null}
    {onReorder ? <div className="photo-order"><button disabled={!previous} aria-label={`向前移动图片：${photo.name}`} onClick={() => onReorder(photo.id, previous)}>←</button><button disabled={!next} aria-label={`向后移动图片：${photo.name}`} onClick={() => onReorder(photo.id, next)}>→</button></div> : null}
  </div>;
}
export function EventRow({ event, index, total, onChange, onMove, onDelete, onError, onTransferPhoto }) {
  const upload = useRef(null), text = useRef(null);
  useEffect(() => {
    const field = text.current;
    if (!field) return;
    let previousWidth = field.getBoundingClientRect().width;
    const fit = () => { field.style.height = '0px'; field.style.height = `${Math.max(60, field.scrollHeight + 2)}px`; };
    const observer = new ResizeObserver(() => { const width = field.getBoundingClientRect().width; if (width !== previousWidth) { previousWidth = width; fit(); } });
    fit(); observer.observe(field);
    return () => observer.disconnect();
  }, [event.text]);
  function addPhotos(files) {
    const selected = Array.from(files || []), images = selected.filter(isImageFile);
    if (images.length !== selected.length) onError('仅添加了图片文件，其他文件未上传。');
    if (images.length) { const added = images.map(file => ({ id: id(), name: file.name || '粘贴图片.png', file })); onChange(current => ({ ...current, photos: [...current.photos, ...added] })); }
    upload.current.value = '';
  }
  function dropPhotos(input) {
    if (input.dataTransfer.types.includes(photoDragType)) {
      input.preventDefault();
      try { const source = JSON.parse(input.dataTransfer.getData(photoDragType)); onTransferPhoto?.(source.eventId, source.photoId); } catch {}
    } else if (input.dataTransfer.files.length) { input.preventDefault(); addPhotos(input.dataTransfer.files); }
  }
  return <article className="event-row"><div className="event-rail"><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div className="event-content">
    <div className="event-actions"><IconButton label={`上移事件 ${index + 1}`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUpIcon /></IconButton><IconButton label={`下移事件 ${index + 1}`} disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDownIcon /></IconButton><IconButton label={`删除事件 ${index + 1}`} onClick={onDelete}><TrashIcon /></IconButton></div>
    {event.unassigned ? <p className="muted">待关联图片 · 拖入对应事件</p> : null}
    <label className="sr-only" htmlFor={`event-${event.id}`}>事件 {index + 1} 的内容</label><textarea ref={text} id={`event-${event.id}`} placeholder="写下这件事，图片可选…" value={event.text} onPaste={input => { const images = clipboardImages(input.clipboardData); if (images.length) { input.preventDefault(); addPhotos(images); } }} onChange={input => onChange({ ...event, text: input.target.value })} />
    <div className="photo-list" onDragOver={input => { if (input.dataTransfer.types.includes('Files') || input.dataTransfer.types.includes(photoDragType)) input.preventDefault(); }} onDrop={dropPhotos}><button className="upload-button" title="支持选择多张图片；选中本事件输入框后可用 ⌘V / Ctrl+V 粘贴图片" aria-label={`事件 ${index + 1} 添加图片`} onClick={() => upload.current.click()}><PlusIcon size={24} /><span>添加图片</span></button>{event.photos.map((photo, position) => <Photo key={photo.id} photo={photo} eventId={event.id} onTransfer={onTransferPhoto} previous={event.photos[position - 1]?.id} next={event.photos[position + 1]?.id} onReorder={(source, target) => onChange(current => ({ ...current, photos: reorderPhotos(current.photos, source, target) }))} onRemove={() => onChange(current => ({ ...current, photos: current.photos.filter(item => item.id !== photo.id) }))} />)}<input ref={upload} type="file" accept={imageAccept} multiple hidden aria-label={`事件 ${index + 1} 上传图片`} onChange={input => addPhotos(input.target.files)} /></div>
  </div></article>;
}
