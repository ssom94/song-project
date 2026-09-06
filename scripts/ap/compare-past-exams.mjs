import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pastRoot = path.join(root, 'data/ap/past-exams');
const mockRoot = path.join(root, 'data/ap/mock-exams');
const studyRoot = path.join(root, 'public/assets/data/ap-past-study');
const analysisRoot = path.join(root, 'data/ap/analysis');
const docsRoot = path.join(root, 'docs/ap');
const past = JSON.parse(fs.readFileSync(path.join(pastRoot, 'manifest.json'), 'utf8'));
const mocks = JSON.parse(fs.readFileSync(path.join(mockRoot, 'manifest.json'), 'utf8'));
const writeReport = process.argv.includes('--write');

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}
function questionText(q) {
  return collectStrings({ promptJa: q.promptJa, promptKo: q.promptKo, optionsJa: q.optionsJa, optionsKo: q.optionsKo, content: q.content }).join('\n');
}
function ratio(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length : 0;
}
function roundedRatio(value) {
  return Math.round(value * 1000) / 1000;
}
function rounded(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
      sourceConceptCode: q.sourceConceptCode || null,
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
function loadMockRounds(subject) {
  return mocks.rounds
    .filter((r) => r.subject === subject && r.status === 'ready')
    .map((round) => {
      const questions = [];
      for (const file of round.files) {
        const data = JSON.parse(fs.readFileSync(path.join(mockRoot, file), 'utf8'));
        if (Array.isArray(data.questions)) questions.push(...data.questions);
      }
      return { examNo: round.examNo, questions, profile: profile(questions) };
    });
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
function countValues(values) {
  const counts = {};
  for (const value of values) {
    if (value == null || value === '') continue;
    const key = String(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
function topEntries(counts, limit = 12) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([key, count]) => ({ key, count }));
}
function gapValue(actual, synthetic) {
  if (!Number.isFinite(actual) || !Number.isFinite(synthetic)) return null;
  return rounded(actual - synthetic, 3);
}
function buildGap(actual, synthetic) {
  const metrics = {};
  for (const key of ['calculationRatio', 'diagramRatio', 'codeRatio', 'securityRatio', 'scenarioRatio']) metrics[key] = gapValue(actual?.[key], synthetic?.[key]);
  metrics.difficultyMean = Number.isFinite(actual?.difficultyMean) && Number.isFinite(synthetic?.difficultyMean) ? rounded(actual.difficultyMean - synthetic.difficultyMean, 2) : null;
  metrics.sectionRatio = {};
  for (const section of ['T', 'M', 'S']) metrics.sectionRatio[section] = gapValue(actual?.sectionRatio?.[section], synthetic?.sectionRatio?.[section]);
  return metrics;
}
function recommendationLabel(metric) {
  return {
    calculationRatio: 'calculation',
    diagramRatio: 'diagram/table',
    codeRatio: 'programming/SQL/algorithm',
    securityRatio: 'security',
    scenarioRatio: 'long scenario',
  }[metric] || metric;
}
function buildRecommendations(gap) {
  const recommendations = [];
  for (const key of ['calculationRatio', 'diagramRatio', 'codeRatio', 'securityRatio', 'scenarioRatio']) {
    const value = gap[key];
    if (Number.isFinite(value) && value >= 0.05) recommendations.push({ priority: value >= 0.12 ? 'high' : 'medium', type: 'increase-pattern', target: recommendationLabel(key), delta: value });
    else if (Number.isFinite(value) && value <= -0.12) recommendations.push({ priority: 'low', type: 'avoid-overweight', target: recommendationLabel(key), delta: value });
  }
  if (Number.isFinite(gap.difficultyMean) && gap.difficultyMean >= 0.25) recommendations.push({ priority: gap.difficultyMean >= 0.5 ? 'high' : 'medium', type: 'raise-difficulty', target: 'overall', delta: gap.difficultyMean });
  if (Number.isFinite(gap.difficultyMean) && gap.difficultyMean <= -0.5) recommendations.push({ priority: 'low', type: 'avoid-overdifficulty', target: 'overall', delta: gap.difficultyMean });
  for (const section of ['T', 'M', 'S']) {
    const value = gap.sectionRatio?.[section];
    if (Number.isFinite(value) && value >= 0.03) recommendations.push({ priority: value >= 0.08 ? 'high' : 'medium', type: 'increase-section', target: section, delta: value });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => order[a.priority] - order[b.priority]);
}
function formatPct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-';
}
function buildMarkdown(report) {
  const lines = ['# AP Past Exam vs Mock Gap Report', '', `Generated: ${report.generatedAt}`, ''];
  for (const result of report.results.filter((r) => r.status === 'compared')) {
    lines.push(`## ${result.session} / 科目${result.subject}`, '');
    lines.push(`- Similarity: **${result.similarityScore}%**`);
    lines.push(`- Source: ${result.source}`);
    lines.push(`- Actual difficulty: ${result.actual.difficultyMean ?? '-'} / Mock difficulty: ${result.syntheticRounds1To7.difficultyMean ?? '-'}`);
    lines.push('');
    lines.push('| Metric | Actual | Mock 1-7 | Gap |', '|---|---:|---:|---:|');
    for (const key of ['calculationRatio', 'diagramRatio', 'codeRatio', 'securityRatio', 'scenarioRatio']) lines.push(`| ${recommendationLabel(key)} | ${formatPct(result.actual[key])} | ${formatPct(result.syntheticRounds1To7[key])} | ${formatPct(result.gap[key])} |`);
    for (const section of ['T', 'M', 'S']) lines.push(`| section ${section} | ${formatPct(result.actual.sectionRatio?.[section])} | ${formatPct(result.syntheticRounds1To7.sectionRatio?.[section])} | ${formatPct(result.gap.sectionRatio?.[section])} |`);
    lines.push('');
    if (result.recommendations.length) {
      lines.push('### Reinforcement recommendations', '');
      for (const item of result.recommendations) lines.push(`- **${item.priority.toUpperCase()}** ${item.type}: ${item.target} (gap ${Number.isFinite(item.delta) ? item.delta : '-'})`);
      lines.push('');
    }
    if (result.subject === 'A' && result.mockRoundProfiles?.length) {
      lines.push('### Mock round profiles', '', '| Round | Difficulty | Calculation | Diagram | Code | Security | Scenario |', '|---:|---:|---:|---:|---:|---:|---:|');
      for (const round of result.mockRoundProfiles) lines.push(`| ${round.examNo} | ${round.profile.difficultyMean ?? '-'} | ${formatPct(round.profile.calculationRatio)} | ${formatPct(round.profile.diagramRatio)} | ${formatPct(round.profile.codeRatio)} | ${formatPct(round.profile.securityRatio)} | ${formatPct(round.profile.scenarioRatio)} |`);
      lines.push('');
    }
    if (result.actualTopPatterns?.length) lines.push('### Actual top pattern tags', '', ...result.actualTopPatterns.map((item) => `- ${item.key}: ${item.count}`), '');
    if (result.mockTopConceptCodes?.length) lines.push('### Mock top concept codes', '', ...result.mockTopConceptCodes.map((item) => `- ${item.key}: ${item.count}`), '');
  }
  lines.push('## Policy', '', '- Do not rewrite already-attempted mock rounds only to chase one past paper.', '- Fix factual errors or broken questions in place.', '- Add missing recent patterns as a separate reinforcement set so historical attempt results remain stable.', '');
  return `${lines.join('\n')}\n`;
}

const mockRoundsBySubject = { A: loadMockRounds('A'), B: loadMockRounds('B') };
const mockQuestionsBySubject = { A: mockRoundsBySubject.A.flatMap((r) => r.questions), B: mockRoundsBySubject.B.flatMap((r) => r.questions) };
const syntheticProfiles = { A: profile(mockQuestionsBySubject.A), B: profile(mockQuestionsBySubject.B) };
const results = [];
for (const session of past.sessions) {
  for (const subject of ['A', 'B']) {
    const actualSource = loadPastQuestions(session, subject) || loadStudyQuestions(session, subject);
    if (!actualSource) {
      results.push({ session: session.key, subject, status: 'pending-source' });
      continue;
    }
    const actual = actualSource.profile;
    const gap = buildGap(actual, syntheticProfiles[subject]);
    const actualTopPatterns = actualSource.source === 'korean-study-companion'
      ? topEntries(countValues(actualSource.questions.flatMap((q) => Array.isArray(q.patterns) ? q.patterns : [])))
      : [];
    const mockTopConceptCodes = topEntries(countValues(mockQuestionsBySubject[subject].map((q) => q.sourceConceptCode)));
    results.push({
      session: session.key,
      subject,
      status: 'compared',
      source: actualSource.source,
      similarityScore: similarity(syntheticProfiles[subject], actual),
      actual,
      syntheticRounds1To7: syntheticProfiles[subject],
      gap,
      recommendations: buildRecommendations(gap),
      mockRoundProfiles: mockRoundsBySubject[subject].map((round) => ({ examNo: round.examNo, profile: round.profile })),
      actualTopPatterns,
      mockTopConceptCodes,
      note: actualSource.source === 'korean-study-companion'
        ? 'Study-companion tags are used for the actual-paper profile; exact Japanese stem-length comparison requires a structured official import.'
        : undefined,
    });
  }
}

const compared = results.filter((r) => r.status === 'compared');
const report = {
  version: 2,
  generatedAt: new Date().toISOString(),
  status: compared.length ? 'ok' : 'pending-source',
  compared: compared.length,
  pending: results.length - compared.length,
  policy: {
    preserveAttemptHistory: true,
    rewriteExistingRoundsOnlyFor: ['factual-error', 'broken-question', 'wrong-answer', 'bad-explanation'],
    missingPatternStrategy: 'add-separate-reinforcement-set',
  },
  results,
};

if (writeReport) {
  fs.mkdirSync(analysisRoot, { recursive: true });
  fs.mkdirSync(docsRoot, { recursive: true });
  fs.writeFileSync(path.join(analysisRoot, 'past-mock-gap-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(docsRoot, 'past-mock-gap-report.md'), buildMarkdown(report), 'utf8');
  console.error(`Wrote ${path.relative(root, path.join(analysisRoot, 'past-mock-gap-report.json'))}`);
  console.error(`Wrote ${path.relative(root, path.join(docsRoot, 'past-mock-gap-report.md'))}`);
}

console.log(JSON.stringify(report, null, 2));
