import { useState } from 'react';

export function ChatHandoff({ job, execution }) {
  const [copied, setCopied] = useState(false), [manual, setManual] = useState(''), [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  async function copy() {
    setLoading(true); setFailed(false);
    try {
      const { prompt } = await execution.handoff(job);
      try { await navigator.clipboard.writeText(prompt); setCopied(true); }
      catch { setManual(prompt); }
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }
  return <div className="generation-control chat-handoff">
    <span className="generation-status" role="status">{failed ? '指令未读取，请重试' : copied ? '已复制，请到左侧聊天粘贴并发送' : '等待左侧聊天接手'}</span>
    <button className="primary" disabled={loading} onClick={copy}>{loading ? '正在读取…' : copied ? '再次复制指令' : '复制生成指令'}</button>
    {manual ? <div className="handoff-manual" role="dialog" aria-label="生成指令"><p>复制以下指令，到左侧聊天发送。</p><textarea readOnly value={manual} aria-label="生成指令内容" onFocus={e => e.target.select()} /><button onClick={() => setManual('')}>关闭</button></div> : null}
  </div>;
}
