import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/ap/past-exams/manifest.json');
const publicPath = path.join(root, 'public/assets/data/ap-past-exams.json');
const expected = [
  ['2025-autumn', '2025-10-12', 'https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html'],
  ['2025-spring', '2025-04-20', 'https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html'],
  ['2024-autumn', '2024-10-13', 'https://www.ipa.go.jp/shiken/mondai-kaiotu/2024r06.html'],
  ['2024-spring', '2024-04-21', 'https://www.ipa.go.jp/shiken/mondai-kaiotu/2024r06.html'],
  ['2023-autumn', '2023-10-08', 'https://www.ipa.go.jp/shiken/mondai-kaiotu/2023r05.html'],
];

function fail(message) {
  console.error(`AP past exam validation failed: ${message}`);
  process.exitCode = 1;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function validateReadyFile(session, subjectCode, subject) {
  if (subject.status !== 'ready') return;
  if (!subject.file || typeof subject.file !== 'string') {
    fail(`${session.key} ${subjectCode}: ready status requires file`);
    return;
  }
  const filePath = path.join(root, 'data/ap/past-exams', subject.file);
  if (!fs.existsSync(filePath)) {
    fail(`${session.key} ${subjectCode}: file not found: ${subject.file}`);
    return;
  }
  const data = readJson(filePath);
  if (data.kind !== 'official-past-exam') fail(`${subject.file}: invalid kind`);
  if (data.sessionKey !== session.key) fail(`${subject.file}: sessionKey mismatch`);
  if (data.subject !== subjectCode) fail(`${subject.file}: subject mismatch`);
  if (!Array.isArray(data.questions)) fail(`${subject.file}: questions must be an array`);
  else if (data.questions.length !== subject.questionCount) fail(`${subject.file}: expected ${subject.questionCount} questions, got ${data.questions.length}`);
  if (data.source?.publisher !== '独立行政法人情報処理推進機構（IPA）') fail(`${subject.file}: IPA publisher attribution is required`);
}

const manifest = readJson(manifestPath);
const published = readJson(publicPath);
if (manifest.exam !== 'AP') fail('manifest.exam must be AP');
if (manifest.canonicalPublisher !== '独立行政法人情報処理推進機構（IPA）') fail('canonical publisher must be IPA');
if (!Array.isArray(manifest.sessions) || manifest.sessions.length !== 5) fail('exactly five sessions are required');

for (let i = 0; i < expected.length; i += 1) {
  const [key, date, url] = expected[i];
  const session = manifest.sessions?.[i];
  if (!session) continue;
  if (session.key !== key) fail(`session ${i + 1}: expected key ${key}, got ${session.key}`);
  if (session.administeredAt !== date) fail(`${key}: expected administeredAt ${date}`);
  if (session.source?.url !== url) fail(`${key}: official IPA source URL mismatch`);
  const a = session.subjects?.A;
  const b = session.subjects?.B;
  if (!a || !b) {
    fail(`${key}: both A and B metadata are required`);
    continue;
  }
  if (a.questionCount !== 80 || a.answerCount !== 80) fail(`${key} A: expected 80/80`);
  if (b.questionCount !== 11 || b.answerCount !== 5) fail(`${key} B: expected 11 presented / 5 answered`);
  for (const [subjectCode, subject] of [['A', a], ['B', b]]) {
    if (!['awaiting-source', 'ready'].includes(subject.status)) fail(`${key} ${subjectCode}: unsupported status ${subject.status}`);
    validateReadyFile(session, subjectCode, subject);
  }
}

if (!Array.isArray(published.sessions) || published.sessions.length !== expected.length) {
  fail('public catalog must expose exactly five sessions');
} else {
  expected.forEach(([key, date, url], index) => {
    const item = published.sessions[index];
    if (item.key !== key || item.administeredAt !== date || item.sourceUrl !== url) fail(`public catalog mismatch at ${key}`);
    if (item.subjects?.A?.questionCount !== 80 || item.subjects?.B?.questionCount !== 11) fail(`public catalog question targets mismatch at ${key}`);
  });
}

if (!process.exitCode) {
  const readySubjects = manifest.sessions.flatMap((s) => ['A', 'B'].map((code) => s.subjects[code].status === 'ready')).filter(Boolean).length;
  console.log(`AP past exam catalog OK: ${manifest.sessions.length} sessions, ${readySubjects}/10 subject papers imported.`);
}
