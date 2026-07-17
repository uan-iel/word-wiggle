import React, { useEffect, useMemo, useRef, useState } from 'react';

function flattenWords(worlds, overrides) {
  const seen = new Set();
  const records = [];
  worlds.forEach((world, worldIndex) => {
    world.levels.flat().forEach(item => {
      const id = `${world.id}:${item.sourceIndex}`;
      if (seen.has(id)) return;
      seen.add(id);
      records.push({
        ...item,
        ...(overrides[id] || {}),
        id,
        worldId: world.id,
        worldName: world.name,
        worldIndex,
        original: item,
        edited: Boolean(overrides[id]),
      });
    });
  });
  return records;
}

export default function VocabAdmin({ worlds, overrides, onSave, onReset, onImport, onClear, onClose }) {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const records = useMemo(() => flattenWords(worlds, overrides), [worlds, overrides]);
  const duplicateCounts = useMemo(() => records.reduce((map, item) => {
    const key = item.word.toLowerCase().replace(/[^a-z]/g, '');
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map()), [records]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter(item => (theme === 'all' || item.worldId === theme) && (!needle || `${item.word} ${item.zh} ${item.ipa}`.toLowerCase().includes(needle)));
  }, [records, query, theme]);
  const selected = records.find(item => item.id === selectedId) || filtered[0] || records[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  useEffect(() => {
    if (selected) setDraft({word:selected.word, zh:selected.zh, pos:selected.pos, ipa:selected.ipa});
  }, [selected?.id, selected?.word, selected?.zh, selected?.pos, selected?.ipa]);

  const save = () => {
    if (!draft.word.trim() || !/[a-z]/i.test(draft.word) || !draft.zh.trim()) {
      setNotice('英文和中文释义不能为空'); return;
    }
    onSave(selected.id, Object.fromEntries(Object.entries(draft).map(([key,value]) => [key, value.trim()])));
    setNotice('已保存，并会立即应用到游戏');
    setTimeout(() => setNotice(''), 1800);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({version:1, exportedAt:new Date().toISOString(), overrides}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'word-wiggle-vocabulary-edits.json'; anchor.click(); URL.revokeObjectURL(url);
  };
  const importJson = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const incoming = payload.overrides || payload;
      if (!incoming || Array.isArray(incoming) || typeof incoming !== 'object') throw new Error('invalid');
      onImport(incoming); setNotice(`已导入 ${Object.keys(incoming).length} 条修改`);
    } catch { setNotice('导入失败：请选择本游戏导出的 JSON 文件'); }
    event.target.value = '';
  };

  return <main className="admin-shell">
    <header className="admin-header">
      <button className="round-btn" onClick={onClose} aria-label="返回首页">‹</button>
      <div className="admin-title"><span>VOCAB LAB</span><div><h1>词库校对实验室</h1><p>修改会保存在这台设备，并立即进入游戏</p></div></div>
      <div className="admin-stats"><b>{records.length}</b><small>词条</small><b>{Object.keys(overrides).length}</b><small>已修改</small></div>
      <button className="admin-action" onClick={exportJson}>导出修改</button>
      <button className="admin-action" onClick={() => fileRef.current?.click()}>导入</button>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson}/>
    </header>
    <div className="admin-layout">
      <aside className="vocab-browser">
        <div className="browser-tools">
          <label><span>搜索词条</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="英文、中文或音标"/></label>
          <label><span>主题筛选</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option value="all">全部 24 个主题</option>{worlds.map(world=><option key={world.id} value={world.id}>{world.name}</option>)}</select></label>
          <small>找到 {filtered.length} 条</small>
        </div>
        <div className="vocab-results">
          {filtered.map(item => {
            const key=item.word.toLowerCase().replace(/[^a-z]/g,'');
            return <button key={item.id} className={`${item.id===selected?.id?'selected':''} ${item.edited?'edited':''}`} onClick={()=>setSelectedId(item.id)}>
              <span><b>{item.word}</b><small>{item.zh}</small></span>
              <i>{item.edited?'已改':duplicateCounts.get(key)>1?'重复':item.worldName}</i>
            </button>;
          })}
        </div>
      </aside>
      <section className="vocab-editor">
        {selected && draft && <>
          <div className="editor-heading"><div><span>{String(selected.worldIndex+1).padStart(2,'0')} · {selected.worldName}</span><h2>{selected.word}</h2></div><div className="editor-badges">{selected.edited&&<i>本地已修改</i>}{duplicateCounts.get(selected.word.toLowerCase().replace(/[^a-z]/g,''))>1&&<i className="duplicate">跨主题重复</i>}</div></div>
          <div className="editor-form">
            <label className="wide"><span>英文或短语</span><input value={draft.word} onChange={e=>setDraft({...draft,word:e.target.value})}/><small>游戏会自动忽略空格、连字符和标点</small></label>
            <label><span>词性</span><input value={draft.pos} onChange={e=>setDraft({...draft,pos:e.target.value})} placeholder="例如 n. / v. / adj."/></label>
            <label><span>音标</span><input value={draft.ipa} onChange={e=>setDraft({...draft,ipa:e.target.value})} placeholder="/…/"/></label>
            <label className="wide"><span>中文释义</span><textarea value={draft.zh} onChange={e=>setDraft({...draft,zh:e.target.value})} rows="4"/></label>
          </div>
          <div className="source-compare"><span>PDF 原始记录</span><p><b>{selected.original.word}</b> · {selected.original.pos} · {selected.original.ipa}</p><p>{selected.original.zh}</p></div>
          <div className="editor-footer">
            <button className="danger-link" onClick={()=>{if(confirm('确定清除全部本地词库修改吗？'))onClear()}}>清除全部修改</button>
            {selected.edited&&<button className="reset-word" onClick={()=>onReset(selected.id)}>恢复本词原文</button>}
            <button className="save-word" onClick={save}>保存并应用 <b>→</b></button>
          </div>
          {notice&&<div className="admin-notice" role="status">{notice}</div>}
        </>}
      </section>
    </div>
  </main>;
}
