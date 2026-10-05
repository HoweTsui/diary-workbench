import { useRef, useState } from 'react';
import { PosterPreview } from './PosterPreview.jsx';
import { BookOpenIcon } from '@phosphor-icons/react/dist/csr/BookOpen';
import { dateLabel, photoCount, reviewDay, unchangedHistory } from './model.mjs';
import { Photo, PlusIcon } from './controls.jsx';
import { busyStates, dayInputKey, generationStatus } from './jobs.mjs';
import { dataUrl } from './storage.mjs';
import { libraryLinks } from './library.mjs';
import { imageAccept, imageMime } from './image-formats.mjs';

function IdentitySources({ job, stale, inputKey, onAction }) {
  const uploadInput = useRef(null);
  const [selectedId, setSelectedId] = useState(job.identityContext.length === 1 ? job.identityContext[0].id : '');
  const [sources, setSources] = useState({}), [descriptions, setDescriptions] = useState({}), [sending, setSending] = useState(false), [error, setError] = useState('');
  const character = job.identityContext.find(item => item.id === selectedId), photo = sources[selectedId];
  async function upload(character, file) {
    if (!file) return;
    setError('');
    try { const type = imageMime(file), original = await dataUrl(file.type === type ? file : file.slice(0, file.size, type)); setSources(previous => ({ ...previous, [character.id]: { name: file.name, type, original } })); }
    catch { setError('照片无法读取，请换一张。'); }
  }
  async function retry() {
    setSending(true);
    try { await onAction(job, 'retry', { inputKey, identitySources: Object.entries(sources).map(([id, photo]) => ({ id, photo, description: descriptions[id] || '' })) }); }
    finally { setSending(false); }
  }
  return <div className="identity-supplement"><h4>补充角色照片</h4>
    <div className="identity-source-controls"><label><span className="sr-only">选择角色</span><select value={selectedId} disabled={sending || stale} onChange={event => setSelectedId(event.target.value)}><option value="">选择角色</option>{job.identityContext.map(item => <option key={item.id} value={item.id}>{item.name}{sources[item.id] ? ' · 已添加' : ''}</option>)}</select></label><span className="muted">仅用于识别角色</span></div>
    <div className="identity-source-photo"><button className="upload-button" disabled={!character || sending || stale} onClick={() => uploadInput.current.click()} aria-label={character ? `添加${character.name}的照片` : '先选择角色再添加照片'}><PlusIcon size={24} /><span>{photo ? '更换照片' : '添加照片'}</span></button>{photo ? <Photo photo={{ name: photo.name, source: photo.original }} /> : null}<input ref={uploadInput} type="file" accept={imageAccept} hidden aria-label="选择角色照片文件" onChange={event => { if (character) upload(character, event.target.files[0]); event.target.value = ''; }} /></div>
    {photo ? <details className="identity-position"><summary>合照位置（选填）</summary><input aria-label={`${character.name}在照片中的位置`} placeholder="如：左侧戴眼镜的人" value={descriptions[selectedId] || ''} onChange={event => setDescriptions(previous => ({ ...previous, [selectedId]: event.target.value }))} /></details> : null}
    {error ? <p className="job-error" role="alert">{error}</p> : null}<button className="primary" disabled={stale || sending || !Object.keys(sources).length} onClick={retry}>{sending ? '正在提交…' : '继续生成'}</button>
  </div>;
}

function PendingRequest({ job, onAction }) {
  const [answers, setAnswers] = useState({});
  const pending = job.pending;
  if (!pending) return null;
  const asking = pending.method.endsWith('requestUserInput');
  return <details className="job-request"><summary>{asking ? '补充信息' : '需要你的确认'}</summary><div className="job-request-content">{asking ? pending.questions.map(question => <label key={question.id}>{question.question}
    {question.options?.length ? <select value={answers[question.id] || ''} onChange={e => setAnswers(previous => ({ ...previous, [question.id]: e.target.value }))}><option value="">请选择</option>{question.options.map(option => <option key={option.label} value={option.label}>{option.label} — {option.description}</option>)}</select> : null}
    <input aria-label={`${question.header || question.id}补充回答`} value={answers[question.id] || ''} onChange={e => setAnswers(previous => ({ ...previous, [question.id]: e.target.value }))} placeholder="也可以直接输入回答" />
  </label>) : <pre>{pending.detail}</pre>}<div className="job-actions">{asking ? <button className="primary" disabled={pending.questions.some(q => !answers[q.id]?.trim())} onClick={() => onAction(job, 'respond', { pendingId: pending.id, answers: Object.fromEntries(pending.questions.map(q => [q.id, [answers[q.id]]])) })}>提交回答</button> : <><button onClick={() => onAction(job, 'respond', { pendingId: pending.id, decision: 'decline' })}>拒绝</button><button className="primary" onClick={() => onAction(job, 'respond', { pendingId: pending.id, decision: 'accept' })}>仅批准本次</button></>}</div></div></details>;
}
function JobPreview({ job, stale, inputKey, onAction }) {
  const finalPoster = !stale && ['ready', 'archiving', 'archived'].includes(job.status) && job.posterUrl;
  const statusText = stale ? '内容已更新，请重新生成。' : generationStatus(job) || ( job.status === 'queued' ? '等待生成…' : job.status === 'waiting' ? '需要你确认后继续。' : job.status === 'archiving' ? '正在保存…' : busyStates.has(job.status) ? '正在生成…' : job.status === 'needs_input' ? '补充角色照片后继续。' : job.status === 'cancelled' ? '已取消生成。' : job.status === 'archived' ? job.archive?.mode === 'obsidian' ? '已保存，并同步日记本。' : '已存入测试库。' : '海报暂未生成，请重试。');
  return <div className={`job-preview${finalPoster ? ' has-poster' : ''}`}>{!finalPoster || job.status !== 'ready' ? <p className="job-state muted" role="status">{statusText}</p> : null}
    {!stale && job.pending ? <PendingRequest key={job.pending.id} job={job} onAction={onAction} /> : null}
    {!stale && job.status === 'needs_input' && job.identityContext?.length ? <IdentitySources job={job} stale={stale} inputKey={inputKey} onAction={onAction} /> : null}
    {finalPoster ? <PosterPreview src={job.posterUrl} alt={`${dateLabel(job.date)}成品海报`} label="查看完整海报" /> : null}
    <div className="job-actions">{busyStates.has(job.status) && job.status !== 'archiving' ? <button onClick={() => onAction(job, 'cancel')}>取消此日期任务</button> : null}
      {job.archive ? <><a href={job.archive.noteUrl}>查看此日日记</a><a href={job.archive.bookUrl}>在3D日记本中查看</a></> : null}
    </div>
  </div>;
}
export function Review({ draft, onEdit, execution, catalog, catalogLoading = false, record }) {
  const { date, events } = reviewDay(draft);
  const key = dayInputKey(draft, date), job = execution.jobs.find(j => j.date === date && j.inputKey === key) || execution.jobs.find(j => j.date === date);
  // A saved poster is a fallback only when there is no new draft to confuse it with.
  const currentAttempt = job?.inputKey === key && !['archived', 'cancelled', 'interrupted'].includes(job.status);
  const archivedEntry = !currentAttempt && (!events.length || unchangedHistory(draft, date)) ? catalog?.entries?.find(entry => entry.date === date && !entry.isBlank) : null;
  const hasContent = Boolean(events.length || archivedEntry || record?.exists);
  return <section className="review"><h2>日记预览</h2>
    {execution.loading ? <p className="muted" role="status">正在连接…</p> : !execution.session ? <p className="muted" role="status">暂时无法生成，可返回继续填写。</p> : null}
    {execution.error ? <p className="job-error" role="alert">暂时无法完成操作，请重试。</p> : null}
    <section className="review-day" key={date} aria-label={`${dateLabel(date)}的日记预览`}><div className="review-heading"><div><h3>{dateLabel(date)}</h3>{hasContent ? <p className="muted">{archivedEntry ? archivedEntry.approval === 'draft' ? '已有海报 · 预览稿' : archivedEntry.posterSrc ? '已有日记' : '已有正文 · 尚无海报' : `${events.length} 件事 · ${photoCount(events)} 张图片`}</p> : null}</div>{hasContent && events.length && (job || archivedEntry?.posterSrc) ? <div className="job-actions"><button disabled={!execution.session?.skillAvailable || execution.submitting || catalogLoading || (job && busyStates.has(job.status))} onClick={() => job && job.inputKey === key && !busyStates.has(job.status) ? execution.action(job, 'retry', { inputKey: key }) : execution.generate(draft, [date], true)}>重新生成当天</button></div> : null}</div>
      {archivedEntry ? <>
        {archivedEntry.posterSrc ? <PosterPreview src={record?.posterUrl || libraryLinks.asset(archivedEntry.posterSrc)} alt={`${dateLabel(date)}已有海报`} label="查看已有的完整海报" /> : <p className="muted">这一天还没有海报。</p>}
        {record ? <details><summary>查看事件与图片</summary>{record.events.map((event, index) => <article className="history-event" key={event.id}><h3>{event.unassigned ? '待关联图片' : `事件 ${index + 1}`}</h3>{event.text ? <p className="event-text">{event.text}</p> : null}{event.photos.length ? <div className="photo-list">{event.photos.map(photo => <Photo key={photo.id} photo={photo} />)}</div> : null}</article>)}</details> : null}
        {archivedEntry.noteUrl ? <div className="job-actions"><a href={archivedEntry.noteUrl}>查看完整日记</a><a href={archivedEntry.bookHref || libraryLinks.book}>在3D日记本中查看</a></div> : null}
      </> : events.length ? <>
        {job ? <JobPreview key={job.id} job={job} inputKey={key} stale={job.inputKey !== key} onAction={execution.action} /> : <div className="job-preview"><p className="job-state muted">还没有生成海报。</p></div>}
        <details><summary>查看填写内容</summary>{events.map((event, index) => <article className="review-event" key={event.id}><span className="muted">{String(index + 1).padStart(2, '0')}</span><div><p className="event-text">{event.text || '仅图片记录'}</p>{event.photos.length ? <div className="photo-list">{event.photos.map(photo => <Photo key={photo.id} photo={photo} />)}</div> : null}</div></article>)}</details>
      </> : <div className="review-empty" role="status"><span className="review-empty-icon"><BookOpenIcon size={28} /></span><h3>{catalogLoading ? '正在读取日记…' : '这一天还没有记录'}</h3>{!catalogLoading ? <><p className="muted">写下一件事，或添加一张照片。</p><button onClick={() => onEdit(date)}>去填写</button></> : null}</div>}
    </section>
  </section>;
}
