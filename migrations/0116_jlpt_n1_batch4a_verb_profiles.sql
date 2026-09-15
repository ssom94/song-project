-- Reviewed direct verbs 1..40 from N1 batch 4 (2026-11-12..2026-11-25).
-- Forty indexed word+reading lookups only; no remote aggregate/full-table verification.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('見渡す','みわたす','transitive','市街地を見渡す',NULL,NULL),
('練る','ねる','transitive','計画を練る',NULL,NULL),
('悟る','さとる','transitive','原因を悟る',NULL,NULL),
('絶える','たえる','intransitive','伝統が絶える','絶つ','たつ'),
('取り戻す','とりもどす','transitive','信頼を取り戻す',NULL,NULL),
('収まる','おさまる','intransitive','雨が収まる','収める','おさめる'),
('引き取る','ひきとる','transitive','機器を引き取る',NULL,NULL),
('目覚める','めざめる','intransitive','関心に目覚める',NULL,NULL),
('立ち寄る','たちよる','intransitive','店へ立ち寄る',NULL,NULL),
('乗り込む','のりこむ','intransitive','現地へ乗り込む',NULL,NULL),
('染める','そめる','transitive','布を藍色に染める','染まる','そまる'),
('召す','めす','transitive','上着をお召しになる',NULL,NULL),
('荒らす','あらす','transitive','山林を荒らす','荒れる','あれる'),
('悩ます','なやます','transitive','企業を悩ます','悩む','なやむ'),
('読み上げる','よみあげる','transitive','名前を読み上げる',NULL,NULL),
('養う','やしなう','transitive','思考力を養う',NULL,NULL),
('苦しめる','くるしめる','transitive','家計を苦しめる','苦しむ','くるしむ'),
('染まる','そまる','intransitive','空が赤く染まる','染める','そめる'),
('操る','あやつる','transitive','三か国語を操る',NULL,NULL),
('焦る','あせる','intransitive','時間不足に焦る',NULL,NULL),
('落ち込む','おちこむ','intransitive','失敗して落ち込む',NULL,NULL),
('摘む','つまむ','transitive','部品を指でつまむ',NULL,NULL),
('呆れる','あきれる','intransitive','態度に呆れる',NULL,NULL),
('寝かせる','ねかせる','transitive','案を一晩寝かせる','寝る','ねる'),
('説く','とく','transitive','必要性を説く',NULL,NULL),
('演じる','えんじる','transitive','刑事の役を演じる',NULL,NULL),
('叶う','かなう','intransitive','夢が叶う','叶える','かなえる'),
('名付ける','なづける','transitive','子に名前を名付ける',NULL,NULL),
('騙す','だます','transitive','利用者を騙す',NULL,NULL),
('組み込む','くみこむ','transitive','機能をシステムに組み込む',NULL,NULL),
('臨む','のぞむ','intransitive','面接に臨む',NULL,NULL),
('葬る','ほうむる','transitive','遺体を葬る',NULL,NULL),
('盛り上がる','もりあがる','intransitive','会場が盛り上がる','盛り上げる','もりあげる'),
('捧げる','ささげる','transitive','人生を研究に捧げる',NULL,NULL),
('強まる','つよまる','intransitive','風が強まる','強める','つよめる'),
('差し出す','さしだす','transitive','身分証を差し出す',NULL,NULL),
('退く','しりぞく','intransitive','社長の座を退く',NULL,NULL),
('励む','はげむ','intransitive','勉強に励む',NULL,NULL),
('浸す','ひたす','transitive','布を水に浸す','浸る','ひたる'),
('惜しむ','おしむ','transitive','努力を惜しむ',NULL,NULL)
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
