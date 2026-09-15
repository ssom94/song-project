-- Reviewed direct verbs from N1 batch 3 (2026-10-29..2026-11-11).
-- The target join uses idx_japanese_words_word_reading_active; no remote COUNT/full scan.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('伴う','ともなう','both','混乱が伴う／危険を伴う',NULL,NULL),
('記す','しるす','transitive','結果を報告書に記す',NULL,NULL),
('止める','とどめる','transitive','被害を最小限に止める','止まる','とどまる'),
('称する','しょうする','transitive','専門家を称する',NULL,NULL),
('尽くす','つくす','transitive','力を尽くす','尽きる','つきる'),
('要する','ようする','transitive','二週間を要する',NULL,NULL),
('止まる','とどまる','intransitive','被害が一地域に止まる','止める','とどめる'),
('弾く','はじく','transitive','素材が水を弾く',NULL,NULL),
('襲う','おそう','transitive','眠気が人を襲う',NULL,NULL),
('浮かぶ','うかぶ','intransitive','解決策が頭に浮かぶ','浮かべる','うかべる'),
('強める','つよめる','transitive','制限を強める','強まる','つよまる'),
('添える','そえる','transitive','書類を申請書に添える','添う','そう'),
('告げる','つげる','transitive','終了を参加者に告げる',NULL,NULL),
('交わす','かわす','transitive','挨拶を交わす',NULL,NULL),
('引き起こす','ひきおこす','transitive','ミスが障害を引き起こす','起こる','おこる'),
('溢れる','あふれる','intransitive','会場が期待に溢れる',NULL,NULL),
('貫く','つらぬく','transitive','方針を貫く',NULL,NULL),
('込める','こめる','transitive','手紙に気持ちを込める',NULL,NULL),
('沿う','そう','intransitive','要望に沿う','添える','そえる'),
('勝る','まさる','intransitive','新製品が旧製品に勝る',NULL,NULL),
('痛む','いたむ','intransitive','腰が痛む','痛める','いためる'),
('追い込む','おいこむ','transitive','現場を窮地に追い込む',NULL,NULL),
('赴く','おもむく','intransitive','被災地へ赴く',NULL,NULL),
('吐く','つく','transitive','嘘を吐く',NULL,NULL),
('漂う','ただよう','intransitive','緊張した空気が会場に漂う',NULL,NULL),
('尽きる','つきる','intransitive','議論が尽きる','尽くす','つくす')
), target AS (
  SELECT jw.id, p.* FROM profiles p
  JOIN japanese_words jw INDEXED BY idx_japanese_words_word_reading_active
    ON jw.word=p.word AND COALESCE(jw.reading,'')=p.reading AND jw.deleted_at IS NULL
)
INSERT OR REPLACE INTO japanese_word_verb_profiles
(word_id,transitivity,particle_pattern_ja,usage_note_ko,usage_note_ja,paired_word,paired_reading,created_at,updated_at)
SELECT id,transitivity,pattern,
  CASE transitivity WHEN 'intransitive' THEN '주체의 상태·움직임을 나타내므로 예시의 が·に·へ 조사 연결을 함께 외우세요.' WHEN 'transitive' THEN '대상에 작용하는 동사이므로 예시의 を 조사 연결을 함께 외우세요.' ELSE '자동사와 타동사 용법이 모두 있으므로 두 조사 패턴을 비교해서 외우세요.' END,
  CASE transitivity WHEN 'intransitive' THEN '主体の状態・動きを表す。助詞も一緒に覚える。' WHEN 'transitive' THEN '対象への働きかけを表す。助詞も一緒に覚える。' ELSE '自動詞・他動詞の両方の用法を、助詞と一緒に覚える。' END,
  pair_word,pair_reading,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM target;
