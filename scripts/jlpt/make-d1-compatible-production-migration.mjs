import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'migrations', '0070_jlpt_production_rebuild_20260907_20270228.sql');

if (!fs.existsSync(FILE)) {
  throw new Error(`Migration not found: ${path.relative(ROOT, FILE)}`);
}

let sql = fs.readFileSync(FILE, 'utf8');

// D1 enforces foreign keys for migrations and may reject changing foreign_keys
// inside its implicit transaction. The explicit pragma is unnecessary here.
sql = sql.replace(/^PRAGMA\s+foreign_keys\s*=\s*ON;\s*\n?/gimu, '');

// D1 can reject CREATE TEMP TABLE with SQLITE_AUTH. Use short-lived normal
// staging tables instead and drop them in the same migration. DROP IF EXISTS
// keeps a retry safe even if a previous external execution left staging state.
sql = sql.replace(
  /CREATE\s+TEMP\s+TABLE\s+(_jlpt_prod_[A-Za-z0-9_]+)\s*\(/gu,
  (_match, name) => `DROP TABLE IF EXISTS ${name};\nCREATE TABLE ${name} (`,
);

if (/CREATE\s+TEMP\s+TABLE/iu.test(sql)) {
  throw new Error('Unsupported CREATE TEMP TABLE remains in production migration.');
}
if (/PRAGMA\s+foreign_keys/iu.test(sql)) {
  throw new Error('Unsupported PRAGMA foreign_keys remains in production migration.');
}

fs.writeFileSync(FILE, sql, 'utf8');
console.log(`Made ${path.relative(ROOT, FILE)} Cloudflare D1 compatible (no TEMP TABLE / foreign_keys pragma).`);
