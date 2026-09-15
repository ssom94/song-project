-- Reviewed direct verbs 41..80 from N1 batch 4 (2026-11-12..2026-11-25).
-- Forty indexed word+reading lookups only; no remote aggregate/full-table verification.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('舞う','まう','intransitive','花びらが風に舞う',NULL,NULL),
('損なう','そこなう','transitive','信頼を損なう',NULL,NULL),
('汚す','けがす','transitive','名誉を汚す','汚れる','けがれる'),
('据える','すえる','transitive','机を中央に据える',NULL,NULL),
('挑む','いどむ','intransitive','世界記録に挑む',NULL,NULL),
('唸る','うなる','intransitive','風が窓の外で唸る',NULL,NULL),
('面する','めんする','intransitive','部屋が海に面する',NULL,NULL),
('慌てる','あわてる','intransitive','事態に慌てる',NULL,NULL),
('帯びる','おびる','transitive','空が赤みを帯びる',NULL,NULL),
('連ねる','つらねる','transitive','名を連ねる','連なる','つらなる'),
('察する','さっする','transitive','事情を察する',NULL,NULL),
('交える','まじえる','transitive','冗談を交える',NULL,NULL),
('申し出る','もうしでる','transitive','協力を申し出る',NULL,NULL),
('漏れる','もれる','intransitive','情報が外部に漏れる','漏らす','もらす'),
('励ます','はげます','transitive','友人を励ます','励む','はげむ'),
('弱める','よわめる','transitive','火を弱める','弱まる','よわまる'),
('抜け出す','ぬけだす','intransitive','停滞から抜け出す',NULL,NULL),
('付け加える','つけくわえる','transitive','説明を付け加える',NULL,NULL),
('連なる','つらなる','intransitive','山々が連なる','連ねる','つらねる'),
('見逃す','みのがす','transitive','変化を見逃す',NULL,NULL),
('賑わう','にぎわう','intransitive','商店街が観光客で賑わう',NULL,NULL),
('徹する','てっする','intransitive','聞き役に徹する',NULL,NULL),
('受け付ける','うけつける','transitive','申請を受け付ける',NULL,NULL),
('駆ける','かける','intransitive','馬が草原を駆ける',NULL,NULL),
('備わる','そなわる','intransitive','施設に設備が備わる','備える','そなえる'),
('沈める','しずめる','transitive','網を海中に沈める','沈む','しずむ'),
('病む','やむ','both','病気で病む／心を病む',NULL,NULL),
('仕入れる','しいれる','transitive','魚を市場から仕入れる',NULL,NULL),
('叶える','かなえる','transitive','夢を叶える','叶う','かなう'),
('恥じる','はじる','transitive','失敗を恥じる',NULL,NULL),
('偏る','かたよる','intransitive','情報源が一つに偏る',NULL,NULL),
('押し込む','おしこむ','transitive','荷物を箱へ押し込む',NULL,NULL),
('打ち切る','うちきる','transitive','交渉を打ち切る',NULL,NULL),
('重んじる','おもんじる','transitive','信頼関係を重んじる',NULL,NULL),
('引っ掛ける','ひっかける','transitive','コートを椅子に引っ掛ける','引っ掛かる','ひっかかる'),
('揺らぐ','ゆらぐ','intransitive','決意が揺らぐ',NULL,NULL),
('裂ける','さける','intransitive','袋が裂ける','裂く','さく'),
('怯える','おびえる','intransitive','雷の音に怯える',NULL,NULL),
('綴じる','とじる','transitive','資料をファイルに綴じる',NULL,NULL),
('見落とす','みおとす','transitive','ミスを見落とす',NULL,NULL)
), target AS (
  SELECT jw.id, p.* FROM profiles p
  JOIN japanese_words jw INDEXED BY idx_japanese_words_word_reading_active
    ON jw.word=p.word AND COALESCE(jw.reading,'')=p.reading AND jw.deleted_at IS NULL
)
INSERT OR REPLACE INTO japanese_word_verb_profiles
(word_id,transitivity,particle_pattern_ja,usage_note_ko,usage_note_ja,paired_word,paired_reading,created_at,updated_at)
SELECT id,transitivity,pattern,
  CASE transitivity WHEN 'intransitive' THEN '주체의 상태·움직임을 나타내므로 예시의 が·に·から 조사 연결을 함께 외우세요.' WHEN 'transitive' THEN '대상에 작용하는 동사이므로 예시의 を 조사 연결을 함께 외우세요.' ELSE '자동사와 타동사 용법이 모두 있으므로 두 조사 패턴을 비교해서 외우세요.' END,
  CASE transitivity WHEN 'intransitive' THEN '主体の状態・動きを表す。助詞も一緒に覚える。' WHEN 'transitive' THEN '対象への働きかけを表す。助詞も一緒に覚える。' ELSE '自動詞・他動詞の両方の用法を、助詞と一緒に覚える。' END,
  pair_word,pair_reading,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM target;
