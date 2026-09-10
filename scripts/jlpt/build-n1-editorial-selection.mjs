import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CANDIDATE_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'candidates');
const TRIAGE_FILE = path.join(CANDIDATE_DIR, 'n1-candidate-triage.json');
const POOL_FILE = path.join(CANDIDATE_DIR, 'n1-candidate-pool.json');
const OUTPUT_FILE = path.join(CANDIDATE_DIR, 'n1-editorial-selection.json');
const REPORT_FILE = path.join(CANDIDATE_DIR, 'n1-editorial-selection-report.json');

const keyOf = (row) => `${String(row.word ?? '').normalize('NFKC')}\u0000${String(row.reading ?? '').normalize('NFKC')}`;
const scoreFrequencyEvidence = (row) => Object.values(row.frequency ?? {}).filter((value) => Number.isFinite(value)).length;
const studyType = (row) => {
	if (['一段動詞', '五段動詞'].includes(row.part_of_speech)) return 'verb';
	if (['副詞', 'な形容詞', 'い形容詞', '接続詞'].includes(row.part_of_speech)) return 'modifier_or_connector';
	if (['普通名詞', 'サ変名詞'].includes(row.part_of_speech)) return 'noun';
	return 'other';
};
// The slot pattern keeps one day from becoming twenty institutional nouns while
// preserving the A-before-B/C policy.  It is only a scheduling spread, never a
// replacement for editorial N1 suitability review.
const DAILY_STUDY_TYPE_SLOTS = [
	'noun', 'verb', 'modifier_or_connector', 'noun', 'noun',
	'verb', 'noun', 'modifier_or_connector', 'noun', 'other',
	'noun', 'verb', 'modifier_or_connector', 'noun', 'noun',
	'verb', 'noun', 'modifier_or_connector', 'noun', 'noun',
];

function spreadForDailyStudy(rows) {
	const buckets = new Map(['noun', 'verb', 'modifier_or_connector', 'other'].map((type) => [type, []]));
	for (const row of rows) buckets.get(studyType(row)).push(row);
	const result = [];
	while ([...buckets.values()].some((values) => values.length)) {
		for (const type of DAILY_STUDY_TYPE_SLOTS) {
			const preferred = buckets.get(type);
			const fallback = [...buckets.values()].find((values) => values.length);
			const next = preferred.length ? preferred.shift() : fallback?.shift();
			if (next) result.push(next);
		}
	}
	return result;
}

const pool = JSON.parse(await fs.readFile(POOL_FILE, 'utf8'));
const triage = JSON.parse(await fs.readFile(TRIAGE_FILE, 'utf8'));
const sourceByIdentity = new Map((pool.candidates ?? []).map((row) => [keyOf(row), row]));

const rows = (triage.candidates ?? []).map((row) => {
	const source = sourceByIdentity.get(keyOf(row));
	if (!source) throw new Error(`Missing source candidate: ${row.word}/${row.reading}`);
	const excludedForReview = row.preliminary_priority === 'review_later';
	const priorityBand = excludedForReview
		? 'excluded_pending_editorial_review'
		: row.preliminary_priority === 'A_candidate'
			? 'A'
			: 'B_or_C';
	return {
		word: source.word,
		reading: source.reading,
		jmdict_seq: source.jmdict_seq,
		part_of_speech: source.part_of_speech,
		pos_tags: source.pos_tags,
		jmdict_common: source.jmdict_common,
		jmdict_canonical_match: source.jmdict_canonical_match,
		source_rank_by_generic_frequency: source.source_rank_by_generic_frequency,
		frequency_evidence_count: scoreFrequencyEvidence(source),
		preliminary_priority_band: priorityBand,
		selection_status: excludedForReview ? 'hold_for_editorial_review' : 'provisional_candidate',
		selection_reason: excludedForReview
			? 'Excluded from the first corpus pass because it has a basic/general, morpheme/function-word, or similarly high-risk signal; a human editor may restore it only with an N1-specific usage rationale.'
			: row.preliminary_priority === 'A_candidate'
				? 'High N1 study-value signal: abstract, formal, written, compound, or nuanced vocabulary marker without a blocking risk signal.'
				: 'Canonical N1-classified candidate without a blocking risk signal; scheduled after the A band according to coverage and editorial review.',
		flags: row.flags,
		final_review_status: 'needs_editorial_review',
	};
});

const scheduled = rows.filter((row) => row.selection_status === 'provisional_candidate').sort((a, b) => {
	const aBand = a.preliminary_priority_band === 'A' ? 0 : 1;
	const bBand = b.preliminary_priority_band === 'A' ? 0 : 1;
	return aBand - bBand ||
		b.frequency_evidence_count - a.frequency_evidence_count ||
		a.source_rank_by_generic_frequency - b.source_rank_by_generic_frequency ||
		a.reading.localeCompare(b.reading, 'ja') ||
		a.word.localeCompare(b.word, 'ja');
});

if (scheduled.length < 3000) throw new Error(`Only ${scheduled.length} provisional candidates remain; need at least 3000.`);
const dailySpread = [
	...spreadForDailyStudy(scheduled.filter((row) => row.preliminary_priority_band === 'A')),
	...spreadForDailyStudy(scheduled.filter((row) => row.preliminary_priority_band === 'B_or_C')),
];
const firstBatchReviewQueue = dailySpread.slice(0, 280).map((row, index) => ({
	...row,
	preliminary_sequence_no: index + 1,
	planned_study_date: new Date(Date.UTC(2026, 9, 1 + Math.floor(index / 20))).toISOString().slice(0, 10),
}));

await fs.writeFile(OUTPUT_FILE, JSON.stringify({
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	purpose: 'Transparent editorial selection queue for the rebuilt N1 curriculum. This is not a claim of official per-word JLPT frequency.',
	counts: {
		totalCanonicalCandidates: rows.length,
		provisionalCandidates: scheduled.length,
		holdForEditorialReview: rows.length - scheduled.length,
		firstBatchReviewQueue: firstBatchReviewQueue.length,
	},
	selectionOrder: 'A band first; then B/C candidates by breadth of corpus evidence and source rank only as a tie-breaker. Within each band, the daily queue spreads nouns, verbs, and modifiers/connectors so a day is not dominated by one grammatical type. Final word order requires human review of N1 usage, reading, Korean meaning, examples, and question quality.',
	candidates: scheduled.map((row, index) => ({ ...row, preliminary_sequence_no: index + 1 })),
	holdForEditorialReview: rows.filter((row) => row.selection_status !== 'provisional_candidate'),
	firstBatchReviewQueue,
}, null, 2) + '\n');

const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	totalCanonicalCandidates: rows.length,
	provisionalCandidates: scheduled.length,
	holdForEditorialReview: rows.length - scheduled.length,
	priorityBands: Object.fromEntries(['A', 'B_or_C'].map((band) => [band, scheduled.filter((row) => row.preliminary_priority_band === band).length])),
	firstBatchReviewQueue: firstBatchReviewQueue.length,
	firstBatchDates: { from: '2026-10-01', to: '2026-10-14', dailyNewWords: 20 },
	checks: {
		uniqueWordReadingPairs: new Set(scheduled.map(keyOf)).size === scheduled.length,
		allCanonicalJmdictMatches: scheduled.every((row) => row.jmdict_canonical_match),
		minimumThreeThousandMet: scheduled.length >= 3000,
	},
};
await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
