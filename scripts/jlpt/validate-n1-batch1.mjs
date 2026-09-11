import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const isBatch2 = process.argv[2] === 'batch2';
const rangeStem = isBatch2 ? '2026-10-15--2026-10-28' : '2026-10-01--2026-10-14';
const ownMigration = isBatch2 ? '0100_jlpt_n1_batch_20261015_20261028.sql' : '0099_jlpt_n1_batch_20261001_20261014.sql';
const INPUT = path.join(ROOT, 'data', 'jlpt', 'production', 'batches', `${rangeStem}.content-draft.json`);
const REPORT = path.join(ROOT, 'data', 'jlpt', 'production', 'batches', `${rangeStem}.validation.json`);
const MIGRATIONS = path.join(ROOT, 'migrations');
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/u;
const HIRAGANA = /^[\u3040-\u309fー・\s]+$/u;
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
const errors = [];
const warnings = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);
const dateValue = (value) => new Date(`${value}T00:00:00Z`).getTime();
const daysApart = (a, b) => Math.abs(Math.round((dateValue(a) - dateValue(b)) / 86400000));
const signatureOf = (question) => normalize(`${question.prompt ?? question.question}\n${(question.options ?? []).join('\n')}`);

function validateMcq(question, where, date, signatures) {
	if (!question || typeof question !== 'object') return fail(where, 'question object required');
	const prompt = normalize(question.prompt ?? question.question);
	const options = Array.isArray(question.options) ? question.options.map(normalize) : [];
	const answer = normalize(question.answer);
	if (!prompt) fail(`${where}.prompt`, 'required');
	if (HANGUL.test(prompt)) fail(`${where}.prompt`, 'Hangul is not allowed in learner-facing Japanese text');
	if (options.length !== 4) fail(`${where}.options`, `expected 4, got ${options.length}`);
	if (new Set(options).size !== options.length) fail(`${where}.options`, 'must be distinct');
	if (options.filter((option) => option === answer).length !== 1) fail(`${where}.answer`, 'must match exactly one option');
	if (!HANGUL.test(normalize(question.explanation_ko))) fail(`${where}.explanation_ko`, 'Korean explanation required');
	const signature = signatureOf(question);
	const previous = signatures.get(signature);
	if (previous && daysApart(previous.date, date) < 90) fail(where, `exact MCQ reused within 90 days (${previous.where})`);
	else if (signature) signatures.set(signature, { date, where });
}

function validateGrammarMcq(question, where, date, signatures) {
	validateMcq(question, where, date, signatures);
	if ((String(question?.prompt ?? '').match(/（　）/gu) ?? []).length < 2) {
		fail(`${where}.prompt`, 'grammar prompt must contain a blank in the test sentence, in addition to the instruction');
	}
}

function validateVocabMcq(question, where, date, signatures) {
	validateMcq(question, where, date, signatures);
	if (question?.type === 'context_fill' && (String(question.prompt ?? '').match(/（　）/gu) ?? []).length !== 2) {
		fail(`${where}.prompt`, 'context-fill prompt must contain exactly one blank in its test sentence');
	}
}

async function historicalSignatures() {
	const found = new Map();
	for (const name of (await fs.readdir(MIGRATIONS)).filter((entry) => entry.endsWith('.sql'))) {
		if (name === ownMigration) continue;
		const sql = await fs.readFile(path.join(MIGRATIONS, name), 'utf8');
		const expression = /SELECT\s+id,'(\d{4}-\d{2}-\d{2})','(?:vocab_question|grammar_question|reading)',\d+,[^,]*,'((?:[^']|'')*)'\s+FROM\s+japanese_jlpt_study_plans/g;
		for (const match of sql.matchAll(expression)) {
			try {
				const payload = JSON.parse(match[2].replaceAll("''", "'"));
				const questions = Array.isArray(payload.questions) ? payload.questions : [payload];
				for (const question of questions) {
					const signature = signatureOf(question);
					if (signature && !found.has(signature)) found.set(signature, { date: match[1], where: `migrations/${name}` });
				}
			} catch { /* Non-JSON SQL payloads are checked by their own migration validators. */ }
		}
	}
	return found;
}

const document = JSON.parse(await fs.readFile(INPUT, 'utf8'));
const historical = await historicalSignatures();
const signatures = new Map(historical);
const identities = new Map();
const keys = new Set();
if (document.words.length !== 280) fail('words', `expected 280, got ${document.words.length}`);
for (const [index, word] of document.words.entries()) {
	const where = `words[${index}]`;
	for (const field of ['key','word','reading','meaning_ko','meaning_ja','part_of_speech','example_ja','example_ko']) if (!normalize(word[field])) fail(`${where}.${field}`, 'required');
	if (!HIRAGANA.test(normalize(word.reading))) warn(`${where}.reading`, 'reading is not all hiragana');
	if (!HANGUL.test(normalize(word.meaning_ko))) fail(`${where}.meaning_ko`, 'Hangul required');
	if (HANGUL.test(normalize(word.example_ja))) fail(`${where}.example_ja`, 'Hangul is not allowed');
	if (!HANGUL.test(normalize(word.example_ko))) fail(`${where}.example_ko`, 'Hangul required');
	const identity = `${normalize(word.word)}\u0000${normalize(word.reading)}`;
	if (identities.has(identity)) fail(where, `duplicate word+reading (${identities.get(identity)})`); else identities.set(identity, where);
	if (keys.has(word.key)) fail(where, `duplicate key ${word.key}`); else keys.add(word.key);
}
if (document.days.length !== 14) fail('days', `expected 14, got ${document.days.length}`);
const dates = new Set();
for (const [dayIndex, day] of document.days.entries()) {
	const where = `days[${dayIndex}]`;
	if (dates.has(day.date)) fail(`${where}.date`, 'duplicate date'); else dates.add(day.date);
	if (day.newWordKeys.length !== 20) fail(`${where}.newWordKeys`, `expected 20, got ${day.newWordKeys.length}`);
	if (new Set(day.newWordKeys).size !== 20) fail(`${where}.newWordKeys`, 'duplicates found');
	if (day.vocabQuestions.length !== 15) fail(`${where}.vocabQuestions`, `expected 15, got ${day.vocabQuestions.length}`);
	if (day.grammarLessons.length !== 2) fail(`${where}.grammarLessons`, `expected 2, got ${day.grammarLessons.length}`);
	if (day.grammarQuestions.length !== 3) fail(`${where}.grammarQuestions`, `expected 3, got ${day.grammarQuestions.length}`);
	if (day.readingSets.length !== 1) fail(`${where}.readingSets`, `expected 1, got ${day.readingSets.length}`);
	for (const [index, question] of day.vocabQuestions.entries()) {
		if (!day.newWordKeys.includes(question.wordKey)) fail(`${where}.vocabQuestions[${index}].wordKey`, 'must target a new word on the same date');
		validateVocabMcq(question, `${where}.vocabQuestions[${index}]`, day.date, signatures);
	}
	for (const [index, lesson] of day.grammarLessons.entries()) {
		if (!normalize(lesson.pattern) || !HANGUL.test(normalize(lesson.meaning_ko)) || !HANGUL.test(normalize(lesson.explanation_ko))) fail(`${where}.grammarLessons[${index}]`, 'pattern and Korean support required');
		if (!Array.isArray(lesson.examples) || lesson.examples.length < 1) fail(`${where}.grammarLessons[${index}].examples`, 'at least one example required');
	}
	day.grammarQuestions.forEach((question, index) => validateGrammarMcq(question, `${where}.grammarQuestions[${index}]`, day.date, signatures));
	for (const [setIndex, set] of day.readingSets.entries()) {
		if (!normalize(set.title) || !normalize(set.passage)) fail(`${where}.readingSets[${setIndex}]`, 'title and passage required');
		if (HANGUL.test(normalize(set.passage))) fail(`${where}.readingSets[${setIndex}].passage`, 'Hangul is not allowed');
		if (!Array.isArray(set.questions) || set.questions.length !== 3) fail(`${where}.readingSets[${setIndex}].questions`, 'exactly 3 questions required');
		(set.questions ?? []).forEach((question, index) => validateMcq(question, `${where}.readingSets[${setIndex}].questions[${index}]`, day.date, signatures));
	}
}
const firstDay = isBatch2 ? 15 : 1;
const expectedDates = Array.from({ length: 14 }, (_, index) => new Date(Date.UTC(2026, 9, firstDay + index)).toISOString().slice(0, 10));
if (expectedDates.some((date) => !dates.has(date))) fail('days', `date range must be exactly ${expectedDates[0]} through ${expectedDates.at(-1)}`);
const report = {
	schemaVersion: 1,
	dateRange: { from: expectedDates[0], to: expectedDates.at(-1) },
	status: errors.length ? 'failed' : 'structural_validation_passed_editorial_review_pending',
	counts: { words: document.words.length, days: document.days.length, vocabQuestions: document.days.reduce((sum, day) => sum + day.vocabQuestions.length, 0), grammarLessons: document.days.reduce((sum, day) => sum + day.grammarLessons.length, 0), grammarQuestions: document.days.reduce((sum, day) => sum + day.grammarQuestions.length, 0), readingSets: document.days.reduce((sum, day) => sum + day.readingSets.length, 0), readingQuestions: document.days.reduce((sum, day) => sum + day.readingSets.reduce((n, set) => n + set.questions.length, 0), 0), historicalMcqSignaturesScanned: historical.size },
	errors, warnings,
	manualReviewRemaining: ['N1 suitability and priority ordering for every selected word', 'naturalness of all Japanese examples and distractors', 'accuracy/naturalness of Korean translations', 'semantic correctness beyond structural answer matching'],
};
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, counts: report.counts, errors: errors.length, warnings: warnings.length }, null, 2));
if (errors.length) process.exitCode = 1;
