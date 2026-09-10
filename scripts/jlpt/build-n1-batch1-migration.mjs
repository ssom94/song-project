import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'data/jlpt/production/batches/2026-10-01--2026-10-14.content-draft.json');
const OUTPUT = path.join(ROOT, 'migrations/0099_jlpt_n1_batch_20261001_20261014.sql');
const PLAN = 'N1_2027_JUL';
const FROM = '2026-10-01';
const TO = '2026-10-14';
const q = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => q(JSON.stringify(value));
const batches = (values, size) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));

const doc = JSON.parse(await fs.readFile(INPUT, 'utf8'));
if (doc.words.length !== 280 || doc.days.length !== 14) throw new Error('Expected validated 280-word / 14-day batch source.');
const keys = new Set(doc.words.map((word) => word.key));
for (const day of doc.days) if (day.newWordKeys.length !== 20 || day.newWordKeys.some((key) => !keys.has(key))) throw new Error(`Invalid day: ${day.date}`);

const lines = [
  '-- 0099_jlpt_n1_batch_20261001_20261014.sql',
  '-- Generated from validated project-authored source data. No remote query is run by this generator.',
  '-- Scope is deliberately bounded to N1_2027_JUL / 2026-10-01..2026-10-14.',
  '-- No plan-wide curriculum deletion, count scan, or legacy learning-data deletion occurs.',
  '',
  'DROP TABLE IF EXISTS _n1_b1_guard_0099;',
  'CREATE TABLE _n1_b1_guard_0099 (ok INTEGER NOT NULL CHECK (ok = 1));',
  `INSERT INTO _n1_b1_guard_0099(ok) SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM japanese_jlpt_daily_sessions s JOIN japanese_jlpt_study_plans p ON p.id=s.plan_id WHERE p.plan_code=${q(PLAN)} AND s.study_date BETWEEN ${q(FROM)} AND ${q(TO)} AND (s.status <> 'not_started' OR s.started_at IS NOT NULL OR s.completed_at IS NOT NULL)) THEN 1 ELSE 0 END;`,
  'DROP TABLE _n1_b1_guard_0099;',
  '',
  'DROP TABLE IF EXISTS _n1_b1_words_0099;',
  'CREATE TABLE _n1_b1_words_0099 (source_key TEXT PRIMARY KEY, study_date TEXT NOT NULL, word TEXT NOT NULL, reading TEXT NOT NULL, meaning_ko TEXT NOT NULL, meaning_ja TEXT NOT NULL, example_ja TEXT NOT NULL, example_ko TEXT NOT NULL);',
];

for (const chunk of batches(doc.words, 40)) {
  lines.push('INSERT INTO _n1_b1_words_0099(source_key,study_date,word,reading,meaning_ko,meaning_ja,example_ja,example_ko) VALUES');
  lines.push(`${chunk.map((word) => `(${[word.key, word.planned_study_date, word.word, word.reading, word.meaning_ko, word.meaning_ja, word.example_ja, word.example_ko].map(q).join(',')})`).join(',\n')};`);
}
lines.push('');
lines.push(`DELETE FROM japanese_jlpt_daily_words WHERE session_id IN (SELECT s.id FROM japanese_jlpt_daily_sessions s JOIN japanese_jlpt_study_plans p ON p.id=s.plan_id WHERE p.plan_code=${q(PLAN)} AND s.study_date BETWEEN ${q(FROM)} AND ${q(TO)});`);
lines.push(`DELETE FROM japanese_jlpt_daily_contents WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)}) AND study_date BETWEEN ${q(FROM)} AND ${q(TO)};`);
lines.push(`DELETE FROM japanese_jlpt_daily_sessions WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)}) AND study_date BETWEEN ${q(FROM)} AND ${q(TO)};`);
lines.push('');
lines.push(`INSERT INTO japanese_words(word,reading,meaning_ko,meaning_ja,jlpt_level_id,ai_status,note) SELECT s.word,s.reading,s.meaning_ko,s.meaning_ja,(SELECT id FROM jlpt_levels WHERE code='N1'),'reviewed','JLPT N1 batch 2026-10-01..2026-10-14' FROM _n1_b1_words_0099 s WHERE NOT EXISTS (SELECT 1 FROM japanese_words w WHERE w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL);`);
lines.push('DROP TABLE IF EXISTS _n1_b1_map_0099;');
lines.push('CREATE TABLE _n1_b1_map_0099 (source_key TEXT PRIMARY KEY, word_id INTEGER NOT NULL);');
lines.push('INSERT INTO _n1_b1_map_0099(source_key,word_id) SELECT s.source_key,MIN(w.id) FROM _n1_b1_words_0099 s JOIN japanese_words w ON w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL GROUP BY s.source_key;');
lines.push(`UPDATE japanese_words AS w SET meaning_ko=s.meaning_ko,meaning_ja=s.meaning_ja,ai_status='reviewed',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM _n1_b1_map_0099 m JOIN _n1_b1_words_0099 s ON s.source_key=m.source_key WHERE w.id=m.word_id;`);
lines.push('');
for (const day of doc.days) lines.push(`INSERT INTO japanese_jlpt_daily_sessions(plan_id,study_date,new_word_target,vocab_question_target,grammar_target,reading_target) SELECT id,${q(day.date)},20,15,2,1 FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)};`);
lines.push(`INSERT INTO japanese_jlpt_daily_words(session_id,word_id,item_kind) SELECT ds.id,m.word_id,'new' FROM _n1_b1_words_0099 s JOIN _n1_b1_map_0099 m ON m.source_key=s.source_key JOIN japanese_jlpt_daily_sessions ds ON ds.study_date=s.study_date JOIN japanese_jlpt_study_plans p ON p.id=ds.plan_id WHERE p.plan_code=${q(PLAN)};`);
lines.push('');
function content(date, type, sequence, title, payload) { lines.push(`INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json) SELECT id,${q(date)},${q(type)},${sequence},${q(title)},${json(payload)} FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)};`); }
for (const day of doc.days) {
  day.vocabQuestions.forEach((item, index) => content(day.date, 'vocab_question', index + 1, '文字・語彙', { type: item.type, wordKey: item.wordKey, prompt: item.prompt, options: item.options, answer: item.answer, explanationKo: item.explanation_ko }));
  day.grammarLessons.forEach((item, index) => content(day.date, 'grammar', index + 1, item.pattern, { pattern: item.pattern, meaningKo: item.meaning_ko, explanation: item.explanation_ko, examples: item.examples }));
  day.grammarQuestions.forEach((item, index) => content(day.date, 'grammar_question', index + 1, '文法', { prompt: item.prompt, options: item.options, answer: item.answer, explanationKo: item.explanation_ko }));
  day.readingSets.forEach((item, index) => content(day.date, 'reading', index + 1, item.title, { passage: item.passage, questions: item.questions.map((question) => ({ prompt: question.prompt, options: question.options, answer: question.answer, explanationKo: question.explanation_ko })) }));
}
lines.push('DROP TABLE _n1_b1_map_0099;');
lines.push('DROP TABLE _n1_b1_words_0099;');
lines.push('');
await fs.writeFile(OUTPUT, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), words: doc.words.length, days: doc.days.length, contentRows: doc.days.length * 21 }, null, 2));
