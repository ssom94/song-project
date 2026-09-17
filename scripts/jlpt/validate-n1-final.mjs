import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CANDIDATES = path.join(ROOT, 'data/jlpt/production/candidates');
const BATCHES = path.join(ROOT, 'data/jlpt/production/batches');
const REPORT = path.join(ROOT, 'data/jlpt/production/n1-final-validation.json');
const proposals = [
  'n1-first-batch-proposals.json', 'n1-second-batch-proposals.json',
  'n1-third-batch-proposals.json', 'n1-fourth-batch-proposals.json',
  'n1-fifth-batch-proposals.json', 'n1-sixth-batch-proposals.json',
  'n1-seventh-batch-proposals.json', 'n1-eighth-batch-proposals.json',
  'n1-ninth-batch-proposals.json', 'n1-tenth-batch-proposals.json',
  'n1-eleventh-batch-proposals.json',
];
const stems = [
  '2026-10-01--2026-10-14', '2026-10-15--2026-10-28',
  '2026-10-29--2026-11-11', '2026-11-12--2026-11-25',
  '2026-11-26--2026-12-09', '2026-12-10--2026-12-23',
  '2026-12-24--2027-01-06', '2027-01-07--2027-01-20',
  '2027-01-21--2027-02-03', '2027-02-04--2027-02-17',
  '2027-02-18--2027-03-03',
];
const required = ['word', 'reading', 'meaning_ko', 'meaning_ja', 'part_of_speech', 'example_ja', 'example_ko'];
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
const identity = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;
const errors = [];
const words = [];
const dates = [];
let contentRows = 0;
let mcqRows = 0;

for (let index = 0; index < proposals.length; index += 1) {
  const proposal = JSON.parse(await fs.readFile(path.join(CANDIDATES, proposals[index]), 'utf8'));
  const batch = JSON.parse(await fs.readFile(path.join(BATCHES, `${stems[index]}.content-draft.json`), 'utf8'));
  if (proposal.words.length !== 280) errors.push(`${proposals[index]}: expected 280 words`);
  if (batch.words.length !== 280 || batch.days.length !== 14) errors.push(`${stems[index]}: invalid batch dimensions`);
  words.push(...proposal.words);
  for (const row of proposal.words) {
    for (const field of required) if (!normalize(row[field])) errors.push(`${row.key ?? row.word}: missing ${field}`);
  }
  for (const day of batch.days) {
    dates.push(day.date);
    if (day.newWordKeys.length !== 20) errors.push(`${day.date}: expected 20 new words`);
    if (day.vocabQuestions.length !== 15 || day.grammarLessons.length !== 2 || day.grammarQuestions.length !== 3 || day.readingSets.length !== 1) errors.push(`${day.date}: invalid linked content dimensions`);
    if (day.readingSets.some((set) => set.questions.length !== 3)) errors.push(`${day.date}: invalid reading question dimensions`);
    contentRows += day.vocabQuestions.length + day.grammarLessons.length + day.grammarQuestions.length + day.readingSets.length;
    mcqRows += day.vocabQuestions.length + day.grammarQuestions.length + day.readingSets.reduce((sum, set) => sum + set.questions.length, 0);
  }
}

const identities = words.map(identity);
const keys = words.map((row) => normalize(row.key));
const sequences = words.map((row) => Number(row.sequence)).sort((a, b) => a - b);
if (words.length !== 3080) errors.push(`expected 3080 N1 words, found ${words.length}`);
if (new Set(identities).size !== identities.length) errors.push('duplicate word+reading identity across N1 batches');
if (new Set(keys).size !== keys.length) errors.push('duplicate key across N1 batches');
if (sequences.some((value, index) => value !== index + 1)) errors.push('N1 sequence is not contiguous 1..3080');
const expectedDates = Array.from({ length: 154 }, (_, index) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10));
if (dates.length !== expectedDates.length || dates.some((date, index) => date !== expectedDates[index])) errors.push('study dates are not contiguous 2026-10-01..2027-03-03');

const report = {
  schemaVersion: 1,
  scope: { level: 'N1', from: '2026-10-01', to: '2027-03-03', batches: proposals.length },
  counts: { words: words.length, uniqueWordReadingPairs: new Set(identities).size, days: dates.length, contentRows, mcqRows },
  checks: {
    allRequiredEditorialFieldsPresent: !errors.some((error) => error.includes('missing')),
    uniqueWordReadingPairs: new Set(identities).size === identities.length,
    uniqueKeys: new Set(keys).size === keys.length,
    contiguousSequences: !errors.some((error) => error.includes('sequence')),
    contiguousDates: !errors.some((error) => error.includes('study dates')),
    twentyWordsPerDay: !errors.some((error) => error.includes('expected 20')),
    linkedContentDimensions: !errors.some((error) => error.includes('content dimensions') || error.includes('reading question')),
  },
  errors,
  status: errors.length ? 'failed' : 'passed_final_local_validation',
};
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
