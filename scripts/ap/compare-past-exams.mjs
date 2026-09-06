import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pastRoot = path.join(root, 'data/ap/past-exams');
const mockRoot = path.join(root, 'data/ap/mock-exams');
const studyRoot = path.join(root, 'public/assets/data/ap-past-study');
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
function ratio(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length : 0;
}
function roundedRatio(value) {
  return Math.round(value * 1000) / 1000;
}
function sectionProfile(rows) {
  const total = rows.length || 1;
  return {
    T: roundedRatio(rows.filter((q) => q.sectionCode === 'T').length / total),
    M: roundedRatio(rows.filter((q) => q.sectionCode === 'M').length / total),
    S: roundedRatio(rows.filter((q) => q.sectionCode === 'S').length / total),
  };
}
function profile(questions) {
  if (!questions?.length) return null;
  const rows = questions.map((q) => {
    const text = questionText(q);
    const content = q.content ?? {};
    const lower = text.toLowerCase();
    return {
      length: text.length,
      longStem: text.length >= 240,
      diagram: Boolean(content.tables || content.table || content.dataTable || content.matrix || content.diagram || content.figure) || /(?:図|表|グラフ|タイミングチャート)/.test(text),
      log: Boolean(content.logs || content.log) || /\b(log|ログ|ログファイル)\b/i.test(text),
      code: Boolean(content.code || content.pseudocode || content.program) || /\b(select|insert|update|delete|for|while|if|else|class|function|sql)\b/i.test(lower),
      calculation: /\d/.test(text) && /[%％=＋+－\-*×÷/]|確率|計算|平均|原価|時間|率|容量|件\/秒|秒|ns|MHz|GHz/.test(text),
      security: /セキュリ|暗号|攻撃|認証|脆弱|証明書|フォレンジック|アクセス制御|DKIM|PSIRT|CSPM/i.test(text),
      scenario: text.length >= 180 || /ある会社|プロジェクト|システム|サービス|契約|監査/.test(text),
      difficulty: Number.isFinite(Number(q.difficulty)) ? Number(q.difficulty) : null,
      sectionCode: q.sectionCode || null,
    };
  });
  const difficulties = rows.map((r) => r.difficulty).filter((v) => Number.isFinite(v));
  return {
    count: rows.length,
    meanTextLength: Math.round(rows.reduce((sum, r) => sum + r.length, 0) / rows.length),
    longStemRatio: roundedRatio(ratio(rows, (r) => r.longStem)),
    diagramRatio: roundedRatio(ratio(rows, (r) => r.diagram)),
    logRatio: roundedRatio(ratio(rows, (r) => r.log)),
    codeRatio: roundedRatio(ratio(rows, (r) => r.code)),
    calculationRatio: roundedRatio(ratio(rows, (r) => r.calculation)),
    securityRatio: roundedRatio(ratio(rows, (r) => r.security)),
    scenarioRatio: roundedRatio(ratio(rows, (r) => r.scenario)),
    difficultyMean: difficulties.length ? Math.round((difficulties.reduce((a, b) => a + b, 0) / difficulties.length) * 100) / 100 : null,
    sectionRatio: sectionProfile(rows),
  };
}
function studyProfile(questions) {
  if (!questions?.length) return null;
  const rows = questions.map((q) => {
    const patterns = new Set(Array.isArray(q.patterns) ? q.patterns.map(String) : []);
    return {
      calculation: patterns.has('calculation'),
      diagram: patterns.has('diagram'),
      code: patterns.has('programming') || patterns.has('sql') || patterns.has('algorithm'),
      security: ['security', 'pki', 'attack', 'forensics', 'email'].some((tag) => patterns.has(tag)),
      scenario: patterns.has('scenario') || patterns.has('simulation'),
      difficulty: Number(q.difficulty),
      sectionCode: q.sectionCode || null,
    };
  });
  return {
    count: rows.length,
    calculationRatio: roundedRatio(ratio(rows, (r) => r.calculation)),
    diagramRatio: roundedRatio(ratio(rows, (r) => r.diagram)),
    codeRatio: roundedRatio(ratio(rows, (r) => r.code)),
    securityRatio: roundedRatio(ratio(rows, (r) => r.security)),
    scenarioRatio: roundedRatio(ratio(rows, (r) => r.scenario)),
    difficultyMean: Math.round((rows.reduce((sum, r) => sum + (Number.isFinite(r.difficulty) ? r.difficulty : 0), 0) / rows.length) * 100) / 100,
    sectionRatio: sectionProfile(rows),
  };
}
function similarity(a, b) {
  const diffs = [];
  for (const key of ['calculationRatio', 'diagramRatio', 'codeRatio', 'securityRatio', 'scenarioRatio']) {
    if (Number.isFinite(a?.[key]) && Number.isFinite(b?.[key])) diffs.push(Math.abs(a[key] - b[key]));
  }
  if (Number.isFinite(a?.difficultyMean) && Number.isFinite(b?.difficultyMean)) {
    diffs.push(Math.min(1, Math.abs(a.difficultyMean - b.difficultyMean) / 2));
  }
  for (const section of ['T', 'M', 'S']) {
    const av = a?.sectionRatio?.[section];
    const bv = b?.sectionRatio?.[section];
    if (Number.isFinite(av) && Number.isFinite(bv)) diffs.push(Math.abs(av - bv));
  }
  if (!diffs.length) return null;
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
  return { source: 'structured-official-import', questions: data.questions, profile: profile(data.questions) };
}
function loadStudyQuestions(session, subject) {
  const file = path.join(studyRoot, `${session.key}-${subject}.json`);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.kind !== 'official-past-exam-study-companion' || data.sessionKey !== session.key || data.subject !== subject) return null;
  return { source: 'korean-study-companion', questions: data.questions, profile: studyProfile(data.questions) };
}

const syntheticProfiles = {
  A: profile(loadMockQuestions('A')),
  B: profile(loadMockQuestions('B')),
};
const results = [];
for (const session of past.sessions) {
  for (const subject of ['A', 'B']) {
    const actualSource = loadPastQuestions(session, subject) || loadStudyQuestions(session, subject);
    if (!actualSource) {
      results.push({ session: session.key, subject, status: 'pending-source' });
      continue;
    }
    const actual = actualSource.profile;
    results.push({
      session: session.key,
      subject,
      status: 'compared',
      source: actualSource.source,
      similarityScore: similarity(syntheticProfiles[subject], actual),
      actual,
      syntheticRounds1To7: syntheticProfiles[subject],
      note: actualSource.source === 'korean-study-companion'
        ? 'Study-companion tags are used for the actual-paper profile; exact Japanese stem-length comparison requires a structured official import.'
        : undefined,
    });
  }
}

const compared = results.filter((r) => r.status === 'compared');
if (!compared.length) {
  console.log('AP past/mock comparison: pending-source. Synthetic A1-A7/B1-B7 baseline is ready; add an official structured import or Korean study companion to compare.');
  console.log(JSON.stringify({ status: 'pending-source', pending: results.length, syntheticBaseline: syntheticProfiles }, null, 2));
} else {
  console.log(JSON.stringify({ status: 'ok', compared: compared.length, pending: results.length - compared.length, results }, null, 2));
}
