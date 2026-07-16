import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WORLDS, VOCAB_STATS, toWord } from './data.js';

const W = 1000;
const H = 650;
const STEP = 22;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const opposite = (a, b) => (a === 'up' && b === 'down') || (a === 'down' && b === 'up') || (a === 'left' && b === 'right') || (a === 'right' && b === 'left');
const colors = ['#ff6f61','#ffb703','#60c6ff','#7bcf82','#b986ee','#ff75b5','#56c9b4'];
const randomPos = (occupied = []) => {
  let point;
  let attempts = 0;
  do {
    point = { x: 70 + Math.random() * (W - 140), y: 105 + Math.random() * (H - 175) };
    attempts += 1;
  } while (attempts < 160 && (
    Math.hypot(point.x - 500, point.y - 330) < 155 ||
    (point.x > 790 && point.y > 455) ||
    occupied.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 72)
  ));
  return point;
};

function makeBubbles(words, startIndex) {
  const output = [];
  [startIndex, startIndex + 1].forEach((source) => {
    const item = words[source];
    if (!item) return;
    [...item.letters].forEach((char, i) => {
      const p = randomPos(output);
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
  const [saved, setSaved] = useState(() => Number(localStorage.getItem('wiggleStars') || 0));

  const begin = (wi, li) => { setWorldIndex(wi); setLevelIndex(li); setScreen('game'); };
  if (screen === 'game') return <Game key={`${worldIndex}-${levelIndex}`} world={WORLDS[worldIndex]} worldIndex={worldIndex} levelIndex={levelIndex} soundOn={soundOn} setSoundOn={setSoundOn} onHome={() => setScreen('home')} onNext={() => {
    const world = WORLDS[worldIndex];
    if (levelIndex + 1 < world.levels.length) setLevelIndex(levelIndex + 1);
    else { setScreen('home'); setWorldIndex((worldIndex + 1) % WORLDS.length); setLevelIndex(0); }
  }} onEarn={(amount = 10) => { const next = saved + amount; setSaved(next); localStorage.setItem('wiggleStars', String(next)); }} />;

  return <main className="home-shell">
    <div className="sky-doodles" aria-hidden="true"><i>ABC</i><i>★</i><i>hello!</i><i>✿</i><i>123</i></div>
    <header className="home-nav">
      <div className="mini-brand"><span>W</span> Word Wiggle</div>
      <div className="star-bank">⭐ <strong>{saved}</strong></div>
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
  </main>;
}

function Game({ world, levelIndex, soundOn, setSoundOn, onHome, onNext, onEarn }) {
  const words = useMemo(() => world.levels[levelIndex].map(toWord), [world, levelIndex]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState([]);
  const [bubbles, setBubbles] = useState(() => makeBubbles(words, 0));
  const [snake, setSnake] = useState(() => Array.from({length: 5}, (_, i) => ({x: 440 - i * STEP, y: 330})));
  const [direction, setDirection] = useState('right');
  const directionRef = useRef('right');
  const [feedback, setFeedback] = useState(null);
  const [mistakeStreak, setMistakeStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [slowMotion, setSlowMotion] = useState(false);
  const [earnedStars, setEarnedStars] = useState(3);
  const [levelComplete, setLevelComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const lockedRef = useRef(false);
  const feedbackTimerRef = useRef(null);
  const slowTimerRef = useRef(null);
  const playRef = Sound({ soundOn });

  const setDir = useCallback((next) => {
    if (!DIRS[next] || opposite(directionRef.current, next)) return;
    directionRef.current = next; setDirection(next);
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
  }, []);

  useEffect(() => {
    if (paused || levelComplete) return;
    const timer = setInterval(() => {
      setSnake(prev => {
        const [dx, dy] = DIRS[directionRef.current];
        const raw = {x: prev[0].x + dx * STEP, y: prev[0].y + dy * STEP};
        const head = {x: raw.x < 20 ? W - 20 : raw.x > W - 20 ? 20 : raw.x, y: raw.y < 20 ? H - 20 : raw.y > H - 20 ? 20 : raw.y};
        if (!lockedRef.current) {
          const hit = bubbles.find(b => !b.cooldown && Math.hypot(b.x - head.x, b.y - head.y) < (combo >= 5 ? 68 : 54));
          if (hit) {
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
                    setIndex(nextIndex); setTyped('');
                    setBubbles(makeBubbles(words, nextIndex));
                  }
                  setFeedback(null); lockedRef.current = false;
                }, 1150);
              }
            } else {
              const tier = Math.min(3, mistakeStreak + 1);
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
        return [head, ...prev.slice(0, -1)];
      });
    }, slowMotion ? 420 : 270);
    return () => clearInterval(timer);
  }, [bubbles, index, typed, words, paused, levelComplete, mistakeStreak, mistakes, combo, slowMotion, onEarn, playRef]);

  const current = words[index];
  return <main className="game-shell" style={{'--accent': world.color, '--soft': world.soft}}>
    <header className="game-header">
      <button className="round-btn" onClick={onHome} aria-label="返回首页">‹</button>
      <div className="game-brand"><span>W</span><div><strong>{world.name}</strong><small>第 {levelIndex + 1} 关 · 10 个单词</small></div></div>
      <div className="progress-wrap"><div><span>本关进度</span><b>{done.length}<small>/10</small></b></div><div className="progress"><i style={{width:`${done.length * 10}%`}}/></div></div>
      <button className="round-btn sound" onClick={() => setSoundOn(!soundOn)} aria-label="切换声音">{soundOn ? '♪' : '×'}</button>
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
        <div className={`arena ${feedback?.type || ''}`}>
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
                <circle r={head ? 25 : Math.max(13, 22 - i * .28)} fill={head ? '#ff8e3c' : i % 2 ? '#47b98a' : '#68cf9d'} stroke="#fff" strokeWidth="4"/>
                {head && <><circle cx="-8" cy="-5" r="4" fill="#263747"/><circle cx="8" cy="-5" r="4" fill="#263747"/><path d="M-7 8 Q0 14 8 7" fill="none" stroke="#263747" strokeWidth="3" strokeLinecap="round"/></>}
              </g>;
            })}
          </svg>
          <Joystick setDir={setDir} direction={direction}/>
          <div className="arena-instruction">拖动摇杆 · 或用键盘方向键</div>
          {paused && <div className="pause-screen"><div>☁️</div><h2>休息一下</h2><button onClick={() => setPaused(false)}>继续游戏</button></div>}
          {feedback?.type === 'correct' && <div className="feedback-card" role="status" aria-live="polite"><span>太棒啦！</span><b>{feedback.word.word}</b><small>{feedback.word.pos} · {feedback.word.ipa}</small></div>}
          {feedback?.type === 'wrong' && <div className={`wrong-toast tier-${feedback.tier}`} role="status" aria-live="polite"><b>{feedback.tier === 1 ? '噗～这个字母还没轮到' : feedback.tier === 2 ? '看看正在发光的字母' : '正确字母在向你招手！'}</b><small>{feedback.tier === 1 ? '已经拼对的部分会保留' : feedback.tier === 2 ? '继续操控，不用重新开始' : '软糖蛇也暂时放慢啦'}</small></div>}
        </div>
      </section>
    </div>
    {levelComplete && <Complete world={world} levelIndex={levelIndex} stars={earnedStars} onNext={onNext} />}
  </main>;
}

function Joystick({ setDir, direction }) {
  const [knob, setKnob] = useState({x:0,y:0});
  const base = useRef(null);
  const move = (e) => {
    const r = base.current.getBoundingClientRect(); const x = e.clientX - (r.left + r.width/2); const y = e.clientY - (r.top + r.height/2);
    if (Math.hypot(x, y) < 8) return;
    const len = Math.hypot(x,y) || 1; const max = 34; const scale = Math.min(1, max/len); setKnob({x:x*scale,y:y*scale});
    if (Math.abs(x) > Math.abs(y)) setDir(x > 0 ? 'right' : 'left'); else setDir(y > 0 ? 'down' : 'up');
  };
  const end = () => setKnob({x:0,y:0});
  return <div className="joystick" ref={base} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);move(e)}} onPointerMove={e=>e.currentTarget.hasPointerCapture(e.pointerId)&&move(e)} onPointerUp={end} onPointerCancel={end}>
    <span className="arrow up">▲</span><span className="arrow right">▶</span><span className="arrow down">▼</span><span className="arrow left">◀</span>
    <i style={{transform:`translate(${knob.x}px,${knob.y}px)`}}><b>{direction==='up'?'↑':direction==='down'?'↓':direction==='left'?'←':'→'}</b></i>
  </div>;
}

function Complete({ world, levelIndex, stars, onNext }) {
  return <div className="complete-overlay">
    <div className="confetti">{Array.from({length:50},(_,i)=><i key={i} style={{'--x':`${Math.random()*100}vw`,'--d':`${Math.random()*1.8}s`,'--c':colors[i%colors.length]}}/>)}</div>
    <div className="complete-card"><div className="crown">👑</div><span>LEVEL COMPLETE!</span><h2>关卡完成啦！</h2><p>你拼对了 <b>10</b> 个单词<br/>软糖蛇又长大了一圈！</p><div className="star-rating" aria-label={`${stars} 星评价`}>{[1,2,3].map(value => <i key={value} className={value <= stars ? 'lit' : ''}>★</i>)}</div><div className="earned">知识星 +{stars * 5}</div><button onClick={onNext}>{levelIndex === world.levels.length - 1 ? '去下一个副本' : '进入下一关'} <b>→</b></button></div>
  </div>;
}

export default App;
