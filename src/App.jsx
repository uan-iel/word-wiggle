import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WORLDS, VOCAB_STATS, toWord } from './data.js';
import VocabAdmin from './VocabAdmin.jsx';
import ReviewHub from './ReviewHub.jsx';
import { learningSummary, loadLearningProgress, markWordMastered, recordWordCompletion, LEARNING_PROGRESS_KEY } from './learningProgress.js';

const W = 1000;
const H = 650;
const STEP = 22;
const KEY_DIRECTIONS = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
const colors = ['#ff6f61','#ffb703','#60c6ff','#7bcf82','#b986ee','#ff75b5','#56c9b4'];
const VOCAB_OVERRIDES_KEY = 'wiggleVocabOverridesV1';
const SPEED_KEY = 'wiggleGameSpeedV1';
const clampSpeed = (value) => Math.min(3, Math.max(.5, Math.round(Number(value) * 10) / 10));
const normalizeDirection = ({x, y}) => {
  const length = Math.hypot(x, y);
  return length > .001 ? {x:x / length, y:y / length} : null;
};
const safeBubbleSlots = () => {
  const slots = [];
  for (let y = 125; y <= 615; y += 122) {
    for (let x = 72; x <= 928; x += 122) {
      if (Math.hypot(x - 500, y - 330) >= 155) slots.push({x, y});
    }
  }
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
};

function makeBubbles(words, startIndex) {
  const output = [];
  const slots = safeBubbleSlots();
  const currentLength = words[startIndex]?.letters.length || 0;
  const nextAllowance = Math.max(0, 30 - currentLength);
  [startIndex, startIndex + 1].forEach((source, sourceOffset) => {
    const item = words[source];
    if (!item) return;
    const letters = sourceOffset === 0 ? [...item.letters] : [...item.letters].slice(0, nextAllowance);
    letters.forEach((char, i) => {
      const p = slots[output.length] || {x:72 + (output.length % 8) * 122, y:125 + Math.floor(output.length / 8) * 122};
      output.push({ id: `${source}-${i}-${Math.random()}`, source, char, ...p, color: colors[(i + source * 2) % colors.length], delay: Math.random() * -3 });
    });
  });
  return output;
}

function Sound({ soundOn }) {
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = (type = 'correct') => {
      if (!soundOn) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'wrong' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(type === 'wrong' ? 310 : 520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(type === 'wrong' ? 230 : 880, ctx.currentTime + .12);
      gain.gain.setValueAtTime(type === 'wrong' ? .045 : .09, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .18);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .18);
    };
  }, [soundOn]);
  return audioRef;
}

function App() {
  const [screen, setScreen] = useState('home');
  const [worldIndex, setWorldIndex] = useState(0);
  const [levelIndex, setLevelIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(() => clampSpeed(localStorage.getItem(SPEED_KEY) || 1));
  const [reviewWords, setReviewWords] = useState([]);
  const [saved, setSaved] = useState(() => Number(localStorage.getItem('wiggleStars') || 0));
  const [vocabOverrides, setVocabOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(VOCAB_OVERRIDES_KEY) || '{}'); } catch { return {}; }
  });
  const [learningProgress, setLearningProgress] = useState(loadLearningProgress);
  const progressSummary = useMemo(() => learningSummary(learningProgress), [learningProgress]);
  const recordLearning = useCallback((attempt) => {
    setLearningProgress(previous => {
      const next = recordWordCompletion(previous, attempt);
      localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const wordLookup = useMemo(() => {
    const map = new Map();
    WORLDS.forEach(world => world.levels.flat().forEach(item => {
      const id = `${world.id}:${item.sourceIndex}`;
      if (map.has(id)) return;
      const override = vocabOverrides[id] || {};
      const word = override.word || item.word;
      map.set(id, {...item, ...override, id, word, letters:word.toLowerCase().replace(/[^a-z]/g,''), sourceWorldId:world.id, sourceWorldName:world.name});
    }));
    return map;
  }, [vocabOverrides]);

  const persistOverrides = (next) => { setVocabOverrides(next); localStorage.setItem(VOCAB_OVERRIDES_KEY, JSON.stringify(next)); };
  const updateSpeed = (value) => {
    const next = clampSpeed(value);
    setSpeedMultiplier(next);
    localStorage.setItem(SPEED_KEY, String(next));
  };
  const settings = settingsOpen && <SettingsModal speed={speedMultiplier} onSpeedChange={updateSpeed} soundOn={soundOn} onSoundChange={setSoundOn} onClose={() => setSettingsOpen(false)}/>;
  if (screen === 'admin') return <VocabAdmin worlds={WORLDS} overrides={vocabOverrides} onClose={() => setScreen('home')}
    onSave={(id, patch) => persistOverrides({...vocabOverrides, [id]:patch})}
    onReset={(id) => { const next={...vocabOverrides}; delete next[id]; persistOverrides(next); }}
    onImport={(incoming) => persistOverrides({...vocabOverrides,...incoming})}
    onClear={() => persistOverrides({})}/>;
  if (screen === 'review') return <ReviewHub progress={learningProgress} onClose={() => setScreen('home')}
    onStart={(records) => { setReviewWords(records.map(record => wordLookup.get(record.id) || {...record, id:record.id, letters:record.word.toLowerCase().replace(/[^a-z]/g,'')})); setScreen('reviewGame'); }}
    onMarkMastered={(id) => setLearningProgress(previous => { const next=markWordMastered(previous,id); localStorage.setItem(LEARNING_PROGRESS_KEY,JSON.stringify(next)); return next; })}/>;
  if (screen === 'reviewGame') {
    const reviewWorld={id:'review',name:'今日复习',color:'#25a879',soft:'#d8f6df',levels:[reviewWords]};
    return <><Game key={`review-${reviewWords.map(item=>item.id).join('-')}`} world={reviewWorld} overrides={vocabOverrides} levelIndex={0} soundOn={soundOn} setSoundOn={setSoundOn} speedMultiplier={speedMultiplier} settingsOpen={settingsOpen} onOpenSettings={() => setSettingsOpen(true)} onRecordWord={recordLearning} onHome={() => setScreen('review')} onNext={() => setScreen('review')} onEarn={(amount=10)=>{const next=saved+amount;setSaved(next);localStorage.setItem('wiggleStars',String(next));}} isReview/>{settings}</>;
  }

  const begin = (wi, li) => { setWorldIndex(wi); setLevelIndex(li); setScreen('game'); };
  if (screen === 'game') return <><Game key={`${worldIndex}-${levelIndex}`} world={WORLDS[worldIndex]} overrides={vocabOverrides} worldIndex={worldIndex} levelIndex={levelIndex} soundOn={soundOn} setSoundOn={setSoundOn} speedMultiplier={speedMultiplier} settingsOpen={settingsOpen} onOpenSettings={() => setSettingsOpen(true)} onRecordWord={recordLearning} onHome={() => setScreen('home')} onNext={() => {
    const world = WORLDS[worldIndex];
    if (levelIndex + 1 < world.levels.length) setLevelIndex(levelIndex + 1);
    else { setScreen('home'); setWorldIndex((worldIndex + 1) % WORLDS.length); setLevelIndex(0); }
  }} onEarn={(amount = 10) => { const next = saved + amount; setSaved(next); localStorage.setItem('wiggleStars', String(next)); }} />{settings}</>;

  return <main className="home-shell">
    <div className="sky-doodles" aria-hidden="true"><i>ABC</i><i>★</i><i>hello!</i><i>✿</i><i>123</i></div>
    <header className="home-nav">
      <div className="mini-brand"><span>W</span> Word Wiggle</div>
      <div className="home-tools"><button className="review-entry" onClick={() => setScreen('review')}>🔁 今日复习{progressSummary.due>0&&<b>{progressSummary.due}</b>}</button><button onClick={() => setSettingsOpen(true)}>⚙ 总设置</button><button onClick={() => setScreen('admin')}>✎ 词库校对</button><div className="star-bank">⭐ <strong>{saved}</strong></div></div>
    </header>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">SNAKE · SPELL · SMILE</div>
        <h1>扭一扭，<br/><em>吃出单词！</em></h1>
        <p>跟着中文提示，操控软糖蛇按顺序吃掉字母。<br/>已收录 PDF 正文中的 {VOCAB_STATS.extractedTotal} 条词汇，每 10 词一关！</p>
        <button className="primary" onClick={() => document.querySelector('.worlds')?.scrollIntoView({ behavior: 'smooth' })}>选择一个副本 <b>→</b></button>
      </div>
      <div className="hero-art" aria-label="一条由彩色圆球组成的卡通贪吃蛇">
        <span className="spark s1">✦</span><span className="spark s2">✦</span>
        <div className="word-bubble"><b>W</b><small>哇！</small></div>
        <div className="mascot-snake">
          <i></i><i></i><i></i><i></i><i></i><i className="head"><b>•</b><b>•</b><span>⌣</span></i>
        </div>
      </div>
    </section>
    <LearningSnapshot summary={progressSummary}/>
    <section className="worlds">
      <div className="section-title"><div><span>CHOOSE A WORLD</span><h2>今天去哪里探险？</h2></div><small>{VOCAB_STATS.worldCount} 个主题 · {VOCAB_STATS.levelCount} 个关卡 · 每关 10 词</small></div>
      <div className="world-grid">
        {WORLDS.map((world, wi) => <article className="world-card" key={world.id} style={{'--accent': world.color, '--soft': world.soft}}>
          <div className="world-top"><span className="world-number">{String(wi + 1).padStart(2, '0')}</span><div className="world-emoji">{world.emoji}</div><span className="world-tag">KET</span></div>
          <h3>{world.name}</h3><p>{world.sourceCount} 个原文词条 · {world.levels.length} 关</p>
          <div className="level-row">
            {world.levels.map((_, li) => <button key={li} title={`进入第 ${li + 1} 关`} aria-label={`${world.name}第 ${li + 1} 关`} onClick={() => begin(wi, li)}><span>{li + 1}</span></button>)}
          </div>
        </article>)}
      </div>
    </section>
    <footer>词汇内容选自《KET 备考必备 1500 词（带音标版）》 · PDF 正文实际提取 {VOCAB_STATS.extractedTotal} 条 · 快乐学，记得牢</footer>
    {settings}
  </main>;
}

function SettingsModal({ speed, onSpeedChange, soundOn, onSoundChange, onClose }) {
  const speedLabel = speed < .8 ? '慢慢探索' : speed < 1.3 ? '舒适巡航' : speed < 2 ? '活力加速' : speed < 2.6 ? '闪电冲刺' : '超级旋风';
  return <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onPointerDown={event => event.target === event.currentTarget && onClose()}>
    <section className="settings-card">
      <button className="settings-close" onClick={onClose} aria-label="关闭总设置">×</button>
      <div className="settings-heading"><span>GAME CONTROL</span><h2 id="settings-title">总设置</h2><p>调出最适合你的软糖蛇手感</p></div>
      <div className="speed-setting">
        <div className="setting-title"><span>🏎️</span><div><b>移动速度</b><small>可按 0.1 倍精细调整</small></div><strong>{speed.toFixed(1)}×</strong></div>
        <input type="range" min="0.5" max="3" step="0.1" value={speed} onChange={event => onSpeedChange(event.target.value)} aria-label="贪吃蛇移动速度" style={{'--speed-progress':`${(speed - .5) / 2.5 * 100}%`}}/>
        <div className="speed-scale"><span>0.5×</span><b>{speedLabel}</b><span>3.0×</span></div>
        <div className="speed-presets">{[.5,1,1.5,2,3].map(value => <button key={value} className={speed === value ? 'active' : ''} onClick={() => onSpeedChange(value)}>{value.toFixed(1)}×</button>)}</div>
      </div>
      <div className="sound-setting"><span>🎵</span><div><b>游戏音效</b><small>拼对和纠错提示音</small></div><button className={soundOn ? 'on' : ''} onClick={() => onSoundChange(!soundOn)} aria-pressed={soundOn}><i/>{soundOn ? '开启' : '关闭'}</button></div>
      <div className="settings-tip">🕹️ 摇杆现在支持 360° 自由转向，拖向哪里就游向哪里。</div>
    </section>
  </div>;
}

function LearningSnapshot({ summary }) {
  return <section className="learning-snapshot" aria-label="学习进度概览">
    <div className="snapshot-copy"><span>MY LEARNING TRAIL</span><h2>{summary.practiced ? '今天也在长大！' : '从第一个单词出发吧！'}</h2><p>{summary.practiced ? `已经练过 ${summary.practiced} 个词，首次拼对率 ${summary.firstTryRate}%` : '完成单词后，这里会记录熟练度、正确率和复习时间。'}</p></div>
    <div className="snapshot-stats">
      <div><i>🌱</i><b>{summary.practiced}</b><small>练过的词</small></div>
      <div><i>🏅</i><b>{summary.mastered}</b><small>熟练掌握</small></div>
      <div><i>📅</i><b>{summary.today}</b><small>今天完成</small></div>
      <div className={summary.due ? 'due' : ''}><i>🔁</i><b>{summary.due}</b><small>等待复习</small></div>
    </div>
  </section>;
}

function Game({ world, overrides, levelIndex, soundOn, setSoundOn, speedMultiplier, settingsOpen, onOpenSettings, onHome, onNext, onEarn, onRecordWord, isReview=false }) {
  const words = useMemo(() => world.levels[levelIndex].map(item => {
    const itemId = item.id || `${world.id}:${item.sourceIndex}`;
    const override = overrides[itemId] || {};
    const word = override.word || item.word;
    return toWord({...item, ...override, id:itemId, word, letters:word.toLowerCase().replace(/[^a-z]/g,'')});
  }), [world, levelIndex, overrides]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState([]);
  const [bubbles, setBubbles] = useState(() => makeBubbles(words, 0));
  const [snake, setSnake] = useState(() => Array.from({length: 5}, (_, i) => ({x: 440 - i * STEP, y: 330})));
  const [direction, setDirection] = useState({x:1,y:0});
  const directionRef = useRef({x:1,y:0});
  const [feedback, setFeedback] = useState(null);
  const [mistakeStreak, setMistakeStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [slowMotion, setSlowMotion] = useState(false);
  const [earnedStars, setEarnedStars] = useState(3);
  const [levelComplete, setLevelComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [freeControl, setFreeControl] = useState(null);
  const freeControlRef = useRef(null);
  const lockedRef = useRef(false);
  const collisionGateRef = useRef(false);
  const feedbackTimerRef = useRef(null);
  const slowTimerRef = useRef(null);
  const collisionTimerRef = useRef(null);
  const controlTimerRef = useRef(null);
  const wordAttemptRef = useRef({startedAt:performance.now(), mistakes:0, maxHintTier:0, wrongLetters:[]});
  const playRef = Sound({ soundOn });

  const setDir = useCallback((next) => {
    const vector = normalizeDirection(typeof next === 'string' ? KEY_DIRECTIONS[next] : next);
    if (!vector) return;
    directionRef.current = vector;
    setDirection(vector);
  }, []);

  useEffect(() => {
    const key = (e) => {
      const map = {ArrowUp:'up', w:'up', ArrowDown:'down', s:'down', ArrowLeft:'left', a:'left', ArrowRight:'right', d:'right'};
      if (map[e.key]) { e.preventDefault(); setDir(map[e.key]); }
      if (e.key === ' ') setPaused(p => !p);
    };
    window.addEventListener('keydown', key, {passive:false});
    return () => window.removeEventListener('keydown', key);
  }, [setDir]);

  useEffect(() => () => {
    clearTimeout(feedbackTimerRef.current);
    clearTimeout(slowTimerRef.current);
    clearTimeout(collisionTimerRef.current);
    clearTimeout(controlTimerRef.current);
    document.documentElement.classList.remove('joystick-dragging');
  }, []);

  useEffect(() => {
    const moveAnywhere = (event) => {
      const previous = freeControlRef.current;
      if (!previous || !previous.active || previous.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - previous.originClientX;
      const dy = event.clientY - previous.originClientY;
      const length = Math.hypot(dx,dy);
      if (length > 9) setDir({x:dx,y:dy});
      const scale = length > 70 ? 70 / length : 1;
      const next = {...previous,knobX:dx*scale,knobY:dy*scale};
      freeControlRef.current = next;
      setFreeControl(next);
    };
    const finishAnywhere = (event) => {
      const previous = freeControlRef.current;
      if (!previous || (event?.pointerId != null && previous.pointerId !== event.pointerId)) return;
      const next = {...previous,active:false};
      freeControlRef.current = next;
      setFreeControl(next);
      document.documentElement.classList.remove('joystick-dragging');
      clearTimeout(controlTimerRef.current);
      controlTimerRef.current = setTimeout(() => {
        freeControlRef.current = null;
        setFreeControl(null);
      }, 180);
    };
    window.addEventListener('pointermove', moveAnywhere, {passive:false});
    window.addEventListener('pointerup', finishAnywhere);
    window.addEventListener('pointercancel', finishAnywhere);
    window.addEventListener('blur', finishAnywhere);
    return () => {
      window.removeEventListener('pointermove', moveAnywhere);
      window.removeEventListener('pointerup', finishAnywhere);
      window.removeEventListener('pointercancel', finishAnywhere);
      window.removeEventListener('blur', finishAnywhere);
    };
  }, [setDir]);

  useEffect(() => {
    if (paused || levelComplete || settingsOpen) return;
    let frame;
    let lastTime = performance.now();
    const animate = (now) => {
      const delta = Math.min((now - lastTime) / 1000, .04);
      lastTime = now;
      setSnake(prev => {
        const {x:dx, y:dy} = directionRef.current;
        const distance = (slowMotion ? 52 : 82) * speedMultiplier * delta;
        const raw = {x: prev[0].x + dx * distance, y: prev[0].y + dy * distance};
        const wrapped = raw.x < 20 || raw.x > W - 20 || raw.y < 20 || raw.y > H - 20;
        const head = {x: raw.x < 20 ? W - 20 : raw.x > W - 20 ? 20 : raw.x, y: raw.y < 20 ? H - 20 : raw.y > H - 20 ? 20 : raw.y};
        let body;
        if (wrapped) {
          body = prev.map((_, i) => ({
            x: Math.max(20, Math.min(W - 20, head.x - dx * STEP * i)),
            y: Math.max(20, Math.min(H - 20, head.y - dy * STEP * i)),
          }));
        } else {
          body = [head];
          for (let i = 1; i < prev.length; i += 1) {
            const leader = body[i - 1];
            const follower = prev[i];
            const gapX = leader.x - follower.x;
            const gapY = leader.y - follower.y;
            const gap = Math.hypot(gapX, gapY) || 1;
            body.push(gap > STEP ? {
              x: follower.x + gapX / gap * (gap - STEP),
              y: follower.y + gapY / gap * (gap - STEP),
            } : follower);
          }
        }
        if (!lockedRef.current && !collisionGateRef.current) {
          const hit = bubbles.find(b => !b.cooldown && Math.hypot(b.x - head.x, b.y - head.y) < (combo >= 5 ? 68 : 54));
          if (hit) {
            collisionGateRef.current = true;
            clearTimeout(collisionTimerRef.current);
            collisionTimerRef.current = setTimeout(() => { collisionGateRef.current = false; }, 170);
            const current = words[index];
            const expected = current?.letters[typed.length];
            if (hit.char === expected) {
              playRef.current?.('correct');
              clearTimeout(feedbackTimerRef.current);
              setFeedback(null);
              setBubbles(list => list.filter(b => b.id !== hit.id));
              const nextTyped = typed + hit.char;
              setTyped(nextTyped);
              setMistakeStreak(0);
              setCombo(value => value + 1);
              if (nextTyped === current.letters) {
                lockedRef.current = true;
                const attempt = wordAttemptRef.current;
                onRecordWord({
                  id:current.id, word:current.word, zh:current.zh, pos:current.pos, ipa:current.ipa,
                  worldId:current.sourceWorldId || world.id, worldName:current.sourceWorldName || world.name,
                  mistakes:attempt.mistakes, maxHintTier:attempt.maxHintTier,
                  wrongLetters:attempt.wrongLetters, durationMs:Math.max(500, Math.round(performance.now() - attempt.startedAt)),
                });
                setDone(list => [...list, index]);
                setFeedback({type:'correct', word:current});
                setTimeout(() => {
                  setSnake(body => [...body, body[body.length - 1], body[body.length - 1]]);
                  if (index === words.length - 1) {
                    const stars = mistakes === 0 ? 3 : mistakes <= 5 ? 2 : 1;
                    setEarnedStars(stars);
                    setLevelComplete(true);
                    onEarn(stars * 5);
                  }
                  else {
                    const nextIndex = index + 1;
                    wordAttemptRef.current = {startedAt:performance.now(), mistakes:0, maxHintTier:0, wrongLetters:[]};
                    setIndex(nextIndex); setTyped('');
                    setBubbles(makeBubbles(words, nextIndex));
                  }
                  setFeedback(null); lockedRef.current = false;
                }, 1150);
              }
            } else {
              const tier = Math.min(3, mistakeStreak + 1);
              wordAttemptRef.current.mistakes += 1;
              wordAttemptRef.current.maxHintTier = Math.max(wordAttemptRef.current.maxHintTier, tier);
              wordAttemptRef.current.wrongLetters.push({position:typed.length, expected, chosen:hit.char});
              playRef.current?.('wrong');
              setMistakeStreak(tier);
              setMistakes(value => value + 1);
              setCombo(0);
              setFeedback({type:'wrong', tier});
              setBubbles(list => list.map(bubble => bubble.id === hit.id ? {...bubble, cooldown:true} : bubble));
              setTimeout(() => setBubbles(list => list.map(bubble => bubble.id === hit.id ? {...bubble, cooldown:false} : bubble)), 850);
              clearTimeout(feedbackTimerRef.current);
              feedbackTimerRef.current = setTimeout(() => setFeedback(value => value?.type === 'wrong' ? null : value), 950);
              if (tier >= 3) {
                setSlowMotion(true);
                clearTimeout(slowTimerRef.current);
                slowTimerRef.current = setTimeout(() => setSlowMotion(false), 1400);
              }
            }
          }
        }
        return body;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [bubbles, index, typed, words, paused, levelComplete, settingsOpen, mistakeStreak, mistakes, combo, slowMotion, speedMultiplier, onEarn, onRecordWord, playRef, world.id, world.name]);

  const current = words[index];
  const startFreeControl = (event) => {
    if (paused || levelComplete || settingsOpen || event.target.closest?.('button,.spell-ribbon,.feedback-card')) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    clearTimeout(controlTimerRef.current);
    const next = {pointerId:event.pointerId,x:event.clientX-rect.left,y:event.clientY-rect.top,originClientX:event.clientX,originClientY:event.clientY,knobX:0,knobY:0,active:true};
    freeControlRef.current = next;
    setFreeControl(next);
    document.documentElement.classList.add('joystick-dragging');
  };
  return <main className="game-shell" style={{'--accent': world.color, '--soft': world.soft}}>
    <header className="game-header">
      <button className="round-btn" onClick={onHome} aria-label="返回首页">‹</button>
      <div className="game-brand"><span>W</span><div><strong>{world.name}</strong><small>{isReview?'专属复习关':`第 ${levelIndex + 1} 关`} · {words.length} 个单词</small></div></div>
      <div className="progress-wrap"><div><span>{isReview?'复习进度':'本关进度'}</span><b>{done.length}<small>/{words.length}</small></b></div><div className="progress"><i style={{width:`${words.length ? done.length / words.length * 100 : 0}%`}}/></div></div>
      <button className="round-btn sound" onClick={() => setSoundOn(!soundOn)} aria-label="切换声音">{soundOn ? '♪' : '×'}</button>
      <button className="round-btn game-settings" onClick={onOpenSettings} aria-label="打开总设置">⚙</button>
      <button className="pause-btn" onClick={() => setPaused(!paused)}>{paused ? '继续' : '暂停'}</button>
    </header>
    <div className="game-layout">
      <aside className="word-panel">
        <div className="panel-heading"><span>WORD QUEST</span><h2>单词任务</h2><p>按照中文顺序来拼写哦</p></div>
        <div className="word-list">
          {words.map((word, i) => <div key={word.word} className={`word-item ${done.includes(i)?'complete':''} ${i===index?'active':''}`}>
            <span className="check">{done.includes(i) ? '✓' : i + 1}</span>
            <div className={feedback?.type==='correct' && i===index ? 'bounce-zh':''}><b>{word.zh}</b>{done.includes(i) && <small>{word.word} · {word.pos} · {word.ipa}</small>}</div>
            {i===index && !done.includes(i) && <em>正在拼</em>}
          </div>)}
        </div>
        <div className="tiny-tip">💡 吃错不会重来：软糖蛇会吐掉错字母，并给你一点提示。</div>
      </aside>
      <section className="arena-wrap">
        <div className={`arena ${feedback?.type || ''}`} onPointerDown={startFreeControl} onContextMenu={event=>event.preventDefault()} onDragStart={event=>event.preventDefault()}>
          <div className="arena-clouds" aria-hidden="true"><i/><i/><i/></div>
          <div className="spell-ribbon"><span>拼一拼</span><div>
            {current?.letters.split('').map((letter, i) => <b key={i} className={i < typed.length ? 'filled' : i === typed.length ? 'next' : ''}>{i < typed.length ? letter.toUpperCase() : '·'}</b>)}
          </div></div>
          {combo >= 2 && <div className={`combo-pill ${combo >= 5 ? 'magnet' : ''}`}>{combo >= 5 ? '🧲 磁力连击' : '🔥 连击'} × {combo}</div>}
          <svg className="playfield" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="贪吃蛇游戏区域">
            {bubbles.map((b) => <g className={`letter-bubble ${b.cooldown ? 'cooldown' : ''} ${mistakeStreak >= 2 && b.char === current?.letters[typed.length] ? 'hint' : ''} ${mistakeStreak >= 3 && b.char !== current?.letters[typed.length] ? 'subdued' : ''}`} key={b.id} transform={`translate(${b.x} ${b.y})`} style={{'--delay':`${b.delay}s`}}>
              <circle r="29" fill={b.color}/><circle cx="-8" cy="-10" r="8" fill="rgba(255,255,255,.45)"/>
              <text textAnchor="middle" dominantBaseline="central">{b.char.toUpperCase()}</text>
            </g>)}
            {snake.slice().reverse().map((s, revI) => {
              const i = snake.length - 1 - revI; const head = i === 0;
              return <g key={i} transform={`translate(${s.x} ${s.y})`}>
                <g transform={head ? `rotate(${Math.atan2(direction.y,direction.x) * 180 / Math.PI})` : undefined}>
                  <circle r={head ? 25 : Math.max(13, 22 - i * .28)} fill={head ? '#ff8e3c' : i % 2 ? '#47b98a' : '#68cf9d'} stroke="#fff" strokeWidth="4"/>
                  {head && <><circle cx="8" cy="-8" r="4" fill="#263747"/><circle cx="8" cy="8" r="4" fill="#263747"/><path d="M16 -7 Q22 0 16 8" fill="none" stroke="#263747" strokeWidth="3" strokeLinecap="round"/></>}
                </g>
              </g>;
            })}
          </svg>
          <FreeJoystick control={freeControl} direction={direction}/>
          <div className="arena-instruction">按住后可拖到界面任意位置 · 或用键盘方向键</div>
          {paused && <div className="pause-screen"><div>☁️</div><h2>休息一下</h2><button onClick={() => setPaused(false)}>继续游戏</button></div>}
          {feedback?.type === 'correct' && <div className="feedback-card" role="status" aria-live="polite"><span>太棒啦！</span><b>{feedback.word.word}</b><small>{feedback.word.pos} · {feedback.word.ipa}</small></div>}
          {feedback?.type === 'wrong' && <div className={`wrong-toast tier-${feedback.tier}`} role="status" aria-live="polite"><b>{feedback.tier === 1 ? '噗～这个字母还没轮到' : feedback.tier === 2 ? '看看正在发光的字母' : '正确字母在向你招手！'}</b><small>{feedback.tier === 1 ? '已经拼对的部分会保留' : feedback.tier === 2 ? '继续操控，不用重新开始' : '软糖蛇也暂时放慢啦'}</small></div>}
        </div>
      </section>
    </div>
    {levelComplete && <Complete world={world} levelIndex={levelIndex} count={words.length} stars={earnedStars} onNext={onNext} isReview={isReview} />}
  </main>;
}

function FreeJoystick({ control, direction }) {
  if (!control) return null;
  const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
  return <div className={`free-joystick ${control.active?'active':'releasing'}`} style={{left:control.x,top:control.y}} aria-hidden="true">
    <span></span><i style={{transform:`translate(${control.knobX}px,${control.knobY}px) rotate(${angle}deg)`}}>→</i>
  </div>;
}

function Complete({ world, levelIndex, count, stars, onNext, isReview }) {
  return <div className="complete-overlay">
    <div className="confetti">{Array.from({length:50},(_,i)=><i key={i} style={{'--x':`${Math.random()*100}vw`,'--d':`${Math.random()*1.8}s`,'--c':colors[i%colors.length]}}/>)}</div>
    <div className="complete-card"><div className="crown">👑</div><span>LEVEL COMPLETE!</span><h2>{isReview?'复习完成啦！':'关卡完成啦！'}</h2><p>你拼对了 <b>{count}</b> 个单词<br/>软糖蛇又长大了一圈！</p><div className="star-rating" aria-label={`${stars} 星评价`}>{[1,2,3].map(value => <i key={value} className={value <= stars ? 'lit' : ''}>★</i>)}</div><div className="earned">知识星 +{stars * 5}</div><button onClick={onNext}>{isReview?'返回复习花园':levelIndex === world.levels.length - 1 ? '去下一个副本' : '进入下一关'} <b>→</b></button></div>
  </div>;
}

export default App;
