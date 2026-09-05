import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'ap', 'mock-exams');
const MANIFEST = path.join(DIR, 'manifest.json');
const errors = [];
const warnings = [];
const signatures = new Map();
const fingerprints = new Map();

const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);
const clean = (v) => String(v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const keyOf = (subject, examNo) => `${subject}-${String(examNo).padStart(2, '0')}`;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { fail(path.relative(ROOT, file), `JSON parse failed: ${e.message}`); return null; }
}

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizedQuestionSignature(q) {
  const options = Array.isArray(q.optionsJa) ? q.optionsJa.map(clean) : [];
  const subquestions = Array.isArray(q.subquestions) ? q.subquestions.map((s) => ({
    promptJa: clean(s?.promptJa),
    optionsJa: Array.isArray(s?.optionsJa) ? s.optionsJa.map(clean) : [],
  })) : [];
  return JSON.stringify({
    promptJa: clean(q.promptJa),
    passageJa: clean(q.passageJa),
    optionsJa: options,
    subquestions,
  });
}

function validateRound(round, spec) {
  const where = `data/ap/mock-exams/${round.file}`;
  const file = path.join(DIR, round.file);
  if (!fs.existsSync(file)) {
    if (round.status === 'ready') fail(where, 'ready round file is missing');
    return;
  }
  const data = readJson(file);
  if (!data) return;
  if (data.subject !== round.subject || Number(data.examNo) !== Number(round.examNo)) {
    fail(where, 'subject/examNo must match manifest');
  }
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (round.status === 'ready' && questions.length !== spec.questionCount) {
    fail(where, `ready round must contain exactly ${spec.questionCount} questions (got ${questions.length})`);
  }
  const numbers = new Set();
  let totalScore = 0;
  let mandatoryCount = 0;
  questions.forEach((q, index) => {
    const qWhere = `${where}.questions[${index}]`;
    const no = Number(q?.questionNo);
    if (!Number.isInteger(no) || no <= 0) fail(qWhere, 'questionNo must be a positive integer');
    if (numbers.has(no)) fail(qWhere, `duplicate questionNo ${no}`);
    numbers.add(no);
    const promptJa = clean(q?.promptJa);
    const promptKo = clean(q?.promptKo);
    if (!promptJa) fail(qWhere, 'promptJa is required');
    if (!promptKo) fail(qWhere, 'promptKo is required');
    if (!clean(q?.explanationJa)) fail(qWhere, 'explanationJa is required');
    if (!clean(q?.explanationKo)) fail(qWhere, 'explanationKo is required');
    const maxScore = Number(q?.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) fail(qWhere, 'maxScore must be > 0');
    else totalScore += maxScore;
    if (q?.mandatory === true) mandatoryCount += 1;

    if (round.subject === 'A') {
      const optionsJa = Array.isArray(q?.optionsJa) ? q.optionsJa.map(clean) : [];
      const optionsKo = Array.isArray(q?.optionsKo) ? q.optionsKo.map(clean) : [];
      if (q?.type !== 'choice4') fail(qWhere, 'Subject A question type must be choice4');
      if (optionsJa.length !== 4 || optionsKo.length !== 4) fail(qWhere, 'Subject A must have exactly four JA/KO choices');
      if (new Set(optionsJa).size !== optionsJa.length) fail(qWhere, 'Japanese choices must be distinct');
      const answer = Number(q?.correctChoice);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) fail(qWhere, 'correctChoice must be 0..3');
    } else {
      if (q?.type !== 'written') fail(qWhere, 'Subject B question type must be written');
      if (!clean(q?.passageJa)) warn(qWhere, 'passageJa is recommended for exam-style Subject B');
      if (!clean(q?.modelAnswerJa) && !Array.isArray(q?.subquestions)) fail(qWhere, 'modelAnswerJa or subquestions are required');
    }

    const signature = normalizedQuestionSignature(q);
    const computed = digest(signature);
    const supplied = clean(q?.fingerprint);
    if (!supplied) fail(qWhere, `fingerprint is required; expected ${computed}`);
    else if (supplied !== computed) fail(qWhere, `fingerprint mismatch; expected ${computed}`);
    const previousSig = signatures.get(signature);
    if (previousSig) fail(qWhere, `duplicate question content; previous ${previousSig}`);
    else signatures.set(signature, qWhere);
    const previousFp = fingerprints.get(computed);
    if (previousFp) fail(qWhere, `duplicate fingerprint; previous ${previousFp}`);
    else fingerprints.set(computed, qWhere);
  });

  if (round.status === 'ready') {
    if (Math.abs(totalScore - spec.totalScore) > 0.0001) fail(where, `question maxScore total must be ${spec.totalScore} (got ${totalScore})`);
    if (round.subject === 'B' && mandatoryCount < 1) fail(where, 'Subject B must contain at least one mandatory information-security question');
  }
}

const manifest = readJson(MANIFEST);
if (manifest) {
  const rounds = Array.isArray(manifest.rounds) ? manifest.rounds : [];
  const roundKeys = new Set();
  const files = new Set();
  rounds.forEach((round, index) => {
    const where = `manifest.rounds[${index}]`;
    if (round?.subject !== 'A' && round?.subject !== 'B') fail(where, 'subject must be A or B');
    if (!Number.isInteger(Number(round?.examNo)) || Number(round.examNo) <= 0) fail(where, 'examNo must be positive');
    const key = keyOf(round?.subject, Number(round?.examNo));
    if (roundKeys.has(key)) fail(where, `duplicate round ${key}`); else roundKeys.add(key);
    if (!clean(round?.file)) fail(where, 'file is required');
    else if (files.has(round.file)) fail(where, `duplicate file ${round.file}`); else files.add(round.file);
    if (!['draft', 'ready'].includes(round?.status)) fail(where, 'status must be draft or ready');
    const spec = manifest.subjects?.[round?.subject];
    if (!spec) fail(where, `missing subject spec for ${round?.subject}`);
    else validateRound(round, spec);
  });
}

for (const message of warnings) console.warn(`WARN ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`ERROR ${message}`);
  console.error(`AP mock exam validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`AP mock exam validation passed: ${signatures.size} question(s), ${warnings.length} warning(s)`);
