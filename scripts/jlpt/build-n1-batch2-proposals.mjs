import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const POOL = path.join(PROD, 'candidates/n1-candidate-pool.json');
const CURATION = path.join(PROD, 'curation/words');
const BATCH1 = path.join(PROD, 'candidates/n1-first-batch-proposals.json');
const BATCH2 = path.join(PROD, 'candidates/n1-second-batch-proposals.json');
const BATCH3 = path.join(PROD, 'candidates/n1-third-batch-proposals.json');
const batch = ['batch2', 'batch3', 'batch4'].includes(process.argv[2]) ? process.argv[2] : 'batch2';
const configs = {
	batch2: { ordinal: 'Second', output: 'n1-second-batch-proposals.json', from: '2026-10-15', to: '2026-10-28', sequence: 281, day: 15, prior: [BATCH1] },
	batch3: { ordinal: 'Third', output: 'n1-third-batch-proposals.json', from: '2026-10-29', to: '2026-11-11', sequence: 561, day: 29, prior: [BATCH1, BATCH2] },
	batch4: { ordinal: 'Fourth', output: 'n1-fourth-batch-proposals.json', from: '2026-11-12', to: '2026-11-25', sequence: 841, day: 43, prior: [BATCH1, BATCH2, BATCH3] },
};
const config = configs[batch];
const OUTPUT = path.join(PROD, 'candidates', config.output);
const normalize = (value = '') => String(value).normalize('NFKC').trim();
const identity = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;
const REQUIRED = ['word','reading','meaning_ko','meaning_ja','part_of_speech','example_ja','example_ko'];

// Obvious elementary/daily vocabulary is held out of the high-priority N1 queue.
// It remains in the canonical candidate corpus and can be reconsidered manually.
const EXCLUDE = new Set(['教え','一部','開発','不明','保護','施設','及び','作り','動き','過ぎ','持ち','提供','殺人','調べ','現場','選挙','自己','資金','距離','保険','勝利','投資','文書','治療','参照','通常','設定','美術','採用','派遣','同意','公開','地元','設置','反応','古代','購入','開催','内部','予想','登録','伝説','軍事','手配','固定','戦闘','体験','指示','名誉','日々','同士','一言','素敵','部下','地獄','職員','起こす','箇所','貴族','上司','了解','現地','専用','天才','本気','燃料','挑戦','恋愛','出演','後悔','乗客','知り合い','年寄り','昼間','英雄','読者','天井','仕上げ','調理','無線','肉体','不良','秘書','原子','各種','教科','当たり前','保つ','迅速','壮大','神秘','強烈','段々','健全','不審','華やか','有益','無能','不調','案の定','無難','色々','何故','訪れる','決まる','返る','集まる','甘い','大げさ','貧乏','済ます','満たす','愚か','任す','構える']);
for (const word of ['定める','果たす','設ける','逃れる','頻繁','受け入れる','誤る','固める','催す','短気','付き合う','導く','良好','仕掛ける','控える','鮮やか','歩む','栄える','逃す','引き受ける','未熟','明かす','潜る','取り除く','定まる','仕上げる','滅びる','素早い','逃げ出す','飲み込む','物好き','受かる','上がる','軈て','暫く','継ぐ','仮令','遥か','今日は','間もなく','下がる','ドライ','包む','広まる','誇る','押さえる','名高い','整える','間違う','どうにか','背負う','グレー','切り替える','レギュラー','果てる','仕立てる','無意味','追い出す','埋まる','今晩は','慣らす','取り寄せる','引き下げる','問い合わせる','がっちり','投げ出す','当てはめる','割り込む','てっきり','爽やか','がっしり','如何して','現われる','済みません','如何しても','矢っ張り','お早う','辿り着く','インターナショナル','何気ない','受身','嘗める','縮まる','指差す','隔週','済まない','老ける','ご苦労様','突っ張る','有りのまま','認める','産む','お蔭様で','出合う','果ない','散蒔く','久し振り','ルーズ','補充','山岳','風習','利子','教材','家計','富豪','外来','定年','問屋','津波','期末','学芸','味わい','残高','劇団','喜劇','堤防','当人','時差','転勤','下痢','役場','利息','学歴','出社','母校','本場','女史','日の丸','無駄遣い','短大','私','扱い','メディア','携帯','遅れ','収集','行い','柱']) EXCLUDE.add(word);
if (batch === 'batch3' || batch === 'batch4') for (const word of [
	'教習','大空','張り紙','民宿','共働き','源','システム','作','実','財','当たり','ビジネス','データ','通','状','デザイン','なんか','観','器','製','サイズ','庁','和','メーカー','ガイド','ルール','受け取り','オープン','ソース','技','コミュニケーション','オレンジ','悪','慣れ','塾','センス','レッスン','浜','トラブル','ブーム','グラフ','雄','見方','判','コンテスト','ヒント','伊','キャッチ','象','纏め','ガイドブック','デザート','ブーツ','特技','サイクル','カメラマン','特産','レントゲン','膜','漁村','花びら','ユニフォーム','共学','コマーシャル','助詞','考古学','社宅','雌','お産','休学','仲人','汽船','貝殻','割り算','税務署','インフォメーション','コントラスト','夕焼け','勤め先','吃逆','大事','所が','振り','其れで','其処で','従業員','それでは','土産','取り引き','其れでも','準急','お使い','チャンネル','ナプキン','使用人','漢語','然うして','カンニング','荷','目蓋','嚏','和文','軍服','ノイローゼ','デモンストレーション','産婦人科','チームワーク','三味線','タイピスト','オリエンテーション','ゼリー','打ち消し','共稼ぎ','例','帳','お邪魔します','御免ください','蛋白質','黴菌','控室','膨脹','見積り','世','修学','用法','教職','来場','課外','気楽','盛大','未定','主任','天国','情熱','決勝','教員','探検','正解','再会','当選','対결','配布','推理','気象','預金','地形','入る','悪い','沢山','終わる','詳細','面白い','一寸','落ちる','あら','直ぐ','落とす','楽しむ','明るい','易い','畜生','役立つ','可哀想','一向'
]) EXCLUDE.add(word);
if (batch === 'batch4') for (const word of [
	// Nonstandard/dated kanji spellings whose normal modern form is kana.
	'態と','余程','一々','丸で','況して','凡そ','殆ど','嘗て','未だ','如何','悉く','彼方此方','忽ち','兎に角','兎も角','矢鱈','兎角','些とも','碌に','尚更','為さる','零す','捲る','可笑しい','確り','偶に','予め','大人しい','くっ付く',
	// Elementary or broad everyday entries held below the N1 editorial queue.
	'突く','垂れる','痒い','美味しい','可愛い','曲がる','喋る','解く','鍛える','織る','早める','痛める','丸める','弱る','眩しい','甘える','生やす','抜かす','粘る'
	,'いいえ','でかい','可愛らしい','殴る','各','イエス','この頃','この間','雑','乙','茹でる','炒める','酸っぱい','未婚','洋風','ユニーク','混む','平たい','剃る','休める','怠い','来る','上手','共','何と','何も','何処か','屹度','有難う','先に','何だか','可成','夜中','何時でも','若しも','その内','その上','吃驚','成るべく','若し','如何にも','何時までも','詰らない','近付く','跨がる','何となく','何とも','吊るす','堪らない'
]) EXCLUDE.add(word);
const FORMAL = /政策|制度|法|権|規|議|論|証|審|査|裁|判|統|制|構|概|抽|象|因|果|関|係|経|済|産|業|社|会|国|際|文化|歴史|技術|研究|情報|資|源|労|働|環境|行政|政治|倫理|責任|義務|批判|主張|評価|分析|判断|認め|妨|阻|抑|覆|遂|免|準|掲|携|顧|隔|紛|乏|緩|脆/u;

const used = new Set();
for (const priorPath of config.prior) {
	const prior = JSON.parse(await fs.readFile(priorPath, 'utf8'));
	for (const word of prior.words) used.add(identity(word));
}
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

const selected = candidates.slice(0, 280);
// Each daily vocabulary set needs seven examples where the dictionary-form
// spelling can be blanked safely. Reorder only within the already selected
// 280-word priority window so content generation never invents a conjugation.
const literal = selected.filter((word) => word.example_ja.includes(word.word));
const nonLiteral = selected.filter((word) => !word.example_ja.includes(word.word));
if (literal.length < 98) throw new Error(`Need at least 98 literal examples; got ${literal.length}`);
const scheduled = [];
for (let day = 0; day < 14; day += 1) {
	scheduled.push(...literal.splice(0, 7), ...nonLiteral.splice(0, Math.min(13, nonLiteral.length)));
	while (scheduled.length < (day + 1) * 20) scheduled.push(literal.shift());
}
const words = scheduled.map((word, index) => ({
	...word,
	sequence: index + config.sequence,
	planned_study_date: new Date(Date.UTC(2026, 9, config.day + Math.floor(index / 20))).toISOString().slice(0, 10),
	review_status: 'proposed_for_admin_editorial_review',
	selection_reasons: [`excluded ${used.size} earlier-batch identities`, 'verified local reading/meaning/example', word.priority_score >= 45 ? 'formal-or-abstract reading value' : 'secondary N1 editorial candidate'],
}));
if (words.length !== 280 || new Set(words.map(identity)).size !== 280) throw new Error(`Expected 280 unique ${batch} words; got ${words.length}`);

await fs.writeFile(OUTPUT, `${JSON.stringify({
	schemaVersion: 1,
	purpose: `${config.ordinal} 14-day N1 editorial candidate batch. This is a project study priority, not an official per-word JLPT frequency ranking.`,
	dateRange: { from: config.from, to: config.to, dailyWords: 20 },
	checks: { candidatePool: candidates.length, selected: words.length, excludesEarlierBatches: words.every((word) => !used.has(identity(word))), uniqueWordReadingPairs: true, allRequiredContentPresent: true },
	words,
}, null, 2)}\n`);
console.log(JSON.stringify({ candidates: candidates.length, selected: words.length, firstDate: words[0].planned_study_date, lastDate: words.at(-1).planned_study_date }, null, 2));
