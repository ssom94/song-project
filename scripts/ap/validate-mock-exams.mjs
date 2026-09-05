import fs from 'node:fs';
import path from 'node:path';
import {
  clean,
  computeQuestionFingerprint,
  normalizedQuestionSignature,
  roundFiles,
  roundKey,
} from './mock-exam-utils.mjs';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'ap', 'mock-exams');
const MANIFEST = path.join(DIR, 'manifest.json');
const errors = [];
const warnings = [];
const signatures = new Map();
const fingerprints = new Map();

const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { fail(path.relative(ROOT, file), `JSON parse failed: ${e.message}`); return null; }
}

function loadRoundQuestions(round) {
  const files = roundFiles(round);
  const questions = [];
  for (const name of files) {
    const file = path.join(DIR, name);
    const where = `data/ap/mock-exams/${name}`;
    if (!fs.existsSync(file)) {
      if (round.status === 'ready') fail(where, 'ready round source file is missing');
      continue;
    }
    const data = readJson(file);
    if (!data) continue;
    if (data.subject !== round.subject || Number(data.examNo) !== Number(round.examNo)) {
      fail(where, 'subject/examNo must match manifest');
    }
    const rows = Array.isArray(data.questions) ? data.questions : [];
    rows.forEach((q, index) => questions.push({ q, where: `${where}.questions[${index}]` }));
  }
  return { files, questions };
}

function validateRound(round, spec) {
  const key = roundKey(round.subject, round.examNo);
  const { questions } = loadRoundQuestions(round);
  if (round.status === 'ready' && questions.length !== spec.questionCount) {
    fail(key, `ready round must contain exactly ${spec.questionCount} questions across all source files (got ${questions.length})`);
  }

  const numbers = new Set();
  const sectionCounts = new Map();
  const answerPositions = [0, 0, 0, 0];
  let totalScore = 0;
  let mandatoryCount = 0;

  for (const { q, where } of questions) {
    const no = Number(q?.questionNo);
    if (!Number.isInteger(no) || no <= 0) fail(where, 'questionNo must be a positive integer');
    if (numbers.has(no)) fail(where, `duplicate questionNo ${no} across round source files`);
    numbers.add(no);

    const section = clean(q?.sectionCode);
    if (section) sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    if (!clean(q?.promptJa)) fail(where, 'promptJa is required');
    if (!clean(q?.promptKo)) fail(where, 'promptKo is required');
    if (!clean(q?.explanationJa)) fail(where, 'explanationJa is required');
    if (!clean(q?.explanationKo)) fail(where, 'explanationKo is required');

    const maxScore = Number(q?.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) fail(where, 'maxScore must be > 0');
    else totalScore += maxScore;
    if (q?.mandatory === true) mandatoryCount += 1;

    if (round.subject === 'A') {
      const optionsJa = Array.isArray(q?.optionsJa) ? q.optionsJa.map(clean) : [];
      const optionsKo = Array.isArray(q?.optionsKo) ? q.optionsKo.map(clean) : [];
      if (q?.type !== 'choice4') fail(where, 'Subject A question type must be choice4');
      if (optionsJa.length !== 4 || optionsKo.length !== 4) fail(where, 'Subject A must have exactly four JA/KO choices');
      if (new Set(optionsJa).size !== optionsJa.length) fail(where, 'Japanese choices must be distinct');
      if (new Set(optionsKo).size !== optionsKo.length) warn(where, 'Korean choices should normally be distinct');
      const answer = Number(q?.correctChoice);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) fail(where, 'correctChoice must be 0..3');
      else answerPositions[answer] += 1;
    } else {
      if (q?.type !== 'written') fail(where, 'Subject B question type must be written');
      if (!clean(q?.passageJa) && !q?.content) warn(where, 'passageJa or structured content is recommended for exam-style Subject B');
      if (!clean(q?.modelAnswerJa) && !Array.isArray(q?.subquestions) && !q?.gradingSchema) {
        fail(where, 'model answer/subquestions/grading schema are required');
      }
    }

    // fingerprint is derived data. Never trust a hand-written fingerprint in JSON.
    // Duplicate checks always use the normalized Japanese question content itself.
    const signature = normalizedQuestionSignature(q);
    const computed = computeQuestionFingerprint(q);
    const previousSig = signatures.get(signature);
    if (previousSig) fail(where, `duplicate question content; previous ${previousSig}`);
    else signatures.set(signature, where);
    const previousFp = fingerprints.get(computed);
    if (previousFp) fail(where, `duplicate computed fingerprint; previous ${previousFp}`);
    else fingerprints.set(computed, where);
  }

  if (round.status === 'ready') {
    if (numbers.size === spec.questionCount) {
      for (let no = 1; no <= spec.questionCount; no += 1) {
        if (!numbers.has(no)) fail(key, `missing questionNo ${no}`);
      }
    }
    if (Math.abs(totalScore - spec.totalScore) > 0.0001) fail(key, `question maxScore total must be ${spec.totalScore} (got ${totalScore})`);
    if (round.subject === 'B' && mandatoryCount < 1) fail(key, 'Subject B must contain at least one mandatory information-security question');

    if (round.subject === 'A' && spec.sectionDistribution) {
      for (const [section, expected] of Object.entries(spec.sectionDistribution)) {
        const actual = sectionCounts.get(section) ?? 0;
        if (actual !== expected) fail(key, `section ${section}: expected ${expected}, got ${actual}`);
      }
    }
    if (round.subject === 'A' && Array.isArray(round.answerPositionDistribution)) {
      round.answerPositionDistribution.forEach((expected, index) => {
        if (answerPositions[index] !== expected) fail(key, `correctChoice ${index}: expected ${expected}, got ${answerPositions[index]}`);
      });
    }
  }
}

const manifest = readJson(MANIFEST);
if (manifest) {
  const rounds = Array.isArray(manifest.rounds) ? manifest.rounds : [];
  const roundKeys = new Set();
  const usedFiles = new Set();
  rounds.forEach((round, index) => {
    const where = `manifest.rounds[${index}]`;
    if (round?.subject !== 'A' && round?.subject !== 'B') fail(where, 'subject must be A or B');
    if (!Number.isInteger(Number(round?.examNo)) || Number(round.examNo) <= 0) fail(where, 'examNo must be positive');
    const key = roundKey(round?.subject, Number(round?.examNo));
    if (roundKeys.has(key)) fail(where, `duplicate round ${key}`); else roundKeys.add(key);
    const names = roundFiles(round);
    if (!names.length) fail(where, 'file or files is required');
    for (const name of names) {
      if (usedFiles.has(name)) fail(where, `duplicate source file ${name}`); else usedFiles.add(name);
    }
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
