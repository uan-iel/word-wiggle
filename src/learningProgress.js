export const LEARNING_PROGRESS_KEY = 'wiggleLearningProgressV1';

export function emptyLearningProgress() {
  return {version:1, words:{}, totals:{completedWords:0, totalMistakes:0, totalPracticeMs:0}, updatedAt:null};
}

export function loadLearningProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(LEARNING_PROGRESS_KEY) || 'null');
    if (!stored || stored.version !== 1 || typeof stored.words !== 'object') return emptyLearningProgress();
    return {...emptyLearningProgress(), ...stored, totals:{...emptyLearningProgress().totals, ...(stored.totals || {})}};
  } catch { return emptyLearningProgress(); }
}

function masteryFor(record) {
  const accuracy = record.completions ? record.firstTryCompletions / record.completions : 0;
  let level = record.completions >= 8 && accuracy >= .75 ? 5
    : record.completions >= 5 && accuracy >= .65 ? 4
    : record.completions >= 3 && accuracy >= .5 ? 3
    : record.completions >= 2 ? 2
    : 1;
  if (record.lastHintTier >= 3 && level > 1) level -= 1;
  return level;
}

export function recordWordCompletion(progress, attempt, now = Date.now()) {
  const previous = progress.words[attempt.id] || {
    id:attempt.id, word:attempt.word, zh:attempt.zh, pos:attempt.pos, ipa:attempt.ipa, worldId:attempt.worldId, worldName:attempt.worldName,
    completions:0, firstTryCompletions:0, totalMistakes:0, totalHints:0,
    currentFirstTryStreak:0, bestFirstTryStreak:0, totalDurationMs:0, averageDurationMs:0,
    wrongLetters:{}, mastery:0, lastPracticedAt:null, nextReviewAt:null,
  };
  const firstTry = attempt.mistakes === 0;
  const wrongLetters = {...previous.wrongLetters};
  attempt.wrongLetters.forEach(error => {
    const key = `${error.position}:${error.expected}>${error.chosen}`;
    wrongLetters[key] = (wrongLetters[key] || 0) + 1;
  });
  const completions = previous.completions + 1;
  const currentFirstTryStreak = firstTry ? previous.currentFirstTryStreak + 1 : 0;
  const record = {
    ...previous,
    word:attempt.word, zh:attempt.zh, pos:attempt.pos, ipa:attempt.ipa, worldId:attempt.worldId, worldName:attempt.worldName,
    completions,
    firstTryCompletions:previous.firstTryCompletions + (firstTry ? 1 : 0),
    totalMistakes:previous.totalMistakes + attempt.mistakes,
    totalHints:previous.totalHints + (attempt.maxHintTier > 1 ? 1 : 0),
    currentFirstTryStreak,
    bestFirstTryStreak:Math.max(previous.bestFirstTryStreak, currentFirstTryStreak),
    totalDurationMs:previous.totalDurationMs + attempt.durationMs,
    averageDurationMs:Math.round((previous.totalDurationMs + attempt.durationMs) / completions),
    wrongLetters,
    lastHintTier:attempt.maxHintTier,
    lastMistakes:attempt.mistakes,
    lastDurationMs:attempt.durationMs,
    lastFirstTry:firstTry,
    lastPracticedAt:new Date(now).toISOString(),
  };
  record.mastery = previous.manuallyMastered ? 5 : masteryFor(record);
  const intervals = [0, 1, 3, 7, 14, 30];
  record.nextReviewAt = previous.manuallyMastered ? null : new Date(now + intervals[record.mastery] * 86400000).toISOString();
  return {
    ...progress,
    words:{...progress.words, [attempt.id]:record},
    totals:{
      completedWords:(progress.totals?.completedWords || 0) + 1,
      totalMistakes:(progress.totals?.totalMistakes || 0) + attempt.mistakes,
      totalPracticeMs:(progress.totals?.totalPracticeMs || 0) + attempt.durationMs,
    },
    updatedAt:new Date(now).toISOString(),
  };
}

export function markWordMastered(progress, id, now = Date.now()) {
  const previous = progress.words[id];
  if (!previous) return progress;
  return {
    ...progress,
    words:{...progress.words, [id]:{
      ...previous, mastery:5, manuallyMastered:true,
      manuallyMasteredAt:new Date(now).toISOString(), nextReviewAt:null,
    }},
    updatedAt:new Date(now).toISOString(),
  };
}

export function learningSummary(progress, now = Date.now()) {
  const records = Object.values(progress.words || {});
  const today = new Date(now).toDateString();
  const firstTry = records.reduce((sum, item) => sum + item.firstTryCompletions, 0);
  const completions = records.reduce((sum, item) => sum + item.completions, 0);
  return {
    practiced:records.length,
    mastered:records.filter(item => item.mastery >= 4).length,
    learning:records.filter(item => item.mastery > 0 && item.mastery < 4).length,
    due:records.filter(item => !item.manuallyMastered && item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= now).length,
    today:records.filter(item => item.lastPracticedAt && new Date(item.lastPracticedAt).toDateString() === today).length,
    firstTryRate:completions ? Math.round(firstTry / completions * 100) : 0,
    practiceMinutes:Math.round((progress.totals?.totalPracticeMs || 0) / 60000),
  };
}
