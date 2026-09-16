import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batch = process.argv[2] === 'batch8' ? 'batch8' : 'batch7';
const inputPath = path.join(root, 'data/jlpt/production/candidates', batch === 'batch8' ? 'n1-eighth-batch-supplement-review-queue.json' : 'n1-supplement-review-queue.json');
const outputPath = path.join(root, 'data/jlpt/production/candidates', batch === 'batch8' ? 'n1-eighth-batch-supplement-shortlist.json' : 'n1-seventh-batch-supplement-shortlist.json');
const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const normalize = (value = '') => String(value).normalize('NFKC').trim();
const identity = (row) => `${normalize(row.word)}\u0000${normalize(row.reading)}`;

// Project-authored study-priority heuristic. Never describe it as official
// JLPT frequency or as an official N1 vocabulary list.
const FORMAL = /概|観|規|律|系|公務|催促|侵入|制作|性質|性能|専制|対策|体制|抽象|的確|統一|統計|能率|評論|免税|過半数|方程式|圧縮|意義|移転|有無|応用|改正|解説|改造|解放|拡充|学術|拡張|可決|過失|過剰|課税|仮定|過程|為替|間隔|間接|官庁|期限|基準|基礎|基盤|境界|教養|区域|区分|形式|継続|激増|気配|謙虚|原稿|原始|厳重|謙遜|原理|公害|公共|公式|口実|公正|功績|構造|肯定|公表|項目|合理|効力|国籍|個体|古典|再三|索引|削除|作成|自衛|自治|実感|実績|執筆|実用|指定|地盤|紙幣|社説|修繕|重点|就任|重役|縮小|循環|順序|純粋|焦点|消耗|省略/u;
const ABSTRACT_END = /(?:性|的|化|率|論|観|制|策|務|権|力|感|態|過|難|害|失|用|績|理|義|質|能|効|構|準|律|統|系)$/u;
const BASIC = /小学生|幼稚園|遊園地|扇風機|座布団|受話器|定期券|定休日|日用品|文房具|留守番|温泉|快晴|遠足|楽器|金魚|口紅|毛糸|競馬|下駄|香水|校庭|胡椒|小指|刺身|算数|四季|磁石|習字|絨毯|祝日|受験|将棋|賞金|商店|醤油|食器|書店|書道|白髪/u;
const NARROW = /形容動詞|片仮名|平仮名|五十音|代名詞|形容詞|句読点|正方形|長方形|四捨五入|顕微鏡|望遠鏡|乾電池|蛍光灯|機関車|消防署|助教授|新幹線|水蒸気|時間割|回数券|先々月|先々週|再来月|再来週|再来年|生年月日|人差指|親指|薬指|交通機関/u;
const DATED = /御免|大凡|個所|受取|編物|出来上がり|面倒臭い|逆様|先程|流石|締切|順々|小便/u;
const ADVANCED_SIGNAL = /体系|超過|通用|素質|標準|推定|妥当|対立|調整|成立|相違|増減|相互|増大|測定|断定|段階|中途|接近|接続|全般|先端|生存|整備|成分|申請|診断|人命|心身|住居|高等|作製|資料|製作|政党|宣伝|損得|貯蔵|抽選|転換|分布|変動|公認|固有|過程|概算|権限|実態|視点|観点|根拠|傾向|適用|運用|対応|検証|維持|促進|抑制|構想|承認|認定|規模|要因|効率|情勢|配慮|措置|是非|余地|見解|見通し|見込み|負担|妨害|遂行|補償|賠償|協議|合意|論点|前提|基盤|領域|範囲|比率|比重|需要|供給|収支|収益|損失|統制|権利|義務|責任|倫理|慣行|慣習|介入|提示|進展/u;
const EVERYDAY = /^(?:定規|裁縫|障子|一昨日|一昨年|従姉妹|海水浴|瀬戸物|調味料|出入口|寝間着|風呂敷|洋品店|欠伸|宛名|雨戸|井戸|植木|裏口|宴会|煙突|王女|温室|改札|書留|書取|垣根|学年|貸間|貸家|片道|学科|学級|紙屑|神様|剃刀|関西|缶詰|関東|乾杯|看板|看病|起床|客席|客間|稽古|外科|毛皮|下車|下旬|下水|月給|月末|見学|工員|孝行|工事|校舎|後輩|紅葉|国王|献立|在学|祭日|材木|酒場|座敷|三角|寺院|司会|四角|自習|時速|下町|湿気|失恋|児童|蛇口|車庫|車掌|写生|車輪|洒落|集金|終点|主語|述語|巡査|上級|上下|乗車|上旬|賞品|勝負|初級|食塩|初旬|素人|寝台|深夜|親類|炊事|水滴|水筒|水曜|図鑑|隙間|図形|相撲|寸法|清書|清掃|正門|西暦|折角|洗剤|扇子|先祖|先頭|線路|雑巾|倉庫|葬式|送別|草履|送料|速達|蕎麦|算盤|第一|大工|太鼓|大小|体操|大分|大木|題名|足袋|溜息|団地|近々|知人|地名|茶碗|中旬|中年|長女|長男|直後|直線|直前|直通|直角|直径|塵紙)$/u;

function scoreRow(row) {
  let score = Number(row.editorial_score ?? 0);
  const reasons = [];
  if (FORMAL.test(row.word)) { score += 34; reasons.push('formal, academic, administrative, or abstract study value'); }
  if (ABSTRACT_END.test(row.word)) { score += 18; reasons.push('productive abstract compound pattern'); }
  if (ADVANCED_SIGNAL.test(row.word)) { score += 42; reasons.push('advanced written, analytical, institutional, or abstract study value'); }
  if (/^[\p{Script=Han}々ヶ]{2,}$/u.test(row.word)) { score += 8; reasons.push('multi-kanji compound reading value'); }
  if (BASIC.test(row.word)) { score -= 55; reasons.push('elementary or everyday vocabulary held below this queue'); }
  if (NARROW.test(row.word)) { score -= 42; reasons.push('narrow school/science/grammar term held for a themed list'); }
  if (DATED.test(row.word)) { score -= 60; reasons.push('dated or non-preferred written form requires reconsideration'); }
  if (EVERYDAY.test(row.word)) { score -= 85; reasons.push('elementary, household, school, date, or narrow everyday item held below the advanced queue'); }
  return { score, reasons };
}

const seen = new Set();
const ranked = source.candidates.map((row) => {
  const result = scoreRow(row);
  return { ...row, supplement_priority_score: result.score, editorial_reasons: result.reasons };
}).filter((row) => {
  const key = identity(row);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).sort((a, b) => b.supplement_priority_score - a.supplement_priority_score || a.source_rank - b.source_rank || a.word.localeCompare(b.word, 'ja'));

const selected = ranked.slice(0, 280).map((row, index) => ({ ...row, shortlist_sequence: index + 1, selection_status: 'shortlisted_pending_dictionary_and_korean_editorial_enrichment' }));
const holdout = ranked.slice(280).map((row) => ({ ...row, selection_status: `held_out_from_batch_${batch === 'batch8' ? 'eight' : 'seven'}` }));
if (selected.length !== 280 || new Set(selected.map(identity)).size !== 280) throw new Error('Expected 280 unique shortlisted candidates');

await fs.writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  purpose: `Editorial shortlist for the ${batch === 'batch8' ? 'eighth' : 'seventh'} 14-day N1-preparation batch supplement.`,
  disclaimer: 'Project-authored prerequisite/supplement priority; not an official JLPT N1 list or official per-word frequency ranking.',
  dateRange: batch === 'batch8' ? { from: '2027-01-07', to: '2027-01-20', requiredWords: 280 } : { from: '2026-12-24', to: '2027-01-06', requiredWords: 280 },
  checks: { inputCandidates: source.candidates.length, shortlisted: selected.length, heldOut: holdout.length, uniqueWordReadingPairs: true, dictionaryAndKoreanEditorialEnrichmentPending: true, scheduledInTodayStudy: false },
  selected,
  holdout,
}, null, 2)}\n`);
console.log(JSON.stringify({ input: ranked.length, selected: selected.length, heldOut: holdout.length, first: selected.slice(0, 10).map((row) => row.word) }, null, 2));
