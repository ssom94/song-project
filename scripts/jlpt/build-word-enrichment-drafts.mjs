import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const CANDIDATE_FILE = path.join(PROD, 'candidates/n1-source-3000.json');
const KRDICT_FILE = path.join(PROD, 'candidates/krdict-n1-matches.json');
const LEGACY_DIR = path.join(ROOT, 'data/jlpt/daily_words');
const CURATION_DIR = path.join(PROD, 'curation/words');
const OUT_DIR = path.join(PROD, 'candidates/word-drafts');
const REPORT_FILE = path.join(PROD, 'candidates/word-enrichment-report.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeReading(value = '') {
  return String(value)
    .normalize('NFKC')
    .trim()
    .replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function normalizeWord(value = '') {
  return String(value).normalize('NFKC').trim();
}

function identity(word, reading) {
  return `${normalizeWord(word)}\u0000${normalizeReading(reading)}`;
}

function legacyRecords() {
  const byIdentity = new Map();
  if (!fs.existsSync(LEGACY_DIR)) return byIdentity;

  for (const name of fs.readdirSync(LEGACY_DIR).filter(v => v.endsWith('.json')).sort()) {
    const file = path.join(LEGACY_DIR, name);
    const parsed = readJson(file);
    for (const item of parsed.words ?? []) {
      const id = identity(item.word, item.reading);
      if (!byIdentity.has(id)) {
        byIdentity.set(id, {
          ...item,
          source_file: `data/jlpt/daily_words/${name}`,
        });
      }
    }
  }
  return byIdentity;
}

function curatedRecords() {
  const byIdentity = new Map();
  if (!fs.existsSync(CURATION_DIR)) return byIdentity;

  for (const name of fs.readdirSync(CURATION_DIR).filter(v => v.endsWith('.json')).sort()) {
    const file = path.join(CURATION_DIR, name);
    const parsed = readJson(file);
    for (const item of parsed.words ?? []) {
      if (!item?.word || !item?.reading) throw new Error(`Missing curated word/reading in ${file}`);
      const id = identity(item.word, item.reading);
      if (byIdentity.has(id)) throw new Error(`Duplicate curated identity ${item.word}/${item.reading}`);
      byIdentity.set(id, {
        ...item,
        source_file: `data/jlpt/production/curation/words/${name}`,
      });
    }
  }
  return byIdentity;
}

function splitMeaning(value) {
  return String(value ?? '')
    .split(/[|｜]/)
    .map(v => v.trim())
    .filter(Boolean)
    .join(', ');
}

const candidateDoc = readJson(CANDIDATE_FILE);
const krdictDoc = fs.existsSync(KRDICT_FILE) ? readJson(KRDICT_FILE) : { matches: {} };
const legacy = legacyRecords();
const curated = curatedRecords();
const krdictMatches = krdictDoc.matches ?? {};

const records = [];
const matchedCuratedIdentities = new Set();
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  candidateCount: candidateDoc.candidates?.length ?? 0,
  curatedOverrides: 0,
  curatedKeyDrift: 0,
  retiredCuratedRecords: 0,
  retiredCuratedIdentities: [],
  legacyExactMatches: 0,
  krdictExactMatches: 0,
  sourceBackedKoreanGlosses: 0,
  withCuratedExamples: 0,
  readyForFinalReview: 0,
  needsExamples: 0,
  needsKoreanGloss: 0,
  unresolvedKeys: [],
  note: 'Draft artifacts only. Curated overrides are joined by normalized word+reading identity so candidate reranking cannot attach review data to the wrong lexeme. Curated records intentionally retired by a later corpus-quality rule are reported but ignored. The complete selected set must still pass production validation before promotion.',
};

for (const candidate of candidateDoc.candidates ?? []) {
  const candidateIdentity = identity(candidate.word, candidate.reading);
  const legacyItem = legacy.get(candidateIdentity);
  const curatedItem = curated.get(candidateIdentity) ?? null;
  const kr = krdictMatches[candidate.key] ?? null;

  if (curatedItem) {
    matchedCuratedIdentities.add(candidateIdentity);
    report.curatedOverrides += 1;
    if (curatedItem.key && curatedItem.key !== candidate.key) report.curatedKeyDrift += 1;
  }
  if (legacyItem) report.legacyExactMatches += 1;
  if (kr) report.krdictExactMatches += 1;

  const meaningKo = curatedItem?.meaning_ko?.trim()
    || (legacyItem ? splitMeaning(legacyItem.meaning) : '')
    || kr?.meaning_ko?.trim()
    || '';
  const meaningJa = curatedItem?.meaning_ja?.trim() || kr?.definition_ja?.trim() || '';
  const exampleJa = curatedItem?.example_ja?.trim() || legacyItem?.example_ja?.trim() || '';
  const exampleKo = curatedItem?.example_ko?.trim() || legacyItem?.example_ko?.trim() || '';
  const partOfSpeech = curatedItem?.part_of_speech?.trim() || legacyItem?.part || candidate.part_of_speech || '';

  if (meaningKo) report.sourceBackedKoreanGlosses += 1;
  if (exampleJa && exampleKo) report.withCuratedExamples += 1;

  let reviewStatus;
  if (meaningKo && exampleJa && exampleKo) {
    reviewStatus = curatedItem ? 'curated_ready_for_final_review' : 'ready_for_final_review';
    report.readyForFinalReview += 1;
  } else if (meaningKo) {
    reviewStatus = 'needs_examples';
    report.needsExamples += 1;
  } else {
    reviewStatus = 'needs_korean_gloss';
    report.needsKoreanGloss += 1;
    report.unresolvedKeys.push(candidate.key);
  }

  records.push({
    key: candidate.key,
    sequence_no: candidate.sequence_no,
    word: candidate.word,
    reading: candidate.reading,
    meaning_ko: meaningKo,
    meaning_ja: meaningJa,
    part_of_speech: partOfSpeech,
    example_ja: exampleJa,
    example_ko: exampleKo,
    review_status: reviewStatus,
    evidence: {
      candidate_source: candidate.source,
      jmdict_seq: candidate.jmdict_seq,
      meaning_en: candidate.meaning_en,
      curated_file: curatedItem?.source_file ?? null,
      curated_original_key: curatedItem?.key ?? null,
      legacy_curated_file: legacyItem?.source_file ?? null,
      krdict: kr ? {
        score: kr.score,
        reasons: kr.reasons,
        source_file: kr.source_file,
        meaning_ko: kr.meaning_ko,
        definition_ko: kr.definition_ko,
        meaning_ja_source: kr.meaning_ja_source,
      } : null,
    },
  });
}

for (const [id, item] of curated.entries()) {
  if (matchedCuratedIdentities.has(id)) continue;
  report.retiredCuratedRecords += 1;
  report.retiredCuratedIdentities.push({
    word: item.word,
    reading: item.reading,
    source_file: item.source_file,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const old of fs.readdirSync(OUT_DIR).filter(v => v.endsWith('.json'))) {
  fs.unlinkSync(path.join(OUT_DIR, old));
}

for (let start = 0; start < records.length; start += 500) {
  const chunk = records.slice(start, start + 500);
  const first = String(start + 1).padStart(4, '0');
  const last = String(start + chunk.length).padStart(4, '0');
  fs.writeFileSync(
    path.join(OUT_DIR, `${first}-${last}.json`),
    `${JSON.stringify({ schemaVersion: 1, range: `${first}-${last}`, words: chunk }, null, 2)}\n`,
  );
}

fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  candidateCount: report.candidateCount,
  curatedOverrides: report.curatedOverrides,
  curatedKeyDrift: report.curatedKeyDrift,
  retiredCuratedRecords: report.retiredCuratedRecords,
  legacyExactMatches: report.legacyExactMatches,
  krdictExactMatches: report.krdictExactMatches,
  sourceBackedKoreanGlosses: report.sourceBackedKoreanGlosses,
  withCuratedExamples: report.withCuratedExamples,
  readyForFinalReview: report.readyForFinalReview,
  needsExamples: report.needsExamples,
  needsKoreanGloss: report.needsKoreanGloss,
}, null, 2));
