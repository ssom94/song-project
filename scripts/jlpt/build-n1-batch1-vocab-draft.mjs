import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'jlpt', 'production');
const INPUT = path.join(DIR, 'candidates', 'n1-first-batch-proposals.json');
const OUTPUT_DIR = path.join(DIR, 'batches');
const WORD_OUTPUT = path.join(OUTPUT_DIR, '2026-10-01--2026-10-14.word-review.json');
const OUTPUT = path.join(OUTPUT_DIR, '2026-10-01--2026-10-14.content-draft.json');
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
const types = ['kanji_reading','kanji_reading','kanji_reading',...Array(7).fill('context_fill'),...Array(5).fill('meaning_usage_synonym')];
function rotate(values, seed) { const at = seed % values.length; return values.slice(at).concat(values.slice(0, at)); }
function distractors(all, word, field, seed) {
	const ordered = [...all.filter((row) => row.key !== word.key && row.part_of_speech === word.part_of_speech), ...all.filter((row) => row.key !== word.key && row.part_of_speech !== word.part_of_speech)];
	const seen = new Set([normalize(word[field])]); const values = [];
	for (let offset = 0; offset < ordered.length && values.length < 3; offset += 1) {
		const value = normalize(ordered[(seed * 31 + offset * 17) % ordered.length][field]);
		if (value && !seen.has(value)) { seen.add(value); values.push(value); }
	}
	if (values.length !== 3) throw new Error(`distractor shortage: ${word.word}/${field}`);
	return values;
}
function makeQuestion(all, word, type, sequence, dayIndex) {
	const seed = dayIndex * 19 + sequence;
	if (type === 'kanji_reading') return { sequence, type, wordKey: word.key, prompt: `「${word.word}」の読み方として最も適切なものを選びなさい。`, options: rotate([word.reading,...distractors(all,word,'reading',seed)],seed), answer: word.reading, explanation_ko: `「${word.word}」는 「${word.reading}」라고 읽는다. 뜻은 ${word.meaning_ko}이다.` };
	if (type === 'context_fill') {
		const example = word.example_ja.includes(word.word) ? word.example_ja.replace(word.word,'（　）') : `${word.example_ja} （　）に入る語を選びなさい。`;
		return { sequence, type, wordKey: word.key, prompt: `次の文の（　）に入る語として最も適切なものを選びなさい。\n${example}`, options: rotate([word.word,...distractors(all,word,'word',seed)],seed), answer: word.word, explanation_ko: `문맥상 「${word.word}」가 가장 자연스럽다. ${word.meaning_ko}라는 의미로 쓰였다.` };
	}
	return { sequence, type, wordKey: word.key, prompt: `「${word.meaning_ja}」という意味に最も近い語を選びなさい。`, options: rotate([word.word,...distractors(all,word,'word',seed)],seed), answer: word.word, explanation_ko: `「${word.word}」의 핵심 의미는 ${word.meaning_ko}이다.` };
}
const source = JSON.parse(await fs.readFile(INPUT, 'utf8'));
if (source.words.length !== 280) throw new Error(`Expected 280 selected words, found ${source.words.length}`);
const words = source.words.map((word) => ({ ...word, review_status: 'proposed_for_admin_editorial_review' }));
const days = Array.from({ length: 14 }, (_, dayIndex) => {
	const dayWords = words.slice(dayIndex * 20, dayIndex * 20 + 20);
	return { date: dayWords[0].planned_study_date, newWordKeys: dayWords.map((word) => word.key), vocabQuestions: types.map((type,index) => makeQuestion(words,dayWords[index],type,index + 1,dayIndex)), grammarLessons: [], grammarQuestions: [], readingSets: [] };
});
const signatures = new Set();
for (const day of days) for (const question of day.vocabQuestions) {
	if (question.options.length !== 4 || new Set(question.options.map(normalize)).size !== 4) throw new Error(`${day.date}/${question.sequence}: duplicate options`);
	if (question.options.filter((option) => normalize(option) === normalize(question.answer)).length !== 1) throw new Error(`${day.date}/${question.sequence}: answer mismatch`);
	if (!day.newWordKeys.includes(question.wordKey)) throw new Error(`${day.date}/${question.sequence}: question not linked to the date's new words`);
	const signature = normalize(`${question.prompt}\n${question.options.join('\n')}`);
	if (signatures.has(signature)) throw new Error(`${day.date}/${question.sequence}: exact duplicate question`);
	signatures.add(signature);
}
await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.writeFile(WORD_OUTPUT, `${JSON.stringify({ schemaVersion: 1, dateRange: source.dateRange, status: 'proposed_for_admin_editorial_review', priorityDisclaimer: source.purpose, checks: source.checks, words }, null, 2)}\n`);
await fs.writeFile(OUTPUT, `${JSON.stringify({ schemaVersion: 1, dateRange: source.dateRange, status: 'vocabulary_questions_complete_editorial_review_pending', words, days, checks: { wordCount: words.length, dayCount: days.length, vocabularyQuestionCount: days.length * 15, uniqueVocabularyMcqCount: signatures.size, answerAndDateLinkChecksPassed: true, grammarAndReadingPending: true } }, null, 2)}\n`);
console.log(JSON.stringify({ words: words.length, days: days.length, questions: signatures.size }, null, 2));
