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
function clean(value) {
  return String(value ?? '').normalize('NFKC').trim();
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function isOfficialPdf(value) {
  const url = clean(value);
  return /^https:\/\/www\.ipa\.go\.jp\/shiken\/mondai-kaiotu\/.+\.pdf$/i.test(url);
}
function validateViewerReady(session, subjectCode, subject) {
  if (subject.status !== 'viewer-ready') return;
  if (!isOfficialPdf(subject.questionPdfUrl)) fail(`${session.key} ${subjectCode}: viewer-ready requires official IPA questionPdfUrl`);
  if (!isOfficialPdf(subject.answerPdfUrl)) fail(`${session.key} ${subjectCode}: viewer-ready requires official IPA answerPdfUrl`);
  if (subjectCode === 'A') {
    const key = clean(subject.answerKey);
    if (Array.from(key).length !== 80) fail(`${session.key} A: answerKey must contain exactly 80 choices`);
    if (!/^[アイウエ]+$/.test(key)) fail(`${session.key} A: answerKey may contain only ア/イ/ウ/エ`);
  } else if (!isOfficialPdf(subject.commentaryPdfUrl)) {
    fail(`${session.key} B: viewer-ready requires official IPA commentaryPdfUrl`);
  }
}
function validateReadyQuestions(data, subjectCode, file) {
  if (!Array.isArray(data.questions)) return;
  const numbers = new Set();
  data.questions.forEach((question, index) => {
    const where = `${file}.questions[${index}]`;
    const questionNo = Number(question?.questionNo);
    if (!Number.isInteger(questionNo) || questionNo <= 0) fail(`${where}: positive questionNo is required`);
    else if (numbers.has(questionNo)) fail(`${where}: duplicate questionNo ${questionNo}`);
    else numbers.add(questionNo);
    if (!clean(question?.promptJa)) fail(`${where}: promptJa is required`);
    if (!clean(question?.promptKo)) fail(`${where}: promptKo is required`);
    if (!clean(question?.explanationJa)) fail(`${where}: explanationJa is required`);
    if (!clean(question?.explanationKo)) fail(`${where}: explanationKo is required`);
    if (subjectCode === 'A') {
      const choicesJa = Array.isArray(question?.optionsJa) ? question.optionsJa : [];
      const choicesKo = Array.isArray(question?.optionsKo) ? question.optionsKo : [];
      if (choicesJa.length !== 4 || choicesKo.length !== 4) fail(`${where}: Subject A requires four JA/KO choices`);
      const correctChoice = Number(question?.correctChoice);
      if (!Number.isInteger(correctChoice) || correctChoice < 0 || correctChoice > 3) fail(`${where}: Subject A correctChoice must be 0..3`);
    } else {
      if (!clean(question?.modelAnswerJa)) fail(`${where}: Subject B modelAnswerJa is required`);
      if (!clean(question?.modelAnswerKo)) fail(`${where}: Subject B modelAnswerKo is required`);
    }
  });
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
  validateReadyQuestions(data, subjectCode, subject.file);
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
    if (!['awaiting-source', 'viewer-ready', 'ready'].includes(subject.status)) fail(`${key} ${subjectCode}: unsupported status ${subject.status}`);
    validateViewerReady(session, subjectCode, subject);
    validateReadyFile(session, subjectCode, subject);
  }
}

if (!Array.isArray(published.sessions) || published.sessions.length !== expected.length) {
  fail('public catalog must expose exactly five sessions');
} else {
  expected.forEach(([key, date, url], index) => {
    const item = published.sessions[index];
    const source = manifest.sessions[index];
    if (item.key !== key || item.administeredAt !== date || item.sourceUrl !== url) fail(`public catalog mismatch at ${key}`);
    if (item.subjects?.A?.questionCount !== 80 || item.subjects?.B?.questionCount !== 11) fail(`public catalog question targets mismatch at ${key}`);
    for (const subjectCode of ['A', 'B']) {
      const pub = item.subjects?.[subjectCode];
      const src = source.subjects?.[subjectCode];
      if (pub?.status !== src?.status) fail(`public catalog status mismatch at ${key} ${subjectCode}`);
      if (pub?.questionPdfUrl !== src?.questionPdfUrl || pub?.answerPdfUrl !== src?.answerPdfUrl) fail(`public catalog PDF mismatch at ${key} ${subjectCode}`);
      if (subjectCode === 'A' && pub?.answerKey !== src?.answerKey) fail(`public catalog answerKey mismatch at ${key} A`);
      if (subjectCode === 'B' && pub?.commentaryPdfUrl !== src?.commentaryPdfUrl) fail(`public catalog commentary mismatch at ${key} B`);
    }
  });
}

if (!process.exitCode) {
  const viewerSubjects = manifest.sessions.flatMap((s) => ['A', 'B'].map((code) => s.subjects[code].status === 'viewer-ready')).filter(Boolean).length;
  const importedSubjects = manifest.sessions.flatMap((s) => ['A', 'B'].map((code) => s.subjects[code].status === 'ready')).filter(Boolean).length;
  console.log(`AP past exam catalog OK: ${manifest.sessions.length} sessions, ${viewerSubjects}/10 official PDF viewers, ${importedSubjects}/10 locally imported papers.`);
}
