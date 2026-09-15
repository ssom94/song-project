-- Reviewed direct verbs from N1 batch 2 (2026-10-15..2026-10-28). Bounded by word+reading.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('有する','ゆうする','transitive','権利を有する',NULL,NULL),
('問う','とう','transitive','責任を問う',NULL,NULL),
('反する','はんする','intransitive','規則に反する',NULL,NULL),
('上回る','うわまわる','transitive','予想を上回る',NULL,NULL),
('費やす','ついやす','transitive','時間を費やす',NULL,NULL),
('受け継ぐ','うけつぐ','transitive','技術を受け継ぐ',NULL,NULL),
('辿る','たどる','transitive','記録を辿る',NULL,NULL),
('深める','ふかめる','transitive','理解を深める','深まる','ふかまる'),
('取り扱う','とりあつかう','transitive','個人情報を取り扱う',NULL,NULL),
('引き上げる','ひきあげる','both','価格を引き上げる／現場から引き上げる',NULL,NULL),
('絡む','からむ','intransitive','複数の要因が絡む',NULL,NULL),
('仰ぐ','あおぐ','transitive','指示を仰ぐ',NULL,NULL),
('漏らす','もらす','transitive','情報を漏らす','漏れる','もれる'),
('富む','とむ','intransitive','自然に富む',NULL,NULL),
('打ち込む','うちこむ','both','杭を打ち込む／研究に打ち込む',NULL,NULL),
('志す','こころざす','transitive','医師を志す',NULL,NULL),
('遠ざかる','とおざかる','intransitive','目標から遠ざかる','遠ざける','とおざける'),
('裁く','さばく','transitive','事件を裁く',NULL,NULL),
('経る','へる','transitive','審査を経る',NULL,NULL),
('図る','はかる','transitive','改善を図る',NULL,NULL),
('担う','になう','transitive','役割を担う',NULL,NULL),
('高まる','たかまる','intransitive','関心が高まる','高める','たかめる'),
('生かす','いかす','transitive','経験を生かす',NULL,NULL),
('試みる','こころみる','transitive','新手法を試みる',NULL,NULL),
('値する','あたいする','intransitive','評価に値する',NULL,NULL),
('成り立つ','なりたつ','intransitive','制度が料金で成り立つ',NULL,NULL),
('授ける','さずける','transitive','技を授ける',NULL,NULL),
('司る','つかさどる','transitive','運用を司る',NULL,NULL),
('当てはまる','あてはまる','intransitive','条件に当てはまる',NULL,NULL),
('禁ずる','きんずる','transitive','立ち入りを禁ずる',NULL,NULL),
('傾ける','かたむける','transitive','耳を傾ける','傾く','かたむく'),
('乱れる','みだれる','intransitive','髪が乱れる','乱す','みだす'),
('障る','さわる','intransitive','体に障る',NULL,NULL),
('取り締まる','とりしまる','transitive','違法行為を取り締まる',NULL,NULL),
('諮る','はかる','transitive','案件を専門家に諮る',NULL,NULL),
('侵す','おかす','transitive','権利を侵す',NULL,NULL),
('繕う','つくろう','transitive','服を繕う',NULL,NULL),
('瞑る','つぶる','transitive','目を瞑る',NULL,NULL),
('揺さぶる','ゆさぶる','transitive','社会を揺さぶる',NULL,NULL),
('貶す','けなす','transitive','他人を貶す',NULL,NULL),
('結び付く','むすびつく','intransitive','努力が成果に結び付く','結び付ける','むすびつける'),
('手掛ける','てがける','transitive','設計を手掛ける',NULL,NULL),
('賄う','まかなう','transitive','費用を参加費で賄う',NULL,NULL),
('遮る','さえぎる','transitive','光を遮る',NULL,NULL),
('絶つ','たつ','transitive','悪習を絶つ',NULL,NULL),
('即する','そくする','intransitive','実情に即する',NULL,NULL),
('捗る','はかどる','intransitive','作業が捗る',NULL,NULL),
('労る','いたわる','transitive','体を労る',NULL,NULL),
('弛む','たるむ','intransitive','ロープが弛む','弛める','たるめる'),
('齎らす','もたらす','transitive','変化をもたらす',NULL,NULL)
), target AS (
  SELECT jw.id, p.* FROM profiles p
  JOIN japanese_words jw ON jw.word=p.word AND COALESCE(jw.reading,'')=p.reading AND jw.deleted_at IS NULL
)
INSERT OR REPLACE INTO japanese_word_verb_profiles
(word_id,transitivity,particle_pattern_ja,usage_note_ko,usage_note_ja,paired_word,paired_reading,created_at,updated_at)
SELECT id,transitivity,pattern,
  CASE transitivity WHEN 'intransitive' THEN '주체의 상태·움직임을 나타내므로 예시의 が·に·から 조사 연결을 함께 외우세요.' WHEN 'transitive' THEN '대상에 작용하는 동사이므로 예시의 を 조사 연결을 함께 외우세요.' ELSE '자동사와 타동사 용법이 모두 있으므로 두 조사 패턴을 비교해서 외우세요.' END,
  CASE transitivity WHEN 'intransitive' THEN '主体の状態・動きを表す。助詞も一緒に覚える。' WHEN 'transitive' THEN '対象への働きかけを表す。助詞も一緒に覚える。' ELSE '自動詞・他動詞の両方の用法を、助詞と一緒に覚える。' END,
  pair_word,pair_reading,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM target;
