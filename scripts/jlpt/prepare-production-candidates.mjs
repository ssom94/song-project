import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'candidates');
const SOURCE_BASE = 'https://raw.githubusercontent.com/jkindrix/japanese-language-data/main';
const URLS = {
  jlpt: `${SOURCE_BASE}/data/enrichment/jlpt-classifications.json`,
  words: `${SOURCE_BASE}/data/core/words.json`,
  corpus: `${SOURCE_BASE}/data/enrichment/frequency-corpus.json`,
  subtitles: `${SOURCE_BASE}/data/enrichment/frequency-subtitles.json`,
  web: `${SOURCE_BASE}/data/enrichment/frequency-web.json`,
  wikipedia: `${SOURCE_BASE}/data/enrichment/frequency-wikipedia.json`,
};
const DISALLOWED_READING_TAGS = new Set(['ok', 'rk', 'sk']);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'song-project-jlpt-production-builder/1.0' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.json();
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim();
}

function pairKey(text, reading = '') {
  return `${normalize(text)}\u0000${normalize(reading)}`;
}

// The upstream historical N1 classification includes a small number of
// elementary counters, affixes, particles and single-character morphemes.
// They are valid JMdict entries, and frequency ranking strongly favors them,
// but spending one of the fixed 3,000 production study slots on them lowers
// the value of an N1-focused corpus. Keep this list identity-specific rather
// than using a blanket one-character rule: advanced one-character lexemes can
// still be valid N1 study targets.
const LOW_VALUE_EXCLUDED_IDENTITIES = new Set([
  ['的', 'てき'],
  ['人', 'じん'],
  ['第', 'だい'],
  ['三', 'み'],
  ['御', 'ご'],
  ['前', 'ぜん'],
  ['分', 'ふん'],
  ['彼の', 'あの'],
  ['歳', 'さい'],
  ['さん', 'さん'],
  ['商', 'しょう'],
  ['部', 'ぶ'],
  ['新', 'しん'],
  ['権', 'けん'],
  ['側', 'かわ'],
  ['側', 'がわ'],
  ['号', 'ごう'],
  ['区', 'く'],
  ['六', 'む'],
  ['系', 'けい'],
  ['店', 'てん'],
  ['と', 'と'],
  ['派', 'は'],
  ['同', 'どう'],
  ['面', 'おも'],
  ['迚も', 'とても'],
  ['制', 'せい'],
  ['様', 'さま'],
  ['高', 'たか'],
].map(([word, reading]) => pairKey(word, reading)));

function validJapaneseHeadword(text) {
  if (!text || text.length > 40) return false;
  if (/[\u0000-\u001f\u007f]/u.test(text)) return false;
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヶー]/u.test(text);
}

function validReading(reading) {
  if (!reading || reading.length > 50) return false;
  return /^[\p{Script=Hiragana}\p{Script=Katakana}ー・･\s]+$/u.test(reading);
}

function posCategory(tags = []) {
  const joined = tags.join(' ');
  if (/\bvs(?:-|\b)/.test(joined)) return 'サ変名詞';
  if (/\bv5/.test(joined)) return '五段動詞';
  if (/\bv1/.test(joined)) return '一段動詞';
  if (/\bvk\b/.test(joined)) return 'カ変動詞';
  if (/\badj-i\b/.test(joined)) return 'い形容詞';
  if (/\badj-na\b/.test(joined)) return 'な形容詞';
  if (/\badv(?:-|\b)/.test(joined)) return '副詞';
  if (/\bconj\b/.test(joined)) return '接続詞';
  if (/\bint\b/.test(joined)) return '感動詞';
  if (/\bprt\b/.test(joined)) return '助詞';
  if (/\baux-v\b/.test(joined)) return '助動詞';
  if (/\bn(?:-|\b)/.test(joined)) return '普通名詞';
  return 'その他';
}

function buildFrequencyMap(dataset) {
  const map = new Map();
  for (const entry of dataset?.entries ?? []) {
    const text = normalize(entry.text);
    const reading = normalize(entry.reading);
    const rank = Number(entry.rank);
    if (!text || !Number.isFinite(rank) || rank <= 0) continue;
    const exact = pairKey(text, reading);
    const textOnly = pairKey(text, '');
    const currentExact = map.get(exact);
    if (!currentExact || rank < currentExact) map.set(exact, rank);
    const currentText = map.get(textOnly);
    if (!currentText || rank < currentText) map.set(textOnly, rank);
  }
  return map;
}

function lookupRank(map, text, reading) {
  return map.get(pairKey(text, reading)) ?? map.get(pairKey(text, '')) ?? null;
}

function primaryWordEvidence(wordEntry, text, reading) {
  if (!wordEntry) return { common: false, posTags: [], canonicalMatch: false, readingTags: [] };
  const kanji = wordEntry.kanji ?? [];
  const kana = wordEntry.kana ?? [];
  const matchingKana = kana.find((x) => normalize(x.text) === reading) ?? null;
  const writingMatch = kanji.some((x) => normalize(x.text) === text) || kana.some((x) => normalize(x.text) === text);
  const appliesToKanji = matchingKana?.appliesToKanji ?? ['*'];
  const readingApplies = !kanji.some((x) => normalize(x.text) === text) || appliesToKanji.includes('*') || appliesToKanji.some((x) => normalize(x) === text);
  const canonicalMatch = Boolean(writingMatch && matchingKana && readingApplies);
  const common = kanji.some((x) => normalize(x.text) === text && x.common) || Boolean(matchingKana?.common);
  const posTags = [...new Set((wordEntry.sense ?? []).flatMap((sense) => sense.partOfSpeech ?? []))];
  const readingTags = [...new Set(matchingKana?.tags ?? [])];
  return { common, posTags, canonicalMatch, readingTags };
}

function qualityScore(candidate) {
  let score = 0;
  if (!candidate.jmdictCanonicalMatch) score += 1_000_000;
  if (!candidate.jmdictCommon) score += 150_000;
  const ranks = Object.values(candidate.frequency);
  for (const rank of ranks) score += rank == null ? 60_000 : Math.log2(rank + 1) * 1_000;
  const evidence = ranks.filter((rank) => rank != null).length;
  score -= evidence * 2_000;
  return Math.round(score);
}

const [jlpt, wordsData, corpus, subtitles, web, wikipedia] = await Promise.all([
  fetchJson(URLS.jlpt),
  fetchJson(URLS.words),
  fetchJson(URLS.corpus),
  fetchJson(URLS.subtitles),
  fetchJson(URLS.web),
  fetchJson(URLS.wikipedia),
]);

const wordsById = new Map((wordsData.words ?? []).map((entry) => [String(entry.id), entry]));
const freqMaps = {
  corpus: buildFrequencyMap(corpus),
  subtitles: buildFrequencyMap(subtitles),
  web: buildFrequencyMap(web),
  wikipedia: buildFrequencyMap(wikipedia),
};

const rawN1 = (jlpt.classifications ?? []).filter((entry) => entry.kind === 'vocab' && entry.level === 'N1');
const rejected = [];
const deduped = new Map();

for (const entry of rawN1) {
  const word = normalize(entry.text);
  const reading = normalize(entry.reading);
  const meaningEn = normalize(entry.meaning_en);
  const id = String(entry.jmdict_seq ?? '').trim();
  const key = pairKey(word, reading);

  let reason = null;
  if (!validJapaneseHeadword(word)) reason = 'invalid_headword';
  else if (!validReading(reading)) reason = 'invalid_reading';
  else if (!meaningEn) reason = 'missing_english_gloss';
  else if (!id) reason = 'missing_jmdict_seq';
  else if (LOW_VALUE_EXCLUDED_IDENTITIES.has(key)) reason = 'low_value_morpheme_or_elementary_form';
  if (reason) {
    rejected.push({ word, reading, jmdict_seq: id || null, reason });
    continue;
  }

  const evidence = primaryWordEvidence(wordsById.get(id), word, reading);
  const disallowedReadingTag = evidence.readingTags.find((tag) => DISALLOWED_READING_TAGS.has(tag));
  if (disallowedReadingTag) {
    rejected.push({ word, reading, jmdict_seq: id, reading_tags: evidence.readingTags, reason: `disallowed_reading_tag_${disallowedReadingTag}` });
    continue;
  }
  if (!evidence.canonicalMatch) {
    rejected.push({ word, reading, jmdict_seq: id, reading_tags: evidence.readingTags, reason: 'noncanonical_word_reading_pair' });
    continue;
  }

  const candidate = {
    word,
    reading,
    meaning_en: meaningEn,
    jmdict_seq: id,
    part_of_speech: posCategory(evidence.posTags),
    pos_tags: evidence.posTags,
    reading_tags: evidence.readingTags,
    jmdict_common: evidence.common,
    jmdict_canonical_match: evidence.canonicalMatch,
    frequency: Object.fromEntries(Object.entries(freqMaps).map(([name, map]) => [name, lookupRank(map, word, reading)])),
    source: 'waller-n1-via-stephenmk+jmdict-normalized',
  };
  candidate.quality_score = qualityScore({
    ...candidate,
    jmdictCommon: evidence.common,
    jmdictCanonicalMatch: evidence.canonicalMatch,
  });

  const existing = deduped.get(key);
  if (!existing || candidate.quality_score < existing.quality_score ||
      (candidate.quality_score === existing.quality_score && candidate.jmdict_seq < existing.jmdict_seq)) {
    if (existing) rejected.push({ ...existing, reason: 'duplicate_word_reading' });
    deduped.set(key, candidate);
  } else {
    rejected.push({ ...candidate, reason: 'duplicate_word_reading' });
  }
}

const ranked = [...deduped.values()].sort((a, b) =>
  a.quality_score - b.quality_score ||
  a.reading.localeCompare(b.reading, 'ja') ||
  a.word.localeCompare(b.word, 'ja') ||
  a.jmdict_seq.localeCompare(b.jmdict_seq)
);

if (ranked.length < 3000) {
  throw new Error(`Only ${ranked.length} valid unique N1 candidates remain; need at least 3000.`);
}

const selected = ranked.slice(0, 3000).map((entry, index) => ({
  key: `n1-${String(index + 1).padStart(4, '0')}`,
  sequence_no: index + 1,
  ...entry,
}));
for (const entry of ranked.slice(3000)) rejected.push({ ...entry, reason: 'below_frequency_cutoff' });

const selectedPairs = new Set(selected.map((entry) => pairKey(entry.word, entry.reading)));
if (selectedPairs.size !== 3000) throw new Error('Internal error: selected word+reading pairs are not unique.');

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUT_DIR, 'n1-source-3000.json'), JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target: 3000,
  sourceCandidateCount: rawN1.length,
  selectionRule: 'valid unique Waller N1 candidates; require canonical JMdict word+reading applicability; exclude obsolete/rare/search-only reading variants and known low-value elementary morphemes; prefer common JMdict matches and multi-corpus frequency evidence',
  candidates: selected,
}, null, 2) + '\n');

const reasonCounts = {};
for (const item of rejected) reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1;
await fs.writeFile(path.join(OUT_DIR, 'selection-report.json'), JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  rawN1: rawN1.length,
  uniqueValidBeforeCutoff: ranked.length,
  selected: selected.length,
  rejected: rejected.length,
  rejectedByReason: reasonCounts,
  selectedQuality: {
    canonicalJmdictMatches: selected.filter((x) => x.jmdict_canonical_match).length,
    commonJmdictEntries: selected.filter((x) => x.jmdict_common).length,
    disallowedReadingVariants: selected.filter((x) => (x.reading_tags ?? []).some((tag) => DISALLOWED_READING_TAGS.has(tag))).length,
    withCorpusFrequency: selected.filter((x) => x.frequency.corpus != null).length,
    withSubtitleFrequency: selected.filter((x) => x.frequency.subtitles != null).length,
    withWebFrequency: selected.filter((x) => x.frequency.web != null).length,
    withWikipediaFrequency: selected.filter((x) => x.frequency.wikipedia != null).length
  },
  sourceUrls: URLS
}, null, 2) + '\n');

console.log(`Prepared ${selected.length} JLPT N1 production candidates from ${rawN1.length} Waller N1 rows.`);
console.log(`Rejected/left out: ${rejected.length}. Report: ${path.relative(ROOT, path.join(OUT_DIR, 'selection-report.json'))}`);
