import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, 'migrations');
const BANKS = [
  { file: '0071_ap_subject_a_network_security_exam_bank.sql', expected: 42, from: 33, to: 46, questionNo: 1 },
  { file: '0072_ap_subject_a_dev_management_strategy_exam_bank.sql', expected: 66, from: 47, to: 68, questionNo: 1 },
  { file: '0073_ap_subject_a_replace_generic_fallbacks.sql', expected: 57, from: 14, to: 32, questionNo: 2 },
];
const DAILY_FILE = '0074_ap_subject_a_balanced_daily_mix_20261001_20261007.sql';
const NORMALIZATION_FILE = '0075_ap_japanese_exam_style_normalization.sql';
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/u;
const errors = [];
const warnings = [];

function fail(where, message) { errors.push(`${where}: ${message}`); }
function warn(where, message) { warnings.push(`${where}: ${message}`); }
function read(file) { return fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'); }
function unquoteSql(value) {
  const text = value.trim();
  if (!text.startsWith("'") || !text.endsWith("'")) return text;
  return text.slice(1, -1).replaceAll("''", "'");
}

function splitSqlFields(text) {
  const fields = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") {
      current += ch;
      if (quoted && text[i + 1] === "'") {
        current += text[i + 1];
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === ',' && !quoted) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function parseQuestionBlocks(sql, file) {
  const marker = 'INSERT OR REPLACE INTO ap_concept_questions';
  const chunks = sql.split(marker).slice(1);
  const rows = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const selectIndex = chunk.indexOf('SELECT ');
    const fromIndex = chunk.indexOf(' FROM ap_concept_problem_types');
    if (selectIndex < 0 || fromIndex < 0) continue;
    const select = chunk.slice(selectIndex + 7, fromIndex).trim();
    const fields = splitSqlFields(select);
    const where = `${file}#${i + 1}`;

    if (fields.length !== 14) {
      fail(where, `expected 14 SELECT fields, got ${fields.length}`);
      continue;
    }
    if (fields[0] !== 'NULL' || fields[1] !== 't.id') {
      fail(where, 'unexpected INSERT/SELECT shape');
      continue;
    }

    const concept = chunk.match(/c\.concept_code='(A-\d+)'/)?.[1];
    const typeNo = Number(chunk.match(/t\.type_no=(\d+)/)?.[1]);
    const questionNo = Number(fields[2]);
    const questionKo = unquoteSql(fields[3]);
    const questionJa = unquoteSql(fields[4]);
    const choicesKoRaw = unquoteSql(fields[5]);
    const choicesJaRaw = unquoteSql(fields[6]);
    const correct = Number(fields[7]);
    const answerKo = unquoteSql(fields[8]);
    const answerJa = unquoteSql(fields[9]);
    const explanationKo = unquoteSql(fields[10]);
    const explanationJa = unquoteSql(fields[11]);

    let choicesKo = [];
    let choicesJa = [];
    try { choicesKo = JSON.parse(choicesKoRaw); } catch (error) { fail(where, `choices_ko_json invalid JSON: ${error.message}`); }
    try { choicesJa = JSON.parse(choicesJaRaw); } catch (error) { fail(where, `choices_ja_json invalid JSON: ${error.message}`); }

    if (!concept) fail(where, 'concept_code is missing');
    if (!Number.isInteger(typeNo) || typeNo < 1 || typeNo > 3) fail(where, `invalid type_no ${typeNo}`);
    if (![1, 2].includes(questionNo)) fail(where, `unexpected question_no ${questionNo}`);
    if (!questionKo) fail(where, 'question_ko is empty');
    if (!questionJa) fail(where, 'question_ja is empty');
    if (HANGUL.test(questionJa)) fail(where, 'question_ja contains Hangul');
    if (!Array.isArray(choicesJa) || choicesJa.length !== 4) fail(where, `Japanese choices must contain exactly 4 items (got ${choicesJa.length})`);
    if (!Array.isArray(choicesKo) || choicesKo.length !== 4) fail(where, `Korean choices must contain exactly 4 items (got ${choicesKo.length})`);
    if (new Set(choicesJa).size !== choicesJa.length) fail(where, 'Japanese choices are not distinct');
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) fail(where, `correct_choice must be 0..3 (got ${fields[7]})`);
    if (choicesJa.length === 4 && answerJa !== choicesJa[correct]) fail(where, `answer_ja does not match choices_ja_json[${correct}]`);
    if (!answerKo) fail(where, 'answer_ko is empty');
    if (!explanationKo) fail(where, 'explanation_ko is empty');
    if (!explanationJa) fail(where, 'explanation_ja is empty');
    if (HANGUL.test(explanationJa)) fail(where, 'explanation_ja contains Hangul');

    if (choicesKo.length === 4 && choicesKo.every((choice) => !HANGUL.test(String(choice)))) {
      warn(where, 'choices_ko_json has no Hangul; acceptable for Japanese-first exam practice but review Korean-toggle UX');
    }

    rows.push({ where, concept, typeNo, questionNo, questionJa, choicesJa, correct });
  }
  return rows;
}

function validateBank(spec, signatures) {
  const full = path.join(MIGRATIONS, spec.file);
  if (!fs.existsSync(full)) {
    fail(spec.file, 'file is missing');
    return [];
  }
  const rows = parseQuestionBlocks(read(spec.file), spec.file);
  if (rows.length !== spec.expected) fail(spec.file, `expected ${spec.expected} question rows, got ${rows.length}`);

  const perConcept = new Map();
  for (const row of rows) {
    const n = Number(row.concept?.slice(2));
    if (!Number.isInteger(n) || n < spec.from || n > spec.to) fail(row.where, `concept ${row.concept} is outside A-${spec.from}..A-${spec.to}`);
    if (row.questionNo !== spec.questionNo) fail(row.where, `question_no must be ${spec.questionNo}`);
    const types = perConcept.get(row.concept) ?? new Set();
    if (types.has(row.typeNo)) fail(row.where, `duplicate type ${row.typeNo} for ${row.concept}`);
    types.add(row.typeNo);
    perConcept.set(row.concept, types);

    const signature = `${row.questionJa}\n${row.choicesJa.join('\n')}`.normalize('NFKC');
    const previous = signatures.get(signature);
    if (previous) fail(row.where, `duplicate MCQ content (previous: ${previous})`);
    else signatures.set(signature, row.where);
  }

  for (let n = spec.from; n <= spec.to; n += 1) {
    const code = `A-${String(n).padStart(2, '0')}`;
    const types = perConcept.get(code);
    if (!types) fail(spec.file, `${code} has no replacement questions`);
    else if (![1, 2, 3].every((value) => types.has(value))) fail(spec.file, `${code} must cover type_no 1,2,3`);
  }
  return rows;
}

function validateDailyMix() {
  const full = path.join(MIGRATIONS, DAILY_FILE);
  if (!fs.existsSync(full)) {
    fail(DAILY_FILE, 'file is missing');
    return;
  }
  const sql = read(DAILY_FILE);
  const matches = [...sql.matchAll(/\('(2026-10-0[1-7])',(\d+),'(A-\d+)',(\d+),(\d+)\)/g)];
  if (matches.length !== 70) fail(DAILY_FILE, `expected 70 daily picks, got ${matches.length}`);

  const byDay = new Map();
  const keys = new Set();
  for (const match of matches) {
    const [, date, sequenceText, concept, typeText, questionText] = match;
    const sequence = Number(sequenceText);
    const typeNo = Number(typeText);
    const questionNo = Number(questionText);
    const rows = byDay.get(date) ?? [];
    rows.push({ sequence, concept, typeNo, questionNo });
    byDay.set(date, rows);
    const key = `${concept}:${typeNo}:${questionNo}`;
    if (keys.has(key)) warn(DAILY_FILE, `same source question is reused in first week: ${key}`);
    keys.add(key);
  }

  for (let day = 1; day <= 7; day += 1) {
    const date = `2026-10-0${day}`;
    const rows = byDay.get(date) ?? [];
    if (rows.length !== 10) fail(DAILY_FILE, `${date}: expected 10 questions, got ${rows.length}`);
    const sequences = rows.map((row) => row.sequence).sort((a, b) => a - b);
    if (sequences.join(',') !== '1,2,3,4,5,6,7,8,9,10') fail(DAILY_FILE, `${date}: sequence_no must be 1..10`);
    const bands = new Set(rows.map((row) => {
      const n = Number(row.concept.slice(2));
      if (n <= 13) return 'fundamentals';
      if (n <= 32) return 'computer-db';
      if (n <= 46) return 'network-security';
      return 'development-management-strategy';
    }));
    if (bands.size < 4) fail(DAILY_FILE, `${date}: balanced mix must include all four broad bands`);
  }
}

function validateNormalizationMigration() {
  const full = path.join(MIGRATIONS, NORMALIZATION_FILE);
  if (!fs.existsSync(full)) {
    fail(NORMALIZATION_FILE, 'file is missing');
    return;
  }
  const sql = read(NORMALIZATION_FILE);
  for (const token of ['server', 'browser', 'data', 'code', 'node', 'sort', 'memory', 'process', 'thread', 'cache', 'service', 'system', 'project', 'application', 'network', 'address', 'protocol', 'password', 'hash']) {
    if (!sql.includes(`'${token}'`)) fail(NORMALIZATION_FILE, `normalization rule missing for ${token}`);
  }
  if (!sql.includes("WHERE exam_part IN ('A','B')")) fail(NORMALIZATION_FILE, 'concept normalization must be bounded to AP concepts');
  if (!sql.includes('JOIN ap_concepts c ON c.id = pt.concept_id')) fail(NORMALIZATION_FILE, 'question normalization must be bounded through AP concept relation');
}

const signatures = new Map();
let total = 0;
for (const spec of BANKS) total += validateBank(spec, signatures).length;
validateDailyMix();
validateNormalizationMigration();

console.log(`[AP validate] checked ${total} replacement MCQs and the 7-day balanced daily mix.`);
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length})`);
  warnings.forEach((message) => console.log(`- ${message}`));
}
if (errors.length) {
  console.error(`\nErrors (${errors.length})`);
  errors.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log('\nAP content validation passed.');
}
