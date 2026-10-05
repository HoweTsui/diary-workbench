import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { dayInputKey } from './model.mjs';
import { GeneratePreviewButton } from './GeneratePreviewButton.jsx';

export function currentReviewJob(draft, jobs) {
  return jobs.find(job => job.date === draft.activeDate && job.inputKey === dayInputKey(draft, draft.activeDate));
}

function ReadyActions({ job, execution, onArchived, confirmationHost }) {
  const [approved, setApproved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const roles = job.characters.filter(character => character.requiresApproval);
  const busy = saving || job.status === 'archiving';
  const archived = job.status === 'archived';
  async function confirm() {
    if (archived) return onArchived();
    setSaving(true); setError('');
    try {
      const result = await execution.action(job, 'confirm', { inputKey: job.inputKey, approvedCharacters: approved });
      if (result?.status === 'archived') onArchived();
      else setError('保存未完成，请重试。');
    } finally { setSaving(false); }
  }
  return <>
    {!archived && roles.length && confirmationHost ? createPortal(<fieldset className="identity-confirmation"><legend>确认本次角色</legend><div className="identity-names">{roles.map(character => <label key={character.id}><input type="checkbox" disabled={busy} checked={approved.includes(character.id)} onChange={event => setApproved(previous => event.target.checked ? [...previous, character.id] : previous.filter(id => id !== character.id))} />{character.name}</label>)}</div></fieldset>, confirmationHost) : null}
    <div className="generation-control">{error ? <span role="alert">{error}</span> : null}<button className="primary" disabled={busy || (!archived && roles.some(role => !approved.includes(role.id)))} aria-busy={busy} onClick={confirm}>{busy ? '正在归档…' : archived ? '查看归档' : '确认并归档'}{!busy ? <ArrowRightIcon size={18} /> : null}</button></div>
  </>;
}

export function ReviewActions({ draft, preview, execution, catalogError, onArchived, confirmationHost }) {
  const job = currentReviewJob(draft, execution.jobs);
  if (job?.posterUrl && ['ready', 'archiving', 'archived'].includes(job.status)) return <ReadyActions key={job.id} job={job} execution={execution} onArchived={onArchived} confirmationHost={confirmationHost} />;
  return <GeneratePreviewButton draft={draft} preview={preview} execution={execution} catalogError={catalogError} />;
}
