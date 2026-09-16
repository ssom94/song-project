import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const SOURCE = path.join(PROD, 'upstream/waller-n2.csv');
const batch = process.argv[2] === 'batch8' ? 'batch8' : 'batch7';
const OUTPUT = path.join(PROD, 'candidates', batch === 'batch8' ? 'n1-eighth-batch-supplement-review-queue.json' : 'n1-supplement-review-queue.json');
const N1_POOL = path.join(PROD, 'candidates/n1-candidate-pool.json');
const BATCH_DIR = path.join(PROD, 'batches');
const normalize = (value = '') => String(value).normalize('NFKC').trim();
const identity = (word, reading) => `${normalize(word)}\u0000${normalize(reading)}`;

function parseCsv(text) {
	const rows = [];
	let row = [], value = '', quoted = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
			else if (ch === '"') quoted = false;
			else value += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ',') { row.push(value); value = ''; }
		else if (ch === '\n') { row.push(value.replace(/\r$/u, '')); rows.push(row); row = []; value = ''; }
		else value += ch;
	}
	if (value || row.length) { row.push(value); rows.push(row); }
	const [header, ...body] = rows;
	return body.filter((cells) => cells.some(Boolean)).map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));
}

const n1 = JSON.parse(await fs.readFile(N1_POOL, 'utf8'));
const n1Identities = new Set(n1.candidates.map((row) => identity(row.word, row.reading)));
const used = new Set();
for (const name of (await fs.readdir(BATCH_DIR)).filter((name) => name.endsWith('.content-draft.json'))) {
	const doc = JSON.parse(await fs.readFile(path.join(BATCH_DIR, name), 'utf8'));
	for (const word of doc.words ?? []) used.add(identity(word.word, word.reading));
}

const lowValue = /^(?:一つ|二つ|一人|二人|今日|明日|昨日|私|僕|俺|学校|学生|先生|子供|大人|父|母|兄|姉|弟|妹|男|女|上|下|左|右|前|後|中|外|東|西|南|北)$/u;
const formalSignal = /(?:化|性|的|制|論|率|権|策|務|態|観|証|償|障|慮|促|抑|緩|遂|覆|阻|免|乏|概|抽|象|依|措|規|審|裁|統|契|維|廃|脅|侵|援|譲|訴|懸|是|否|余地|見込み|に伴|に基づ|を巡)/u;
const rows = parseCsv(await fs.readFile(SOURCE, 'utf8')).flatMap((source, sourceIndex) => {
	const word = normalize(source.kanji || source.kana);
	const reading = normalize(source.kana);
	const key = identity(word, reading);
	if (!word || !reading || n1Identities.has(key) || used.has(key) || lowValue.test(word)) return [];
	if (!/\p{Script=Han}/u.test(word) || word.length < 2 || word.length > 12) return [];
	let score = 0;
	const kanjiCount = [...word].filter((ch) => /\p{Script=Han}/u.test(ch)).length;
	score += Math.min(kanjiCount, 4) * 12;
	if (formalSignal.test(word)) score += 35;
	if (/^[\p{Script=Han}々ヶ]{2,6}$/u.test(word)) score += 18;
	if (/^[\p{Script=Han}々ヶ]+[ぁ-ん]+$/u.test(word)) score += 8;
	if (/^(?:御|お|ご|何|此|其|彼)/u.test(word)) score -= 30;
	return [{
		word, reading,
		meaning_en: normalize(source.waller_definition),
		jmdict_seq: normalize(source.jmdict_seq),
		source_level: 'N2-community-classification',
		source_rank: sourceIndex + 1,
		editorial_score: score,
		selection_status: 'requires_jmdict_and_korean_editorial_enrichment',
		selection_reason: 'Potential N1-preparation prerequisite selected for written, compound, abstract, or nuanced study value; not claimed as an official N1 word.',
	}];
});

const unique = new Map();
for (const row of rows) if (!unique.has(identity(row.word, row.reading))) unique.set(identity(row.word, row.reading), row);
const ranked = [...unique.values()].sort((a, b) => b.editorial_score - a.editorial_score || a.source_rank - b.source_rank || a.word.localeCompare(b.word, 'ja'));
const queueSize = batch === 'batch8' ? 1000 : 500;
const queue = ranked.slice(0, queueSize).map((row, index) => ({ review_sequence: index + 1, ...row }));
if (queue.length < 280) throw new Error(`Only ${queue.length} supplement candidates; need at least 280.`);

await fs.writeFile(OUTPUT, `${JSON.stringify({
	schemaVersion: 1,
	purpose: `Open-licensed supplemental review queue for ${batch === 'batch8' ? 'the eighth' : 'the seventh'} N1-preparation batch after the original Waller N1 pool high-priority tier was exhausted.`,
	disclaimer: 'These rows come from a community N2 classification and are prerequisite/supplement candidates, not official N1 vocabulary or official per-word frequency claims.',
	source: { project: 'stephenmk/yomitan-jlpt-vocab', path: 'original_data/n2.csv', upstream: 'Jonathan Waller JLPT Resources', license: 'CC-BY 4.0 / redistributed CC-BY-SA 4.0' },
	checks: { sourceRows: parseCsv(await fs.readFile(SOURCE, 'utf8')).length, excludesOriginalN1Identities: true, excludesAllMaterializedBatchIdentities: true, uniqueWordReadingPairs: new Set(queue.map((row) => identity(row.word, row.reading))).size === queue.length, reviewQueue: queue.length },
	candidates: queue,
}, null, 2)}\n`);
console.log(JSON.stringify({ eligible: ranked.length, reviewQueue: queue.length, first: queue.slice(0, 10).map((row) => `${row.word}(${row.reading})`) }, null, 2));
