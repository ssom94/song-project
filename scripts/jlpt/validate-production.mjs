import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PRODUCTION_DIR = path.join(ROOT, 'data', 'jlpt', 'production');
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/u;
const PLACEHOLDER = /(다른\s*의미|반대\s*의미|관련\s*없음|뜻\s*확인|適切なN1表現|不自然な表現|該当なし|べつのよみ|まぎらわしいよみ|N1文法表現|選択肢[ＡＡA-B]?|ダミー|placeholder|dummy)/iu;
const QUESTION_KEYS = new Set(['title', 'prompt', 'question', 'passage', 'answer']);
const OPTION_KEYS = new Set(['options']);
const ALLOWED_KOREAN_KEYS = new Set([
  'meaning_ko', 'meaningKo', 'example_ko', 'exampleKo', 'translation_ko', 'translationKo',
  'explanation_ko', 'explanationKo', 'note_ko', 'noteKo', 'source_note', 'sourceNote',
]);

const errors = [];
const warnings = [];

function fail(where, message) {
  errors.push(`${where}: ${message}`);
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(path.relative(ROOT, file), `JSON parse failed: ${error.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function hasHangul(value) {
  return HANGUL.test(normalized(value));
}

function validateQuestionFacing(value, where) {
  const text = normalized(value);
  if (!text) fail(where, 'question-facing text is empty');
  if (hasHangul(text)) fail(where, 'Hangul is forbidden in JLPT question-facing text');
  if (PLACEHOLDER.test(text)) fail(where, `placeholder-like text is forbidden: ${JSON.stringify(text)}`);
}

function validateQuestion(question, where, date, signatures) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    fail(where, 'question must be an object');
    return;
  }

  for (const key of QUESTION_KEYS) {
    if (key in question && question[key] != null) validateQuestionFacing(question[key], `${where}.${key}`);
  }

  const options = question.options;
  if (!Array.isArray(options) || options.length !== 4) {
    fail(`${where}.options`, `MCQ must have exactly 4 options (got ${Array.isArray(options) ? options.length : 'non-array'})`);
    return;
  }
  const clean = options.map(normalized);
  clean.forEach((option, index) => validateQuestionFacing(option, `${where}.options[${index}]`));
  if (new Set(clean).size !== 4) fail(`${where}.options`, 'options must be unique');

  const answer = normalized(question.answer);
  validateQuestionFacing(answer, `${where}.answer`);
  if (clean.filter((option) => option === answer).length !== 1) {
    fail(`${where}.answer`, 'answer must match exactly one option');
  }

  const signature = normalized(`${question.prompt ?? question.question ?? ''}\n${clean.join('\n')}`);
  if (signature) {
    const previous = signatures.get(signature);
    if (previous && date && previous.date && daysBetween(previous.date, date) < 90) {
      fail(where, `exact question reused within 90 days (previous: ${previous.where})`);
    } else if (!previous || (date && previous.date && date < previous.date)) {
      signatures.set(signature, { date, where });
    }
  }
}

function daysBetween(a, b) {
  const aa = Date.parse(`${a}T00:00:00Z`);
  const bb = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return Infinity;
  return Math.abs(Math.round((bb - aa) / 86400000));
}

function walkQuestions(value, where, date, signatures, parentKey = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkQuestions(item, `${where}[${index}]`, date, signatures, parentKey));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const looksLikeQuestion = ('options' in value) && ('answer' in value) && (('prompt' in value) || ('question' in value));
  if (looksLikeQuestion) validateQuestion(value, where, date, signatures);

  for (const [key, child] of Object.entries(value)) {
    if (ALLOWED_KOREAN_KEYS.has(key)) continue;
    if (QUESTION_KEYS.has(key) && typeof child === 'string') validateQuestionFacing(child, `${where}.${key}`);
    if (OPTION_KEYS.has(key) && Array.isArray(child) && !looksLikeQuestion) {
      child.forEach((option, index) => validateQuestionFacing(option, `${where}.${key}[${index}]`));
    }
    if (typeof child === 'object' && child !== null) walkQuestions(child, `${where}.${key}`, date, signatures, key);
  }
}

function collectWordArrays(document, file) {
  const arrays = [];
  if (Array.isArray(document)) arrays.push(document);
  if (Array.isArray(document?.words)) arrays.push(document.words);
  if (Array.isArray(document?.items) && /word/i.test(path.basename(file))) arrays.push(document.items);
  return arrays;
}

function validateWord(word, where, seenWords) {
  if (!word || typeof word !== 'object' || Array.isArray(word)) {
    fail(where, 'word row must be an object');
    return;
  }
  const surface = normalized(word.word ?? word.japanese);
  const reading = normalized(word.reading ?? word.hiragana);
  const meaningKo = normalized(word.meaning_ko ?? word.meaningKo ?? word.korean);
  const exampleJa = normalized(word.example_ja ?? word.exampleJa);
  if (!surface) fail(`${where}.word`, 'word is required');
  if (!reading) fail(`${where}.reading`, 'reading is required');
  if (!meaningKo) fail(`${where}.meaning_ko`, 'Korean meaning is required');
  if (PLACEHOLDER.test(meaningKo)) fail(`${where}.meaning_ko`, 'placeholder meaning is forbidden');
  if (!exampleJa) fail(`${where}.example_ja`, 'Japanese example is required');
  if (hasHangul(exampleJa)) fail(`${where}.example_ja`, 'Japanese example must not contain Hangul');
  if (PLACEHOLDER.test(exampleJa)) fail(`${where}.example_ja`, 'placeholder example is forbidden');
  const key = `${surface}\u0000${reading}`;
  if (surface && reading && seenWords.has(key)) fail(where, `duplicate word+reading: ${surface} / ${reading}`);
  else if (surface && reading) seenWords.add(key);
}

if (!fs.existsSync(PRODUCTION_DIR)) {
  console.error('JLPT production directory does not exist:', path.relative(ROOT, PRODUCTION_DIR));
  process.exit(1);
}

const files = listJsonFiles(PRODUCTION_DIR);
if (!files.length) fail('data/jlpt/production', 'no production JSON files found');

const seenWords = new Set();
const signatures = new Map();
let wordRows = 0;
let dayRows = 0;
let manifest = null;

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const document = readJson(file);
  if (document == null) continue;
  if (path.basename(file) === 'manifest.json') manifest = document;

  for (const words of collectWordArrays(document, file)) {
    words.forEach((word, index) => validateWord(word, `${rel}.words[${index}]`, seenWords));
    wordRows += words.length;
  }

  const days = Array.isArray(document?.days) ? document.days : (Array.isArray(document) && /daily|schedule|practice/i.test(path.basename(file)) ? document : []);
  if (days.length) {
    for (let index = 0; index < days.length; index += 1) {
      const day = days[index];
      const date = normalized(day?.date ?? day?.study_date ?? day?.studyDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`${rel}.days[${index}]`, 'valid study date is required');
      walkQuestions(day, `${rel}.days[${index}]`, date, signatures);
    }
    dayRows += days.length;
  } else {
    walkQuestions(document, rel, '', signatures);
  }
}

if (!manifest) fail('data/jlpt/production/manifest.json', 'manifest is required');
else {
  const target = Number(manifest.targetWordCount ?? 0);
  if (!Number.isInteger(target) || target <= 0) fail('manifest.targetWordCount', 'positive integer required');
  if (target && wordRows !== target) fail('production words', `expected exactly ${target} word rows, found ${wordRows}`);
  if (manifest.preparedThrough && manifest.studyStartDate) {
    if (manifest.preparedThrough < manifest.studyStartDate) fail('manifest.preparedThrough', 'must be on/after studyStartDate');
  }
}

if (warnings.length) {
  console.warn(`JLPT production validation warnings (${warnings.length})`);
  warnings.forEach((message) => console.warn(`  - ${message}`));
}

if (errors.length) {
  console.error(`JLPT production validation FAILED (${errors.length})`);
  errors.slice(0, 200).forEach((message) => console.error(`  - ${message}`));
  if (errors.length > 200) console.error(`  ... and ${errors.length - 200} more`);
  process.exit(1);
}

console.log(`JLPT production validation passed: ${wordRows} words, ${dayRows} prepared days, ${signatures.size} unique MCQs.`);
