import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { activeGeneration, generationStatus } from './jobs.mjs';
import { ChatHandoff } from './ChatHandoff.jsx';

export function GeneratePreviewButton({ draft, preview, execution, catalogError }) {
  const dates = preview.days.map(day => day.date);
  const active = activeGeneration(execution.jobs, [...dates, draft.activeDate]);
  const busy = execution.submitting || Boolean(active);
  if (active?.status === 'awaiting_chat') return <ChatHandoff job={active} execution={execution} />;
  const label = execution.submitting ? '正在提交…' : active ? active.status === 'waiting' ? '等待你的确认' : active.phase === 'reconnecting' ? '连接重试中…' : '生成中…' : preview.dayCount ? `生成 ${preview.dayCount} 天海报预览` : '生成海报预览';
  return <div className="generation-control">
    {busy ? <span className="generation-status" role="status">{execution.submitting ? '正在提交日记' : `${active.date.slice(5).replace('-', '/')} · ${generationStatus(active)}`}</span> : null}
    <button className="primary" aria-busy={busy} disabled={busy || !preview.dayCount || !execution.session?.skillAvailable || catalogError} onClick={() => execution.generate(draft, dates)}>
      {busy ? <span className="generation-spinner" aria-hidden="true" /> : null}{label}{!busy ? <ArrowRightIcon size={18} /> : null}
    </button>
  </div>;
}
