import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const WORDS_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'words');
const DAILY_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'daily');

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

let fixedWords = 0;
let fixedDaily = 0;

for (const file of listJson(WORDS_DIR)) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const word of value.words ?? []) {
    if (word.key === 'n1-1009') {
      word.example_ko = '발언의 일부만 떼어 내면 본인의 의도와 어긋난 뜻으로 받아들여질 수 있다.';
      fixedWords += 1;
    }
    if (word.key === 'n1-1084') {
      word.example_ja = '駅を出て三番目の交差点を右に曲がると、市役所が見える。';
      word.example_ko = '역을 나와 세 번째 교차로에서 오른쪽으로 돌면 시청이 보인다.';
      fixedWords += 1;
    }
  }
  writeJson(file, value);
}

for (const file of listJson(DAILY_DIR)) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const day of value.days ?? []) {
    for (const question of day.vocabQuestions ?? []) {
      if (question.wordKey === 'n1-1084' && question.type === 'context_fill') {
        question.prompt = String(question.prompt ?? '').replace(
          '三（　）の選択肢が最も条件に合っている。',
          '駅を出て三（　）の交差点を右に曲がると、市役所が見える。',
        ).replace(
          '三( )の選択肢が最も条件に合っている。',
          '駅を出て三（　）の交差点を右に曲がると、市役所が見える。',
        );
        fixedDaily += 1;
      }
    }
  }
  writeJson(file, value);
}

console.log(`Sanitized JLPT materialized data: ${fixedWords} word rows, ${fixedDaily} daily questions.`);
