import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CURATION_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'curation', 'words');
const CANDIDATE_FILE = path.join(ROOT, 'data', 'jlpt', 'production', 'candidates', 'n1-source-3000.json');

const normalize = (value = '') => String(value).normalize('NFKC').trim();
const normalizeReading = (value = '') => normalize(value).replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const identity = (word, reading) => `${normalize(word)}\u0000${normalizeReading(reading)}`;
const keyNo = key => Number(String(key ?? '').match(/^n1-(\d{4})$/)?.[1] ?? NaN);
const splitGloss = value => new Set(normalize(value).split(/[;,|｜/·・]/).map(v => v.trim()).filter(Boolean));

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const value of a) if (b.has(value)) common += 1;
  return common / Math.min(a.size, b.size);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const files = fs.readdirSync(CURATION_DIR).filter(v => v.endsWith('.json')).sort();
const rows = [];
const malformed = [];

for (const name of files) {
  const file = path.join(CURATION_DIR, name);
  let doc;
  try {
    doc = readJson(file);
  } catch (error) {
    malformed.push({ file: name, error: error.message });
    continue;
  }
  for (const [index, item] of (doc.words ?? []).entries()) {
    rows.push({ ...item, __file: name, __index: index });
  }
}

const keyMap = new Map();
const identityMap = new Map();
const readingMap = new Map();
const duplicateKeys = [];
const duplicateIdentities = [];
const missingRequired = [];

for (const row of rows) {
  const ref = `${row.__file}#${row.key ?? row.__index}`;
  const required = ['key', 'word', 'reading', 'meaning_ko', 'meaning_ja', 'part_of_speech', 'example_ja', 'example_ko'];
  const missing = required.filter(field => !normalize(row[field]));
  if (missing.length) missingRequired.push({ ref, missing });

  const previousKey = keyMap.get(row.key);
  if (previousKey) duplicateKeys.push({ key: row.key, first: previousKey, second: ref });
  else keyMap.set(row.key, ref);

  const id = identity(row.word, row.reading);
  const previousId = identityMap.get(id);
  if (previousId) duplicateIdentities.push({ word: row.word, reading: row.reading, first: previousId, second: ref });
  else identityMap.set(id, ref);

  const reading = normalizeReading(row.reading);
  if (!readingMap.has(reading)) readingMap.set(reading, []);
  readingMap.get(reading).push({ ...row, ref });
}

const numbers = rows.map(row => keyNo(row.key)).filter(Number.isFinite).sort((a, b) => a - b);
const minKey = numbers[0] ?? null;
const maxKey = numbers.at(-1) ?? null;
const numberSet = new Set(numbers);
const missingKeys = [];
if (minKey != null && maxKey != null) {
  for (let n = minKey; n <= maxKey; n += 1) if (!numberSet.has(n)) missingKeys.push(`n1-${String(n).padStart(4, '0')}`);
}

const semanticDuplicateCandidates = [];
for (const [reading, group] of readingMap.entries()) {
  if (group.length < 2) continue;
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      const a = group[i];
      const b = group[j];
      if (identity(a.word, a.reading) === identity(b.word, b.reading)) continue;
      const score = overlap(splitGloss(a.meaning_ko), splitGloss(b.meaning_ko));
      if (score >= 0.6) {
        semanticDuplicateCandidates.push({
          reading,
          score: Number(score.toFixed(2)),
          a: { key: a.key, word: a.word, meaning_ko: a.meaning_ko, file: a.__file },
          b: { key: b.key, word: b.word, meaning_ko: b.meaning_ko, file: b.__file },
        });
      }
    }
  }
}

const sourceByKey = new Map();
if (fs.existsSync(CANDIDATE_FILE)) {
  const doc = readJson(CANDIDATE_FILE);
  for (const item of doc.candidates ?? []) {
    if (item?.key && !sourceByKey.has(item.key)) sourceByKey.set(item.key, item);
  }
}

const sourceDrift = [];
for (const row of rows) {
  const source = sourceByKey.get(row.key);
  if (!source) continue;
  if (identity(source.word, source.reading) !== identity(row.word, row.reading)) {
    sourceDrift.push({
      key: row.key,
      curated: `${row.word}/${row.reading}`,
      source: `${source.word}/${source.reading}`,
      file: row.__file,
      note: row.note ?? '',
    });
  }
}

const report = {
  files: files.length,
  rows: rows.length,
  minKey,
  maxKey,
  malformed,
  duplicateKeys,
  duplicateIdentities,
  missingRequired,
  missingKeys,
  semanticDuplicateCandidates,
  sourceDrift,
};

console.log(JSON.stringify(report, null, 2));

if (malformed.length || duplicateKeys.length || duplicateIdentities.length || missingRequired.length || missingKeys.length || sourceDrift.length) {
  process.exitCode = 1;
}
