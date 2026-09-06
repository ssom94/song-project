import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pastRoot = path.join(root, 'data/ap/past-exams');
const mockRoot = path.join(root, 'data/ap/mock-exams');
const past = JSON.parse(fs.readFileSync(path.join(pastRoot, 'manifest.json'), 'utf8'));
const mocks = JSON.parse(fs.readFileSync(path.join(mockRoot, 'manifest.json'), 'utf8'));

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}
function questionText(q) {
  return collectStrings({ promptJa: q.promptJa, optionsJa: q.optionsJa, content: q.content }).join('\n');
}
function profile(questions) {
  if (!questions.length) return null;
  const rows = questions.map((q) => {
    const text = questionText(q);
    const content = q.content ?? {};
    const lower = text.toLowerCase();
    return {
      length: text.length,
      longStem: text.length >= 240,
      table: Boolean(content.tables || content.table || content.dataTable || content.matrix),
      log: Boolean(content.logs || content.log) || /\b(log|ログ|ログファイル)\b/i.test(text),
      code: Boolean(content.code || content.pseudocode || content.program) || /\b(select|insert|update|delete|for|while|if|else|class|function|sql)\b/i.test(lower),
      calculation: /\d/.test(text) && /[%％=＋+－\-*×÷/]|確率|計算|平均|原価|時間|率|容量|件\/秒/.test(text),
    };
  });
  const n = rows.length;
  const ratio = (key) => rows.filter((r) => r[key]).length / n;
  return {
    count: n,
    meanTextLength: Math.round(rows.reduce((sum, r) => sum + r.length, 0) / n),
    longStemRatio: ratio('longStem'),
    tableRatio: ratio('table'),
    logRatio: ratio('log'),
    codeRatio: ratio('code'),
    calculationRatio: ratio('calculation'),
  };
}
function similarity(a, b) {
  const lengthDiff = Math.abs(a.meanTextLength - b.meanTextLength) / Math.max(a.meanTextLength, b.meanTextLength, 1);
  const keys = ['longStemRatio', 'tableRatio', 'logRatio', 'codeRatio', 'calculationRatio'];
  const diffs = [lengthDiff, ...keys.map((key) => Math.abs(a[key] - b[key]))];
  return Math.max(0, Math.round((1 - diffs.reduce((x, y) => x + y, 0) / diffs.length) * 100));
}
function loadMockQuestions(subject) {
  const questions = [];
  for (const round of mocks.rounds.filter((r) => r.subject === subject && r.status === 'ready')) {
    for (const file of round.files) {
      const data = JSON.parse(fs.readFileSync(path.join(mockRoot, file), 'utf8'));
      if (Array.isArray(data.questions)) questions.push(...data.questions);
    }
  }
  return questions;
}
function loadPastQuestions(session, subject) {
  const meta = session.subjects[subject];
  if (meta.status !== 'ready' || !meta.file) return null;
  const data = JSON.parse(fs.readFileSync(path.join(pastRoot, meta.file), 'utf8'));
  return data.questions;
}

const syntheticProfiles = {
  A: profile(loadMockQuestions('A')),
  B: profile(loadMockQuestions('B')),
};
const results = [];
for (const session of past.sessions) {
  for (const subject of ['A', 'B']) {
    const questions = loadPastQuestions(session, subject);
    if (!questions) {
      results.push({ session: session.key, subject, status: 'pending-source' });
      continue;
    }
    const actual = profile(questions);
    results.push({
      session: session.key,
      subject,
      status: 'compared',
      similarityScore: similarity(syntheticProfiles[subject], actual),
      actual,
      syntheticRounds1To7: syntheticProfiles[subject],
    });
  }
}

const compared = results.filter((r) => r.status === 'compared');
if (!compared.length) {
  console.log('AP past/mock comparison: pending-source. Synthetic A1-A7/B1-B7 baseline is ready; upload official IPA papers to compare.');
  console.log(JSON.stringify({ status: 'pending-source', pending: results.length, syntheticBaseline: syntheticProfiles }, null, 2));
} else {
  console.log(JSON.stringify({ status: 'ok', compared: compared.length, results }, null, 2));
}
