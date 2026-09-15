-- Reviewed direct verbs from N1 batch 1 (2026-10-01..2026-10-14). Bounded by word+reading.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japanese_word_verb_profiles (
  word_id INTEGER PRIMARY KEY,
  transitivity TEXT NOT NULL CHECK (transitivity IN ('intransitive','transitive','both')),
  particle_pattern_ja TEXT NOT NULL,
  usage_note_ko TEXT NOT NULL,
  usage_note_ja TEXT NOT NULL,
  paired_word TEXT,
  paired_reading TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_japanese_word_verb_profiles_transitivity ON japanese_word_verb_profiles(transitivity);

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('及ぶ','およぶ','intransitive','影響が各地に及ぶ',NULL,NULL),
('取り組む','とりくむ','intransitive','課題に取り組む',NULL,NULL),
('築く','きずく','transitive','信頼関係を築く',NULL,NULL),
('負う','おう','transitive','責任を負う',NULL,NULL),
('仕える','つかえる','intransitive','主君に仕える',NULL,NULL),
('欠く','かく','transitive','礼儀を欠く',NULL,NULL),
('唱える','となえる','transitive','異議を唱える',NULL,NULL),
('耐える','たえる','intransitive','苦痛に耐える',NULL,NULL),
('滅ぼす','ほろぼす','transitive','国を滅ぼす','滅びる','ほろびる'),
('犯す','おかす','transitive','過ちを犯す',NULL,NULL),
('施す','ほどこす','transitive','処置を施す',NULL,NULL),
('遂げる','とげる','transitive','目的を遂げる',NULL,NULL),
('掲げる','かかげる','transitive','目標を掲げる',NULL,NULL),
('営む','いとなむ','transitive','事業を営む',NULL,NULL),
('携わる','たずさわる','intransitive','研究に携わる',NULL,NULL),
('免れる','まぬかれる','both','被害を免れる',NULL,NULL),
('募る','つのる','both','不安が募る／参加者を募る',NULL,NULL),
('脅かす','おどかす','transitive','安全を脅かす',NULL,NULL),
('率いる','ひきいる','transitive','チームを率いる',NULL,NULL),
('促す','うながす','transitive','改善を促す',NULL,NULL),
('踏まえる','ふまえる','transitive','結果を踏まえる',NULL,NULL),
('制する','せいする','transitive','試合を制する',NULL,NULL),
('阻む','はばむ','transitive','進行を阻む',NULL,NULL),
('覆す','くつがえす','transitive','判定を覆す',NULL,NULL),
('顧みる','かえりみる','transitive','過去を顧みる',NULL,NULL),
('慎む','つつしむ','transitive','言動を慎む',NULL,NULL),
('脅す','おどす','transitive','相手を脅す',NULL,NULL),
('逸らす','そらす','transitive','視線を逸らす','逸れる','それる'),
('躊躇う','ためらう','both','返事を躊躇う／一瞬躊躇う',NULL,NULL),
('緩む','ゆるむ','intransitive','緊張が緩む','緩める','ゆるめる'),
('緩める','ゆるめる','transitive','規制を緩める','緩む','ゆるむ'),
('準ずる','じゅんずる','intransitive','規定に準ずる',NULL,NULL),
('慕う','したう','transitive','恩師を慕う',NULL,NULL),
('誤魔化す','ごまかす','transitive','失敗をごまかす',NULL,NULL),
('紛れる','まぎれる','intransitive','群衆に紛れる','紛らす','まぎらす'),
('膨れる','ふくれる','intransitive','予算が膨れる','膨らませる','ふくらませる'),
('隔たる','へだたる','intransitive','二地点が隔たる',NULL,NULL),
('準じる','じゅんじる','intransitive','規則に準じる',NULL,NULL),
('堪える','たえる','intransitive','批判に堪える',NULL,NULL)
), target AS (
  SELECT jw.id, p.* FROM profiles p
  JOIN japanese_words jw ON jw.word=p.word AND COALESCE(jw.reading,'')=p.reading AND jw.deleted_at IS NULL
)
INSERT OR REPLACE INTO japanese_word_verb_profiles
(word_id,transitivity,particle_pattern_ja,usage_note_ko,usage_note_ja,paired_word,paired_reading,created_at,updated_at)
SELECT id,transitivity,pattern,
  CASE transitivity WHEN 'intransitive' THEN '주체의 상태·움직임을 나타내며, 예시의 が·に 조사 연결을 함께 외우세요.' WHEN 'transitive' THEN '대상에 작용하는 동사이므로, 예시의 を 조사 연결을 함께 외우세요.' ELSE '자동사와 타동사 용법이 모두 있으므로 두 조사 패턴을 비교해서 외우세요.' END,
  CASE transitivity WHEN 'intransitive' THEN '主体の状態・動きを表す。助詞も一緒に覚える。' WHEN 'transitive' THEN '対象への働きかけを表す。助詞も一緒に覚える。' ELSE '自動詞・他動詞の両方の用法を、助詞と一緒に覚える。' END,
  pair_word,pair_reading,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM target;
