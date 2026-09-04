import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data', 'jlpt', 'production');
const CURATION = path.join(PROD, 'curation', 'words');
const WORDS_DIR = path.join(PROD, 'words');
const DAILY_DIR = path.join(PROD, 'daily');
const MANIFEST = path.join(PROD, 'manifest.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function listJson(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}
function addDays(text, days) {
  const d = new Date(`${text}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function monthOf(date) {
  return date.slice(0, 7);
}
function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
function uniqValues(words, start, getter, answer, count = 3) {
  const out = [];
  const seen = new Set([String(answer ?? '')]);
  for (let step = 1; step <= words.length && out.length < count; step += 1) {
    const value = String(getter(words[(start + step * 37) % words.length]) ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  if (out.length !== count) throw new Error(`Could not build ${count} distinct distractors at index ${start}`);
  return out;
}
function rotateOptions(answer, distractors, seed) {
  const values = [answer, ...distractors];
  const shift = seed % values.length;
  return values.slice(shift).concat(values.slice(0, shift));
}

const manifest = readJson(MANIFEST);
const curated = listJson(CURATION).flatMap((file) => {
  const value = readJson(file);
  return Array.isArray(value) ? value : value.words;
}).sort((a, b) => a.key.localeCompare(b.key));

if (curated.length !== manifest.targetWordCount) {
  throw new Error(`Expected ${manifest.targetWordCount} curated words, found ${curated.length}`);
}
const keys = new Set(curated.map((word) => word.key));
if (keys.size !== curated.length) throw new Error('Curated word keys are not unique.');

const words = curated.map((word) => ({
  key: word.key,
  word: word.word,
  reading: word.reading,
  meaning_ko: word.meaning_ko,
  meaning_ja: word.meaning_ja ?? '',
  part_of_speech: word.part_of_speech,
  example_ja: word.example_ja,
  example_ko: word.example_ko,
  source: 'curated',
}));

ensureCleanDir(WORDS_DIR);
for (let start = 0; start < words.length; start += 500) {
  const end = Math.min(start + 500, words.length);
  writeJson(path.join(WORDS_DIR, `${String(start + 1).padStart(4, '0')}-${String(end).padStart(4, '0')}.json`), {
    schemaVersion: 1,
    range: `${String(start + 1).padStart(4, '0')}-${String(end).padStart(4, '0')}`,
    words: words.slice(start, end),
  });
}

const grammarPatterns = [
  ['〜あっての', '〜이 있어야 비로소'], ['〜いかんでは', '〜여하에 따라서는'],
  ['〜いかんにかかわらず', '〜여하에 관계없이'], ['〜ずにはおかない', '반드시 〜하게 만들다'],
  ['〜ずにはすまない', '〜하지 않고는 끝나지 않다'], ['〜そばから', '〜하자마자 곧'],
  ['〜たところで', '〜해 보아도'], ['〜だに', '〜하기만 해도'],
  ['〜たりとも', '단 하나라도'], ['〜であれ', '〜라 할지라도'],
  ['〜てからというもの', '〜하고 나서부터 줄곧'], ['〜てやまない', '진심으로 계속 〜하다'],
  ['〜とあって', '〜라는 특별한 상황이라'], ['〜とあれば', '〜라면'],
  ['〜といえども', '〜라 할지라도'], ['〜なくして', '〜없이는'],
  ['〜ならでは', '〜이기에 가능한'], ['〜に即して', '〜에 입각하여'],
  ['〜にたえる', '〜할 가치가 있다'], ['〜に足る', '〜할 만하다'],
  ['〜にもまして', '〜보다도 더욱'], ['〜ばこそ', '바로 〜이기 때문에'],
  ['〜べからず', '〜해서는 안 된다'], ['〜までもない', '〜할 필요도 없다'],
  ['〜もさることながら', '〜도 물론이지만'], ['〜を皮切りに', '〜을 시작으로'],
  ['〜を禁じ得ない', '〜을 금할 수 없다'], ['〜をものともせず', '〜을 아랑곳하지 않고'],
];

const readingThemes = [
  '情報の受け取り方', '働き方と集中', '地域社会の役割', '技術と判断', '学習と記憶',
  '便利さと責任', '環境と生活', '組織の意思決定', '文化の継承', '時間の使い方',
];

function makeVocabQuestion(word, wordIndex, type, dayIndex, sequence) {
  const tag = `第${dayIndex + 1}日・問${sequence}`;
  if (type === 'kanji_reading') {
    const distractors = uniqValues(words, wordIndex, (w) => w.reading, word.reading);
    return {
      sequence,
      type,
      wordKey: word.key,
      prompt: `${tag} 「${word.word}」の読み方として最も適切なものを選びなさい。`,
      options: rotateOptions(word.reading, distractors, dayIndex + sequence),
      answer: word.reading,
      explanation_ko: `「${word.word}」는 「${word.reading}」라고 읽는다.`,
    };
  }
  if (type === 'context_fill') {
    const distractors = uniqValues(words, wordIndex, (w) => w.word, word.word);
    const base = String(word.example_ja || '').replace(word.word, '（　）');
    const sentence = base.includes('（　）') ? base : `${word.word}という語の使い方を文脈から判断する。`;
    return {
      sequence,
      type,
      wordKey: word.key,
      prompt: `${tag} 次の文の（　）に入る語として最も適切なものを選びなさい。${sentence}`,
      options: rotateOptions(word.word, distractors, dayIndex + sequence),
      answer: word.word,
      explanation_ko: `문맥과 예문의 용법을 보면 「${word.word}」가 가장 자연스럽다.`,
    };
  }
  const distractors = uniqValues(words, wordIndex, (w) => w.word, word.word);
  const gloss = word.meaning_ja || `${word.word}の中心的な意味`;
  return {
    sequence,
    type: 'meaning_usage_synonym',
    wordKey: word.key,
    prompt: `${tag} 「${gloss}」という意味に最も近い語を選びなさい。`,
    options: rotateOptions(word.word, distractors, dayIndex + sequence),
    answer: word.word,
    explanation_ko: `「${word.word}」의 핵심 의미와 가장 가깝다: ${word.meaning_ko}`, 
  };
}

function makeGrammarLesson(dayIndex, sequence) {
  const [pattern, meaning] = grammarPatterns[(dayIndex * 2 + sequence - 1) % grammarPatterns.length];
  return {
    sequence,
    pattern,
    meaning_ko: meaning,
    explanation_ko: `${pattern}의 접속과 문맥상 의미를 함께 확인한다. 단순 번역보다 앞뒤 문장의 관계를 보고 판단하는 것이 중요하다.`,
    examples: [{
      ja: `経験があれば十分というわけではなく、状況に応じて判断する姿勢が必要だ。${pattern}という表現も文脈の関係を意識して理解したい。`,
      ko: `${pattern} 표현은 앞뒤 문맥의 관계를 의식해서 이해하는 것이 좋다.`,
    }],
  };
}

function makeGrammarQuestion(dayIndex, sequence) {
  const correctIndex = (dayIndex * 3 + sequence - 1) % grammarPatterns.length;
  const answer = grammarPatterns[correctIndex][0];
  const distractors = [];
  for (let step = 1; distractors.length < 3; step += 1) {
    const value = grammarPatterns[(correctIndex + step * 5) % grammarPatterns.length][0];
    if (value !== answer && !distractors.includes(value)) distractors.push(value);
  }
  return {
    sequence,
    prompt: `第${dayIndex + 1}日・文法${sequence} 文脈に最も適するN1文法表現を選びなさい。条件や状況の違いを踏まえて判断することが重要である。`,
    options: rotateOptions(answer, distractors, dayIndex + sequence),
    answer,
    explanation_ko: `이 문항에서는 문맥의 관계에 맞는 「${answer}」를 고르는 것이 핵심이다.`,
  };
}

function makeReadingSet(dayIndex) {
  const theme = readingThemes[dayIndex % readingThemes.length];
  const n = dayIndex + 1;
  const passage = `第${n}日のテーマは「${theme}」である。私たちは日常生活の中で、多くの情報や選択肢に囲まれている。便利な仕組みが増えるほど、考える手間は減ったように見えるが、実際には何を基準に選ぶかという判断の重要性はむしろ高まっている。ある方法が短期的に効率的であっても、長期的な影響まで同じとは限らない。また、周囲の人が選んでいるという理由だけで、自分にとっても最善だと決めつけることはできない。重要なのは、目的を明確にし、得られた情報の出所や条件を確かめ、必要であれば異なる立場から見直すことである。失敗を完全に避けることより、判断した理由を後から説明できる状態にしておく方が、学習や仕事では役に立つ。さらに、結果が予想と違ったときには、判断そのものを責めるのではなく、どの前提が違っていたのかを検討する必要がある。こうした振り返りを積み重ねることで、次の選択ではより適切な基準を持てるようになる。つまり、良い判断とは一度で正解を当てることではなく、根拠を持って選び、その結果から基準を更新していく過程だと考えられる。`;
  return {
    sequence: 1,
    title: `${theme}―第${n}日`,
    passage,
    questions: [
      {
        sequence: 1,
        prompt: `第${n}日の文章で、筆者が最も重視していることは何か。`,
        options: ['判断の根拠を持ち、結果から基準を更新すること', '周囲と同じ選択をすること', '短期的な効率だけを優先すること', '失敗の可能性を完全になくすこと'],
        answer: '判断の根拠を持ち、結果から基準を更新すること',
        explanation_ko: '필자는 근거를 가지고 판단하고 결과를 통해 기준을 갱신하는 과정을 중요하게 본다.',
      },
      {
        sequence: 2,
        prompt: `第${n}日の文章によれば、結果が予想と違った場合に必要なことは何か。`,
        options: ['前提のどこが違っていたかを検討すること', '判断した人を責めること', '同じ方法を必ず繰り返すこと', '情報を一切見ないこと'],
        answer: '前提のどこが違っていたかを検討すること',
        explanation_ko: '예상과 다른 결과가 나왔을 때는 어떤 전제가 달랐는지 검토해야 한다고 설명한다.',
      },
      {
        sequence: 3,
        prompt: `第${n}日の文章の内容と合うものはどれか。`,
        options: ['便利さが増えても判断基準の重要性は下がらない', '多数派の選択は常に最善である', '良い判断には振り返りが不要である', '長期的な影響は短期的な結果と必ず同じである'],
        answer: '便利さが増えても判断基準の重要性は下がらない',
        explanation_ko: '편리한 구조가 늘어도 무엇을 기준으로 선택할지 판단하는 중요성은 오히려 커진다고 서술한다.',
      },
    ],
  };
}

const start = new Date(`${manifest.studyStartDate}T00:00:00Z`);
const end = new Date(`${manifest.preparedThrough}T00:00:00Z`);
const totalDays = Math.floor((end - start) / 86400000) + 1;
const days = [];

for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
  const date = addDays(manifest.studyStartDate, dayIndex);
  const introStart = dayIndex * manifest.dailyNewWords;
  const introWords = dayIndex < manifest.newWordScheduling.fullDays
    ? words.slice(introStart, introStart + manifest.dailyNewWords)
    : [];
  const questionTargets = introWords.length
    ? introWords.slice(0, manifest.dailyTargets.vocabQuestions)
    : Array.from({ length: manifest.dailyTargets.vocabQuestions }, (_, i) => words[(dayIndex * 17 + i * 11) % words.length]);
  const types = ['kanji_reading', 'kanji_reading', 'kanji_reading', ...Array(7).fill('context_fill'), ...Array(5).fill('meaning_usage_synonym')];
  const vocabQuestions = questionTargets.map((word, index) => {
    const wordIndex = words.findIndex((w) => w.key === word.key);
    return makeVocabQuestion(word, wordIndex, types[index], dayIndex, index + 1);
  });
  days.push({
    date,
    newWordKeys: introWords.map((word) => word.key),
    vocabQuestions,
    grammarLessons: [makeGrammarLesson(dayIndex, 1), makeGrammarLesson(dayIndex, 2)],
    grammarQuestions: [makeGrammarQuestion(dayIndex, 1), makeGrammarQuestion(dayIndex, 2), makeGrammarQuestion(dayIndex, 3)],
    readingSets: [makeReadingSet(dayIndex)],
  });
}

ensureCleanDir(DAILY_DIR);
const byMonth = new Map();
for (const day of days) {
  const month = monthOf(day.date);
  if (!byMonth.has(month)) byMonth.set(month, []);
  byMonth.get(month).push(day);
}
for (const [month, monthDays] of byMonth) {
  writeJson(path.join(DAILY_DIR, `${month}.json`), { schemaVersion: 1, month, days: monthDays });
}

console.log(`Materialized JLPT production data: ${words.length} words, ${days.length} days.`);
console.log(`  words -> ${path.relative(ROOT, WORDS_DIR)}`);
console.log(`  daily -> ${path.relative(ROOT, DAILY_DIR)}`);
