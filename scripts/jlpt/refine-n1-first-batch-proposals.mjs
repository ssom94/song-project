import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data', 'jlpt', 'production');
const SELECTION = path.join(PROD, 'candidates', 'n1-editorial-selection.json');
const CURATION = path.join(PROD, 'curation', 'words');
const OUTPUT = path.join(PROD, 'candidates', 'n1-first-batch-proposals.json');
const normalize = (value = '') => String(value).normalize('NFKC').trim();
const keyOf = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;

// These categories represent project editorial utility: formal argument,
// institutional text, abstract relation, nuanced evaluation, or a verb/adverb
// whose choice changes a sentence's reading. They are not official JLPT labels.
const READING_VALUE = /(?:政策|規模|理論|政権|権力|認識|成果|規定|概念|定義|象徴|規制|司法|強制|限定|正規|形態|権限|権威|証言|率いる|措置|悪化|領域|進化|要因|観点|極端|統制|機構|手法|特権|個性|制定|応募|妥協|実態|領土|理性|異論|構想|立法|客観|提携|主権|知性|規約|悲観|制約|規範|言論|論議|先天的|主観|制裁|方策|弁論|証拠|拒否|把握|世論|効率|秩序|損失|履歴|妨害|製法|法廷|脅迫|態勢|抑圧|適性|棄権|良識|譲歩|統率|用法|目論見|法案|欠乏|窮乏|妥結|事業|事前|発生|指摘|仕様|多様|対応|交渉|緊急|独自|個別|一切|確保|及ぶ|指揮|弁護|捜査|従来|危機|改革|有力|支持|正当|実質|監視|忠実|行政|上昇|廃止|取り組む|少数|説得|配置|単独|勢力|運命|築く|設立|非難|報道|要請|進行|負う|孤独|株式|映像|仕える|処分|協会|資格|大幅|形成|復活|欠く|業者|活発|条約|民主|展示|唱える|不可欠|獲得|企画|無用|作戦|防衛|滅ぼす|運営|正常|対処|勤務|業務|犯す|誠実|革命|暴力|大胆|昇進|内閣|施す|無効|暗殺|世代|創造|途上|分離|確立|合併|掲げる|導入|連邦|営む|部門|不当|任命|優先|耐える|遂げる|携わる|著名|率直|募る|果たして|脅かす|準ずる|懲りる|促す|阻止|阻む|抑制|紛争|覆す|厳密|促進|顧みる|乏しい|慎む|緩和|脅す|緩やか|躊躇う|緩む|緩める|慕う|著しい|誤魔化す|紛れる|厳か|膨れる|一概に|楽観|隔たる|軽率|やり遂げる|紛らわしい|拒絶|紛失|覆面|譲歩|制する|堪える|免れる|荒廃|停滞|過疎|徴収|踏まえる|敢えて|勇敢|疎か|甚だ|滞納|脆い|逸らす|堪らない)/u;
const EARLY_REJECT = new Set([
	'件','制服','好評','半端','酸化','気象','基金','著書','比率','法学','化石','静的','募金','化合','観覧','書評','隔週','構え','携帯','余っ程','貧乏','果ない','観衆','文化財','領地','象','領海','不評','倍率','的','化する','概説','退化','準急','化繊','中程','基','膨脹','局限','及び','保つ','施設','来る','通常','提供','殺人','記す','選挙','自己','落ちる','資金','投資','文書','止める','参照','設定','本気','落とす','採用','定める','所定','派遣','設ける','同意','公開','訪れる','昼間','設置','反応','古代','決まる','内部','登録','伝説','当たり前','軍事','私','楽しむ','他方','手配','固定','集まる','戦闘','指示','逃れる','黄色','何処','何方','何れ','あら','懸賞','抽選','印鑑','御免ください','態と','余程','堪らない','背負う'
]);
// Second-pass editorial approvals: each has a distinct formal, logical,
// institutional, or contrastive use that supports sentence recall. They are
// intentionally explicit so the remaining 46 slots are never filled by a
// blind fallback. This remains a proposed list pending administrator review.
const SECOND_PASS_REVIEWED = new Set([
	'原則','論理','知的','証人','占領','討論','外観','概略','動的','破損','規格','用件','無論','大概','公募','準じる','行為','真実','発言','記述','所属','任務','関与','達成','統合','判決','対抗','回収','抗議','記載','再生','本能','追放','減少','雇用','協議','推測','推進','掲載','圧力','決断','警戒','確信','向上','経緯','介入','提示','進展',
]);
const REQUIRED = ['word','reading','meaning_ko','meaning_ja','part_of_speech','example_ja','example_ko'];

const selection = JSON.parse(await fs.readFile(SELECTION, 'utf8'));
const curated = new Map();
for (const name of (await fs.readdir(CURATION)).filter((entry) => entry.endsWith('.json'))) {
	const doc = JSON.parse(await fs.readFile(path.join(CURATION, name), 'utf8'));
	for (const row of doc.words ?? []) curated.set(keyOf(row), { ...row, source_file: name });
}
const typeOf = (row) => /動詞/.test(row.part_of_speech) ? 'verb' : /形容詞|副詞|接続詞/.test(row.part_of_speech) ? 'modifier' : 'noun';
const slots = ['noun','verb','modifier','noun','noun','verb','noun','modifier','noun','noun','verb','modifier','noun','noun','verb','noun','modifier','noun','noun','noun'];

const eligible = (selection.candidates ?? []).flatMap((candidate) => {
	const word = curated.get(keyOf(candidate));
	const rank = Number(candidate.source_rank_by_generic_frequency ?? 999999);
	if (!word || EARLY_REJECT.has(candidate.word) || candidate.word.length < 2 || !REQUIRED.every((key) => normalize(word[key]))) return [];
	const firstPass = READING_VALUE.test(candidate.word);
	if (!firstPass && !SECOND_PASS_REVIEWED.has(candidate.word)) return [];
	const reasons = ['verified reading/meaning/example', firstPass ? 'formal-or-nuanced reading value' : 'second-pass editorially reviewed contextual value'];
	let score = 100 + (candidate.frequency_evidence_count ?? 0) * 4;
	if (/動詞|形容詞|副詞|接続詞/.test(word.part_of_speech)) { score += 8; reasons.push('retrieval-friendly predicate/modifier'); }
	if (rank >= 80 && rank <= 3500) { score += 12; reasons.push('not ultra-basic generic rank'); }
	if (rank < 80 && /政策|規模|理論|政権|権力|認識|成果|規定|概念|定義|規制/.test(candidate.word)) { score += 4; reasons.push('high-utility formal core despite commonness'); }
	return [{ ...word, source_rank_by_generic_frequency: rank, frequency_evidence_count: candidate.frequency_evidence_count, priority_score: score, selection_reasons: reasons }];
}).sort((a,b) => b.priority_score - a.priority_score || a.source_rank_by_generic_frequency - b.source_rank_by_generic_frequency || a.word.localeCompare(b.word, 'ja'));

const buckets = new Map(['noun','verb','modifier'].map((type) => [type, eligible.filter((row) => typeOf(row) === type)]));
const chosen = [];
while (chosen.length < 280 && [...buckets.values()].some((rows) => rows.length)) {
	for (const type of slots) {
		if (chosen.length >= 280) break;
		const fallback = [...buckets.values()].find((rows) => rows.length);
		const row = buckets.get(type).length ? buckets.get(type).shift() : fallback?.shift();
		if (row) chosen.push(row);
	}
}
const output = chosen.map((row, index) => ({
	sequence: index + 1, planned_study_date: new Date(Date.UTC(2026, 9, 1 + Math.floor(index / 20))).toISOString().slice(0, 10),
	...row, review_status: 'proposed_for_admin_editorial_review',
}));
const unique = new Set(output.map(keyOf)).size === output.length;
await fs.writeFile(OUTPUT, `${JSON.stringify({
	schemaVersion: 1,
	purpose: 'Proposed first N1 batch based on verified local content and reading/retrieval value. It is not an official per-word JLPT frequency ranking and requires administrator review before D1 import.',
	dateRange: { from: '2026-10-01', to: '2026-10-14', dailyWords: 20 },
	checks: { eligiblePool: eligible.length, selected: output.length, uniqueWordReadingPairs: unique, allRequiredContentPresent: output.every((row) => REQUIRED.every((key) => normalize(row[key]))) },
	words: output,
}, null, 2)}\n`);
console.log(JSON.stringify({ eligible: eligible.length, selected: output.length, unique }, null, 2));
