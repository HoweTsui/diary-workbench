import { useCallback, useEffect, useRef, useState } from 'react';
import { busyStates, dayInputKey, diaryRequest } from './jobs.mjs';
import { serializeDay } from './storage.mjs';

export function useDiaryJobs(onError, onArchived) {
  const [session, setSession] = useState(null), [jobs, setJobs] = useState([]), [loading, setLoading] = useState(true), [submitting, setSubmitting] = useState(false), [error, setError] = useState('');
  const token = useRef(''), submittingNow = useRef(false);
  const update = useCallback(job => setJobs(previous => [job, ...previous.filter(j => j.id !== job.id)]), []);
  useEffect(() => {
    let alive = true;
    diaryRequest('/api/diary/session').then(value => { if (alive) { token.current = value.token; setSession(value); setJobs(value.jobs); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const busy = jobs.some(job => busyStates.has(job.status));
  useEffect(() => {
    if (!session || !busy) return;
    let alive = true, timer;
    const poll = async () => {
      try { const data = await diaryRequest('/api/diary/jobs'); if (alive) { setJobs(data.jobs); setError(''); } }
      catch(e) { if (alive) setError(e.message); }
      if (alive) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1000);
    return () => { alive = false; clearTimeout(timer); };
  }, [session, busy]);
  async function generate(draft, dates, force = false) {
    if (submittingNow.current) return { jobs: [] };
    submittingNow.current = true;
    setSubmitting(true); setError('');
    const submitted = [];
    try {
      for (const date of dates) {
        const inputKey = dayInputKey(draft, date);
        const existing = jobs.find(job => job.date === date && job.inputKey === inputKey && (busyStates.has(job.status) || ['ready', 'archived'].includes(job.status)));
        if (existing && !force) { submitted.push(existing); continue; }
        const day = await serializeDay(draft, date);
        if (!day.events.length) continue;
        const job = await diaryRequest('/api/diary/jobs', token.current, { day, inputKey, force, executor: 'chat' });
        update(job); submitted.push(job);
      }
      if (submitted.some(job => job.status === 'awaiting_chat') && typeof window.openai?.sendFollowUpMessage === 'function') {
        const handoffs = await Promise.all(submitted.filter(job => job.status === 'awaiting_chat').map(job => diaryRequest(`/api/diary/jobs/${job.id}/handoff`)));
        // Optional host extension only. Never post to a guessed parent window.
        await window.openai.sendFollowUpMessage({ prompt: handoffs.map(h => h.prompt).join('\n\n') });
      }
      return { jobs: submitted };
    } catch(e) { setError(e.message); onError('暂时无法完成操作，请重试。'); return { jobs: submitted, error: e.message }; }
    finally { submittingNow.current = false; setSubmitting(false); }
  }
  async function action(job, name, body = {}) {
    try {
      const next = await diaryRequest(`/api/diary/jobs/${job.id}/${name}`, token.current, body); update(next);
      if (next.status === 'archived') onArchived(next);
      return next;
    } catch(e) { setError(e.message); onError('暂时无法完成操作，请重试。'); return null; }
  }
  async function handoff(job) { return diaryRequest(`/api/diary/jobs/${job.id}/handoff`); }
  return { session, jobs, loading, submitting, error, generate, action, handoff };
}
