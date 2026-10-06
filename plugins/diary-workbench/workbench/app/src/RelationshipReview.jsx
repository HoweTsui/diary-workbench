// Read-only component preview. Uses the production confirmation component and
// current catalogue; never calls a mutation endpoint or changes stored drafts.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReadyActions } from './ReviewActions.jsx';
import './styles.css';

function Preview() {
  const [host, setHost] = useState(null), [job, setJob] = useState(null), [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/diary/catalog').then(r => r.json()).then(catalog => {
    const narrator = catalog.characters.find(c => c.role === '日记主角');
    const people = catalog.characters.filter(c => c.id !== narrator?.id).slice(-3);
    setJob({ id: 'non-writing-component-preview', inputKey: 'preview', status: 'ready', protagonistId: narrator?.id,
      characters: people.map(c => ({ id: c.id, name: c.name, requiresApproval: true, requiresRelationship: true, avatarUrl: c.avatarSrc ? `/library/diary/${c.avatarSrc}` : null })) });
  }).catch(() => setMessage('无法读取角色目录。')); }, []);
  const execution = { action: async (_job, _action, payload) => {
    setMessage(`交互检查通过：${payload.relationships.map(r => `${job.characters.find(c => c.id === r.id).name}：${r.status === 'unknown' ? '暂不确定' : r.label}`).join('；')}。仅界面预览，未保存。`);
    return { status: 'archived' };
  } };
  return <main style={{ maxWidth: 920, margin: '32px auto', padding: '0 24px' }}>
    <a href="/">← 返回工作台</a><h1 style={{ marginTop: 24 }}>角色关系确认</h1>
    <p style={{ color: '#666', margin: '12px 0 24px' }}>界面预览 · 未保存。使用当前角色展示交互，不生成、不归档、不修改关系。</p>
    <div ref={setHost} />
    {job ? <ReadyActions job={job} execution={execution} confirmationHost={host} onArchived={() => {}} /> : null}
    {message ? <p role="status" style={{ marginTop: 24 }}>{message}</p> : null}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
