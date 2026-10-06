import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { dayInputKey } from './model.mjs';
import { GeneratePreviewButton } from './GeneratePreviewButton.jsx';

export function currentReviewJob(draft, jobs) {
  return jobs.find(job => job.date === draft.activeDate && job.inputKey === dayInputKey(draft, draft.activeDate));
}

export function ReadyActions({ job, execution, onArchived, confirmationHost }) {
  const [approved, setApproved] = useState([]);
  const [relations, setRelations] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const roles = job.characters.filter(character => character.requiresApproval || character.requiresRelationship);
  const pending = roles.some(c => (c.requiresApproval && !approved.includes(c.id)) || (c.requiresRelationship && !relations[c.id]?.trim()));
  const busy = saving || job.status === 'archiving';
  const archived = job.status === 'archived';
  async function confirm() {
    if (archived) return onArchived();
    setSaving(true); setError('');
    try {
      const relationships = roles.filter(c => c.requiresRelationship).map(c => ({ id: c.id, status: relations[c.id] === '暂不确定' ? 'unknown' : 'confirmed', label: relations[c.id] === '暂不确定' ? '' : relations[c.id] }));
      const result = await execution.action(job, 'confirm', { inputKey: job.inputKey, approvedCharacters: approved, relationships });
      if (result?.status === 'archived') onArchived();
      else setError('保存未完成，请重试。');
    } catch (failure) { setError(failure.message || '保存未完成，请重试。'); } finally { setSaving(false); }
  }
  return <>
    {!archived && roles.length && confirmationHost ? createPortal(<fieldset className="identity-confirmation"><legend>确认本次角色与关系</legend><div className="identity-names">{roles.map(character => <div className="identity-review-row" key={character.id}>
      {character.avatarUrl ? <img src={character.avatarUrl} alt={`${character.name}的独立头像`} width="64" height="64" style={{ objectFit: 'contain', objectPosition: 'center' }} /> : null}
      <div>{character.requiresApproval ? <label><input type="checkbox" disabled={busy} checked={approved.includes(character.id)} onChange={event => setApproved(previous => event.target.checked ? [...previous, character.id] : previous.filter(id => id !== character.id))} />{character.name}{character.id === job.protagonistId ? '（日记主角）' : ''}</label> : <span>{character.name}</span>}
      {character.requiresRelationship ? <label className="relationship-input">{character.name}是主角的<input list={`relationships-${character.id}`} aria-label={`${character.name}与主角的关系`} placeholder="例如：弟弟、朋友；或暂不确定" maxLength={40} value={relations[character.id] || ''} disabled={busy} onChange={event => setRelations(previous => ({ ...previous, [character.id]: event.target.value }))} /><datalist id={`relationships-${character.id}`}>{['爸爸', '妈妈', '奶奶', '弟弟', '妹妹', '朋友', '伴侣', '家猫', '家犬', '朋友的宠物', '暂不确定'].map(value => <option key={value} value={value} />)}</datalist></label> : null}</div>
    </div>)}</div><small>已存在的角色自动复用；暂不确定的关系保留待补充，不自动连线。</small></fieldset>, confirmationHost) : null}
    <div className="generation-control">{error ? <span role="alert">{error}</span> : null}<button className="primary" disabled={busy || (!archived && pending)} aria-busy={busy} onClick={confirm}>{busy ? '正在归档…' : archived ? '查看归档' : '确认并归档'}{!busy ? <ArrowRightIcon size={18} /> : null}</button></div>
  </>;
}

export function ReviewActions({ draft, preview, execution, catalogError, onArchived, confirmationHost }) {
  const job = currentReviewJob(draft, execution.jobs);
  if (job?.posterUrl && ['ready', 'archiving', 'archived'].includes(job.status)) return <ReadyActions key={job.id} job={job} execution={execution} onArchived={onArchived} confirmationHost={confirmationHost} />;
  return <GeneratePreviewButton draft={draft} preview={preview} execution={execution} catalogError={catalogError} />;
}
