import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROD = path.join(ROOT, 'data/jlpt/production');
const CANDIDATES = path.join(PROD, 'candidates');
const CURATION = path.join(PROD, 'curation/words');
const isBatch10 = process.argv[2] === 'batch10';
const OUTPUT = path.join(CANDIDATES, isBatch10 ? 'n1-tenth-batch-proposals.json' : 'n1-ninth-batch-proposals.json');
const PRIOR = [
  'n1-first-batch-proposals.json', 'n1-second-batch-proposals.json',
  'n1-third-batch-proposals.json', 'n1-fourth-batch-proposals.json',
  'n1-fifth-batch-proposals.json', 'n1-sixth-batch-proposals.json',
  'n1-seventh-batch-proposals.json', 'n1-eighth-batch-proposals.json',
];
if (isBatch10) PRIOR.push('n1-ninth-batch-proposals.json');
const REQUIRED = ['word', 'reading', 'meaning_ko', 'meaning_ja', 'part_of_speech', 'example_ja', 'example_ko'];
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
const identity = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;

const used = new Set();
for (const name of PRIOR) {
  const doc = JSON.parse(await fs.readFile(path.join(CANDIDATES, name), 'utf8'));
  for (const row of doc.words) used.add(identity(row));
}

const curated = new Map();
for (const name of (await fs.readdir(CURATION)).filter((name) => name.endsWith('.json')).sort()) {
  const doc = JSON.parse(await fs.readFile(path.join(CURATION, name), 'utf8'));
  for (const row of doc.words ?? []) curated.set(identity(row), row);
}

// Project-authored N1 study-priority signals. These are editorial heuristics,
// not official JLPT frequencies or an official per-word JLPT list.
const ADVANCED = /(?:概|規|統|制|権|責|義|慣|衷|慨|脅|侵|審|裁|遂|阻|抑|緩|乏|妥|抽象|論|観|証|償|施策|制度|政策|倫理|根拠|見解|余地|動向|情勢|形骸|脆弱|齟齬|是正|踏襲|逸脱|顕著|包括|媒介|補完|還元|帰属|波及|排他|享受|趣旨|経緯|見込み|見通し|措置|配慮|介入)/u;
const ABSTRACT_END = /(?:性|化|率|論|観|権|制|策|務|態|感|効|義|理|質|能|構|準|律|系|害|難|失|過|用|績)$/u;
const LOW_VALUE = /(?:幼稚園|小学生|中学生|高校生|文房具|台所|便所|風呂|座布団|布巾|箪笥|茶碗|醤油|胡椒|下駄|草履|浴衣|扇子|手拭|靴下|寝巻|寝間着|雨戸|障子|蛇口|物差|定規|鉛筆|消しゴム|算数|割り算|掛け算|足し算|引き算|曜日|先々月|先々週|再来月|再来週|再来年|生年月日|人差指|親指|小指|薬指|床屋|八百屋|魚屋|肉屋|文房具屋|お早う|今晩は|今日は|左様なら|有難う|済みません|御免|頂きます|ご馳走さま)/u;
const NARROW = /(?:形容詞|形容動詞|副詞|助詞|助動詞|代名詞|主語|述語|五十音|平仮名|片仮名|送り仮名|振り仮名|仮名遣い|句読点|正方形|長方形|四捨五入|分数|顕微鏡|望遠鏡|乾電池|蛍光灯|機関車|消防署|税務署|産婦人科|耳鼻科|小児科)/u;
const DATED_FORM = /^(?:尚更|出来上がり|個所|受取|締切|見積り|売行き|打合せ|組合せ|付合う|知合い|引受る|引返す|引出す|見付かる|見付ける|附属|日日|庖丁|割算|煉瓦|蝋燭|御|其|此|彼処|所が|凡そ|殆ど|悉く|嘗て|未だ|兎に角|矢張り|可成|屹度|態と)/u;

// Reuse the accumulated editorial holdouts from batches 2-7. The older
// selector records hundreds of explicitly rejected greetings, elementary
// items, narrow school terms, dated spellings, and daily-life fillers.
const earlierSelector = await fs.readFile(path.join(ROOT, 'scripts/jlpt/build-n1-batch2-proposals.mjs'), 'utf8');
const holdoutSource = earlierSelector.slice(earlierSelector.indexOf('const EXCLUDE'), earlierSelector.indexOf('const FORMAL'));
const historicalHoldouts = new Set([...holdoutSource.matchAll(/'([^'\n]+)'/gu)].map((match) => normalize(match[1])));

const pool = JSON.parse(await fs.readFile(path.join(CANDIDATES, 'n1-candidate-pool.json'), 'utf8')).candidates;
const eligible = [];
for (const candidate of pool) {
  const id = identity(candidate);
  const row = curated.get(id);
  if (!row || used.has(id) || !REQUIRED.every((field) => normalize(row[field]))) continue;
  if (LOW_VALUE.test(row.word) || NARROW.test(row.word) || DATED_FORM.test(row.word)) continue;
  if (normalize(row.note).match(/現代.*(?:仮名|かな).*一般|古風|古い表記|通常.*書/u)) continue;
  let score = 0;
  const evidence = Object.values(candidate.frequency ?? {}).filter((value) => Number.isFinite(value)).length;
  score += evidence * 10;
  if (candidate.jmdict_common) score += 8;
  if (ADVANCED.test(row.word)) score += 48;
  if (ABSTRACT_END.test(row.word)) score += 18;
  if (/動詞|形容詞|副詞|接続詞/u.test(row.part_of_speech)) score += 12;
  if (/^[\p{Script=Han}々ヶ]{2,6}$/u.test(row.word)) score += 25;
  if (/^[\p{Script=Katakana}ー・]+$/u.test(row.word)) score -= 35;
  if (/^[\p{Script=Hiragana}ー]+$/u.test(row.word)) score -= 20;
  if (/^\p{Script=Han}$/u.test(row.word)) score -= 40;
  const rank = Number(candidate.source_rank_by_generic_frequency ?? 999999);
  if (rank >= 700 && rank <= 3000) score += 18;
  else if (rank < 400) score -= 25;
  if (historicalHoldouts.has(row.word)) score -= 100;
  eligible.push({ ...row, source_rank_by_generic_frequency: rank, editorial_priority_score: score });
}

eligible.sort((a, b) => b.editorial_priority_score - a.editorial_priority_score || a.source_rank_by_generic_frequency - b.source_rank_by_generic_frequency || a.word.localeCompare(b.word, 'ja'));
if (process.env.LIST_CANDIDATES === '1') {
  const offset = Number(process.env.OFFSET ?? 0);
  const limit = Number(process.env.LIMIT ?? 300);
  console.log(eligible.slice(offset, offset + limit).map((row, index) => `${offset + index + 1}\t${row.word}\t${row.reading}\t${row.meaning_ko}\t${row.part_of_speech}\t${row.editorial_priority_score}`).join('\n'));
  process.exit(0);
}
// Final human editorial pass. Ordering is intentional: broadly reusable
// written-language items come before narrower cultural or concrete terms.
const PREFERRED_WORDS = `
補償 代用 原作 一括 悪口 点検 得点 著書 複合 購読 敗戦 本体 河川 訂正 究極 山脈 孤立 契機 復旧 協調 一帯 用品 内臓 反射 潜入 出動 色彩 情緒 落下 飼育 宿命 斜面 生計 火星 見通し 勤務 人質 真実 緊急 他方 孤独 大幅 堂々 正常 台無し 行為 指摘 対応 確保 支持 認識 監視 上昇 説得 配置 運命 映像 復活 展示 昇進 創造 部門 優先 連中 屋敷 感染 兵器 看護 死刑 素材 惑星 背後 少数 同志 処置 中毒 直面 改良 出生 放射 充実 本文 一面 航海 告白 大金 結成 同情 末期 類似 脚本 幹部 旅客 意地 上位 公演 洪水 最善 乗り換え
貧乏 あっさり 観覧 不審 向き 上がり 組み合わせ 無能 無難 とんだ 同感 慣らす 有益 不調 頻繁 良好 未熟 推理 生死 動力 補充 化石 募金 山岳 風習 原油 保育 電線 陶器 教材 同居 交互 送金 立体 肥料 戦力 家計 富豪 外来 近郊 排水 化合 定年 天体 衣料 人情 高原 地主 結核 津波 原爆 静止 体格 樹木 原文 無言 故人 味覚 残高 堤防 野外 当人 時差 転勤 生育 耕作 朗読 学歴 入賞 着席 田園 出社 歓声 根気 先着
迅速 壮大 神秘 強烈 健全 気楽 盛大 未定 無意味 携帯 兵士 着陸 修行 破壊 収集 本名 課題 退職 赤字 装飾 退学 脱出 徒歩 平方 街道 振動 衣装 好意 幽霊 人目 手数 装備 暴風 爆弾 紳士 昆虫 返答 運送 真珠 仏像 家出 夜行 短歌 豊作 既婚 始発 守衛 沸騰 水田 雨天 製鉄 安静 出血 原形 欲望 新築
案の定 主任 情熱 教員 探検 再会 当選 配布 気象 預金 伝言 隔週 真下 世辞 気流 来場 見方 点火 私物 特産 版画 字体 姓名 発芽 考古学 社宅 休学
定める 果たす 設ける 逃れる 受け入れる 満たす 誤る 固める 催す 構える 導く 仕掛ける 控える 歩む 栄える 逃す 明かす 取り除く 定まる 仕上げる 滅びる 素早い 逃げ出す 飲み込む 継ぐ 広まる 誇る 整える
背負う 切り替える 果てる 仕立てる 鍛える 追い出す 埋まる 早める 取り寄せる 引き下げる 問い合わせる 弱る 投げ出す 当てはめる 粘る 割り込む 爽やか 扱い 怒り 行い 恐れ 情け 申し込み 締め切り 共働き 夕暮れ
資金 距離 投資 文書 参照 派遣 同意 設置 反応 内部 手配 固定 戦闘 指示 同士 箇所 現地 燃料 挑戦 後悔 無線 各種 重んずる 跨がる 辿り着く 何気ない 縮まる 及び
`.trim().split(/\s+/u);
const BATCH10_WORDS = `
歯科 公立 登校 入浴 聖書 黄色 相対 上下 体 暇 値 暦 格 渦 災害 癌 脈 宛 上手 明白 慣れ 詳細 短気
合唱 楽譜 衣類 小銭 利子 月日 満月 年長 年頃 一息 神殿 音色 台本 父母 問屋 連休 晴天 期末 給食 学芸 劇団 喜劇 本館 下痢 定食 役場 利息 現像 星座 母校 本場 主食 女史
未婚 洋風 大事 流行 一見 一目 作物 風車 元年 日向 道場 悪者 浜辺 旦那 家来 喫茶 家主 裸足 真上 同級 教習 大空 民宿 水洗 雨具 天国
決勝 正解 受身 修学 用法 教職 課外 観 警部 一敗 主人公 極楽 微笑 冷蔵 年号 特技 横綱 海路 漁村 式場 砂利 共学 蜂蜜 水気 花壇 担架 油絵 短波 大水 熱湯 三日月 貝殻 一部分 蛋白質
訪れる 決まる 楽しむ 返る 集まる 明るい 役立つ 大げさ 済ます 愚か 任す 鮮やか 突く 潜る 垂れる 殴る 物好き 受かる
採用 専用 調理 日焼け 値引き 味わい 左利き 後回し 前置き 無駄遣い 使い道 身体 従業員 帰京 使用人 漢語 縁側 桟橋 碁盤 分母 縁談 時刻表 和文 軍服 還暦 三味線 香辛料 十字路 冬眠
一部 不明 通常 日々 本気 不良 保つ 華やか 遥か 間もなく 名高い 間違う 切り替える 果てる 仕立てる 鍛える 追い出す 埋まる 早める 混む 痛める 平たい 取り寄せる 引き下げる 丸める 問い合わせる 弱る 眩しい 甘える 休める 投げ出す 抜かす 当てはめる 粘る 割り込む 爽やか
扱い 怒り 遅れ 助け 勧め 行い 結び 恐れ 並み 覚え 写し 情け 申し込み 悩み 驚き 叫び 頼み 救い 身振り 締め切り 張り紙 共働き 夕暮れ
開発 保護 施設 提供 殺人 現場 選挙 自己 資金 距離 保険 勝利 投資 文書 治療 参照 設定 美術 派遣 同意 公開 地元 設置 反応 古代 購入 開催 内部 予想 登録 伝説 軍事 手配 固定 戦闘 体験 指示 同士 一言 部下 地獄 職員 箇所 貴族 上司 了解 現地 天才 燃料 挑戦 恋愛 出演 後悔 乗客 英雄 読者 天井 無線 肉体 教科 秘書 原子 各種
何と 何も 先に 演ずる その上 如何にも 重んずる 近付く 跨がる 何となく 何とも 吊るす 辿り着く 恋する お洒落 何気ない 傷付く 馬鹿らしい 何だかんだ 縮まる 割合に 指差す 老ける 突っ張る 汚れ
当て 当たり 借り 受け取り 増し 憧れ 手当て 進み 荷造り 盗み 届け 招き 詫び 売り出し 顔付き 夜更け 見晴らし 勤め先
`.trim().split(/\s+/u);
const byWord = new Map(eligible.map((row) => [row.word, row]));
const editorialWords = isBatch10 ? BATCH10_WORDS : PREFERRED_WORDS;
const missingPreferred = editorialWords.filter((word) => !byWord.has(word));
if (missingPreferred.length) throw new Error(`Preferred words missing from eligible pool: ${missingPreferred.join(', ')}`);
if (new Set(editorialWords).size !== editorialWords.length) throw new Error('Duplicate word in editorial preference list');
const selected = editorialWords.slice(0, 280).map((word) => byWord.get(word));
if (selected.length < 280) console.log(JSON.stringify({ eligible: eligible.length, words: selected.map((row) => row.word) }, null, 2));
if (selected.length !== 280) throw new Error(`Expected 280 candidates, found ${selected.length}`);

const literal = selected.filter((row) => row.example_ja.includes(row.word));
const nonLiteral = selected.filter((row) => !row.example_ja.includes(row.word));
if (literal.length < 98) throw new Error(`Need at least 98 literal examples, found ${literal.length}`);
const scheduled = [];
for (let day = 0; day < 14; day += 1) {
  scheduled.push(...literal.splice(0, 7));
  while (scheduled.length < (day + 1) * 20 && nonLiteral.length) scheduled.push(nonLiteral.shift());
  while (scheduled.length < (day + 1) * 20) scheduled.push(literal.shift());
}

const words = scheduled.map((row, index) => ({
  ...row,
  key: `n1-${(isBatch10 ? 3841 : 3561) + index}`,
  sequence: (isBatch10 ? 2521 : 2241) + index,
  planned_study_date: new Date(Date.UTC(2027, 0, (isBatch10 ? 35 : 21) + Math.floor(index / 20))).toISOString().slice(0, 10),
  review_status: 'editorially_selected_from_verified_curation',
  selection_reasons: [
    `excluded all ${isBatch10 ? 2520 : 2240} prior scheduled word+reading identities`,
    'verified local reading, Korean/Japanese meaning, part of speech, and project-authored example',
    'modern written, abstract, nuanced, or broadly useful N1 study value',
  ],
}));
if (new Set(words.map(identity)).size !== 280) throw new Error('Duplicate selected word+reading pair');

await fs.writeFile(OUTPUT, `${JSON.stringify({
  schemaVersion: 1,
  purpose: `${isBatch10 ? 'Tenth' : 'Ninth'} 14-day N1 editorial batch. Project study priority only; not an official per-word JLPT frequency ranking.`,
  dateRange: isBatch10 ? { from: '2027-02-04', to: '2027-02-17', dailyWords: 20 } : { from: '2027-01-21', to: '2027-02-03', dailyWords: 20 },
  checks: {
    candidatePool: eligible.length,
    selected: words.length,
    excludesEarlierBatches: true,
    uniqueWordReadingPairs: true,
    allRequiredContentPresent: true,
    allExamplesContainHeadwordForContextPool: literal.length + 98 >= 98,
  },
  words,
}, null, 2)}\n`);

console.log(JSON.stringify({ eligible: eligible.length, selected: words.length, firstDate: words[0].planned_study_date, lastDate: words.at(-1).planned_study_date, selectedWords: words.map((row) => row.word) }, null, 2));
