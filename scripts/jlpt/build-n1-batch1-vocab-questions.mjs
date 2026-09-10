import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BATCH_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'batches');
const INPUT = path.join(BATCH_DIR, '2026-10-01--2026-10-14.word-review.json');
const OUTPUT = path.join(BATCH_DIR, '2026-10-01--2026-10-14.content-draft.json');
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();

function rotate(values, seed) {
	const offset = seed % values.length;
	return values.slice(offset).concat(values.slice(0, offset));
}
function distractors(words, target, field, seed) {
	const sameClass = words.filter((row) => row.key !== target.key && row.part_of_speech === target.part_of_speech);
	const rest = words.filter((row) => row.key !== target.key && row.part_of_speech !== target.part_of_speech);
	const ordered = sameClass.concat(rest);
	const result = [];
	const seen = new Set([normalize(target[field])]);
	for (let step = 0; step < ordered.length && result.length < 3; step += 1) {
		const row = ordered[(seed * 17 + step * 37) % ordered.length];
		const value = normalize(row[field]);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	if (result.length !== 3) throw new Error(`Unable to create distractors for ${target.key}/${field}`);
	return result;
}
function question(words, word, type, sequence, dayIndex) {
	const seed = dayIndex * 23 + sequence;
	if (type === 'kanji_reading') {
		const answer = word.reading;
		return {
			sequence, type, wordKey: word.key,
			prompt: `「${word.word}」の読み方として最も適切なものを選びなさい。`,
			options: rotate([answer, ...distractors(words, word, 'reading', seed)], seed),
			answer,
			explanation_ko: `「${word.word}」는 「${word.reading}」라고 읽으며, ${word.meaning_ko}라는 뜻이다.`,
		};
	}
	if (type === 'context_fill') {
		const answer = word.word;
		const sentence = word.example_ja.includes(word.word)
			? word.example_ja.replace(word.word, '（　）')
			: `${word.example_ja} この文脈に最も合う語を選びなさい。`;
		return {
			sequence, type, wordKey: word.key,
			prompt: `次の文の（　）に入る語として最も適切なものを選びなさい。\n${sentence}`,
			options: rotate([answer, ...distractors(words, word, 'word', seed)], seed),
			answer,
			explanation_ko: `문맥상 「${word.word}」가 자연스럽다. ${word.meaning_ko}라는 뜻으로 쓰였다.`,
		};
	}
	const answer = word.word;
	return {
		sequence, type: 'meaning_usage_synonym', wordKey: word.key,
		prompt: `「${word.meaning_ja}」という意味に最も近い語を選びなさい。`,
		options: rotate([answer, ...distractors(words, word, 'word', seed)], seed),
		answer,
		explanation_ko: `「${word.word}」의 중심 의미는 ${word.meaning_ko}이다.`,
	};
}

const source = JSON.parse(await fs.readFile(INPUT, 'utf8'));
const words = source.words;
const types = ['kanji_reading', 'kanji_reading', 'kanji_reading', ...Array(7).fill('context_fill'), ...Array(5).fill('meaning_usage_synonym')];
const days = [];
for (let dayIndex = 0; dayIndex < 14; dayIndex += 1) {
	const dayWords = words.slice(dayIndex * 20, dayIndex * 20 + 20);
	days.push({
		date: dayWords[0].planned_study_date,
		newWordKeys: dayWords.map((row) => row.key),
		vocabQuestions: types.map((type, index) => question(words, dayWords[index], type, index + 1, dayIndex)),
		grammarLessons: [], grammarQuestions: [], readingSets: [],
	});
}
const signatures = new Set();
for (const day of days) for (const item of day.vocabQuestions) {
	if (item.options.length !== 4 || new Set(item.options.map(normalize)).size !== 4) throw new Error(`${day.date}/${item.sequence}: invalid options`);
	if (item.options.filter((value) => normalize(value) === normalize(item.answer)).length !== 1) throw new Error(`${day.date}/${item.sequence}: answer mismatch`);
	if (!day.newWordKeys.includes(item.wordKey)) throw new Error(`${day.date}/${item.sequence}: unlinked word`);
	const signature = normalize(`${item.prompt}\n${item.options.join('\n')}`);
	if (signatures.has(signature)) throw new Error(`${day.date}/${item.sequence}: duplicate MCQ`);
	signatures.add(signature);
}
await fs.writeFile(OUTPUT, `${JSON.stringify({
	schemaVersion: 1,
	dateRange: source.dateRange,
	status: 'vocabulary_questions_complete_editorial_review_pending',
	priorityDisclaimer: source.priorityDisclaimer,
	words,
	days,
	checks: {
		wordCount: words.length,
		vocabularyQuestionCount: days.reduce((sum, day) => sum + day.vocabQuestions.length, 0),
		uniqueMcqCount: signatures.size,
		answerAndLinkChecksPassed: true,
		grammarAndReadingPending: true,
	},
}, null, 2)}\n`);
console.log(`Prepared ${signatures.size} linked vocabulary questions: ${path.relative(ROOT, OUTPUT)}`);
