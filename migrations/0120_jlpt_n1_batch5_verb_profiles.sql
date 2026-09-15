-- All 24 actual verbs from N1 batch 5 (2026-11-26..2026-12-09).
-- 感動詞・書簡語「拝啓」is deliberately excluded.
-- Twenty-four indexed word+reading lookups only; no remote aggregate/full-table verification.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('鈍る','なまる','intransitive','感覚が鈍る',NULL,NULL),
('映える','はえる','intransitive','建物が青空に映える',NULL,NULL),
('群がる','むらがる','intransitive','鳥が餌に群がる',NULL,NULL),
('躓く','つまずく','intransitive','設計段階で躓く',NULL,NULL),
('打ち合わせる','うちあわせる','transitive','発表内容を打ち合わせる',NULL,NULL),
('据え付ける','すえつける','transitive','機械を工場に据え付ける',NULL,NULL),
('綻びる','ほころびる','intransitive','袖口が綻びる',NULL,NULL),
('ぼやける','ぼやける','intransitive','写真がぼやける',NULL,NULL),
('しくじる','しくじる','both','仕事をしくじる／大事な場面でしくじる',NULL,NULL),
('剥げる','はげる','intransitive','塗装が剥げる','剥がす','はがす'),
('怒る','いかる','intransitive','不正に怒る',NULL,NULL),
('意気込む','いきごむ','intransitive','成功させようと意気込む',NULL,NULL),
('活ける','いける','transitive','花を花瓶に活ける',NULL,NULL),
('納まる','おさまる','intransitive','荷物が棚に納まる','納める','おさめる'),
('省みる','かえりみる','transitive','失敗の原因を省みる',NULL,NULL),
('見せびらかす','みせびらかす','transitive','時計を見せびらかす',NULL,NULL),
('可愛がる','かわいがる','transitive','孫を可愛がる',NULL,NULL),
('恥じらう','はじらう','intransitive','人前で恥じらう',NULL,NULL),
('ばてる','ばてる','intransitive','暑さでばてる',NULL,NULL),
('汚れる','けがれる','intransitive','名誉が汚れる','汚す','けがす'),
('添う','そう','intransitive','希望に添う','添える','そえる'),
('留める','とどめる','transitive','被害を最小限に留める','留まる','とどまる'),
('冷やかす','ひやかす','transitive','友人を冷やかす',NULL,NULL),
('盛る','さかる','intransitive','花が春に盛る',NULL,NULL)
), target AS (
  SELECT jw.id, p.* FROM profiles p
  JOIN japanese_words jw INDEXED BY idx_japanese_words_word_reading_active
    ON jw.word=p.word AND COALESCE(jw.reading,'')=p.reading AND jw.deleted_at IS NULL
)
INSERT OR REPLACE INTO japanese_word_verb_profiles
(word_id,transitivity,particle_pattern_ja,usage_note_ko,usage_note_ja,paired_word,paired_reading,created_at,updated_at)
SELECT id,transitivity,pattern,
  CASE transitivity WHEN 'intransitive' THEN '주체의 상태·움직임을 나타내므로 예시의 が·に·で 조사 연결을 함께 외우세요.' WHEN 'transitive' THEN '대상에 작용하는 동사이므로 예시의 を 조사 연결을 함께 외우세요.' ELSE '자동사와 타동사 용법이 모두 있으므로 두 조사 패턴을 비교해서 외우세요.' END,
  CASE transitivity WHEN 'intransitive' THEN '主体の状態・動きを表す。助詞も一緒に覚える。' WHEN 'transitive' THEN '対象への働きかけを表す。助詞も一緒に覚える。' ELSE '自動詞・他動詞の両方の用法を、助詞と一緒に覚える。' END,
  pair_word,pair_reading,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM target;
