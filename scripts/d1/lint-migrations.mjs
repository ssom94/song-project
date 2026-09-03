import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_.+\.sql$/i.test(name))
  .sort();

const issues = [];
const warnings = [];

function compact(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const name of files) {
  const raw = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
  const sql = compact(raw);
  const upper = sql.toUpperCase();

  // High-risk D1 pattern: enumerate dates and then execute a correlated COUNT for
  // every date. This is what exhausted the Free daily row-read budget in legacy 0061.
  if (/WITH\s+RECURSIVE\b/i.test(sql) && /SELECT\s+COUNT\s*\(\s*\*\s*\)/i.test(sql)) {
    issues.push(`${name}: recursive CTE + COUNT(*) detected; aggregate the bounded range once instead of counting per generated row/date.`);
  }

  // Runtime random selection requires scanning/sorting the eligible population.
  // A migration may contain a one-time bounded RANDOM(), but triggers must not.
  if (/CREATE\s+TRIGGER\b/i.test(sql) && /ORDER\s+BY\s+RANDOM\s*\(/i.test(sql)) {
    issues.push(`${name}: ORDER BY RANDOM() inside a trigger can repeatedly scan/sort a growing table.`);
  }

  // Catch obviously repeated scalar counts in one migration. Small one-time setup
  // counts can be fine, so this is a warning rather than an error.
  const countMatches = upper.match(/SELECT\s+COUNT\s*\(\s*\*\s*\)/g) ?? [];
  if (countMatches.length >= 4) {
    warnings.push(`${name}: ${countMatches.length} scalar COUNT(*) expressions; verify they are bounded/indexed or replace with one GROUP BY pass.`);
  }

  // Full-table integrity sweeps should live in the offline validator. Explicitly
  // bounded DELETE/INSERT source queries are fine; this targets assertion-style
  // scans over the two large daily tables without a plan/date predicate nearby.
  const assertionLike = /CREATE\s+TABLE\s+_ASSERT|CONSTRAINT\s+\w+\s+CHECK/i.test(sql);
  if (assertionLike) {
    const dailyWordsScan = /FROM\s+JAPANESE_JLPT_DAILY_WORDS\b/i.test(sql);
    const dailyContentsScan = /FROM\s+JAPANESE_JLPT_DAILY_CONTENTS\b/i.test(sql);
    const hasBound = /STUDY_DATE\s+(?:BETWEEN|>=|>|=)|PLAN_ID\s*=/i.test(sql);
    if ((dailyWordsScan || dailyContentsScan) && !hasBound) {
      issues.push(`${name}: assertion scans a JLPT daily table without an obvious plan/date bound; validate this offline instead.`);
    }
  }
}

if (warnings.length) {
  console.warn('\nD1 migration cost warnings:');
  for (const warning of warnings) console.warn(`  - ${warning}`);
}

if (issues.length) {
  console.error('\nD1 migration cost errors:');
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`D1 migration cost lint passed (${files.length} migrations checked).`);
}
