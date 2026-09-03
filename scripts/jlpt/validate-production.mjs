import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PRODUCTION_DIR = path.join(ROOT, 'data', 'jlpt', 'production');
const WORDS_DIR = path.join(PRODUCTION_DIR, 'words');
const DAILY_DIR = path.join(PRODUCTION_DIR, 'daily');
const MANIFEST_FILE = path.join(PRODUCTION_DIR, 'manifest.json');

const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/u;
const HIRAGANA = /^[\u3040-\u309fー・\s]+$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WORD_KEY = /^n1-\d{4}$/;
const PLACEHOLDER = /(다른\s*의미|반대\s*의미|관련\s*없음|뜻\s*확인|適切なN1表現|不自然な表現|該当なし|べつのよみ|まぎらわしいよみ|N1文法表現|選択肢[ＡＡA-D]?|ダミー|placeholder|dummy|本日の語彙)/iu;
const VOCAB_TYPES = new Set(['kanji_reading', 'context_fill', 'meaning_usage_synonym']);

const errors = [];
const warnings = [];

function fail(where, message) {
  errors.push(`${where}: ${message}`);
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(path.relative(ROOT, file).replaceAll('\\', '/'), `JSON parse failed: ${error.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function parseDate(text) {
  if (!DATE.test(text)) return null;
  const value = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

function addDays(text, days) {
  const value = parseDate(text);
  if (!value) return '';
  value.setUTCDate(value.getUTCDate() + days);
  return formatDate(value);
}

function daysInclusive(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b || b < a) return [];
  const values = [];
  for (let cursor = new Date(a); cursor <= b; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    values.push(formatDate(cursor));
  }
  return values;
}

function daysBetween(a, b) {
  const aa = parseDate(a);
  const bb = parseDate(b);
  if (!aa || !bb) return Infinity;
  return Math.abs(Math.round((bb - aa) / 86400000));
}

function hasHangul(value) {
  return HANGUL.test(normalized(value));
}

function validateJapaneseFacing(value, where, { allowEmpty = false } = {}) {
  const text = normalized(value);
  if (!text && !allowEmpty) fail(where, 'Japanese question-facing text is required');
  if (text && hasHangul(text)) fail(where, 'Hangul is forbidden in JLPT question-facing text');
  if (text && PLACEHOLDER.test(text)) fail(where, `placeholder/metadata text is forbidden: ${JSON.stringify(text)}`);
  return text;
}

function validateKoreanSupport(value, where, { required = true } = {}) {
  const text = normalized(value);
  if (!text && required) fail(where, 'Korean learner-support text is required');
  if (text && !HANGUL.test(text)) warn(where, 'support text contains no Hangul; review translation quality');
  if (text && PLACEHOLDER.test(text)) fail(where, 'placeholder support text is forbidden');
  return text;
}

function ensureArray(value, where) {
  if (!Array.isArray(value)) {
    fail(where, 'must be an array');
    return [];
  }
  return value;
}

function validateQuestion(question, where, date, signatures, { requireExplanation = true } = {}) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    fail(where, 'question must be an object');
    return null;
  }

  const prompt = validateJapaneseFacing(question.prompt ?? question.question, `${where}.prompt`);
  const options = ensureArray(question.options, `${where}.options`).map((value) => normalized(value));
  if (options.length !== 4) fail(`${where}.options`, `must contain exactly 4 options (got ${options.length})`);
  options.forEach((option, index) => validateJapaneseFacing(option, `${where}.options[${index}]`));
  if (new Set(options).size !== options.length) fail(`${where}.options`, 'options must be distinct after NFKC/whitespace normalization');

  const answer = validateJapaneseFacing(question.answer, `${where}.answer`);
  if (answer && options.filter((option) => option === answer).length !== 1) {
    fail(`${where}.answer`, 'answer must match exactly one option');
  }

  if (requireExplanation) validateKoreanSupport(question.explanation_ko ?? question.explanationKo, `${where}.explanation_ko`);

  const signature = normalized(`${prompt}\n${options.join('\n')}`);
  if (signature) {
    const previous = signatures.get(signature);
    if (previous && date && previous.date && daysBetween(previous.date, date) < 90) {
      fail(where, `exact MCQ reused within 90 days (previous: ${previous.where})`);
    } else if (!previous) {
      signatures.set(signature, { date, where });
    }
  }

  return { prompt, options, answer };
}

function validateWord(word, where, corpus, surfaceReading) {
  if (!word || typeof word !== 'object' || Array.isArray(word)) {
    fail(where, 'word row must be an object');
    return;
  }
  const key = normalized(word.key);
  const surface = normalized(word.word);
  const reading = normalized(word.reading);
  const meaningKo = validateKoreanSupport(word.meaning_ko ?? word.meaningKo, `${where}.meaning_ko`);
  const meaningJa = normalized(word.meaning_ja ?? word.meaningJa);
  const partOfSpeech = normalized(word.part_of_speech ?? word.partOfSpeech);
  const exampleJa = validateJapaneseFacing(word.example_ja ?? word.exampleJa, `${where}.example_ja`);
  validateKoreanSupport(word.example_ko ?? word.exampleKo, `${where}.example_ko`);
  const source = normalized(word.source);

  if (!WORD_KEY.test(key)) fail(`${where}.key`, 'must use stable key n1-0001..n1-3000');
  if (!surface) fail(`${where}.word`, 'word is required');
  if (!reading) fail(`${where}.reading`, 'reading is required');
  if (reading && !HIRAGANA.test(reading)) warn(`${where}.reading`, 'reading should normally be hiragana');
  if (!meaningKo) fail(`${where}.meaning_ko`, 'Korean meaning is required');
  if (!meaningJa) warn(`${where}.meaning_ja`, 'Japanese dictionary-style meaning is recommended');
  if (!partOfSpeech) fail(`${where}.part_of_speech`, 'part of speech is required');
  if (!exampleJa) fail(`${where}.example_ja`, 'natural Japanese example is required');
  if (!source) fail(`${where}.source`, 'source/provenance is required');

  if (key) {
    if (corpus.has(key)) fail(where, `duplicate key: ${key}`);
    else corpus.set(key, { key, word: surface, reading, where });
  }
  const pair = `${surface}\u0000${reading}`;
  if (surface && reading) {
    if (surfaceReading.has(pair)) fail(where, `duplicate word+reading: ${surface} / ${reading}`);
    else surfaceReading.set(pair, where);
  }
}

function validateGrammarLesson(lesson, where) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    fail(where, 'grammar lesson must be an object');
    return;
  }
  validateJapaneseFacing(lesson.pattern, `${where}.pattern`);
  validateKoreanSupport(lesson.meaning_ko ?? lesson.meaningKo, `${where}.meaning_ko`);
  validateKoreanSupport(lesson.explanation_ko ?? lesson.explanationKo, `${where}.explanation_ko`);
  const examples = ensureArray(lesson.examples, `${where}.examples`);
  if (examples.length < 1) fail(`${where}.examples`, 'at least one example is required');
  examples.forEach((example, index) => {
    if (!example || typeof example !== 'object' || Array.isArray(example)) {
      fail(`${where}.examples[${index}]`, 'example must be an object');
      return;
    }
    validateJapaneseFacing(example.ja, `${where}.examples[${index}].ja`);
    validateKoreanSupport(example.ko, `${where}.examples[${index}].ko`);
  });
}

function validateDaily(day, where, manifest, corpus, introduced, signatures) {
  if (!day || typeof day !== 'object' || Array.isArray(day)) {
    fail(where, 'day must be an object');
    return null;
  }
  const date = normalized(day.date);
  if (!parseDate(date)) fail(`${where}.date`, 'valid YYYY-MM-DD date is required');

  const newWordKeys = ensureArray(day.newWordKeys, `${where}.newWordKeys`).map(normalized);
  if (new Set(newWordKeys).size !== newWordKeys.length) fail(`${where}.newWordKeys`, 'duplicate word keys in the same day');
  newWordKeys.forEach((key, index) => {
    if (!corpus.has(key)) fail(`${where}.newWordKeys[${index}]`, `unknown corpus key: ${key}`);
    const previous = introduced.get(key);
    if (previous) fail(`${where}.newWordKeys[${index}]`, `word already introduced on ${previous}`);
    else introduced.set(key, date);
  });

  const vocabQuestions = ensureArray(day.vocabQuestions, `${where}.vocabQuestions`);
  const grammarLessons = ensureArray(day.grammarLessons, `${where}.grammarLessons`);
  const grammarQuestions = ensureArray(day.grammarQuestions, `${where}.grammarQuestions`);
  const readingSets = ensureArray(day.readingSets, `${where}.readingSets`);

  const target = manifest.dailyTargets;
  if (vocabQuestions.length !== target.vocabQuestions) fail(`${where}.vocabQuestions`, `expected ${target.vocabQuestions}, got ${vocabQuestions.length}`);
  if (grammarLessons.length !== target.grammarLessons) fail(`${where}.grammarLessons`, `expected ${target.grammarLessons}, got ${grammarLessons.length}`);
  if (grammarQuestions.length !== target.grammarQuestions) fail(`${where}.grammarQuestions`, `expected ${target.grammarQuestions}, got ${grammarQuestions.length}`);
  if (readingSets.length !== target.readingSets) fail(`${where}.readingSets`, `expected ${target.readingSets}, got ${readingSets.length}`);

  const typeCounts = new Map();
  const questionedWords = new Set();
  const isPostCorpusReviewDay = newWordKeys.length === 0;
  vocabQuestions.forEach((question, index) => {
    const qWhere = `${where}.vocabQuestions[${index}]`;
    const type = normalized(question?.type);
    if (!VOCAB_TYPES.has(type)) fail(`${qWhere}.type`, `invalid vocabulary question type: ${type}`);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    const wordKey = normalized(question?.wordKey);
    if (!corpus.has(wordKey)) fail(`${qWhere}.wordKey`, `unknown word key: ${wordKey}`);
    if (wordKey && !isPostCorpusReviewDay && !newWordKeys.includes(wordKey)) {
      fail(`${qWhere}.wordKey`, 'new-word phase vocabulary questions must target one of the day\'s new words');
    }
    if (wordKey && isPostCorpusReviewDay && !introduced.has(wordKey)) {
      fail(`${qWhere}.wordKey`, 'post-corpus vocabulary questions may target only words introduced on an earlier study day');
    }
    if (questionedWords.has(wordKey)) fail(`${qWhere}.wordKey`, 'a vocabulary target may appear in at most one MCQ per day');
    if (wordKey) questionedWords.add(wordKey);
    const checked = validateQuestion(question, qWhere, date, signatures);
    if (type === 'kanji_reading' && checked && corpus.has(wordKey)) {
      const expected = normalized(corpus.get(wordKey).reading);
      if (checked.answer !== expected) fail(`${qWhere}.answer`, `kanji-reading answer must equal corpus reading ${expected}`);
    }
  });

  for (const [type, expected] of Object.entries(manifest.vocabularyQuestionMix)) {
    const actual = typeCounts.get(type) ?? 0;
    if (actual !== expected) fail(`${where}.vocabQuestions`, `type ${type}: expected ${expected}, got ${actual}`);
  }

  grammarLessons.forEach((lesson, index) => validateGrammarLesson(lesson, `${where}.grammarLessons[${index}]`));
  grammarQuestions.forEach((question, index) => validateQuestion(question, `${where}.grammarQuestions[${index}]`, date, signatures));

  readingSets.forEach((set, index) => {
    const rWhere = `${where}.readingSets[${index}]`;
    if (!set || typeof set !== 'object' || Array.isArray(set)) {
      fail(rWhere, 'reading set must be an object');
      return;
    }
    validateJapaneseFacing(set.title, `${rWhere}.title`);
    const passage = validateJapaneseFacing(set.passage, `${rWhere}.passage`);
    if (passage.length < 300) fail(`${rWhere}.passage`, `N1 production passage is too short (${passage.length} chars; minimum 300)`);
    const questions = ensureArray(set.questions, `${rWhere}.questions`);
    if (questions.length !== target.readingQuestionsPerSet) {
      fail(`${rWhere}.questions`, `expected ${target.readingQuestionsPerSet}, got ${questions.length}`);
    }
    questions.forEach((question, questionIndex) => validateQuestion(question, `${rWhere}.questions[${questionIndex}]`, date, signatures));
  });

  return { date, newWordKeys };
}

if (!fs.existsSync(PRODUCTION_DIR)) fail('data/jlpt/production', 'production directory is missing');
const manifest = readJson(MANIFEST_FILE);

if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
  fail('data/jlpt/production/manifest.json', 'manifest is required');
}

if (manifest) {
  if (manifest.schemaVersion !== 1) fail('manifest.schemaVersion', 'expected schemaVersion 1');
  if (manifest.planCode !== 'N1_2027_JUL') fail('manifest.planCode', 'expected N1_2027_JUL');
  if (!parseDate(manifest.studyStartDate)) fail('manifest.studyStartDate', 'invalid date');
  if (!parseDate(manifest.preparedThrough)) fail('manifest.preparedThrough', 'invalid date');
  if (manifest.preparedThrough < manifest.studyStartDate) fail('manifest.preparedThrough', 'must be on/after studyStartDate');
  if (!Number.isInteger(manifest.targetWordCount) || manifest.targetWordCount <= 0) fail('manifest.targetWordCount', 'positive integer required');
  if (!Number.isInteger(manifest.dailyNewWords) || manifest.dailyNewWords <= 0) fail('manifest.dailyNewWords', 'positive integer required');
  if (!manifest.dailyTargets || typeof manifest.dailyTargets !== 'object') fail('manifest.dailyTargets', 'dailyTargets is required');
  if (!manifest.vocabularyQuestionMix || typeof manifest.vocabularyQuestionMix !== 'object') fail('manifest.vocabularyQuestionMix', 'vocabularyQuestionMix is required');
  const mixTotal = Object.values(manifest.vocabularyQuestionMix ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (mixTotal !== Number(manifest.dailyTargets?.vocabQuestions ?? 0)) fail('manifest.vocabularyQuestionMix', 'mix must sum to vocabQuestions target');
  const fullDays = Number(manifest.newWordScheduling?.fullDays ?? 0);
  if (fullDays * Number(manifest.dailyNewWords ?? 0) !== Number(manifest.targetWordCount ?? 0)) {
    fail('manifest.newWordScheduling.fullDays', 'fullDays × dailyNewWords must equal targetWordCount');
  }
  if (manifest.runtime?.precreateDailySessions !== false || manifest.runtime?.precreateDailyWordRows !== false) {
    fail('manifest.runtime', 'production must not precreate progress sessions/daily review rows');
  }
}

const corpus = new Map();
const surfaceReading = new Map();
for (const file of listJsonFiles(WORDS_DIR)) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const document = readJson(file);
  const words = Array.isArray(document) ? document : document?.words;
  if (!Array.isArray(words)) {
    fail(rel, 'word shard must be an array or { words: [] }');
    continue;
  }
  words.forEach((word, index) => validateWord(word, `${rel}[${index}]`, corpus, surfaceReading));
}

if (manifest && corpus.size !== manifest.targetWordCount) {
  fail('data/jlpt/production/words', `expected exactly ${manifest.targetWordCount} unique words, found ${corpus.size}`);
}
if (manifest && corpus.size === manifest.targetWordCount) {
  for (let index = 1; index <= manifest.targetWordCount; index += 1) {
    const key = `n1-${String(index).padStart(4, '0')}`;
    if (!corpus.has(key)) fail('data/jlpt/production/words', `missing contiguous key ${key}`);
  }
}

const signatures = new Map();
const introduced = new Map();
const dailyByDate = new Map();
let dailyCount = 0;

for (const file of listJsonFiles(DAILY_DIR)) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const document = readJson(file);
  const days = Array.isArray(document) ? document : document?.days;
  if (!Array.isArray(days)) {
    fail(rel, 'daily shard must be an array or { days: [] }');
    continue;
  }
  days.forEach((day, index) => {
    const where = `${rel}.days[${index}]`;
    const result = manifest ? validateDaily(day, where, manifest, corpus, introduced, signatures) : null;
    if (!result?.date) return;
    if (dailyByDate.has(result.date)) fail(`${where}.date`, `duplicate daily date; already defined at ${dailyByDate.get(result.date).where}`);
    else dailyByDate.set(result.date, { where, newWordKeys: result.newWordKeys });
    dailyCount += 1;
  });
}

if (manifest && parseDate(manifest.studyStartDate) && parseDate(manifest.preparedThrough)) {
  const expectedDates = daysInclusive(manifest.studyStartDate, manifest.preparedThrough);
  if (dailyByDate.size !== expectedDates.length) {
    fail('data/jlpt/production/daily', `expected ${expectedDates.length} prepared dates, found ${dailyByDate.size}`);
  }
  expectedDates.forEach((date, index) => {
    const day = dailyByDate.get(date);
    if (!day) {
      fail('data/jlpt/production/daily', `missing prepared date ${date}`);
      return;
    }
    const expectedNew = index < manifest.newWordScheduling.fullDays ? manifest.dailyNewWords : manifest.newWordScheduling.afterCorpusExhausted;
    if (day.newWordKeys.length !== expectedNew) {
      fail(`${day.where}.newWordKeys`, `date ${date}: expected ${expectedNew} new words, got ${day.newWordKeys.length}`);
    }
  });
}

if (manifest && introduced.size !== manifest.targetWordCount) {
  fail('data/jlpt/production/daily', `expected all ${manifest.targetWordCount} corpus words to be introduced exactly once, found ${introduced.size}`);
}

if (warnings.length) {
  console.warn(`JLPT production validation warnings (${warnings.length})`);
  warnings.slice(0, 200).forEach((message) => console.warn(`  - ${message}`));
  if (warnings.length > 200) console.warn(`  ... and ${warnings.length - 200} more`);
}

if (errors.length) {
  console.error(`JLPT production validation FAILED (${errors.length})`);
  errors.slice(0, 250).forEach((message) => console.error(`  - ${message}`));
  if (errors.length > 250) console.error(`  ... and ${errors.length - 250} more`);
  process.exit(1);
}

console.log(`JLPT production validation passed: ${corpus.size} words, ${dailyCount} prepared days, ${signatures.size} unique MCQs.`);
console.log(`New-word introductions: ${manifest.studyStartDate}..${addDays(manifest.studyStartDate, manifest.newWordScheduling.fullDays - 1)} (${introduced.size} unique words).`);
