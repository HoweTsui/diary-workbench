import { useEffect, useMemo, useRef, useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { BookOpenIcon } from '@phosphor-icons/react/dist/csr/BookOpen';
import { GraphIcon } from '@phosphor-icons/react/dist/csr/Graph';
import { ArrowLeftIcon, ArrowRightIcon, CaretLeftIcon, CheckIcon, DateDialog, DateStrip, EventRow, PlusIcon, Stepper } from './controls.jsx';
import { blankDraft, dayInputKey, dateLabel, hasRecord, moveEvent, newEvent, previewSummary, seedDraft, selectDates, shiftDate, weekDates, workspaceDraft, unchangedHistory } from './model.mjs';
import { localToday } from './activity.mjs';
import { loadDraft, saveDraft } from './storage.mjs';
import { Review } from './Review.jsx';
import { ReviewActions } from './ReviewActions.jsx';
import { Archive } from './Archive.jsx';
import { HistoryPreview } from './HistoryPreview.jsx';
import { transferPhoto } from './photo-input.mjs';
import { Profile } from './Profile.jsx';
import { libraryLinks, loadCatalog } from './library.mjs';
import { useDiaryJobs } from './useDiaryJobs.jsx';
import { installSiteTools } from './site-tools.mjs';
const routeView = () => ['profile', 'review', 'archive'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'input';
export function App() {
  const [draft, setDraft] = useState(null), [view, setView] = useState(routeView), [calendar, setCalendar] = useState(false), [saved, setSaved] = useState('正在读取草稿…'), [notice, setNotice] = useState('');
  const [catalog, setCatalog] = useState(null), [catalogLoading, setCatalogLoading] = useState(true), [catalogError, setCatalogError] = useState(false);
  const [record, setRecord] = useState(null), [recordLoading, setRecordLoading] = useState(false), [libraryRevision, setLibraryRevision] = useState(0);
  const [editingDate, setEditingDate] = useState(null);
  const [confirmationHost, setConfirmationHost] = useState(null);
  const revision = useRef(0), pendingEvent = useRef(null), footer = useRef(null);
  const execution = useDiaryJobs(setNotice, job => {
    loadCatalog().then(setCatalog).catch(() => setCatalogError(true));
    setDraft(previous => previous && dayInputKey(previous, job.date) === job.inputKey ? { ...previous, importedDates: { ...previous.importedDates, [job.date]: job.inputKey } } : previous);
    setLibraryRevision(value => value + 1);
  });
  const recordedDates = useMemo(() => new Set((catalog?.entries || []).filter(entry => !entry.isBlank).map(entry => entry.date)), [catalog]);
  const writingDates = useMemo(() => new Set(Object.keys(draft?.days || {}).filter(date => hasRecord(draft.days[date]) && !unchangedHistory(draft, date))), [draft]);
  useEffect(() => {
    installSiteTools({
      handoff: async taskId => {
        const job = execution.jobs.find(job => job.id === taskId);
        if (!job) throw Error('此任务不在当前日记库。');
        return execution.handoff(job);
      },
      read: () => ({ view, days: draft ? previewSummary(draft).days.map(day => ({ date: day.date, events: day.events.map(event => ({ text: event.text, photos: event.photos.length })) })) : [], jobs: execution.jobs, archiveTarget: execution.session?.mode || 'not-connected' }),
      generate: async date => {
        if (!draft || !previewSummary(draft).days.some(day => day.date === date)) throw Error('此日期没有填写内容。');
        if (!execution.session?.skillAvailable) throw Error('本地执行器尚未连接。');
        const result = await execution.generate(draft, [date]);
        return { date, status: result.error ? 'not-started' : 'submitted', ...result, message: result.error || '请通过任务状态核对实际结果，尚未归档。' };
      },
    });
  }, [draft, view, execution]);
  useEffect(() => {
    const update = () => { setView(routeView()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadDraft().catch(() => null), loadCatalog(controller.signal)])
      .then(([savedDraft, value]) => {
        setCatalog(value); setCatalogLoading(false);
        // Old test drafts remain backed up, not silently promoted into the Wiki.
        let next = value.workspace ? workspaceDraft(savedDraft, value.workspace.id, localToday()) : savedDraft?.version === 1 ? savedDraft : seedDraft();
        const requested = new URLSearchParams(window.location.search).get('date');
        if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && Number.isFinite(Date.parse(requested))) next = { ...selectDates(next, next.dates.includes(requested) ? next.dates : [...next.dates, requested].sort()), activeDate: requested };
        setDraft(next);
      })
      .catch(error => { if (error.name !== 'AbortError') { setCatalogError(true); setCatalogLoading(false); loadDraft().then(value => setDraft(value?.version === 1 ? value : blankDraft(localToday()))); setNotice('日记库暂时无法读取，请检查本地连接；草稿不会删除。'); } });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!draft || !catalog?.workspace) return;
    const date = draft.activeDate, controller = new AbortController();
    setRecordLoading(true);
    fetch(`/api/diary/records/${date}`, { signal: controller.signal, cache: 'no-store' }).then(response => { if (!response.ok) throw Error('当天日记读取失败'); return response.json(); }).then(value => {
      setRecord(value); setRecordLoading(false);
      if (value.exists && value.events.length) setDraft(previous => {
        if (previous.activeDate !== date || (hasRecord(previous.days[date]) && !unchangedHistory(previous, date))) return previous;
        const next = { ...previous, days: { ...previous.days, [date]: value.events } };
        return { ...next, importedDates: { ...next.importedDates, [date]: dayInputKey(next, date) } };
      });
    }).catch(error => { if (error.name !== 'AbortError') { setRecordLoading(false); setNotice('当天记录暂时无法读取，请重试；未改动原文件。'); } });
    return () => controller.abort();
  }, [draft?.activeDate, catalog?.workspace?.id, libraryRevision]);
  useEffect(() => {
    if (!draft) return;
    const current = ++revision.current; setSaved('正在保存…');
    const timer = setTimeout(() => saveDraft(draft).then(() => { if (revision.current === current) setSaved('草稿已保存'); }).catch(() => { if (revision.current === current) { setSaved('保存失败'); setNotice('草稿保存失败，请保留当前页面后重试。'); } }), 250);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    if (!footer.current) return;
    const update = () => document.documentElement.style.setProperty('--footer-height', `${Math.ceil(footer.current.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(update);
    observer.observe(footer.current); update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--footer-height'); };
  }, [view, Boolean(draft)]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    if (!pendingEvent.current) return;
    const field = document.getElementById(`event-${pendingEvent.current}`);
    if (field) { pendingEvent.current = null; field.focus({ preventScroll: true }); field.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  }, [draft]);
  if (!draft) return <main className="workbench"><p className="muted">正在读取草稿…</p></main>;
  const events = draft.days[draft.activeDate] || [];
  const dates = weekDates(draft.activeDate), preview = previewSummary(draft);
  const readOnlyHistory = view === 'input' && recordedDates.has(draft.activeDate) && editingDate !== draft.activeDate;
  function beginEdit(date) { chooseDate(date); setEditingDate(date); navigate('input'); }
  function navigate(next) { if (next === 'profile') setEditingDate(null); setView(next); window.location.hash = next === 'input' ? '' : next; window.scrollTo(0, 0); }
  function chooseDate(date) { setEditingDate(null); setDraft(previous => ({ ...selectDates(previous, previous.dates.includes(date) ? previous.dates : [...previous.dates, date].sort()), activeDate: date })); }
  function updateEvents(change) { if (readOnlyHistory) return; setDraft(previous => ({ ...previous, days: { ...previous.days, [previous.activeDate]: change(previous.days[previous.activeDate] || []) } })); }
  function addEvent() { const event = newEvent(); pendingEvent.current = event.id; updateEvents(rows => [...rows, event]); }
  function shiftDates(direction) {
    setEditingDate(null);
    setDraft(previous => { const date = shiftDate(previous.activeDate, direction * 7); return { ...selectDates(previous, weekDates(date)), activeDate: date }; });
  }
  function openReview() { if (!preview.dayCount && !recordedDates.has(draft.activeDate)) { setNotice('先记录一件事或添加一张图片。'); return; } navigate('review'); }
  async function openLibrary(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = event.currentTarget.href;
    try { await saveDraft(draft); window.location.assign(href); }
    catch { setSaved('保存失败'); setNotice('未能保存最新草稿，暂未离开工作台，请重试。'); }
  }
  return <>{view === 'profile' ? <Profile draft={draft} catalog={catalog} loading={catalogLoading} error={catalogError} onOpenLibrary={openLibrary} onBack={() => navigate('input')} onEditDate={beginEdit} /> : <><main className="workbench">{view === 'review' || view === 'archive' ? <nav className="review-navigation" aria-label="返回上一步"><button onClick={() => view === 'archive' ? navigate('review') : beginEdit(draft.activeDate)}><CaretLeftIcon size={18} />{view === 'archive' ? '返回预览' : '返回编辑'}</button></nav> : null}<header className="app-header"><h1>日记工作台</h1><div className="header-right"><Stepper step={view === 'archive' ? 2 : view === 'input' && !readOnlyHistory ? 0 : 1} /><button className="profile-button" aria-label="个人资料" title="个人资料" onClick={() => navigate('profile')}><ProfileAvatar catalog={catalog} /></button></div></header>
    <DateStrip dates={dates} days={draft.days} recordedDates={recordedDates} writingDates={writingDates} activeDate={draft.activeDate} onSelect={chooseDate} onEdit={() => setCalendar(true)} onShift={shiftDates} />
    {view === 'archive' ? <Archive draft={draft} execution={execution} onReview={() => navigate('review')} /> : readOnlyHistory ? <HistoryPreview date={draft.activeDate} record={record?.date === draft.activeDate ? record : null} loading={recordLoading} onEdit={() => beginEdit(draft.activeDate)} draftEvents={!unchangedHistory(draft, draft.activeDate) && hasRecord(draft.days[draft.activeDate])} /> : view === 'input' ? <section className="editor" aria-label={`${dateLabel(draft.activeDate)}的记录`}><div className="editor-heading"><h2>{dateLabel(draft.activeDate)}的记录</h2>{recordedDates.has(draft.activeDate) ? <button onClick={() => setEditingDate(null)}>返回预览</button> : <p>一件事写一次，图片可选。</p>}</div>{recordLoading ? <p className="muted" role="status">正在读取当天记录…</p> : null}<div className="events">{events.map((event, index) => <EventRow key={event.id} event={event} index={index} total={events.length} onError={setNotice} onTransferPhoto={(sourceId, photoId) => updateEvents(rows => transferPhoto(rows, sourceId, photoId, event.id))} onChange={changed => updateEvents(rows => rows.map(row => row.id === event.id ? typeof changed === 'function' ? changed(row) : changed : row))} onMove={offset => updateEvents(rows => moveEvent(rows, index, offset))} onDelete={() => updateEvents(rows => rows.length === 1 ? [newEvent()] : rows.filter(row => row.id !== event.id))} />)}</div></section> : <Review draft={draft} execution={execution} catalog={catalog} catalogLoading={catalogLoading || recordLoading} record={record?.date === draft.activeDate ? record : null} onEdit={beginEdit} />}
  </main><footer ref={footer} className={`footer${view === 'input' && !readOnlyHistory ? ' has-add-event' : ''}`}><div className="footer-content"><div ref={setConfirmationHost} className="footer-confirmation" />{view === 'input' && !readOnlyHistory ? <div className="add-event-bar"><button className="add-event" onClick={addEvent}><PlusIcon size={21} />添加事件</button></div> : null}<div className="footer-inner"><nav className="workspace-links" aria-label="日记资料入口"><a href={libraryLinks.book} onClick={openLibrary}><BookOpenIcon size={17} />3D 日记本</a><a href={libraryLinks.graph} onClick={openLibrary}><GraphIcon size={17} />人物关系图谱</a></nav><div className="footer-controls"><span className="save-status" role="status"><span><CheckIcon size={19} /></span>{saved}</span>{view === 'archive' ? <button className="primary" onClick={() => navigate('input')}>继续写日记<ArrowRightIcon size={20} /></button> : readOnlyHistory ? <button className="primary" disabled={recordLoading || record?.date !== draft.activeDate} onClick={() => beginEdit(draft.activeDate)}>编辑日记<ArrowRightIcon size={20} /></button> : view === 'input' ? <button className="primary preview-button" onClick={openReview} disabled={!preview.dayCount && !recordedDates.has(draft.activeDate)} title={preview.days.map(day => `${dateLabel(day.date)}：${day.events.length} 件事`).join('；')}>{preview.label}<ArrowRightIcon size={20} /></button> : <div className="footer-actions"><ReviewActions draft={draft} preview={preview} execution={execution} catalogError={catalogError} confirmationHost={confirmationHost} onArchived={() => navigate('archive')} /></div>}</div></div></div></footer></>}
    {notice ? <div className="toast" role="status">{notice}</div> : null}{calendar ? <DateDialog dates={draft.dates} onClose={() => setCalendar(false)} onApply={dates => { setEditingDate(null); setDraft(previous => selectDates(previous, dates)); setCalendar(false); }} /> : null}
  </>;
}
