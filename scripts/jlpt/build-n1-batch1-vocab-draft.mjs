import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'jlpt', 'production');
const batch = process.argv[2] === 'batch2' ? 'batch2' : 'batch1';
const isBatch2 = batch === 'batch2';
const INPUT = path.join(DIR, 'candidates', isBatch2 ? 'n1-second-batch-proposals.json' : 'n1-first-batch-proposals.json');
const OUTPUT_DIR = path.join(DIR, 'batches');
const rangeStem = isBatch2 ? '2026-10-15--2026-10-28' : '2026-10-01--2026-10-14';
const WORD_OUTPUT = path.join(OUTPUT_DIR, `${rangeStem}.word-review.json`);
const OUTPUT = path.join(OUTPUT_DIR, `${rangeStem}.content-draft.json`);
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
const types = ['kanji_reading','kanji_reading','kanji_reading',...Array(7).fill('context_fill'),...Array(5).fill('meaning_usage_synonym')];
// These examples use a conjugated form in the word card.  Vocabulary MCQs keep
// the answer in dictionary form, so use a separate, natural sentence with a
// single answer slot instead of showing an unblanked example plus another slot.
const CONTEXT_SENTENCE_OVERRIDES = {
  '取り組む': '会社全体で業務のデジタル化に（　）必要がある。',
  '犯す': '同じ過ちを二度と（　）ことがないよう、原因を記録して共有した。',
  '営む': '祖父はこの町で長年、小さな商店を（　）ことを続けてきた。',
  '制する': '終盤に得点を重ね、相手を（　）ことができた。',
  '慎む': '式典では私語を（　）よう求められた。',
  '緩む': '長く使っているうちに、ねじが少し（　）ことがある。',
  '誤魔化す': '質問の核心を（　）ことなく、答えてください。',
};
function rotate(values, seed) { const at = seed % values.length; return values.slice(at).concat(values.slice(0, at)); }
function wordClass(row) {
	const pos = normalize(row.part_of_speech);
	if (/動詞/u.test(pos)) return 'verb';
	if (/形容詞|副詞|連体詞|接続詞/u.test(pos)) return 'modifier';
	return 'noun';
}
function distractors(all, word, field, seed) {
	const sameClass = all.filter((row) => row.key !== word.key && wordClass(row) === wordClass(word));
	const sameExactPos = sameClass.filter((row) => normalize(row.part_of_speech) === normalize(word.part_of_speech));
	// Keep all four vocabulary choices grammatically comparable whenever the
	// batch provides enough candidates; only fall back across classes when a
	// class genuinely has fewer than three alternatives.
	const preferred = [...sameExactPos, ...sameClass.filter((row) => !sameExactPos.includes(row))];
	const ordered = preferred.length >= 3
		? preferred
		: [...preferred, ...all.filter((row) => row.key !== word.key && wordClass(row) !== wordClass(word))];
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
		const example = CONTEXT_SENTENCE_OVERRIDES[word.word] ?? word.example_ja.replace(word.word,'（　）');
		if (!example.includes('（　）')) throw new Error(`context sentence has no safe blank: ${word.word}`);
		return { sequence, type, wordKey: word.key, prompt: `次の文の（　）に入る語として最も適切なものを選びなさい。\n${example}`, options: rotate([word.word,...distractors(all,word,'word',seed)],seed), answer: word.word, explanation_ko: `문맥상 「${word.word}」가 가장 자연스럽다. ${word.meaning_ko}라는 의미로 쓰였다.` };
	}
	return { sequence, type, wordKey: word.key, prompt: `「${word.meaning_ja}」という意味に最も近い語を選びなさい。`, options: rotate([word.word,...distractors(all,word,'word',seed)],seed), answer: word.word, explanation_ko: `「${word.word}」의 핵심 의미는 ${word.meaning_ko}이다.` };
}
const source = JSON.parse(await fs.readFile(INPUT, 'utf8'));
if (source.words.length !== 280) throw new Error(`Expected 280 selected words, found ${source.words.length}`);
const words = source.words.map((word) => ({ ...word, review_status: 'proposed_for_admin_editorial_review' }));
const days = Array.from({ length: 14 }, (_, dayIndex) => {
	const dayWords = words.slice(dayIndex * 20, dayIndex * 20 + 20);
	const readingWords = dayWords.slice(0, 3);
	const contextWords = dayWords.filter((word) => !readingWords.includes(word) && word.example_ja.includes(word.word)).slice(0, 7);
	if (contextWords.length !== 7) throw new Error(`${dayWords[0].planned_study_date}: fewer than 7 safe context examples`);
	const assigned = new Set([...readingWords, ...contextWords].map((word) => word.key));
	const meaningWords = dayWords.filter((word) => !assigned.has(word.key)).slice(0, 5);
	const questionWords = [...readingWords, ...contextWords, ...meaningWords];
	return { date: dayWords[0].planned_study_date, newWordKeys: dayWords.map((word) => word.key), vocabQuestions: types.map((type,index) => makeQuestion(words,questionWords[index],type,index + 1,dayIndex)), grammarLessons: [], grammarQuestions: [], readingSets: [] };
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
