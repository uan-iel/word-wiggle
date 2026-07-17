import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function ReviewHub({ progress, onClose, onStart, onMarkMastered }) {
  const [tab, setTab] = useState('today');
  const [selected, setSelected] = useState(new Set());
  const [confirmId, setConfirmId] = useState(null);
  const confirmIdRef = useRef(null);
  const confirmTimer = useRef(null);
  const records = useMemo(() => Object.values(progress.words || {}), [progress]);
  const today = useMemo(() => records.filter(item => !item.manuallyMastered && item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= Date.now()).sort((a,b)=>a.mastery-b.mastery || b.totalMistakes-a.totalMistakes), [records]);
  const wrong = useMemo(() => records.filter(item => !item.manuallyMastered && item.totalMistakes > 0).sort((a,b)=>b.totalMistakes-a.totalMistakes || a.mastery-b.mastery), [records]);
  const mastered = records.filter(item => item.manuallyMastered).length;
  const list = tab === 'today' ? today : wrong;

  useEffect(() => {
    setSelected(new Set(list.slice(0,10).map(item => item.id)));
  }, [tab, list.length]);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const toggle = (id) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else if (next.size < 10) next.add(id);
    return next;
  });
  const askMastered = (id) => {
    if (confirmIdRef.current === id) {
      clearTimeout(confirmTimer.current); confirmIdRef.current=null; setConfirmId(null); onMarkMastered(id); return;
    }
    confirmIdRef.current=id; setConfirmId(id); clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => {confirmIdRef.current=null;setConfirmId(null)}, 3500);
  };
  const selectedRecords = list.filter(item => selected.has(item.id));

  return <main className="review-shell">
    <header className="review-header"><button className="round-btn" onClick={onClose} aria-label="返回首页">‹</button><div><span>REVIEW GARDEN</span><h1>复习花园</h1><p>把容易忘记的词，再照顾一次</p></div><div className="review-count"><b>{today.length}</b><small>今日待复习</small><b>{wrong.length}</b><small>错题本</small></div></header>
    <section className="review-hero"><div><span>记忆会开花</span><h2>{tab === 'today' ? '今天该复习什么？' : '把错词变成熟词！'}</h2><p>{tab === 'today' ? '系统根据熟练度和上次练习时间，为你安排了这些词。' : `这里保留所有出现过错误的词，已有 ${mastered} 个被手动标熟。`}</p></div><div className="garden-art">🌱<i>✨</i><b>🌼</b></div></section>
    <nav className="review-tabs"><button className={tab==='today'?'active':''} onClick={()=>setTab('today')}>📅 今日复习 <b>{today.length}</b></button><button className={tab==='wrong'?'active':''} onClick={()=>setTab('wrong')}>📝 错题本 <b>{wrong.length}</b></button></nav>
    <section className="review-content">
      {list.length === 0 ? <div className="review-empty"><div>{tab==='today'?'☀️':'🎈'}</div><h3>{tab==='today'?'今天没有到期的复习':'错题本还是空的'}</h3><p>{tab==='today'?'先去完成几个新单词吧，系统会自动安排复习。':'游戏中吃错的字母会被记录在这里。'}</p></div> : <>
        <div className="review-toolbar"><p>最多选择 10 个词组成一关</p><span>已选择 <b>{selected.size}</b>/10</span><button disabled={!selected.size} onClick={()=>onStart(selectedRecords)}>{tab==='today'?'开始今日复习':'挑战所选错词'} →</button></div>
        <div className="review-list">{list.map(item => {
          const commonError = Object.entries(item.wrongLetters || {}).sort((a,b)=>b[1]-a[1])[0];
          return <article key={item.id} className={selected.has(item.id)?'selected':''}>
            <button className="review-check" onClick={()=>toggle(item.id)} aria-label={selected.has(item.id)?'取消选择':'选择复习'}>{selected.has(item.id)?'✓':'+'}</button>
            <div className="review-word"><span>{item.worldName}</span><h3>{item.word}</h3><p>{item.zh} · {item.pos || 'KET词汇'} · {item.ipa || ''}</p></div>
            <div className="mastery-meter"><span>熟练度 {item.mastery}/5</span><i><b style={{width:`${item.mastery*20}%`}}/></i><small>练习 {item.completions} 次 · 错 {item.totalMistakes} 次</small></div>
            {commonError&&<div className="error-chip">常错：{commonError[0].split(':')[1]?.replace('>',' → ').toUpperCase()}</div>}
            <button className={`mark-mastered ${confirmId===item.id?'confirm':''}`} onClick={()=>askMastered(item.id)}>{confirmId===item.id?'再次点击确认':'标记掌握'}</button>
          </article>;
        })}</div>
      </>}
    </section>
  </main>;
}
