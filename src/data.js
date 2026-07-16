import { VOCABULARY } from './vocabulary.generated.js';

const themeStyles = [
  ['📷','#ff795f','#fff0b9'], ['🧢','#ef5d9f','#ffe1ee'], ['🎨','#f49c36','#fff0bd'],
  ['💻','#4777e8','#dcecff'], ['📚','#8c68d9','#ebe1ff'], ['🎒','#367ddb','#deedff'],
  ['🎸','#25a879','#d8f6df'], ['👨‍👩‍👧','#ef6b79','#ffe1e4'], ['🍎','#f27845','#ffead8'],
  ['⚽','#30a774','#daf5e5'], ['⛺','#e49b31','#fff0c9'], ['🏠','#e56f65','#ffe4dd'],
  ['📏','#4b90d8','#dff0ff'], ['👀','#bd68cf','#f4dfff'], ['🏛️','#e49043','#ffedcf'],
  ['🏝️','#36a79d','#d9f6f0'], ['🏙️','#517ad5','#e1eaff'], ['🏪','#d15f91','#fbe0ee'],
  ['🛍️','#eb7556','#ffe5d7'], ['🏀','#35a966','#dcf4df'], ['🌿','#4c9d5f','#def1d8'],
  ['🚌','#3d88d5','#dcedff'], ['🌦️','#5d8ed8','#e1ebff'], ['👩‍🚀','#d06b58','#ffe2d9'],
];

const hash = (value) => [...value].reduce((n, ch) => ((n * 31) + ch.charCodeAt(0)) >>> 0, 2166136261);

function playableWord(raw) {
  let value = raw.trim();
  if (/^\(aero\)\/\(air\)plane/i.test(value)) return 'aeroplane';
  const alternatives = value.split('/').map(part => part.replace(/[()]/g, '').trim()).filter(Boolean);
  if (alternatives.length > 1) {
    value = alternatives.find(part => part.replace(/[^a-z]/gi, '').length > 1) || alternatives[0];
  }
  return value.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

function arrangeWords(source, seed) {
  const items = source.map((entry, sourceIndex) => {
    const word = playableWord(entry.word);
    return {...entry, word, letters: word.toLowerCase().replace(/[^a-z]/g, ''), sourceIndex};
  }).filter(item => item.letters);

  const groups = new Map();
  items.forEach(item => {
    const first = item.letters[0];
    if (!groups.has(first)) groups.set(first, []);
    groups.get(first).push(item);
  });
  groups.forEach((group, initial) => group.sort((a,b) => hash(`${a.word}-${seed}-${initial}`) - hash(`${b.word}-${seed}-${initial}`)));

  const arranged = [];
  let lastInitial = '';
  while (arranged.length < items.length) {
    const candidates = [...groups.entries()].filter(([,group]) => group.length && (group[0].letters[0] !== lastInitial || groups.size === 1));
    const pool = candidates.length ? candidates : [...groups.entries()].filter(([,group]) => group.length);
    pool.sort((a,b) => b[1].length - a[1].length || hash(`${a[0]}-${arranged.length}-${seed}`) - hash(`${b[0]}-${arranged.length}-${seed}`));
    const [initial, group] = pool[0];
    arranged.push(group.shift());
    lastInitial = initial;
  }
  return arranged;
}

function makeTenWordLevels(items) {
  const levels = [];
  for (let i = 0; i < items.length; i += 10) levels.push(items.slice(i, i + 10));
  const last = levels.at(-1);
  if (last && last.length < 10) {
    const seen = new Set(last.map(item => item.word));
    while (last.length < 10) {
      const previousInitial = last.at(-1)?.letters[0];
      const review = items.find(item => !seen.has(item.word) && item.letters[0] !== previousInitial)
        || items.find(item => !seen.has(item.word));
      if (!review) break;
      last.push({...review, review:true});
      seen.add(review.word);
    }
  }
  return levels;
}

export const WORLDS = VOCABULARY.themes.map((theme, index) => {
  const [emoji, color, soft] = themeStyles[index];
  const ordered = arrangeWords(theme.words, index + 1);
  return {
    id: `theme-${index + 1}`,
    name: theme.name,
    emoji,
    color,
    soft,
    sourceCount: theme.words.length,
    declaredCount: theme.declaredCount,
    levels: makeTenWordLevels(ordered),
  };
});

export const VOCAB_STATS = {
  sourceTitle: VOCABULARY.sourceTitle,
  extractedTotal: VOCABULARY.extractedTotal,
  declaredThemeTotal: VOCABULARY.declaredTotal,
  worldCount: WORLDS.length,
  levelCount: WORLDS.reduce((sum, world) => sum + world.levels.length, 0),
};

export const toWord = (item) => ({...item, letters: item.letters || item.word.toLowerCase().replace(/[^a-z]/g, '')});
