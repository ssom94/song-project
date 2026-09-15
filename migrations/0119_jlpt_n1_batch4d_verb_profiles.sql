-- Reviewed direct verbs 121..161 from N1 batch 4 (2026-11-12..2026-11-25).
-- Forty-one indexed word+reading lookups only; no remote aggregate/full-table verification.
PRAGMA foreign_keys = ON;

WITH profiles(word,reading,transitivity,pattern,pair_word,pair_reading) AS (VALUES
('親しむ','したしむ','intransitive','本に親しむ',NULL,NULL),
('嘆く','なげく','transitive','失敗を嘆く',NULL,NULL),
('洒落る','しゃれる','intransitive','洒落れた服で出かける',NULL,NULL),
('似通う','にかよう','intransitive','二つの案が似通う',NULL,NULL),
('剥ぐ','はぐ','transitive','樹皮を剥ぐ',NULL,NULL),
('寄越す','よこす','transitive','資料をこちらへ寄越す',NULL,NULL),
('強請る','ねだる','transitive','お菓子を母親に強請る',NULL,NULL),
('揉める','もめる','intransitive','両社が条件をめぐって揉める',NULL,NULL),
('恵む','めぐむ','transitive','人々に食べ物を恵む',NULL,NULL),
('ぶら下げる','ぶらさげる','transitive','かばんを肩からぶら下げる','ぶら下がる','ぶらさがる'),
('呟く','つぶやく','transitive','一言を呟く',NULL,NULL),
('凭れる','もたれる','intransitive','壁に凭れる',NULL,NULL),
('腫れる','はれる','intransitive','腕が腫れる',NULL,NULL),
('備え付ける','そなえつける','transitive','消火器を部屋に備え付ける',NULL,NULL),
('治まる','おさまる','intransitive','頭痛が治まる','治める','おさめる'),
('受け止める','うけとめる','transitive','批判を受け止める',NULL,NULL),
('持てる','もてる','intransitive','彼が周囲に持てる',NULL,NULL),
('衰える','おとろえる','intransitive','体力が衰える',NULL,NULL),
('凌ぐ','しのぐ','transitive','昨年の売上を凌ぐ',NULL,NULL),
('煙る','けむる','intransitive','周囲が煙で煙る',NULL,NULL),
('霞む','かすむ','intransitive','山が霞む',NULL,NULL),
('澄ます','すます','transitive','顔を澄ます','澄む','すむ'),
('拵える','こしらえる','transitive','弁当を拵える',NULL,NULL),
('滲む','にじむ','intransitive','涙が目に滲む',NULL,NULL),
('潤う','うるおう','intransitive','地域経済が潤う','潤す','うるおす'),
('待ち望む','まちのぞむ','transitive','開始を待ち望む',NULL,NULL),
('見合わせる','みあわせる','transitive','開催を見合わせる',NULL,NULL),
('害する','がいする','transitive','健康を害する',NULL,NULL),
('化ける','ばける','intransitive','狐が人間に化ける',NULL,NULL),
('取り巻く','とりまく','transitive','環境が企業を取り巻く',NULL,NULL),
('脱する','だっする','both','危機から脱する／危機を脱する',NULL,NULL),
('尊ぶ','たっとぶ','transitive','自然を尊ぶ',NULL,NULL),
('咎める','とがめる','transitive','失敗を咎める',NULL,NULL),
('乱す','みだす','transitive','秩序を乱す','乱れる','みだれる'),
('交わる','まじわる','intransitive','二本の道が交わる','交える','まじえる'),
('妬む','ねたむ','transitive','他人の成功を妬む',NULL,NULL),
('差し掛かる','さしかかる','intransitive','夕方に差し掛かる',NULL,NULL),
('和らげる','やわらげる','transitive','痛みを和らげる','和らぐ','やわらぐ'),
('差し支える','さしつかえる','intransitive','業務に差し支える',NULL,NULL),
('折り返す','おりかえす','both','電車が終点で折り返す／紙を折り返す',NULL,NULL),
('罵る','ののしる','transitive','相手を罵る',NULL,NULL)
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
