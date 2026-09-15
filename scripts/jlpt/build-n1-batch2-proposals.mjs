import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const POOL = path.join(PROD, 'candidates/n1-candidate-pool.json');
const CURATION = path.join(PROD, 'curation/words');
const BATCH1 = path.join(PROD, 'candidates/n1-first-batch-proposals.json');
const BATCH2 = path.join(PROD, 'candidates/n1-second-batch-proposals.json');
const BATCH3 = path.join(PROD, 'candidates/n1-third-batch-proposals.json');
const BATCH4 = path.join(PROD, 'candidates/n1-fourth-batch-proposals.json');
const BATCH5 = path.join(PROD, 'candidates/n1-fifth-batch-proposals.json');
const BATCH6 = path.join(PROD, 'candidates/n1-sixth-batch-proposals.json');
const batch = ['batch2', 'batch3', 'batch4', 'batch5', 'batch6', 'batch7'].includes(process.argv[2]) ? process.argv[2] : 'batch2';
const configs = {
	batch2: { ordinal: 'Second', output: 'n1-second-batch-proposals.json', from: '2026-10-15', to: '2026-10-28', sequence: 281, day: 15, prior: [BATCH1] },
	batch3: { ordinal: 'Third', output: 'n1-third-batch-proposals.json', from: '2026-10-29', to: '2026-11-11', sequence: 561, day: 29, prior: [BATCH1, BATCH2] },
	batch4: { ordinal: 'Fourth', output: 'n1-fourth-batch-proposals.json', from: '2026-11-12', to: '2026-11-25', sequence: 841, day: 43, prior: [BATCH1, BATCH2, BATCH3] },
	batch5: { ordinal: 'Fifth', output: 'n1-fifth-batch-proposals.json', from: '2026-11-26', to: '2026-12-09', sequence: 1121, day: 57, prior: [BATCH1, BATCH2, BATCH3, BATCH4] },
	batch6: { ordinal: 'Sixth', output: 'n1-sixth-batch-proposals.json', from: '2026-12-10', to: '2026-12-23', sequence: 1401, day: 71, prior: [BATCH1, BATCH2, BATCH3, BATCH4, BATCH5] },
	batch7: { ordinal: 'Seventh', output: 'n1-seventh-batch-proposals.json', from: '2026-12-24', to: '2027-01-06', sequence: 1681, day: 85, prior: [BATCH1, BATCH2, BATCH3, BATCH4, BATCH5, BATCH6] },
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
if (['batch3','batch4','batch5','batch6'].includes(batch)) for (const word of [
	'教習','大空','張り紙','民宿','共働き','源','システム','作','実','財','当たり','ビジネス','データ','通','状','デザイン','なんか','観','器','製','サイズ','庁','和','メーカー','ガイド','ルール','受け取り','オープン','ソース','技','コミュニケーション','オレンジ','悪','慣れ','塾','センス','レッスン','浜','トラブル','ブーム','グラフ','雄','見方','判','コンテスト','ヒント','伊','キャッチ','象','纏め','ガイドブック','デザート','ブーツ','特技','サイクル','カメラマン','特産','レントゲン','膜','漁村','花びら','ユニフォーム','共学','コマーシャル','助詞','考古学','社宅','雌','お産','休学','仲人','汽船','貝殻','割り算','税務署','インフォメーション','コントラスト','夕焼け','勤め先','吃逆','大事','所が','振り','其れで','其処で','従業員','それでは','土産','取り引き','其れでも','準急','お使い','チャンネル','ナプキン','使用人','漢語','然うして','カンニング','荷','目蓋','嚏','和文','軍服','ノイローゼ','デモンストレーション','産婦人科','チームワーク','三味線','タイピスト','オリエンテーション','ゼリー','打ち消し','共稼ぎ','例','帳','お邪魔します','御免ください','蛋白質','黴菌','控室','膨脹','見積り','世','修学','用法','教職','来場','課外','気楽','盛大','未定','主任','天国','情熱','決勝','教員','探検','正解','再会','当選','対결','配布','推理','気象','預金','地形','入る','悪い','沢山','終わる','詳細','面白い','一寸','落ちる','あら','直ぐ','落とす','楽しむ','明るい','易い','畜生','役立つ','可哀想','一向'
]) EXCLUDE.add(word);
if (['batch4','batch5','batch6'].includes(batch)) for (const word of [
	// Nonstandard/dated kanji spellings whose normal modern form is kana.
	'態と','余程','一々','丸で','況して','凡そ','殆ど','嘗て','未だ','如何','悉く','彼方此方','忽ち','兎に角','兎も角','矢鱈','兎角','些とも','碌に','尚更','為さる','零す','捲る','可笑しい','確り','偶に','予め','大人しい','くっ付く',
	// Elementary or broad everyday entries held below the N1 editorial queue.
	'突く','垂れる','痒い','美味しい','可愛い','曲がる','喋る','解く','鍛える','織る','早める','痛める','丸める','弱る','眩しい','甘える','生やす','抜かす','粘る'
	,'いいえ','でかい','可愛らしい','殴る','各','イエス','この頃','この間','雑','乙','茹でる','炒める','酸っぱい','未婚','洋風','ユニーク','混む','平たい','剃る','休める','怠い','来る','上手','共','何と','何も','何処か','屹度','有難う','先に','何だか','可成','夜中','何時でも','若しも','その内','その上','吃驚','成るべく','若し','如何にも','何時までも','詰らない','近付く','跨がる','何となく','何とも','吊るす','堪らない'
	,'余り','合わす','出鱈目','歪む','滅茶苦茶','明白','持て成す','俄か','呉れ呉れも','若しかしたら','若しかして','奇麗','恋する','シック','しょっちゅう','ナンセンス','苛める','タイムリー','一定','演ずる','重んずる','お休み','お洒落','ジャンボ'
	,'ロマンチック','ファイト','傷付く','馬鹿らしい','びっしょり','何だかんだ'
]) EXCLUDE.add(word);
if (['batch5','batch6'].includes(batch)) for (const word of [
	// Dated/nonstandard spellings, greetings, and elementary vocabulary are
	// unsuitable for a fixed N1-priority slot even when the dictionary entry is valid.
	'割合に','だぶだぶ','嘸','若しかすると','疾っくに','揶揄う','草臥れる','左様なら','くっ付ける','翔る','眠たい','お大事に','おおい','余っ程','戴きます','何時の間にか','愈々','五月蝿い','嗚呼','エレガント','仰っしゃる','擽ぐったい','ご座います','篭る','逆上る','颯っと','偖','屡','その外','其の儘','其れ程','オートマチック','箇箇','ご馳走さま','サンキュー','恰度','転転','何れ何れ','填める','打付ける','愛でたい','藻掻く','物体ない','明々後日','好い','何方','ひょっと',
	'合唱','楽譜','化石','募金','衣類','小銭','原油','満月','保育','電線','陶器','同居','天地','交互','日焼け','年長','送金','立体','年頃','肥料','戦力','神殿','音色','近郊','排水','化合','台本','天体','父母','衣料','高原','地主','結核','原爆','静止','値引き','連休','晴天','体格','樹木','原文','給食','故人','味覚','野外','本館','定食','生育','耕作','朗読','現像','入賞','左利き','星座','着席','田園','歓声','主食','観覧','後回し','前置き','根気','先着','使い道','一人','二人','巻','アップ','何処','何れ','行','答え','取っ手','元年','怒り','助け','印','兵士','着陸','勧め','修行','破壊','結び','本名','恐れ','課題','退職','並み','玩具','赤字','覚え','災害','赤ちゃん','釣り','装飾','番目','写し','退学','脱出','日向','道場','徒歩'
	,'打','弱','切り','月日','動力','生死','一息','同感','人情','無言','平方','街道','情け','振動','衣装','悪者','申し込み','好意','幽霊','人目','手数','装備','暴風','浜辺','爆弾','旦那','紳士','誠','家来','悩み','喫茶','昆虫','蝶','返答','運送','真珠','木綿','家主','驚き','叫び','アルミ','頼み','明後日','仏像','家出','夜行','短歌','裸足','雛','豊作','既婚','始発','守衛','沸騰','水田','雨天','獣','救い','製鉄','真上','安静','出血','同級','原形','欲望','身振り','締め切り','新築','傲る','彼此','跡切れる','目覚しい','稍','我がまま','擦る','ぶかぶか','ぺこぺこ','アクセル','ライス','アンコール'
]) EXCLUDE.add(word);
if (batch === 'batch6') for (const word of [
	// Sixth-batch editorial holdout: elementary counters/body/nature words,
	// everyday loanwords, greetings, and uncommon dictionary spellings are not
	// suitable for the remaining high-priority N1 schedule.
	'水洗','夕暮れ','本の','何て','詰まり','古','がる','彼処','増し','其方','饂飩','盗み','雨具','軍','当て','曲','室','鼾','発条','音','コメント','ニュー','付き','員','像','版','一日','死','初','字','クラブ','科','非','料','階','仏','編','ファイル','ポイント','頂','ファン','病','蔵','節','ショー','スピード','掛け','レース','群','タイム','園','冊','警部','著','僧','ホール','一敗','ベスト','未','俺','美','ベース','ショック','借り','衆','床','マーク','角','シート','セール','メッセージ','ブルー','弓','カット','レンジ','網','ダウン','福','コーナー','杯','匹','主人公','脳','念','蓮','スペース','峰','ストレス','ランプ','扉','ロープ','極楽','タイトル','ジャズ','禅','単','尾','管','甥','ドライバー','コントロール','碑','ジャンプ','タイル','オンライン','タイミング','露','点火','ペア','酸','班','銅','憧れ','ご馳走','微笑','手当て','刃','タイヤ','了','バー','芝','セックス','ポーズ','シナリオ','麻','フォーム','盾','冷蔵','垢','進み','コンタクト','柵','フロント','荷造り','乳','罰','ゲスト','年号','ポット','バット','穂','杖','ミュージック','顎','パチンコ','モニター','団扇','届け','票','落ち葉','招き','私物','液','胴','スタジオ','タレント','カクテル','筒','横綱','情','ポジション','茎','タワー','ジャンル','海路','崖','ラベル','詫び','ムード','中指','沼','セクション','版画','ベストセラー','パンク','竿','字体','肺','姓名','眉','式場','クイズ','苗','腸','砂利','インテリ','蜂蜜','アワー','ガレージ','蕾','捕鯨','ホース','ボルト','踵','レバー','水気','花壇','フェリー','発芽','担架','布巾','油絵','短波','ご無沙汰','大水','熱湯','鋸','大便','売り出し','顔付き','原っぱ','三日月','嘴','夜更け','片思い','見晴らし','ポンプ','ヤング'
	,'女子','亜爾加里','火燵','位地','加留多','此れ','其れ','所で','かも知れない','凡ゆる','其れに','或る','其れから','其れとも','何故なら','お八つ','お菜','じゃん拳','御負け','お襁褓','辺り','御手洗い','此れ等','而も','然して','始めまして','夜具','一部分','箪笥','面皰','十分','地方','天皇','少女','流行','空間','煙草','身体','金庫','一見','一目','帰京','丈夫','作物','保母','縁側','桟橋','碁盤','分母','縁談','余所見','時刻表','小児科','還暦','朝寝坊','香辛料','十字路','冬眠','伝言','風車','真下','貴女','梅干','籤引','耳鼻科','殿様','歯磨','見舞','目盛','申出','火傷','城下','世辞','気流','立方','出入り口','首飾り','宙返り','合わせ','お願いします','片付け','お祖父さん','お祖母さん','足し算','頬っぺた','坊ちゃん','Gパン','茶の間','体付き','夜更かし','渡り鳥','畏まりました','お巡りさん','目付き','汚れ','明くる','現われ','駆けっこ','錆び','塵取り','遣い','物置き','ローマ字','割引き','同い年','話し合い'
]) EXCLUDE.add(word);
const FORMAL = /政策|制度|法|権|規|議|論|証|審|査|裁|判|統|制|構|概|抽|象|因|果|関|係|経|済|産|業|社|会|国|際|文化|歴史|技術|研究|情報|資|源|労|働|環境|行政|政治|倫理|責任|義務|批判|主張|評価|分析|判断|認め|妨|阻|抑|覆|遂|免|準|掲|携|顧|隔|紛|乏|緩|脆/u;
const BATCH7_HOLD = new Set([
	// Reopened candidates that remain unsuitable for an N1-priority slot:
	// elementary vocabulary, greetings, dated spellings, and narrow daily nouns.
	'仮令','上がる','訪れる','決まる','返る','集まる','甘い','貧乏','付き合う','歩む','栄える','逃す','潜る','軈て','暫く','隔週','利子','教材','下がる','包む','広まる','誇る','押さえる','整える','背負う','果てる','埋まる','問い合わせる','現われる','指差す','老ける','認める','産む','家計','外来','定年','津波','期末','下痢','役場','利息','学歴','出社','母校','本場','携帯','収集','教習','大空','民宿','見方','特技','特産','漁村','共学','助詞','社宅','休学','仲人','汽船','貝殻','大事','従業員','土産','準急','使用人','目蓋','軍服','三味線','控室','修学','用法','教職','来場','課外','慣れ','大げさ','物好き','受かる','間もなく','間違う','爽やか','済まない','ご苦労様','お蔭様で','久し振り','上手','気楽','盛大','未定','味わい','日の丸','無駄遣い','扱い','遅れ','張り紙','共働き','当たり','受け取り','花びら','お産','割り算','夕焼け','勤め先','振り','お使い','打ち消し','共稼ぎ','お邪魔します','見積り','化石','衣類','観覧','災害','真上','主任','天国','情熱','決勝','教員','探検','正解','再会','当選','推理','気象','預金','地形','沢山','詳細','一寸','畜生','可哀想','未婚','洋風','夜中','明々後日','手配','どうにか','がっちり','てっきり','がっしり','不良','その上','何故','保つ','合唱','生死','動力','楽譜','募金','小銭','月日','満月','保育','電線','陶器','同居','天地','交互','年長','送金','立体','年頃',
	'吃逆','果ない','散蒔く','転転','纏め','所が','取り引き','然うして','一向','一々','屹度','可成','吃驚','滅茶苦茶','奇麗','愈々','恰度','逆上る','蛋白質','黴菌','膨脹','段々','出鱈目','嗚呼','箇箇'
]);

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
	// Earlier holdouts were intentionally conservative for the first six
	// priority batches. From batch seven onward, reassess unused canonical
	// entries by score instead of permanently discarding useful upper-level
	// words together with dated spellings.
	if (!row || used.has(identity(candidate)) || (batch !== 'batch7' && EXCLUDE.has(candidate.word)) || (batch === 'batch7' && BATCH7_HOLD.has(candidate.word)) || !REQUIRED.every((key) => normalize(row[key]))) return [];
	const rank = Number(candidate.source_rank_by_generic_frequency ?? 999999);
	let priority = (candidate.frequency_evidence_count ?? 0) * 10;
	if (FORMAL.test(candidate.word) || FORMAL.test(row.meaning_ja)) priority += 45;
	if (/動詞|形容詞|副詞/u.test(row.part_of_speech)) priority += 12;
	if (batch === 'batch6' || batch === 'batch7') {
		// Once the strongest five batches are consumed, generic rank alone starts
		// promoting elementary loanwords, counters and dictionary headword
		// spellings. Prefer multi-kanji compounds and written/abstract usage.
		if (/^[\p{Script=Katakana}ー・]+$/u.test(candidate.word)) priority -= 55;
		if (/^\p{Script=Han}$/u.test(candidate.word)) priority -= 35;
		if (/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(candidate.word)) priority -= 25;
		if (/^[\p{Script=Han}々ヶ]{2,}$/u.test(candidate.word)) priority += 24;
		if (/性|化|率|論|観|権|制|策|務|的|上|化|症|感|態|過|難|害|衰|慣|衷|慨|越|屈|配|紡|嗜|類|密|危|軽|信|転|略|激/u.test(candidate.word)) priority += 16;
		if (/^(?:教え|一部|一日|女子|少女|私|俺|お早う|今日は|今晩は|左様なら|有難う|済みません|お願いします)$/u.test(candidate.word)) priority -= 120;
		if (/^(?:何|其|此|彼|御|凡|如何|兎|矢|嘗|屡|悉|殆|態|余程)/u.test(candidate.word)) priority -= 55;
	}
	if (rank >= 700 && rank <= 3200) priority += 18;
	else if (rank < 400) priority -= 35;
	else if (rank < 700) priority -= 15;
	return [{ ...row, source_rank_by_generic_frequency: rank, frequency_evidence_count: candidate.frequency_evidence_count ?? 0, priority_score: priority }];
}).sort((a,b) => b.priority_score - a.priority_score || a.source_rank_by_generic_frequency - b.source_rank_by_generic_frequency || a.word.localeCompare(b.word, 'ja'));

const qualified = batch === 'batch7' ? candidates.filter((row) => row.priority_score >= 66) : candidates;
if (batch === 'batch7') {
	const auditPath = path.join(PROD, 'candidates/n1-seventh-batch-source-audit.json');
	await fs.writeFile(auditPath, `${JSON.stringify({
		schemaVersion: 1,
		dateRange: { from: config.from, to: config.to },
		status: qualified.length >= 280 ? 'source_ready' : 'candidate_source_expansion_required',
		counts: { unusedCanonicalCandidates: candidates.length, editorialScoreThreshold: 66, qualifiedCandidates: qualified.length, requiredForBatch: 280, shortage: Math.max(0, 280 - qualified.length) },
		note: 'The original generic-frequency pool is exhausted at the high-priority tier. Do not fill the schedule with elementary vocabulary, dated spellings, or narrow dictionary headwords. Expand and independently curate the licensed source corpus before generating batch seven.',
	}, null, 2)}\n`);
	if (qualified.length < 280) throw new Error(`Batch 7 needs candidate-source expansion: ${qualified.length}/280 editorially qualified`);
}
const selected = qualified.slice(0, 280);
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
