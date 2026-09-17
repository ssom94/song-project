import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const CURATION = path.join(PROD, 'curation/supplement');
const batch = process.argv[2] === 'batch8' ? 'batch8' : 'batch7';
const isBatch8 = batch === 'batch8';
const OUTPUT = path.join(PROD, 'candidates', isBatch8 ? 'n1-eighth-batch-proposals.json' : 'n1-seventh-batch-proposals.json');
const PRIOR_PROPOSALS = [
  'n1-first-batch-proposals.json',
  'n1-second-batch-proposals.json',
  'n1-third-batch-proposals.json',
  'n1-fourth-batch-proposals.json',
  'n1-fifth-batch-proposals.json',
  'n1-sixth-batch-proposals.json',
  ...(isBatch8 ? ['n1-seventh-batch-proposals.json'] : []),
];
const CHECKPOINT = new RegExp(`^${batch}-\\d{4}-\\d{4}\\.json$`, 'u');
const REQUIRED = ['word', 'reading', 'meaning_ko', 'meaning_ja', 'part_of_speech', 'example_ja', 'example_ko'];
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
const identity = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;

const prior = new Set();
for (const name of PRIOR_PROPOSALS) {
  const data = JSON.parse(await fs.readFile(path.join(PROD, 'candidates', name), 'utf8'));
  for (const row of data.words) prior.add(identity(row));
}

const checkpointNames = (await fs.readdir(CURATION)).filter((name) => CHECKPOINT.test(name)).sort();
const selected = [];
for (const name of checkpointNames) {
  const data = JSON.parse(await fs.readFile(path.join(CURATION, name), 'utf8'));
  selected.push(...data.words);
}
if (selected.length !== 280) throw new Error(`Expected 280 enriched words, found ${selected.length}`);

const seen = new Set();
for (const [index, row] of selected.entries()) {
  for (const field of REQUIRED) if (!normalize(row[field])) throw new Error(`${index + 1}/${row.word}: missing ${field}`);
  const id = identity(row);
  if (seen.has(id)) throw new Error(`Duplicate ${batch} identity: ${row.word}/${row.reading}`);
  if (prior.has(id)) throw new Error(`Already used in an earlier batch: ${row.word}/${row.reading}`);
  if (!row.example_ja.includes(row.word)) throw new Error(`Example does not contain headword: ${row.word}`);
  seen.add(id);
}

const words = selected.map((row, index) => ({
  key: `n1-${(isBatch8 ? 3281 : 3001) + index}`,
  ...row,
  sequence: (isBatch8 ? 1961 : 1681) + index,
  planned_study_date: new Date(Date.UTC(isBatch8 ? 2027 : 2026, isBatch8 ? 0 : 11, (isBatch8 ? 7 : 24) + Math.floor(index / 20))).toISOString().slice(0, 10),
  review_status: 'proposed_for_admin_editorial_review',
  selection_reasons: [
    'independently curated from an open-license supplemental review queue',
    'verified reading, Korean/Japanese meaning, part of speech, and project-authored example',
    'ordered by project N1 study priority; not an official per-word JLPT frequency claim',
  ],
}));

await fs.writeFile(OUTPUT, `${JSON.stringify({
  schemaVersion: 1,
  purpose: `${isBatch8 ? 'Eighth' : 'Seventh'} 14-day N1 editorial batch. Project study priority only; not an official per-word JLPT frequency ranking.`,
  dateRange: isBatch8 ? { from: '2027-01-07', to: '2027-01-20', dailyWords: 20 } : { from: '2026-12-24', to: '2027-01-06', dailyWords: 20 },
  checks: {
    editorialCheckpointFiles: checkpointNames.length,
    selected: words.length,
    excludesEarlierBatches: true,
    uniqueWordReadingPairs: true,
    allRequiredContentPresent: true,
    allExamplesContainHeadword: true,
  },
  words,
}, null, 2)}\n`);

console.log(JSON.stringify({ checkpoints: checkpointNames.length, words: words.length, firstDate: words[0].planned_study_date, lastDate: words.at(-1).planned_study_date }, null, 2));
