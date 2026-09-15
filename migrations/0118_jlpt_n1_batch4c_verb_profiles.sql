-- Reviewed direct verbs 81..120 from N1 batch 4 (2026-11-12..2026-11-25).
-- Forty indexed word+reading lookups only; no remote aggregate/full-table verification.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('食い違う','くいちがう','intransitive','二人の説明が食い違う',NULL,NULL),
('冴える','さえる','intransitive','頭が冴える',NULL,NULL),
('急かす','せかす','transitive','相手を急かす',NULL,NULL),
('書き取る','かきとる','transitive','文章を書き取る',NULL,NULL),
('漏る','もる','intransitive','屋根から雨が漏る','漏らす','もらす'),
('萎む','しぼむ','intransitive','風船が萎む','萎ませる','しぼませる'),
('着飾る','きかざる','intransitive','パーティーのために着飾る',NULL,NULL),
('弄る','いじる','transitive','機械を弄る',NULL,NULL),
('痺れる','しびれる','intransitive','足が痺れる',NULL,NULL),
('負かす','まかす','transitive','相手を負かす','負ける','まける'),
('捕らえる','とらえる','transitive','容疑者を捕らえる',NULL,NULL),
('途絶える','とだえる','intransitive','交通が途絶える',NULL,NULL),
('代わる','かわる','intransitive','担当者に代わる',NULL,NULL),
('売り出す','うりだす','transitive','新商品を売り出す',NULL,NULL),
('怒鳴る','どなる','both','大声で怒鳴る／部下を怒鳴る',NULL,NULL),
('背く','そむく','intransitive','命令に背く',NULL,NULL),
('禁じる','きんじる','transitive','喫煙を禁じる',NULL,NULL),
('強いる','しいる','transitive','社員に残業を強いる',NULL,NULL),
('見掛ける','みかける','transitive','同僚を駅で見掛ける',NULL,NULL),
('拘る','こだわる','intransitive','品質に拘る',NULL,NULL),
('転じる','てんじる','both','状況が好転に転じる／話題を転じる',NULL,NULL),
('賭ける','かける','transitive','名誉を賭ける',NULL,NULL),
('申し入れる','もうしいれる','transitive','改善を会社に申し入れる',NULL,NULL),
('引きずる','ひきずる','transitive','失敗を引きずる',NULL,NULL),
('跨ぐ','またぐ','transitive','溝を跨ぐ',NULL,NULL),
('漕ぐ','こぐ','transitive','ボートを漕ぐ',NULL,NULL),
('掬う','すくう','transitive','水を掬う',NULL,NULL),
('研ぐ','とぐ','transitive','包丁を研ぐ',NULL,NULL),
('弱まる','よわまる','intransitive','雨の勢いが弱まる','弱める','よわめる'),
('剥がす','はがす','transitive','シールを剥がす','剥がれる','はがれる'),
('危ぶむ','あやぶむ','transitive','実現性を危ぶむ',NULL,NULL),
('取り次ぐ','とりつぐ','transitive','電話を担当者に取り次ぐ',NULL,NULL),
('遅らす','おくらす','transitive','出発を遅らす','遅れる','おくれる'),
('聳える','そびえる','intransitive','高層ビルが街に聳える',NULL,NULL),
('染みる','しみる','intransitive','風が傷口に染みる',NULL,NULL),
('心掛ける','こころがける','transitive','毎日の運動を心掛ける',NULL,NULL),
('改まる','あらたまる','intransitive','口調が改まる','改める','あらためる'),
('欺く','あざむく','transitive','人を欺く',NULL,NULL),
('老いる','おいる','intransitive','人が老いる',NULL,NULL),
('組み合わせる','くみあわせる','transitive','素材を組み合わせる','組み合わさる','くみあわさる')
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
