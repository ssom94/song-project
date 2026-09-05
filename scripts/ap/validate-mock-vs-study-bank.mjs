import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MOCK_DIR = path.join(ROOT, 'data', 'ap', 'mock-exams');
const MIGRATIONS = path.join(ROOT, 'migrations');
const errors = [];
const clean = (v) => String(v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${path.relative(ROOT,file)}: ${error.message}`); return null; }
}

const migrationCorpus = fs.readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql') && entry.name.includes('ap_'))
  .map((entry) => fs.readFileSync(path.join(MIGRATIONS, entry.name), 'utf8').normalize('NFKC'))
  .join('\n');

const files = fs.existsSync(MOCK_DIR)
  ? fs.readdirSync(MOCK_DIR, { withFileTypes: true }).filter((entry) => entry.isFile() && /^[AB]-\d{2}\.json$/.test(entry.name))
  : [];

for (const entry of files) {
  const file = path.join(MOCK_DIR, entry.name);
  const data = readJson(file);
  if (!data || !Array.isArray(data.questions)) continue;
  for (const q of data.questions) {
    const prompt = clean(q?.promptJa);
    if (!prompt) continue;
    if (migrationCorpus.includes(prompt)) {
      errors.push(`${entry.name} Q${q.questionNo}: Japanese prompt is already present in existing AP study-bank migrations`);
    }
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR ${error}`));
  console.error(`Mock-vs-study-bank duplicate validation failed: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`Mock-vs-study-bank duplicate validation passed: ${files.length} mock file(s)`);
