import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data', 'jlpt', 'production');
const CANDIDATE_FILE = path.join(PROD, 'candidates', 'n1-source-3000.json');
const CURATION_DIR = path.join(PROD, 'curation', 'words');

const normalize = (value = '') => String(value).normalize('NFKC').trim();
const normalizeReading = (value = '') => normalize(value).replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const identity = (word, reading) => `${normalize(word)}\u0000${normalizeReading(reading)}`;
const keyFor = n => `n1-${String(n).padStart(4, '0')}`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const candidateDoc = readJson(CANDIDATE_FILE);
const ranked = candidateDoc.candidates ?? [];
if (ranked.length !== 3000) throw new Error(`Expected 3000 candidates, got ${ranked.length}.`);

const currentByIdentity = new Map(ranked.map(item => [identity(item.word, item.reading), item]));
const curatedByKey = new Map();
const curatedIdentityToKey = new Map();
const duplicateKeys = [];
const duplicateIdentities = [];

for (const name of fs.readdirSync(CURATION_DIR).filter(v => v.endsWith('.json')).sort()) {
  const doc = readJson(path.join(CURATION_DIR, name));
  for (const item of doc.words ?? []) {
    if (!item?.key || !item?.word || !item?.reading) throw new Error(`Malformed curated row in ${name}`);
    const id = identity(item.word, item.reading);
    if (curatedByKey.has(item.key)) {
      duplicateKeys.push({ key: item.key, first: curatedByKey.get(item.key).__file, second: name });
      continue;
    }
    if (curatedIdentityToKey.has(id)) {
      const first = curatedIdentityToKey.get(id);
      duplicateIdentities.push({ word: item.word, reading: item.reading, firstKey: first.key, firstFile: first.file, secondKey: item.key, secondFile: name });
    }
    curatedByKey.set(item.key, { ...item, __file: name });
    if (!curatedIdentityToKey.has(id)) curatedIdentityToKey.set(id, { key: item.key, file: name });
  }
}

if (duplicateKeys.length || duplicateIdentities.length) {
  console.error(JSON.stringify({ duplicateKeys, duplicateIdentities }, null, 2));
  throw new Error(`Curation duplicates found: ${duplicateKeys.length} duplicate keys, ${duplicateIdentities.length} duplicate identities.`);
}

const used = new Set(curatedIdentityToKey.keys());
const remaining = ranked.filter(item => !used.has(identity(item.word, item.reading)));
let remainingIndex = 0;
const locked = [];
let metadataRecovered = 0;
let curatedWithoutCurrentMetadata = 0;

for (let n = 1; n <= 3000; n += 1) {
  const key = keyFor(n);
  const curated = curatedByKey.get(key);
  if (curated) {
    const id = identity(curated.word, curated.reading);
    const source = currentByIdentity.get(id) ?? null;
    if (source) metadataRecovered += 1;
    else curatedWithoutCurrentMetadata += 1;
    locked.push({
      ...(source ?? {
        meaning_en: '',
        jmdict_seq: null,
        part_of_speech: curated.part_of_speech ?? '',
        pos_tags: [],
        reading_tags: [],
        jmdict_common: false,
        jmdict_canonical_match: true,
        frequency: {},
        quality_score: null,
        source: 'openai-assisted-manual-curation-lock',
      }),
      key,
      sequence_no: n,
      word: curated.word,
      reading: curated.reading,
      part_of_speech: curated.part_of_speech || source?.part_of_speech || '',
    });
    continue;
  }

  while (remainingIndex < remaining.length && used.has(identity(remaining[remainingIndex].word, remaining[remainingIndex].reading))) {
    remainingIndex += 1;
  }
  const source = remaining[remainingIndex++];
  if (!source) throw new Error(`Not enough uncurated candidates to fill ${key}.`);
  const id = identity(source.word, source.reading);
  used.add(id);
  locked.push({ ...source, key, sequence_no: n });
}

if (locked.length !== 3000) throw new Error(`Locked candidate count is ${locked.length}, expected 3000.`);
if (new Set(locked.map(item => identity(item.word, item.reading))).size !== 3000) {
  throw new Error('Locked candidate identities are not unique.');
}

fs.writeFileSync(CANDIDATE_FILE, `${JSON.stringify({
  ...candidateDoc,
  generatedAt: new Date().toISOString(),
  selectionRule: `${candidateDoc.selectionRule ?? ''}; curated word+reading identities are permanently locked to their reviewed n1-#### keys; only uncurated slots are filled from the ranked candidate pool`,
  curationLock: {
    curatedKeys: curatedByKey.size,
    metadataRecovered,
    curatedWithoutCurrentMetadata,
  },
  candidates: locked,
}, null, 2)}\n`);

console.log(JSON.stringify({
  candidateCount: locked.length,
  curatedKeys: curatedByKey.size,
  metadataRecovered,
  curatedWithoutCurrentMetadata,
  firstUncuratedKey: [...Array(3000)].map((_, i) => keyFor(i + 1)).find(key => !curatedByKey.has(key)) ?? null,
}, null, 2));
