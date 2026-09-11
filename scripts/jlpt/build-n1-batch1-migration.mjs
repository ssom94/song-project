import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const batch = ['batch2','batch3','batch4'].includes(process.argv[2]) ? process.argv[2] : 'batch1';
const config = batch === 'batch4'
  ? { stem: '2026-11-12--2026-11-25', output: '0103_jlpt_n1_batch_20261112_20261125.sql', from: '2026-11-12', to: '2026-11-25', tag: '0103', temp: '_n1_b4', label: 'batch 2026-11-12..2026-11-25' }
  : batch === 'batch3'
    ? { stem: '2026-10-29--2026-11-11', output: '0101_jlpt_n1_batch_20261029_20261111.sql', from: '2026-10-29', to: '2026-11-11', tag: '0101', temp: '_n1_b3', label: 'batch 2026-10-29..2026-11-11' }
  : batch === 'batch2'
    ? { stem: '2026-10-15--2026-10-28', output: '0100_jlpt_n1_batch_20261015_20261028.sql', from: '2026-10-15', to: '2026-10-28', tag: '0100', temp: '_n1_b2', label: 'batch 2026-10-15..2026-10-28' }
    : { stem: '2026-10-01--2026-10-14', output: '0099_jlpt_n1_batch_20261001_20261014.sql', from: '2026-10-01', to: '2026-10-14', tag: '0099', temp: '_n1_b1', label: 'batch 2026-10-01..2026-10-14' };
const INPUT = path.join(ROOT, `data/jlpt/production/batches/${config.stem}.content-draft.json`);
const OUTPUT = path.join(ROOT, `migrations/${config.output}`);
const PLAN = 'N1_2027_JUL';
const { from: FROM, to: TO } = config;
const q = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => q(JSON.stringify(value));
const batches = (values, size) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));

const doc = JSON.parse(await fs.readFile(INPUT, 'utf8'));
if (doc.words.length !== 280 || doc.days.length !== 14) throw new Error('Expected validated 280-word / 14-day batch source.');
const keys = new Set(doc.words.map((word) => word.key));
for (const day of doc.days) if (day.newWordKeys.length !== 20 || day.newWordKeys.some((key) => !keys.has(key))) throw new Error(`Invalid day: ${day.date}`);

const lines = [
  `-- ${config.output}`,
  '-- Generated from validated project-authored source data. No remote query is run by this generator.',
  `-- Scope is deliberately bounded to N1_2027_JUL / ${FROM}..${TO}.`,
  '-- No plan-wide curriculum deletion, count scan, or legacy learning-data deletion occurs.',
  '',
  `DROP TABLE IF EXISTS ${config.temp}_guard_${config.tag};`,
  `CREATE TABLE ${config.temp}_guard_${config.tag} (ok INTEGER NOT NULL CHECK (ok = 1));`,
  `INSERT INTO ${config.temp}_guard_${config.tag}(ok) SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM japanese_jlpt_daily_sessions s JOIN japanese_jlpt_study_plans p ON p.id=s.plan_id WHERE p.plan_code=${q(PLAN)} AND s.study_date BETWEEN ${q(FROM)} AND ${q(TO)} AND (s.status <> 'not_started' OR s.started_at IS NOT NULL OR s.completed_at IS NOT NULL)) THEN 1 ELSE 0 END;`,
  `DROP TABLE ${config.temp}_guard_${config.tag};`,
  '',
  `DROP TABLE IF EXISTS ${config.temp}_words_${config.tag};`,
  `CREATE TABLE ${config.temp}_words_${config.tag} (source_key TEXT PRIMARY KEY, study_date TEXT NOT NULL, word TEXT NOT NULL, reading TEXT NOT NULL, meaning_ko TEXT NOT NULL, meaning_ja TEXT NOT NULL, example_ja TEXT NOT NULL, example_ko TEXT NOT NULL);`,
];

for (const chunk of batches(doc.words, 40)) {
  lines.push(`INSERT INTO ${config.temp}_words_${config.tag}(source_key,study_date,word,reading,meaning_ko,meaning_ja,example_ja,example_ko) VALUES`);
  lines.push(`${chunk.map((word) => `(${[word.key, word.planned_study_date, word.word, word.reading, word.meaning_ko, word.meaning_ja, word.example_ja, word.example_ko].map(q).join(',')})`).join(',\n')};`);
}
lines.push('');
lines.push(`DELETE FROM japanese_jlpt_daily_words WHERE session_id IN (SELECT s.id FROM japanese_jlpt_daily_sessions s JOIN japanese_jlpt_study_plans p ON p.id=s.plan_id WHERE p.plan_code=${q(PLAN)} AND s.study_date BETWEEN ${q(FROM)} AND ${q(TO)});`);
lines.push(`DELETE FROM japanese_jlpt_daily_contents WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)}) AND study_date BETWEEN ${q(FROM)} AND ${q(TO)};`);
lines.push(`DELETE FROM japanese_jlpt_daily_sessions WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)}) AND study_date BETWEEN ${q(FROM)} AND ${q(TO)};`);
lines.push('');
lines.push(`INSERT INTO japanese_words(word,reading,meaning_ko,meaning_ja,jlpt_level_id,ai_status,note) SELECT s.word,s.reading,s.meaning_ko,s.meaning_ja,(SELECT id FROM jlpt_levels WHERE code='N1'),'reviewed','JLPT N1 ${config.label}' FROM ${config.temp}_words_${config.tag} s WHERE NOT EXISTS (SELECT 1 FROM japanese_words w WHERE w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL);`);
lines.push(`DROP TABLE IF EXISTS ${config.temp}_map_${config.tag};`);
lines.push(`CREATE TABLE ${config.temp}_map_${config.tag} (source_key TEXT PRIMARY KEY, word_id INTEGER NOT NULL);`);
lines.push(`INSERT INTO ${config.temp}_map_${config.tag}(source_key,word_id) SELECT s.source_key,MIN(w.id) FROM ${config.temp}_words_${config.tag} s JOIN japanese_words w ON w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL GROUP BY s.source_key;`);
lines.push(`UPDATE japanese_words AS w SET meaning_ko=s.meaning_ko,meaning_ja=s.meaning_ja,ai_status='reviewed',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM ${config.temp}_map_${config.tag} m JOIN ${config.temp}_words_${config.tag} s ON s.source_key=m.source_key WHERE w.id=m.word_id;`);
lines.push('');
for (const day of doc.days) lines.push(`INSERT INTO japanese_jlpt_daily_sessions(plan_id,study_date,new_word_target,vocab_question_target,grammar_target,reading_target) SELECT id,${q(day.date)},20,15,2,1 FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)};`);
lines.push(`INSERT INTO japanese_jlpt_daily_words(session_id,word_id,item_kind) SELECT ds.id,m.word_id,'new' FROM ${config.temp}_words_${config.tag} s JOIN ${config.temp}_map_${config.tag} m ON m.source_key=s.source_key JOIN japanese_jlpt_daily_sessions ds ON ds.study_date=s.study_date JOIN japanese_jlpt_study_plans p ON p.id=ds.plan_id WHERE p.plan_code=${q(PLAN)};`);
lines.push('');
function content(date, type, sequence, title, payload) { lines.push(`INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json) SELECT id,${q(date)},${q(type)},${sequence},${q(title)},${json(payload)} FROM japanese_jlpt_study_plans WHERE plan_code=${q(PLAN)};`); }
for (const day of doc.days) {
  day.vocabQuestions.forEach((item, index) => content(day.date, 'vocab_question', index + 1, '文字・語彙', { type: item.type, wordKey: item.wordKey, prompt: item.prompt, options: item.options, answer: item.answer, explanationKo: item.explanation_ko }));
  day.grammarLessons.forEach((item, index) => content(day.date, 'grammar', index + 1, item.pattern, { pattern: item.pattern, meaningKo: item.meaning_ko, explanation: item.explanation_ko, examples: item.examples }));
  day.grammarQuestions.forEach((item, index) => content(day.date, 'grammar_question', index + 1, '文法', { prompt: item.prompt, options: item.options, answer: item.answer, explanationKo: item.explanation_ko }));
  day.readingSets.forEach((item, index) => content(day.date, 'reading', index + 1, item.title, { passage: item.passage, questions: item.questions.map((question) => ({ prompt: question.prompt, options: question.options, answer: question.answer, explanationKo: question.explanation_ko })) }));
}
lines.push(`DROP TABLE ${config.temp}_map_${config.tag};`);
lines.push(`DROP TABLE ${config.temp}_words_${config.tag};`);
lines.push('');
await fs.writeFile(OUTPUT, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), words: doc.words.length, days: doc.days.length, contentRows: doc.days.length * 21 }, null, 2));
