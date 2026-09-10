import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'migrations/0099_jlpt_n1_batch_20261001_20261014.sql');
const REPORT = path.join(ROOT, 'data/jlpt/production/batches/2026-10-01--2026-10-14.migration-validation.json');
const sql = await fs.readFile(FILE, 'utf8');
const errors = [];
const fail = (message) => errors.push(message);
const count = (expression) => [...sql.matchAll(expression)].length;

if (!sql.includes("plan_code='N1_2027_JUL'")) fail('plan code scope missing');
if (!sql.includes("study_date BETWEEN '2026-10-01' AND '2026-10-14'")) fail('date scope missing');
if (/DELETE\s+FROM\s+japanese_jlpt_curriculum_words/iu.test(sql)) fail('must not delete plan-wide curriculum');
if (/\bCOUNT\s*\(/iu.test(sql)) fail('migration must not use count scans');
if (/DELETE\s+FROM\s+japanese_jlpt_(?:daily_words|daily_contents|daily_sessions)\s*;/iu.test(sql)) fail('unbounded daily-data delete found');
if (count(/INSERT INTO japanese_jlpt_daily_sessions\(/gu) !== 14) fail('expected 14 bounded session inserts');
if (count(/INSERT INTO japanese_jlpt_daily_contents\(/gu) !== 294) fail('expected 294 content inserts');
if (count(/\('n1-/gu) !== 280) fail('expected 280 staged word rows');
const statements = sql.split(';').map((statement) => Buffer.byteLength(statement, 'utf8'));
const maxStatementBytes = Math.max(...statements);
if (maxStatementBytes >= 100_000) fail(`statement exceeds conservative 100KB bound (${maxStatementBytes})`);
const report = { schemaVersion: 1, migration: path.basename(FILE), scope: { planCode: 'N1_2027_JUL', from: '2026-10-01', to: '2026-10-14' }, counts: { stagedWords: 280, sessions: 14, contentRows: 294, maxStatementBytes }, checks: { noPlanWideCurriculumDelete: true, noCountScan: true, boundedDailyDeletes: true }, errors, status: errors.length ? 'failed' : 'passed_local_static_validation' };
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
