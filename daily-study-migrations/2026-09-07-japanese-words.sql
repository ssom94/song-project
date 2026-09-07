-- 2026-09-07-japanese-words.sql
-- 2026-09-07 JLPT N1 신규 20단어 -> 일본어학습 데이터 등록용
-- 원격 D1에는 자동 적용하지 않는다. word+reading 기존 행은 재사용하고 누락 관계만 보완한다.
PRAGMA foreign_keys = ON;

CREATE TEMP TABLE _jlpt_20260907_words (
  word TEXT NOT NULL,
  reading TEXT NOT NULL,
  meaning_ko TEXT NOT NULL,
  meaning_ja TEXT NOT NULL,
  pos_name_ja TEXT NOT NULL,
  sentence_ja TEXT NOT NULL,
  example_reading TEXT NOT NULL,
  translation_ko TEXT NOT NULL,
  PRIMARY KEY (word, reading)
) WITHOUT ROWID;

INSERT INTO _jlpt_20260907_words
(word, reading, meaning_ko, meaning_ja, pos_name_ja, sentence_ja, example_reading, translation_ko)
VALUES
('概ね','おおむね','대체로|대강','全体としてだいたい。おおよそ。','副詞','計画は概ね予定どおりに進んでいる。','けいかくはおおむねよていどおりにすすんでいる。','계획은 대체로 예정대로 진행되고 있다.'),
('補う','おぎなう','보충하다|메우다','足りない部分を付け加えて満たす。','五段動詞','不足している知識は実務経験で補う必要がある。','ふそくしているちしきはじつむけいけんでおぎなうひつようがある。','부족한 지식은 실무 경험으로 보충할 필요가 있다.'),
('把握','はあく','파악|파악하다','内容や状況をしっかり理解し、とらえること。','サ変名詞','障害の影響範囲を正確に把握する。','しょうがいのえいきょうはんいをせいかくにはあくする。','장애의 영향 범위를 정확하게 파악한다.'),
('衰える','おとろえる','쇠퇴하다|약해지다','勢いや能力、体力などが弱くなる。','一段動詞','使わない能力は徐々に衰えていく。','つかわないのうりょくはじょじょにおとろえていく。','사용하지 않는 능력은 서서히 쇠퇴해 간다.'),
('見据える','みすえる','내다보다|응시하다','じっと見つめる。また、将来などを見通して考える。','一段動詞','将来の運用を見据えてシステムを設計する。','しょうらいのうんようをみすえてしすてむをせっけいする。','향후 운영을 내다보고 시스템을 설계한다.'),
('顕著','けんちょ','현저함|두드러짐','はっきり目立っているさま。','な形容詞','改善後は処理時間の短縮が顕著に表れた。','かいぜんごはしょりじかんのたんしゅくがけんちょにあらわれた。','개선 후에는 처리 시간 단축이 두드러지게 나타났다.'),
('柔軟','じゅうなん','유연함|융통성 있음','しなやかなさま。また、状況に応じて考え方や対応を変えられるさま。','な形容詞','状況の変化に柔軟に対応することが求められる。','じょうきょうのへんかにじゅうなんにたいおうすることがもとめられる。','상황 변화에 유연하게 대응하는 것이 요구된다.'),
('慎重','しんちょう','신중함|조심스러움','注意深く、軽々しく行動しないさま。','な形容詞','本番環境の設定変更は慎重に行うべきだ。','ほんばんかんきょうのせっていへんこうはしんちょうにおこなうべきだ。','운영 환경의 설정 변경은 신중하게 해야 한다.'),
('維持','いじ','유지|유지하다','同じ状態を保ち続けること。','サ変名詞','サービス品質を維持するために監視を続ける。','さーびすひんしつをいじするためにかんしをつづける。','서비스 품질을 유지하기 위해 모니터링을 계속한다.'),
('逸脱','いつだつ','일탈|벗어남','本来の範囲、規則、道筋などから外れること。','サ変名詞','手順から逸脱した作業は事故につながる可能性がある。','てじゅんからいつだつしたさぎょうはじこにつながるかのうせいがある。','절차에서 벗어난 작업은 사고로 이어질 가능성이 있다.'),
('膨大','ぼうだい','방대함|막대함','数量や規模が非常に大きいさま。','な形容詞','膨大なログから原因を特定しなければならない。','ぼうだいなろぐからげんいんをとくていしなければならない。','방대한 로그에서 원인을 특정해야 한다.'),
('挙げる','あげる','들다|예로 들다','例や事実などを取り上げて示す。','一段動詞','問題点として三つの原因を挙げた。','もんだいてんとしてみっつのげんいんをあげた。','문제점으로 세 가지 원인을 들었다.'),
('踏まえる','ふまえる','근거로 삼다|고려하다','ある事柄を前提や根拠として考慮する。','一段動詞','利用者の意見を踏まえて仕様を見直した。','りようしゃのいけんをふまえてしようをみなおした。','이용자의 의견을 고려해 사양을 재검토했다.'),
('捗る','はかどる','진척되다|순조롭게 진행되다','仕事などが順調に進む。','五段動詞','作業環境を整えたことで開発が捗った。','さぎょうかんきょうをととのえたことでかいはつがはかどった。','작업 환경을 정비한 덕분에 개발이 순조롭게 진행됐다.'),
('赴く','おもむく','향하다|가다','ある場所へ向かって行く。','五段動詞','担当者は状況確認のため現場へ赴いた。','たんとうしゃはじょうきょうかくにんのためげんばへおもむいた。','담당자는 상황 확인을 위해 현장으로 향했다.'),
('見なす','みなす','간주하다|여기다','あるものを、特定の性質や状態のものとして扱う。','五段動詞','一定時間応答がなければ障害と見なす。','いっていじかんおうとうがなければしょうがいとみなす。','일정 시간 응답이 없으면 장애로 간주한다.'),
('掲げる','かかげる','내걸다|제시하다','人目につくように高く上げる。また、方針や目標などを示す。','一段動詞','会社は品質向上を今年の重点目標として掲げた。','かいしゃはひんしつこうじょうをことしのじゅうてんもくひょうとしてかかげた。','회사는 품질 향상을 올해의 중점 목표로 내걸었다.'),
('是正','ぜせい','시정|바로잡음','悪い点や不都合な点を改め、正しくすること。','サ変名詞','監査で指摘された問題を速やかに是正する。','かんさでしてきされたもんだいをすみやかにぜせいする。','감사에서 지적된 문제를 신속하게 시정한다.'),
('遂行','すいこう','수행|완수','仕事や任務を最後までやり遂げること。','サ変名詞','計画どおりに業務を遂行するため人員を調整した。','けいかくどおりにぎょうむをすいこうするためじんいんをちょうせいした。','계획대로 업무를 수행하기 위해 인원을 조정했다.'),
('遵守','じゅんしゅ','준수|지킴','法律、規則、約束などに従い守ること。','サ変名詞','個人情報を扱う際は社内規程を遵守しなければならない。','こじんじょうほうをあつかうさいはしゃないきていをじゅんしゅしなければならない。','개인정보를 다룰 때는 사내 규정을 준수해야 한다.');

-- 같은 word+reading이 없을 때만 신규 단어를 넣는다. word 인덱스를 이용한 20건의 소규모 탐색이다.
INSERT INTO japanese_words
(word, reading, meaning_ko, meaning_ja, jlpt_level_id, ai_status, note)
SELECT s.word, s.reading, s.meaning_ko, s.meaning_ja, l.id, 'reviewed',
       '2026-09-07 오늘의 학습 N1 신규 단어 검증 완료'
FROM _jlpt_20260907_words AS s
JOIN jlpt_levels AS l ON l.code = 'N1'
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_words AS w
  WHERE w.word = s.word
    AND COALESCE(w.reading, '') = s.reading
    AND w.deleted_at IS NULL
);

-- 기존 동일 단어가 있으면 행을 재사용하고 비어 있는 핵심 메타데이터만 채운다.
UPDATE japanese_words AS w
SET meaning_ko = CASE WHEN w.meaning_ko IS NULL OR trim(w.meaning_ko) = '' THEN
      (SELECT s.meaning_ko FROM _jlpt_20260907_words AS s WHERE s.word = w.word AND s.reading = COALESCE(w.reading, ''))
      ELSE w.meaning_ko END,
    meaning_ja = CASE WHEN w.meaning_ja IS NULL OR trim(w.meaning_ja) = '' THEN
      (SELECT s.meaning_ja FROM _jlpt_20260907_words AS s WHERE s.word = w.word AND s.reading = COALESCE(w.reading, ''))
      ELSE w.meaning_ja END,
    jlpt_level_id = COALESCE(w.jlpt_level_id, (SELECT id FROM jlpt_levels WHERE code = 'N1')),
    ai_status = CASE WHEN w.ai_status = 'not_analyzed' THEN 'reviewed' ELSE w.ai_status END,
    note = CASE WHEN w.note IS NULL OR trim(w.note) = '' THEN '2026-09-07 오늘의 학습 N1 신규 단어 검증 완료' ELSE w.note END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM _jlpt_20260907_words AS s
  WHERE s.word = w.word AND s.reading = COALESCE(w.reading, '')
);

-- 기존 품사 seed의 대/소분류를 이름으로 연결한다. 이미 대표 품사가 있으면 건드리지 않는다.
INSERT OR IGNORE INTO japanese_word_parts_of_speech
(word_id, part_of_speech_id, is_primary)
SELECT MIN(w.id), p.id, 1
FROM _jlpt_20260907_words AS s
JOIN japanese_words AS w
  ON w.word = s.word AND COALESCE(w.reading, '') = s.reading AND w.deleted_at IS NULL
JOIN parts_of_speech AS p
  ON p.name_ja = s.pos_name_ja AND p.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_word_parts_of_speech AS x
  WHERE x.word_id = w.id AND x.is_primary = 1
)
GROUP BY s.word, s.reading, p.id;

-- 같은 예문이 없는 경우만 검증한 예문/읽기/한국어 번역을 추가한다.
INSERT INTO japanese_word_examples
(word_id, sentence_ja, reading, translation_ko, note, source_type)
SELECT MIN(w.id), s.sentence_ja, s.example_reading, s.translation_ko,
       '2026-09-07 오늘의 학습 검증 예문', 'manual'
FROM _jlpt_20260907_words AS s
JOIN japanese_words AS w
  ON w.word = s.word AND COALESCE(w.reading, '') = s.reading AND w.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_word_examples AS e
  WHERE e.word_id = w.id AND e.sentence_ja = s.sentence_ja AND e.deleted_at IS NULL
)
GROUP BY s.word, s.reading, s.sentence_ja, s.example_reading, s.translation_ko;

-- 현재 일본어학습 category seed에는 이 20개를 일괄 귀속할 공통 어휘 category가 보장되지 않으므로
-- 임의 category를 생성/추정하지 않는다. 화면의 JLPT 구분은 japanese_words.jlpt_level_id=N1을 사용한다.
DROP TABLE _jlpt_20260907_words;
