import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data', 'jlpt', 'production');
const POOL_FILE = path.join(PROD, 'candidates', 'n1-candidate-pool.json');
const TRIAGE_FILE = path.join(PROD, 'candidates', 'n1-candidate-triage.json');
const CURATION_DIR = path.join(PROD, 'curation', 'words');
const OUTPUT_DIR = path.join(PROD, 'batches');
const OUTPUT_FILE = path.join(OUTPUT_DIR, '2026-10-01--2026-10-14.word-review.json');

const normalize = (value = '') => String(value).normalize('NFKC').trim();
const normalizeReading = (value = '') => normalize(value).replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
const identity = (row) => `${normalize(row.word)}\u0000${normalizeReading(row.reading)}`;
// Explicit first-batch exclusions are narrower than corpus exclusion. These
// entries may be legitimate Japanese, but they are poor uses of the earliest
// fixed N1 study slots, are orthographic variants, or are too domain/basic-heavy.
const FIRST_BATCH_BLOCKED_WORDS = new Set([
	'教え', '一部', '件', '的', '基', '私', '制服', '募金', '化石', '懸賞', '抽選',
	'介護', '印鑑', '貧乏', '御免ください', '御免なさい', '滅茶苦茶', '携帯', '丁目',
	'歯科', '用品', '準急', '化繊', '中程', '左程', '其れ程', '余っ程', '果ない',
	'膨脹', '局限', '酸化', '化合', '退化', '文化財', '領地', '領海', '法学',
	'開発', '施設', '登録', '伝説', '当たり前', '楽しむ', '集まる', '落ちる',
]);
const ADVANCED_SIGNAL = /[懸顧遂阻抑措脅促覆譲擁紛陥乏耐慕躊緩隔妨懲把拒赴撤携顕厳緻曖脆廃徴免妥甚莫逸疎滞堪敢鑑悟該凝敢踏]/u;
const FORMAL_SIGNAL = /[規制権論策義則構証識態因概裁訴法令条項施策]/u;
const REQUIRED = ['word', 'reading', 'meaning_ko', 'meaning_ja', 'part_of_speech', 'example_ja', 'example_ko'];

function readJson(file) { return fs.readFile(file, 'utf8').then(JSON.parse); }
function evidenceCount(row) { return Object.values(row.frequency ?? {}).filter(Number.isFinite).length; }
function score(row) {
	let value = 0;
	if (ADVANCED_SIGNAL.test(row.word)) value += 120;
	if (FORMAL_SIGNAL.test(row.word)) value += 24;
	if (row.jmdict_common) value += 8;
	if (normalize(row.word).length >= 2) value += 10;
	value += evidenceCount(row) * 3;
	const rank = Number(row.source_rank_by_generic_frequency ?? 99999);
	if (rank < 120) value -= 70;
	else if (rank >= 500 && rank <= 2400) value += 18;
	else if (rank <= 3500) value += 7;
	return value;
}
function studyType(row) {
	if (/動詞/.test(row.part_of_speech)) return 'verb';
	if (/形容詞|副詞|接続詞/.test(row.part_of_speech)) return 'modifier';
	return 'nominal';
}
function spread(rows) {
	const buckets = new Map(['nominal', 'verb', 'modifier'].map((type) => [type, rows.filter((row) => studyType(row) === type)]));
	const slots = ['nominal', 'verb', 'modifier', 'nominal', 'nominal', 'verb', 'nominal', 'modifier', 'nominal', 'nominal', 'verb', 'modifier', 'nominal', 'nominal', 'verb', 'nominal', 'modifier', 'nominal', 'nominal', 'nominal'];
	const result = [];
	while (result.length < rows.length) {
		for (const type of slots) {
			const preferred = buckets.get(type);
			const fallback = [...buckets.values()].find((values) => values.length);
			const next = preferred.length ? preferred.shift() : fallback?.shift();
			if (next) result.push(next);
		}
	}
	return result;
}

const [pool, triage, curationFiles] = await Promise.all([
	readJson(POOL_FILE),
	readJson(TRIAGE_FILE),
	fs.readdir(CURATION_DIR),
]);
const curated = [];
for (const file of curationFiles.filter((name) => name.endsWith('.json')).sort()) {
	const document = await readJson(path.join(CURATION_DIR, file));
	for (const row of document.words ?? []) curated.push({ ...row, source_file: file });
}
const curatedByIdentity = new Map(curated.map((row) => [identity(row), row]));
const triageByIdentity = new Map((triage.candidates ?? []).map((row) => [identity(row), row]));

const eligible = (pool.candidates ?? []).filter((row) => {
	const review = triageByIdentity.get(identity(row));
	const word = curatedByIdentity.get(identity(row));
	return review?.preliminary_priority !== 'review_later' &&
		!FIRST_BATCH_BLOCKED_WORDS.has(row.word) &&
		word && REQUIRED.every((field) => normalize(word[field]));
}).map((row) => ({
	...curatedByIdentity.get(identity(row)),
	candidate_evidence: {
		jmdict_seq: row.jmdict_seq,
		jmdict_canonical_match: row.jmdict_canonical_match,
		corpus_evidence_count: evidenceCount(row),
		source_rank_tiebreaker: row.source_rank_by_generic_frequency,
		priority_score: score(row),
	},
})).sort((a, b) =>
	b.candidate_evidence.priority_score - a.candidate_evidence.priority_score ||
	a.candidate_evidence.source_rank_tiebreaker - b.candidate_evidence.source_rank_tiebreaker ||
	a.word.localeCompare(b.word, 'ja'));

const selected = spread(eligible.slice(0, 360)).slice(0, 280).map((row, index) => {
	const date = new Date(Date.UTC(2026, 9, 1 + Math.floor(index / 20))).toISOString().slice(0, 10);
	return {
		sequence: index + 1,
		planned_study_date: date,
		key: row.key,
		word: row.word,
		reading: row.reading,
		meaning_ko: row.meaning_ko,
		meaning_ja: row.meaning_ja,
		part_of_speech: row.part_of_speech,
		example_ja: row.example_ja,
		example_ko: row.example_ko,
		source_file: row.source_file,
		candidate_evidence: row.candidate_evidence,
		review_status: 'content_complete_priority_review_pending',
	};
});

const identities = new Set(selected.map(identity));
if (selected.length !== 280 || identities.size !== 280) throw new Error(`Expected 280 unique rows, got ${selected.length}/${identities.size}`);
if (selected.some((row) => REQUIRED.some((field) => !normalize(row[field])))) throw new Error('Selected row is missing required content.');

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.writeFile(OUTPUT_FILE, JSON.stringify({
	schemaVersion: 1,
	dateRange: { from: '2026-10-01', to: '2026-10-14', days: 14, dailyWords: 20 },
	status: 'word_content_complete_priority_review_pending',
	priorityDisclaimer: 'Project editorial study priority based on N1 item-type value and licensed/open evidence; not an official JLPT per-word frequency claim.',
	checks: {
		wordCount: selected.length,
		uniqueWordReadingPairs: identities.size,
		allRequiredContentPresent: true,
		blockedEarliestSlotWordsPresent: selected.filter((row) => FIRST_BATCH_BLOCKED_WORDS.has(row.word)).length,
	},
	words: selected,
}, null, 2) + '\n');

console.log(`Prepared ${selected.length} content-complete word rows for priority review: ${path.relative(ROOT, OUTPUT_FILE)}`);
