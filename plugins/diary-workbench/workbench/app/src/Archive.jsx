import { PosterPreview } from './PosterPreview.jsx';
import { dateLabel } from './model.mjs';

export function Archive({ draft, execution, onReview }) {
  const job = execution.jobs.find(item => item.date === draft.activeDate && item.status === 'archived');
  if (job?.status !== 'archived' || !job.archive) return <section className="review-empty"><h2>这一天尚未归档</h2><button onClick={onReview}>返回预览</button></section>;
  const roles = job.characters.filter(role => role.requiresApproval);
  return <section className="archive-result"><h2>归档完成</h2><h3>{dateLabel(job.date)}的日记</h3><div className="archive-result-grid"><PosterPreview src={job.posterUrl} alt={`${dateLabel(job.date)}已归档海报`} label="查看完整海报" /><div><p>{job.archive.mode === 'obsidian' ? '已保存到 Obsidian' : '已保存到本地日记库'}</p><p>日记本已更新</p><div className="job-actions"><a href={job.archive.noteUrl}>查看日记</a><a href={job.archive.bookUrl}>查看 3D 日记本</a></div><h3>新增角色</h3>{roles.length ? <div className="archive-role-names">{roles.map(role => <span key={role.id}>{role.name}</span>)}</div> : <p className="muted">无</p>}{job.archive.graphUrl ? <a href={job.archive.graphUrl}>查看人物关系图谱</a> : null}</div></div></section>;
}
