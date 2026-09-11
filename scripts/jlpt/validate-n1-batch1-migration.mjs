import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const batch = ['batch2','batch3','batch4'].includes(process.argv[2]) ? process.argv[2] : 'batch1';
const config = batch === 'batch4'
  ? { stem: '2026-11-12--2026-11-25', file: '0103_jlpt_n1_batch_20261112_20261125.sql', from: '2026-11-12', to: '2026-11-25' }
  : batch === 'batch3'
    ? { stem: '2026-10-29--2026-11-11', file: '0101_jlpt_n1_batch_20261029_20261111.sql', from: '2026-10-29', to: '2026-11-11' }
  : batch === 'batch2'
    ? { stem: '2026-10-15--2026-10-28', file: '0100_jlpt_n1_batch_20261015_20261028.sql', from: '2026-10-15', to: '2026-10-28' }
    : { stem: '2026-10-01--2026-10-14', file: '0099_jlpt_n1_batch_20261001_20261014.sql', from: '2026-10-01', to: '2026-10-14' };
const FILE = path.join(ROOT, `migrations/${config.file}`);
const REPORT = path.join(ROOT, `data/jlpt/production/batches/${config.stem}.migration-validation.json`);
const sql = await fs.readFile(FILE, 'utf8');
const errors = [];
const fail = (message) => errors.push(message);
const count = (expression) => [...sql.matchAll(expression)].length;

if (!sql.includes("plan_code='N1_2027_JUL'")) fail('plan code scope missing');
if (!sql.includes(`study_date BETWEEN '${config.from}' AND '${config.to}'`)) fail('date scope missing');
if (/DELETE\s+FROM\s+japanese_jlpt_curriculum_words/iu.test(sql)) fail('must not delete plan-wide curriculum');
if (/\bCOUNT\s*\(/iu.test(sql)) fail('migration must not use count scans');
if (/DELETE\s+FROM\s+japanese_jlpt_(?:daily_words|daily_contents|daily_sessions)\s*;/iu.test(sql)) fail('unbounded daily-data delete found');
if (count(/INSERT INTO japanese_jlpt_daily_sessions\(/gu) !== 14) fail('expected 14 bounded session inserts');
if (count(/INSERT INTO japanese_jlpt_daily_contents\(/gu) !== 294) fail('expected 294 content inserts');
if (count(/\('n1-/gu) !== 280) fail('expected 280 staged word rows');
const statements = sql.split(';').map((statement) => Buffer.byteLength(statement, 'utf8'));
const maxStatementBytes = Math.max(...statements);
if (maxStatementBytes >= 100_000) fail(`statement exceeds conservative 100KB bound (${maxStatementBytes})`);
const report = { schemaVersion: 1, migration: path.basename(FILE), scope: { planCode: 'N1_2027_JUL', from: config.from, to: config.to }, counts: { stagedWords: 280, sessions: 14, contentRows: 294, maxStatementBytes }, checks: { noPlanWideCurriculumDelete: true, noCountScan: true, boundedDailyDeletes: true }, errors, status: errors.length ? 'failed' : 'passed_local_static_validation' };
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
