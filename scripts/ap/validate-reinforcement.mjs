import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataRoot = path.join(root, 'public/assets/data/ap-reinforcement');
let failed = false;

function fail(message) { failed = true; console.error(`AP reinforcement validation failed: ${message}`); }
function clean(value) { return String(value ?? '').trim(); }
function countBy(rows, getter) { const out = {}; for (const row of rows) { const key = getter(row); out[key] = (out[key] || 0) + 1; } return out; }
function patternCount(rows, pattern) { return rows.filter((q) => Array.isArray(q.patterns) && q.patterns.includes(pattern)).length; }

function validateCommon(file, data, questions) {
  if (!clean(data.titleJa) || !clean(data.titleKo)) fail(`${file}: JA/KO titles are required`);
  if (questions.length !== Number(data.questionCount)) fail(`${file}: questionCount mismatch`);
  const seen = new Set();
  for (const [index, q] of questions.entries()) {
    const where = `${file}.questions[${index}]`;
    const no = Number(q.questionNo);
    if (!Number.isInteger(no) || no < 1 || no > questions.length) fail(`${where}: invalid questionNo`);
    if (seen.has(no)) fail(`${where}: duplicate questionNo ${no}`);
    seen.add(no);
    if (!Array.isArray(q.patterns) || q.patterns.length === 0 || q.patterns.some((v) => !clean(v))) fail(`${where}: patterns are required`);
  }
  for (let no = 1; no <= questions.length; no += 1) if (!seen.has(no)) fail(`${file}: missing Q${no}`);
}

function validateA(file, data, questions) {
  if (data.kind !== 'ap-subject-a-calibration-set') fail(`${file}: invalid A kind`);
  for (const [index, q] of questions.entries()) {
    const where = `${file}.questions[${index}]`;
    if (!['T', 'M', 'S'].includes(q.sectionCode)) fail(`${where}: invalid sectionCode`);
    if (!clean(q.promptJa) || !clean(q.promptKo)) fail(`${where}: JA/KO prompts are required`);
    if (!Array.isArray(q.optionsJa) || q.optionsJa.length !== 4 || !Array.isArray(q.optionsKo) || q.optionsKo.length !== 4) fail(`${where}: four JA/KO options are required`);
    if (!Number.isInteger(q.correctChoice) || q.correctChoice < 0 || q.correctChoice > 3) fail(`${where}: correctChoice must be 0..3`);
    if (!clean(q.explanationJa) || !clean(q.explanationKo)) fail(`${where}: JA/KO explanations are required`);
    if (!clean(q.examPointJa) || !clean(q.examPointKo)) fail(`${where}: JA/KO exam points are required`);
    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) fail(`${where}: difficulty must be 1..3`);
  }
  const sections = countBy(questions, (q) => q.sectionCode);
  const expectedSections = data.targetProfile?.sectionDistribution || {};
  for (const code of ['T', 'M', 'S']) if ((sections[code] || 0) !== Number(expectedSections[code])) fail(`${file}: ${code} section count mismatch`);
  const mean = questions.reduce((sum, q) => sum + q.difficulty, 0) / Math.max(1, questions.length);
  const reportedMean = Number(mean.toFixed(2));
  const expectedMean = Number(data.targetProfile?.difficultyMean);
  if (!Number.isFinite(expectedMean) || Math.abs(reportedMean - expectedMean) > 0.001) fail(`${file}: difficulty mean ${mean.toFixed(3)} (reported ${reportedMean.toFixed(2)}) does not match target ${data.targetProfile?.difficultyMean}`);
  if (data.sourceSession === 'five-session-aggregate') {
    if (questions.length !== 24) fail(`${file}: five-session A set must contain 24 questions`);
    const choices = countBy(questions, (q) => q.correctChoice);
    for (let choice = 0; choice < 4; choice += 1) if ((choices[choice] || 0) !== 6) fail(`${file}: answer choice ${choice} must occur exactly 6 times`);
    const difficulties = countBy(questions, (q) => q.difficulty);
    if ((difficulties[1] || 0) !== 12 || (difficulties[2] || 0) !== 12) fail(`${file}: difficulty 1/2 must be balanced 12/12`);
    if (patternCount(questions, 'security') !== 3) fail(`${file}: security target must be exactly 3 questions`);
    if (patternCount(questions, 'diagram') !== 1) fail(`${file}: diagram target must be exactly 1 question`);
    if (patternCount(questions, 'scenario') > 1) fail(`${file}: scenario target must be at most 1 question`);
  }
}

function validateB(file, data, questions) {
  if (data.kind !== 'ap-subject-b-calibration-set') fail(`${file}: invalid B kind`);
  if (questions.length !== 11) fail(`${file}: Subject B set must contain 11 questions`);
  if (Number(data.answerCount) !== 5) fail(`${file}: Subject B answerCount must be 5`);
  const requiredSections = ['SECURITY','STRATEGY','PROGRAMMING','ARCHITECTURE','NETWORK','DATABASE','EMBEDDED','SYSTEM_DEV','PROJECT_MGMT','SERVICE_MGMT','AUDIT'];
  const sectionCounts = countBy(questions, (q) => q.sectionCode);
  for (const code of requiredSections) if ((sectionCounts[code] || 0) !== 1) fail(`${file}: section ${code} must occur exactly once`);
  for (const [index, q] of questions.entries()) {
    const where = `${file}.questions[${index}]`;
    if (!requiredSections.includes(q.sectionCode)) fail(`${where}: invalid sectionCode`);
    if (!clean(q.fieldJa) || !clean(q.fieldKo)) fail(`${where}: JA/KO field names are required`);
    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 4) fail(`${where}: difficulty must be 1..4`);
    if (Number(q.questionNo) === 1 && q.mandatory !== true) fail(`${where}: Q1 must be mandatory`);
    if (Number(q.questionNo) !== 1 && q.mandatory === true) fail(`${where}: only Q1 may be mandatory`);
    const content = q.content || {};
    if (!clean(content.passageJa) || !clean(content.passageKo)) fail(`${where}: JA/KO passages are required`);
    const subs = Array.isArray(content.subquestions) ? content.subquestions : [];
    if (subs.length < 3 || subs.length > 5) fail(`${where}: 3..5 subquestions are required`);
    let score = 0;
    const keys = new Set();
    for (const [subIndex, sq] of subs.entries()) {
      const subWhere = `${where}.content.subquestions[${subIndex}]`;
      if (!clean(sq.key) || keys.has(sq.key)) fail(`${subWhere}: unique key is required`);
      keys.add(sq.key);
      if (!clean(sq.promptJa) || !clean(sq.promptKo)) fail(`${subWhere}: JA/KO prompts are required`);
      if (!clean(sq.modelJa) || !clean(sq.modelKo)) fail(`${subWhere}: JA/KO model answers are required`);
      const points = Number(sq.score);
      if (!Number.isInteger(points) || points <= 0) fail(`${subWhere}: positive integer score is required`);
      else score += points;
    }
    if (score !== 20) fail(`${where}: subquestion score total must be 20, got ${score}`);
    if (!clean(q.explanationJa) || !clean(q.explanationKo)) fail(`${where}: JA/KO explanations are required`);
    if (!clean(q.examPointJa) || !clean(q.examPointKo)) fail(`${where}: JA/KO exam points are required`);
  }
  if (Number(data.targetProfile?.mandatoryQuestion) !== 1 || Number(data.targetProfile?.optionalAnswerCount) !== 4) fail(`${file}: B target profile must be Q1 mandatory + 4 optional`);
}

const files = fs.readdirSync(dataRoot).filter((name) => name.endsWith('.json')).sort();
let questionTotal = 0;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8'));
  const questions = Array.isArray(data.questions) ? data.questions : [];
  questionTotal += questions.length;
  validateCommon(file, data, questions);
  if (data.subject === 'A') validateA(file, data, questions);
  else if (data.subject === 'B') validateB(file, data, questions);
  else fail(`${file}: subject must be A or B`);
}

if (failed) process.exit(1);
console.log(`AP reinforcement validation passed: ${files.length} set(s), ${questionTotal} question(s).`);
