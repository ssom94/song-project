import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CANDIDATE_DIR = path.join(ROOT, 'data', 'jlpt', 'production', 'candidates');
const INPUT = path.join(CANDIDATE_DIR, 'n1-candidate-pool.json');
const OUTPUT = path.join(CANDIDATE_DIR, 'n1-candidate-triage.json');

// These are risk signals, not automatic claims of a JLPT level.  Final acceptance
// remains editorial because the official JLPT does not publish a complete N1 list.
const BASIC_OR_GENERAL_IDENTITIES = new Set([
	['教え', 'おしえ'], ['一部', 'いちぶ'], ['作り', 'つくり'], ['動き', 'うごき'],
	['持ち', 'もち'], ['調べ', 'しらべ'], ['日々', 'ひび'], ['一言', 'いちげん'],
	['素敵', 'すてき'], ['天才', 'てんさい'], ['地獄', 'じごく'], ['自信', 'じしん'],
	['現場', 'げんじょう'], ['保険', 'ほけん'], ['距離', 'きょり'], ['勝利', 'しょうり'],
	['治療', 'ちりょう'], ['美術', 'びじゅつ'], ['体験', 'たいけん'], ['購入', 'こうにゅう'],
	['開催', 'かいさい'], ['予想', 'よそう'], ['上司', 'じょうし'], ['部下', 'ぶか'],
	['了解', 'りょうかい'], ['受け入れ', 'うけいれ'], ['地元', 'じもと'], ['現地', 'げんち'],
	['向け', 'むけ'], ['過ぎ', 'すぎ'], ['向き', 'むき'], ['同士', 'どうし'],
].map(([word, reading]) => `${word}\u0000${reading}`));

const ABSTRACT_OR_FORMAL_MARKERS = /(?:性|化|的|率|論|制|権|法|策|領|義|則|規|構|証|識|評|観|態|象|因|果|程|序|基|準|件|限|概|著|顕|緻|慎|厳|妥|膨|抽|端|顧|履|懸|緩|隔|随|脅|抑|措|遂|阻|携|顕|覆|譲|擁|紛|陥|損|乏|耐|慕|躊|躇|携|顧|遂|懸|促|撤|懲|把|拒|譲|覆|妨|募|顕)/u;

function keyOf(row) { return `${String(row.word ?? '').normalize('NFKC')}\u0000${String(row.reading ?? '').normalize('NFKC')}`; }
function hasTag(row, expression) { return (row.pos_tags ?? []).some((tag) => expression.test(String(tag))); }

const input = JSON.parse(await fs.readFile(INPUT, 'utf8'));
const candidates = Array.isArray(input.candidates) ? input.candidates : [];
const triaged = candidates.map((row) => {
	const flags = [];
	if (BASIC_OR_GENERAL_IDENTITIES.has(keyOf(row))) flags.push('basic_or_general_usage_risk');
	if (hasTag(row, /(?:^|-)suf|n-suf|ctr|pref|n-pref|prt|aux-v/)) flags.push('morpheme_or_function_word_risk');
	if (String(row.word ?? '').length <= 1) flags.push('single_character_review');
	if (!row.jmdict_common) flags.push('not_jmdict_common');
	if (ABSTRACT_OR_FORMAL_MARKERS.test(String(row.word ?? ''))) flags.push('abstract_or_formal_marker');
	const priorityBand = flags.includes('morpheme_or_function_word_risk') || flags.includes('basic_or_general_usage_risk')
		? 'review_later'
		: flags.includes('abstract_or_formal_marker') ? 'A_candidate' : 'B_or_C_candidate';
	return {
		word: row.word,
		reading: row.reading,
		jmdict_seq: row.jmdict_seq,
		part_of_speech: row.part_of_speech,
		source_rank_by_generic_frequency: row.source_rank_by_generic_frequency,
		preliminary_priority: priorityBand,
		flags,
		final_review_status: 'needs_editorial_review',
	};
});

const counts = Object.fromEntries(['A_candidate', 'B_or_C_candidate', 'review_later'].map((band) => [band, triaged.filter((row) => row.preliminary_priority === band).length]));
const flagCounts = {};
for (const row of triaged) for (const flag of row.flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;

await fs.writeFile(OUTPUT, JSON.stringify({
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	purpose: 'Editorial review aid only. Preliminary priority is not a claimed official JLPT frequency.',
	sourceCandidateCount: candidates.length,
	counts,
	flagCounts,
	candidates: triaged,
}, null, 2) + '\n');

console.log(`Triaged ${candidates.length} candidates: ${JSON.stringify(counts)}`);
