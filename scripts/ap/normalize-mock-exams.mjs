import fs from 'node:fs';
import path from 'node:path';
import { computeQuestionFingerprint, roundFiles } from './mock-exam-utils.mjs';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'ap', 'mock-exams');
const MANIFEST = path.join(DIR, 'manifest.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const manifest = readJson(MANIFEST);
let changedFiles = 0;
let changedQuestions = 0;

for (const round of Array.isArray(manifest.rounds) ? manifest.rounds : []) {
  for (const name of roundFiles(round)) {
    const file = path.join(DIR, name);
    if (!fs.existsSync(file)) continue;
    const data = readJson(file);
    const questions = Array.isArray(data.questions) ? data.questions : [];
    let changed = false;
    for (const question of questions) {
      const fingerprint = computeQuestionFingerprint(question);
      if (question.fingerprint !== fingerprint) {
        question.fingerprint = fingerprint;
        changed = true;
        changedQuestions += 1;
      }
    }
    if (changed) {
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      changedFiles += 1;
    }
  }
}

console.log(`AP mock exam fingerprints normalized: ${changedQuestions} question(s) in ${changedFiles} file(s)`);
