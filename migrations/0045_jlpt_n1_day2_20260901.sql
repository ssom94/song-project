-- 0045_jlpt_n1_day2_20260901.sql
-- JLPT N1 Day 2: 2026-09-01
-- 신규 단어 20개 + 어휘 15문제 + 문법 2개/확인문제 2개 + 독해 1개
-- 기존 japanese_words와 커리큘럼 중복은 생성하지 않는다.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO japanese_jlpt_study_plans (
    admin_id, plan_code, jlpt_level_code, study_start_date, target_exam_date,
    target_date_is_tentative, target_word_count, daily_new_word_target,
    vocab_question_target, grammar_target, reading_target, is_active
)
SELECT id, 'N1_2027_JUL', 'N1', '2026-08-31', '2027-07-04', 1, 3000, 20, 15, 2, 1, 1
FROM admins
WHERE status = 'active';

WITH day_words(word, reading, meaning_ko) AS (
    VALUES
      ('概ね','おおむね','대체로|대강'),
      ('補う','おぎなう','보충하다|메우다'),
      ('把握','はあく','파악|파악하다'),
      ('衰える','おとろえる','쇠하다|약해지다'),
      ('見据える','みすえる','내다보다|응시하다'),
      ('顕著','けんちょ','현저함|두드러짐'),
      ('柔軟','じゅうなん','유연함|융통성 있음'),
      ('慎重','しんちょう','신중함|조심스러움'),
      ('維持','いじ','유지|유지하다'),
      ('逸脱','いつだつ','일탈|벗어남'),
      ('膨大','ぼうだい','방대함|막대함'),
      ('挙げる','あげる','들다|예로 들다'),
      ('踏まえる','ふまえる','근거로 삼다|고려하다'),
      ('捗る','はかどる','진척되다|순조롭게 진행되다'),
      ('赴く','おもむく','향하다|가다'),
      ('見なす','みなす','간주하다|여기다'),
      ('掲げる','かかげる','내걸다|제시하다'),
      ('是正','ぜせい','시정|바로잡음'),
      ('遂行','すいこう','수행|완수'),
      ('遵守','じゅんしゅ','준수|지킴')
)
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT d.word, d.reading, d.meaning_ko, l.id
FROM day_words d
JOIN jlpt_levels l ON l.code = 'N1'
WHERE NOT EXISTS (
    SELECT 1 FROM japanese_words w WHERE w.word = d.word AND w.deleted_at IS NULL
);

UPDATE japanese_words
SET jlpt_level_id = (SELECT id FROM jlpt_levels WHERE code = 'N1'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE word IN ('概ね','補う','把握','衰える','見据える','顕著','柔軟','慎重','維持','逸脱','膨大','挙げる','踏まえる','捗る','赴く','見なす','掲げる','是正','遂行','遵守')
  AND deleted_at IS NULL
  AND jlpt_level_id IS NULL;

WITH day_words(word, ord) AS (
    VALUES
      ('概ね',1),('補う',2),('把握',3),('衰える',4),('見据える',5),
      ('顕著',6),('柔軟',7),('慎重',8),('維持',9),('逸脱',10),
      ('膨大',11),('挙げる',12),('踏まえる',13),('捗る',14),('赴く',15),
      ('見なす',16),('掲げる',17),('是正',18),('遂行',19),('遵守',20)
), targets AS (
    SELECT p.id AS plan_id, w.id AS word_id, d.ord
    FROM japanese_jlpt_study_plans p
    JOIN day_words d
    JOIN japanese_words w
      ON w.word = d.word
     AND w.deleted_at IS NULL
     AND w.id = (SELECT MIN(w2.id) FROM japanese_words w2 WHERE w2.word = d.word AND w2.deleted_at IS NULL)
    WHERE p.plan_code = 'N1_2027_JUL'
), bases AS (
    SELECT p.id AS plan_id, COALESCE(MAX(c.sort_order), 0) AS base_order
    FROM japanese_jlpt_study_plans p
    LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id = p.id
    WHERE p.plan_code = 'N1_2027_JUL'
    GROUP BY p.id
)
INSERT OR IGNORE INTO japanese_jlpt_curriculum_words (plan_id, word_id, sort_order, introduced_on)
SELECT t.plan_id, t.word_id, b.base_order + t.ord, '2026-09-01'
FROM targets t
JOIN bases b ON b.plan_id = t.plan_id;

WITH details(word, pos_name) AS (
    VALUES
      ('概ね','副詞'),('補う','五段動詞'),('把握','サ変名詞'),('衰える','一段動詞'),('見据える','一段動詞'),
      ('顕著','な形容詞'),('柔軟','な形容詞'),('慎重','な形容詞'),('維持','サ変名詞'),('逸脱','サ変名詞'),
      ('膨大','な形容詞'),('挙げる','一段動詞'),('踏まえる','一段動詞'),('捗る','五段動詞'),('赴く','五段動詞'),
      ('見なす','五段動詞'),('掲げる','一段動詞'),('是正','サ変名詞'),('遂行','サ変名詞'),('遵守','サ変名詞')
)
INSERT OR IGNORE INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
SELECT
    w.id,
    p.id,
    CASE WHEN EXISTS (
        SELECT 1 FROM japanese_word_parts_of_speech existing
        WHERE existing.word_id = w.id AND existing.is_primary = 1
    ) THEN 0 ELSE 1 END,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM details d
JOIN japanese_words w
  ON w.word = d.word AND w.deleted_at IS NULL
 AND w.id = (SELECT MIN(w2.id) FROM japanese_words w2 WHERE w2.word = d.word AND w2.deleted_at IS NULL)
JOIN parts_of_speech p ON p.name_ja = d.pos_name AND p.deleted_at IS NULL;

WITH examples(word, sentence_ja, reading, translation_ko) AS (
    VALUES
      ('概ね','計画は概ね予定どおりに進んでいる。','けいかくはおおむねよていどおりにすすんでいる。','계획은 대체로 예정대로 진행되고 있다.'),
      ('補う','不足している知識は実務経験で補う必要がある。','ふそくしているちしきはじつむけいけんでおぎなうひつようがある。','부족한 지식은 실무 경험으로 보충할 필요가 있다.'),
      ('把握','障害の影響範囲を正確に把握する。','しょうがいのえいきょうはんいをせいかくにはあくする。','장애의 영향 범위를 정확하게 파악한다.'),
      ('衰える','使わない能力は徐々に衰えていく。','つかわないのうりょくはじょじょにおとろえていく。','사용하지 않는 능력은 서서히 쇠퇴해 간다.'),
      ('見据える','将来の運用を見据えてシステムを設計する。','しょうらいのうんようをみすえてシステムをせっけいする。','향후 운영을 내다보고 시스템을 설계한다.'),
      ('顕著','改善後は処理時間の短縮が顕著に表れた。','かいぜんごはしょりじかんのたんしゅくがけんちょにあらわれた。','개선 후에는 처리 시간 단축이 두드러지게 나타났다.'),
      ('柔軟','状況の変化に柔軟に対応することが求められる。','じょうきょうのへんかにじゅうなんにたいおうすることがもとめられる。','상황 변화에 유연하게 대응하는 것이 요구된다.'),
      ('慎重','本番環境の設定変更は慎重に行うべきだ。','ほんばんかんきょうのせっていへんこうはしんちょうにおこなうべきだ。','운영 환경의 설정 변경은 신중하게 해야 한다.'),
      ('維持','サービス品質を維持するために監視を続ける。','サービスひんしつをいじするためにかんしをつづける。','서비스 품질을 유지하기 위해 모니터링을 계속한다.'),
      ('逸脱','手順から逸脱した作業は事故につながる可能性がある。','てじゅんからいつだつしたさぎょうはじこにつながるかのうせいがある。','절차에서 벗어난 작업은 사고로 이어질 가능성이 있다.'),
      ('膨大','膨大なログから原因を特定しなければならない。','ぼうだいなログからげんいんをとくていしなければならない。','방대한 로그에서 원인을 특정해야 한다.'),
      ('挙げる','問題点として三つの原因を挙げた。','もんだいてんとしてみっつのげんいんをあげた。','문제점으로 세 가지 원인을 들었다.'),
      ('踏まえる','利用者の意見を踏まえて仕様を見直した。','りようしゃのいけんをふまえてしようをみなおした。','이용자의 의견을 고려해 사양을 재검토했다.'),
      ('捗る','作業環境を整えたことで開発が捗った。','さぎょうかんきょうをととのえたことでかいはつがはかどった。','작업 환경을 정비한 덕분에 개발이 순조롭게 진행됐다.'),
      ('赴く','担当者は状況確認のため現場へ赴いた。','たんとうしゃはじょうきょうかくにんのためげんばへおもむいた。','담당자는 상황 확인을 위해 현장으로 향했다.'),
      ('見なす','一定時間応答がなければ障害と見なす。','いっていじかんおうとうがなければしょうがいとみなす。','일정 시간 응답이 없으면 장애로 간주한다.'),
      ('掲げる','会社は品質向上を今年の重点目標として掲げた。','かいしゃはひんしつこうじょうをことしのじゅうてんもくひょうとしてかかげた。','회사는 품질 향상을 올해의 중점 목표로 내걸었다.'),
      ('是正','監査で指摘された問題を速やかに是正する。','かんさでしてきされたもんだいをすみやかにぜせいする。','감사에서 지적된 문제를 신속하게 시정한다.'),
      ('遂行','計画どおりに業務を遂行するため人員を調整した。','けいかくどおりにぎょうむをすいこうするためじんいんをちょうせいした。','계획대로 업무를 수행하기 위해 인원을 조정했다.'),
      ('遵守','個人情報を扱う際は社内規程を遵守しなければならない。','こじんじょうほうをあつかうさいはしゃないきていをじゅんしゅしなければならない。','개인정보를 다룰 때는 사내 규정을 준수해야 한다.')
)
INSERT INTO japanese_word_examples (word_id, sentence_ja, reading, translation_ko, source_type, created_at, updated_at)
SELECT w.id, e.sentence_ja, e.reading, e.translation_ko, 'manual',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM examples e
JOIN japanese_words w
  ON w.word = e.word AND w.deleted_at IS NULL
 AND w.id = (SELECT MIN(w2.id) FROM japanese_words w2 WHERE w2.word = e.word AND w2.deleted_at IS NULL)
WHERE NOT EXISTS (
    SELECT 1 FROM japanese_word_examples x
    WHERE x.word_id = w.id AND x.sentence_ja = e.sentence_ja AND x.deleted_at IS NULL
);

-- 어휘 15문제
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',1,'漢字読み 1','{"question":"『概ね』の読み方として最も適切なものはどれですか。","options":["おおむね","がいね","おおかた","おもむね"],"answer":"おおむね","explanation":"概ね（おおむね）＝ 대체로, 대강."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',2,'漢字読み 2','{"question":"『捗る』の読み方として最も適切なものはどれですか。","options":["はかどる","たどる","はかる","かたどる"],"answer":"はかどる","explanation":"捗る（はかどる）＝ 일이 순조롭게 진척되다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',3,'漢字読み 3','{"question":"『遵守』の読み方として最も適切なものはどれですか。","options":["じゅんしゅ","そんしゅ","じゅんじゅ","そんじゅ"],"answer":"じゅんしゅ","explanation":"遵守（じゅんしゅ）＝ 규칙이나 법을 준수함."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',4,'文脈規定 1','{"question":"不足している人員を外部委託で（　）ことにした。","options":["補う","衰える","逸脱する","赴く"],"answer":"補う","explanation":"不足分を補う＝ 부족한 부분을 보충하다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',5,'文脈規定 2','{"question":"まず障害がどの利用者に影響しているかを正確に（　）必要がある。","options":["把握する","掲げる","衰える","赴く"],"answer":"把握する","explanation":"状況・範囲を把握する＝ 상황·범위를 파악하다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',6,'文脈規定 3','{"question":"将来の利用者増加を（　）、余裕のある構成を採用した。","options":["見据えて","見なして","挙げて","逸脱して"],"answer":"見据えて","explanation":"将来を見据える＝ 장래를 내다보다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',7,'文脈規定 4','{"question":"新しい仕組みを導入してから、処理速度の改善が（　）になった。","options":["顕著","柔軟","慎重","概ね"],"answer":"顕著","explanation":"顕著になる＝ 변화나 특징이 뚜렷하게 나타나다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',8,'文脈規定 5','{"question":"承認された手順から（　）した作業を行ってはいけない。","options":["逸脱","維持","遂行","是正"],"answer":"逸脱","explanation":"手順から逸脱する＝ 절차에서 벗어나다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',9,'文脈規定 6','{"question":"システムから出力された（　）な量のログを分析した。","options":["膨大","柔軟","慎重","顕著"],"answer":"膨大","explanation":"膨大な量＝ 매우 많고 방대한 양."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',10,'文脈規定 7','{"question":"利用者から集めた意見を（　）て、画面設計を見直した。","options":["踏まえ","掲げ","赴い","衰え"],"answer":"踏まえ","explanation":"意見を踏まえる＝ 의견을 근거·고려 대상으로 삼다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',11,'文脈規定 8','{"question":"監視サーバから5分以上応答がなければ、障害が発生したものと（　）。","options":["見なす","見据える","挙げる","補う"],"answer":"見なす","explanation":"〜と見なす＝ ~로 간주하다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',12,'文脈規定 9','{"question":"監査で指摘されたアクセス権の設定不備を早急に（　）した。","options":["是正","維持","遂行","把握"],"answer":"是正","explanation":"問題・不備を是正する＝ 잘못된 상태를 바로잡다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',13,'意味用法 1','{"question":"『遂行する』と最も意味が近いものはどれですか。","options":["計画した仕事を最後まで実行する","規則から外れる","不足分を追加する","現場へ向かう"],"answer":"計画した仕事を最後まで実行する","explanation":"遂行＝ 맡은 일이나 계획을 끝까지 수행함."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',14,'意味用法 2','{"question":"『掲げる』の使い方として最も適切なものはどれですか。","options":["会社は品質向上を重点目標として掲げた。","疲労で体力が掲げた。","不足分を掲げて補った。","作業が順調に掲げている。"],"answer":"会社は品質向上を重点目標として掲げた。","explanation":"目標・方針・旗などを掲げる＝ 내걸다, 제시하다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','vocab_question',15,'意味用法 3','{"question":"『赴く』の使い方として最も適切なものはどれですか。","options":["担当者が状況確認のため現場へ赴いた。","計画が予定どおり赴いた。","不足を経験で赴いた。","規則を赴いて作業した。"],"answer":"担当者が状況確認のため現場へ赴いた。","explanation":"場所へ赴く＝ 어떤 목적을 가지고 그 장소로 가다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';

-- 문법 2개 + 확인문제
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','grammar',1,'〜いかんにかかわらず','{"pattern":"〜いかんにかかわらず","meaningKo":"~여하에 관계없이 / ~에 상관없이","usageKo":"명사 + の + いかんにかかわらず. 사정이나 결과가 어떻든 뒤의 사실·방침은 변하지 않음을 나타낸다.","example":"理由のいかんにかかわらず、無断で個人情報を持ち出してはならない。","translationKo":"이유 여하에 관계없이 무단으로 개인정보를 반출해서는 안 된다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','grammar',2,'〜ずくめ','{"pattern":"〜ずくめ","meaningKo":"온통 ~뿐 / 전부 ~인 상태","usageKo":"명사 + ずくめ. 같은 성질의 것만 계속되거나 온통 그것으로 채워진 상태를 나타낸다.","example":"今回の出張は予定どおりに進み、いいことずくめだった。","translationKo":"이번 출장은 예정대로 진행되어 좋은 일뿐이었다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','grammar_question',1,'文法確認 1','{"question":"経験年数の（　）、応募者全員に同じ試験を実施する。","options":["いかんにかかわらず","ずくめで","そばから","にひきかえ"],"answer":"いかんにかかわらず","explanation":"경력 연수가 어떻든 동일한 시험을 실시한다는 의미."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','grammar_question',2,'文法確認 2','{"question":"昇進も決まり、資格試験にも合格し、今年はいいこと（　）だ。","options":["ずくめ","いかん","まみれ","ながら"],"answer":"ずくめ","explanation":"いいことずくめ＝ 좋은 일만 가득함."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';

-- 독해 1개: Day 2 포커스 = 접속 관계
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id,'2026-09-01','reading',1,'効率化と確認作業','{"passage":"業務を効率化するために自動化を進める企業は多い。定型作業をシステムに任せれば、人はより重要な判断に時間を使えるからだ。しかし、自動化すれば確認が不要になるわけではない。処理件数が増えるほど、一つの設定ミスが広い範囲に影響する可能性も高まる。一方、すべてを人が確認すれば、自動化によって得られるはずの効率が失われる。したがって重要なのは、確認作業をなくすことではなく、影響の大きい箇所を特定し、そこに確認を集中させることである。","questions":[{"question":"本文の『しかし』は、何と何を対比していますか。","options":["自動化による効率化と、自動化後も確認が必要であること","定型作業と重要な判断","企業と利用者","設定ミスと処理件数"],"answer":"自動化による効率化と、自動化後も確認が必要であること","explanation":"앞부분은 자동화의 장점, しかし 이후는 자동화해도 확인이 필요하다는 제한을 제시한다."},{"question":"筆者によると、すべてを人が確認することの問題点は何ですか。","options":["自動化による効率が失われること","設定ミスが必ず増えること","重要な判断ができなくなること","処理件数が減らなくなること"],"answer":"自動化による効率が失われること","explanation":"본문에 모든 것을 사람이 확인하면 자동화로 얻을 효율이 사라진다고 명시되어 있다."},{"question":"筆者が最も言いたいことは何ですか。","options":["影響の大きい箇所を見極めて確認を集中させるべきだ","自動化した業務は人が確認すべきではない","定型作業はすべて手作業に戻すべきだ","処理件数を減らすことが最優先だ"],"answer":"影響の大きい箇所を見極めて確認を集中させるべきだ","explanation":"最後の『したがって』以下が筆者の結論이다."}]}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
