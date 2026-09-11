import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const POOL = path.join(PROD, 'candidates/n1-candidate-pool.json');
const CURATION = path.join(PROD, 'curation/words');
const BATCH1 = path.join(PROD, 'candidates/n1-first-batch-proposals.json');
const OUTPUT = path.join(PROD, 'candidates/n1-second-batch-proposals.json');
const normalize = (value = '') => String(value).normalize('NFKC').trim();
const identity = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;
const REQUIRED = ['word','reading','meaning_ko','meaning_ja','part_of_speech','example_ja','example_ko'];

// Obvious elementary/daily vocabulary is held out of the high-priority N1 queue.
// It remains in the canonical candidate corpus and can be reconsidered manually.
const EXCLUDE = new Set(['教え','一部','開発','不明','保護','施設','及び','作り','動き','過ぎ','持ち','提供','殺人','調べ','現場','選挙','自己','資金','距離','保険','勝利','投資','文書','治療','参照','通常','設定','美術','採用','派遣','同意','公開','地元','設置','反応','古代','購入','開催','内部','予想','登録','伝説','軍事','手配','固定','戦闘','体験','指示','名誉','日々','同士','一言','素敵','部下','地獄','職員','起こす','箇所','貴族','上司','了解','現地','専用','天才','本気','燃料','挑戦','恋愛','出演','後悔','乗客','知り合い','年寄り','昼間','英雄','読者','天井','仕上げ','調理','無線','肉体','不良','秘書','原子','各種','教科','当たり前','保つ','迅速','壮大','神秘','強烈','段々','健全','不審','華やか','有益','無能','不調','案の定','無難','色々','何故','訪れる','決まる','返る','集まる','甘い','大げさ','貧乏','済ます','満たす','愚か','任す','構える']);
for (const word of ['定める','果たす','設ける','逃れる','頻繁','受け入れる','誤る','固める','催す','短気','付き合う','導く','良好','仕掛ける','控える','鮮やか','歩む','栄える','逃す','引き受ける','未熟','明かす','潜る','取り除く','定まる','仕上げる','滅びる','素早い','逃げ出す','飲み込む','物好き','受かる','上がる','軈て','暫く','継ぐ','仮令','遥か','今日は','間もなく','下がる','ドライ','包む','広まる','誇る','押さえる','名高い','整える','間違う','どうにか','背負う','グレー','切り替える','レギュラー','果てる','仕立てる','無意味','追い出す','埋まる','今晩は','慣らす','取り寄せる','引き下げる','問い合わせる','がっちり','投げ出す','当てはめる','割り込む','てっきり','爽やか','がっしり','如何して','現われる','済みません','如何しても','矢っ張り','お早う','辿り着く','インターナショナル','何気ない','受身','嘗める','縮まる','指差す','隔週','済まない','老ける','ご苦労様','突っ張る','有りのまま','認める','産む','お蔭様で','出合う','果ない','散蒔く','久し振り','ルーズ','補充','山岳','風習','利子','教材','家計','富豪','外来','定年','問屋','津波','期末','学芸','味わい','残高','劇団','喜劇','堤防','当人','時差','転勤','下痢','役場','利息','学歴','出社','母校','本場','女史','日の丸','無駄遣い','短大','私','扱い','メディア','携帯','遅れ','収集','行い','柱']) EXCLUDE.add(word);
const FORMAL = /政策|制度|法|権|規|議|論|証|審|査|裁|判|統|制|構|概|抽|象|因|果|関|係|経|済|産|業|社|会|国|際|文化|歴史|技術|研究|情報|資|源|労|働|環境|行政|政治|倫理|責任|義務|批判|主張|評価|分析|判断|認め|妨|阻|抑|覆|遂|免|準|掲|携|顧|隔|紛|乏|緩|脆/u;

const first = JSON.parse(await fs.readFile(BATCH1, 'utf8'));
const used = new Set(first.words.map(identity));
const curated = new Map();
for (const name of (await fs.readdir(CURATION)).filter((name) => name.endsWith('.json'))) {
	for (const row of JSON.parse(await fs.readFile(path.join(CURATION, name), 'utf8')).words ?? []) curated.set(identity(row), row);
}
const pool = JSON.parse(await fs.readFile(POOL, 'utf8')).candidates;
const candidates = pool.flatMap((candidate) => {
	const row = curated.get(identity(candidate));
	if (!row || used.has(identity(candidate)) || EXCLUDE.has(candidate.word) || !REQUIRED.every((key) => normalize(row[key]))) return [];
	const rank = Number(candidate.source_rank_by_generic_frequency ?? 999999);
	let priority = (candidate.frequency_evidence_count ?? 0) * 10;
	if (FORMAL.test(candidate.word) || FORMAL.test(row.meaning_ja)) priority += 45;
	if (/動詞|形容詞|副詞/u.test(row.part_of_speech)) priority += 12;
	if (rank >= 700 && rank <= 3200) priority += 18;
	else if (rank < 400) priority -= 35;
	else if (rank < 700) priority -= 15;
	return [{ ...row, source_rank_by_generic_frequency: rank, frequency_evidence_count: candidate.frequency_evidence_count ?? 0, priority_score: priority }];
}).sort((a,b) => b.priority_score - a.priority_score || a.source_rank_by_generic_frequency - b.source_rank_by_generic_frequency || a.word.localeCompare(b.word, 'ja'));

const words = candidates.slice(0, 280).map((word, index) => ({
	...word,
	sequence: index + 281,
	planned_study_date: new Date(Date.UTC(2026, 9, 15 + Math.floor(index / 20))).toISOString().slice(0, 10),
	review_status: 'proposed_for_admin_editorial_review',
	selection_reasons: ['excluded first-batch identities', 'verified local reading/meaning/example', word.priority_score >= 45 ? 'formal-or-abstract reading value' : 'secondary N1 editorial candidate'],
}));
if (words.length !== 280 || new Set(words.map(identity)).size !== 280) throw new Error(`Expected 280 unique second-batch words; got ${words.length}`);

await fs.writeFile(OUTPUT, `${JSON.stringify({
	schemaVersion: 1,
	purpose: 'Second 14-day N1 editorial candidate batch. This is a project study priority, not an official per-word JLPT frequency ranking.',
	dateRange: { from: '2026-10-15', to: '2026-10-28', dailyWords: 20 },
	checks: { candidatePool: candidates.length, selected: words.length, excludesFirstBatch: words.every((word) => !used.has(identity(word))), uniqueWordReadingPairs: true, allRequiredContentPresent: true },
	words,
}, null, 2)}\n`);
console.log(JSON.stringify({ candidates: candidates.length, selected: words.length, firstDate: words[0].planned_study_date, lastDate: words.at(-1).planned_study_date }, null, 2));
