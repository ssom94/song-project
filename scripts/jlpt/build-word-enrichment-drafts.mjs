import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const CANDIDATE_FILE = path.join(PROD, 'candidates/n1-source-3000.json');
const KRDICT_FILE = path.join(PROD, 'candidates/krdict-n1-matches.json');
const LEGACY_DIR = path.join(ROOT, 'data/jlpt/daily_words');
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
      const key = identity(item.word, item.reading);
      if (!byIdentity.has(key)) {
        byIdentity.set(key, {
          ...item,
          source_file: `data/jlpt/daily_words/${name}`,
        });
      }
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
const krdictMatches = krdictDoc.matches ?? {};

const records = [];
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  candidateCount: candidateDoc.candidates?.length ?? 0,
  legacyExactMatches: 0,
  krdictExactMatches: 0,
  sourceBackedKoreanGlosses: 0,
  withCuratedExamples: 0,
  readyForFinalReview: 0,
  needsExamples: 0,
  needsKoreanGloss: 0,
  unresolvedKeys: [],
  note: 'Draft artifacts only. They must not be promoted to production/words until semantic/example review and production validation pass.',
};

for (const candidate of candidateDoc.candidates ?? []) {
  const legacyItem = legacy.get(identity(candidate.word, candidate.reading));
  const kr = krdictMatches[candidate.key] ?? null;

  if (legacyItem) report.legacyExactMatches += 1;
  if (kr) report.krdictExactMatches += 1;

  const meaningKo = legacyItem
    ? splitMeaning(legacyItem.meaning)
    : (kr?.meaning_ko?.trim() || '');
  const meaningJa = kr?.definition_ja?.trim() || '';
  const exampleJa = legacyItem?.example_ja?.trim() || '';
  const exampleKo = legacyItem?.example_ko?.trim() || '';

  if (meaningKo) report.sourceBackedKoreanGlosses += 1;
  if (exampleJa && exampleKo) report.withCuratedExamples += 1;

  let reviewStatus;
  if (meaningKo && exampleJa && exampleKo) {
    reviewStatus = 'ready_for_final_review';
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
    part_of_speech: legacyItem?.part || candidate.part_of_speech || '',
    example_ja: exampleJa,
    example_ko: exampleKo,
    review_status: reviewStatus,
    evidence: {
      candidate_source: candidate.source,
      jmdict_seq: candidate.jmdict_seq,
      meaning_en: candidate.meaning_en,
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
  legacyExactMatches: report.legacyExactMatches,
  krdictExactMatches: report.krdictExactMatches,
  sourceBackedKoreanGlosses: report.sourceBackedKoreanGlosses,
  withCuratedExamples: report.withCuratedExamples,
  needsExamples: report.needsExamples,
  needsKoreanGloss: report.needsKoreanGloss,
}, null, 2));
