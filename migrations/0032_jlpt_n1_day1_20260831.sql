-- 0032_jlpt_n1_day1_20260831.sql
-- JLPT N1 Day 1: 2026-08-31
-- 신규 단어 20개 + 어휘 15문제 + 문법 2개 + 독해 1개
-- 기존 단어가 있으면 중복 생성하지 않고 재사용한다.

PRAGMA foreign_keys = ON;

-- 활성 관리자별 기본 N1 학습 계획 생성. 이미 있으면 유지한다.
INSERT OR IGNORE INTO japanese_jlpt_study_plans (
    admin_id, plan_code, jlpt_level_code, study_start_date, target_exam_date,
    target_date_is_tentative, target_word_count, daily_new_word_target,
    vocab_question_target, grammar_target, reading_target, is_active
)
SELECT id, 'N1_2027_JUL', 'N1', '2026-08-31', '2027-07-04', 1, 3000, 20, 15, 2, 1, 1
FROM admins
WHERE status = 'active';

UPDATE japanese_jlpt_study_plans
SET study_start_date = '2026-08-31',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE plan_code = 'N1_2027_JUL';

-- Day 1 단어: 단어가 없을 때만 신규 등록한다.
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '遂げる', 'とげる', '이루다|달성하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '遂げる' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '滞る', 'とどこおる', '밀리다|정체되다|지체되다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '滞る' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '損なう', 'そこなう', '손상시키다|해치다|망치다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '損なう' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '著しい', 'いちじるしい', '현저하다|두드러지다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '著しい' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '促す', 'うながす', '재촉하다|촉구하다|촉진하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '促す' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '覆す', 'くつがえす', '뒤집다|번복하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '覆す' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '免れる', 'まぬがれる', '면하다|피하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '免れる' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '携わる', 'たずさわる', '종사하다|관여하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '携わる' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '廃れる', 'すたれる', '쇠퇴하다|유행이 지나가다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '廃れる' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '培う', 'つちかう', '기르다|배양하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '培う' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '阻む', 'はばむ', '가로막다|방해하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '阻む' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '強いる', 'しいる', '강요하다|억지로 시키다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '強いる' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '顧みる', 'かえりみる', '돌아보다|고려하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '顧みる' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '怠る', 'おこたる', '게을리하다|소홀히 하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '怠る' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '乏しい', 'とぼしい', '부족하다|빈약하다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '乏しい' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '紛らわしい', 'まぎらわしい', '헷갈리기 쉽다|혼동하기 쉽다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '紛らわしい' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '夥しい', 'おびただしい', '엄청나다|수많다', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '夥しい' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '円滑', 'えんかつ', '원활함|매끄러움', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '円滑' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '妥当', 'だとう', '타당함|적절함', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '妥当' AND deleted_at IS NULL);
INSERT INTO japanese_words (word, reading, meaning_ko, jlpt_level_id)
SELECT '懸念', 'けねん', '우려|걱정', id FROM jlpt_levels WHERE code = 'N1'
AND NOT EXISTS (SELECT 1 FROM japanese_words WHERE word = '懸念' AND deleted_at IS NULL);

-- JLPT 레벨이 비어 있는 기존 동일 단어는 N1로 보정한다. 다른 레벨이 이미 있으면 덮어쓰지 않는다.
UPDATE japanese_words
SET jlpt_level_id = (SELECT id FROM jlpt_levels WHERE code = 'N1'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE word IN ('遂げる','滞る','損なう','著しい','促す','覆す','免れる','携わる','廃れる','培う','阻む','強いる','顧みる','怠る','乏しい','紛らわしい','夥しい','円滑','妥当','懸念')
  AND deleted_at IS NULL
  AND jlpt_level_id IS NULL;

-- Day 1의 20개를 각 N1 플랜 커리큘럼에 순서대로 연결한다.
WITH day_words(word, ord) AS (
    VALUES
      ('遂げる',1),('滞る',2),('損なう',3),('著しい',4),('促す',5),
      ('覆す',6),('免れる',7),('携わる',8),('廃れる',9),('培う',10),
      ('阻む',11),('強いる',12),('顧みる',13),('怠る',14),('乏しい',15),
      ('紛らわしい',16),('夥しい',17),('円滑',18),('妥当',19),('懸念',20)
), targets AS (
    SELECT p.id AS plan_id, w.id AS word_id, d.ord
    FROM japanese_jlpt_study_plans p
    JOIN day_words d
    JOIN japanese_words w ON w.word = d.word AND w.deleted_at IS NULL
    WHERE p.plan_code = 'N1_2027_JUL'
      AND w.id = (SELECT MIN(w2.id) FROM japanese_words w2 WHERE w2.word = d.word AND w2.deleted_at IS NULL)
), bases AS (
    SELECT p.id AS plan_id, COALESCE(MAX(c.sort_order), 0) AS base_order
    FROM japanese_jlpt_study_plans p
    LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id = p.id
    WHERE p.plan_code = 'N1_2027_JUL'
    GROUP BY p.id
)
INSERT OR IGNORE INTO japanese_jlpt_curriculum_words (plan_id, word_id, sort_order, introduced_on)
SELECT t.plan_id, t.word_id, b.base_order + t.ord, '2026-08-31'
FROM targets t
JOIN bases b ON b.plan_id = t.plan_id;

-- 오늘 어휘 문제 15개
INSERT OR IGNORE INTO japanese_jlpt_daily_contents (plan_id, study_date, content_type, sequence_no, title, payload_json)
SELECT id, '2026-08-31', 'vocab_question', 1, '漢字読み 1', '{"question":"『遂げる』の読み方として最も適切なものはどれですか。","options":["とげる","すげる","さげる","つげる"],"answer":"とげる","explanation":"遂げる（とげる）＝ 목표나 일을 이루다."}' FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',2,'漢字読み 2','{"question":"『滞る』の読み方はどれですか。","options":["とどこおる","たむろする","こおる","さまたげる"],"answer":"とどこおる","explanation":"滞る（とどこおる）＝ 일이 밀리거나 흐름이 정체되다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',3,'漢字読み 3','{"question":"『培う』の読み方はどれですか。","options":["つちかう","うしなう","になう","まかなう"],"answer":"つちかう","explanation":"培う（つちかう）＝ 능력·관계 등을 오랜 시간 기르다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',4,'文脈規定 1','{"question":"長年の努力の末、彼はついに大きな目標を（　）。","options":["遂げた","滞った","阻んだ","免れた"],"answer":"遂げた","explanation":"目標を遂げる＝ 목표를 달성하다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',5,'文脈規定 2','{"question":"手続きが複雑なため、申請処理が（　）いる。","options":["滞って","培って","免れて","顧みて"],"answer":"滞って","explanation":"処理が滞る＝ 처리가 지연되다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',6,'文脈規定 3','{"question":"睡眠不足は集中力を（　）おそれがある。","options":["損なう","促す","培う","遂げる"],"answer":"損なう","explanation":"集中力を損なう＝ 집중력을 해치다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',7,'文脈規定 4','{"question":"新制度の導入によって、業務効率が（　）改善した。","options":["著しく","乏しく","紛らわしく","妥当に"],"answer":"著しく","explanation":"著しく改善する＝ 현저하게 개선되다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',8,'文脈規定 5','{"question":"担当者は利用者に早めの手続きを（　）。","options":["促した","覆した","阻んだ","怠った"],"answer":"促した","explanation":"行動を促す＝ 행동을 촉구하다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',9,'言い換え 1','{"question":"『その結果は従来の常識を覆した。』の『覆した』に最も近い意味はどれですか。","options":["逆転させた","維持した","育てた","避けた"],"answer":"逆転させた","explanation":"覆す＝ 기존 판단·결정 등을 뒤집다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',10,'言い換え 2','{"question":"『大きな事故を免れた。』の意味として最も近いものはどれですか。","options":["事故を避けることができた","事故を起こした","事故を調査した","事故を隠した"],"answer":"事故を避けることができた","explanation":"免れる＝ 좋지 않은 일에서 벗어나다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',11,'言い換え 3','{"question":"『開発に携わる』に最も近い表現はどれですか。","options":["開発に関わる","開発を妨げる","開発を避ける","開発を諦める"],"answer":"開発に関わる","explanation":"携わる＝ 어떤 일에 관계하여 종사하다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',12,'用法 1','{"question":"『円滑』の使い方として最も自然なものはどれですか。","options":["会議を円滑に進める","雨が円滑に降る","料理が円滑に甘い","駅が円滑に遠い"],"answer":"会議を円滑に進める","explanation":"円滑＝ 일이나 관계가 막힘없이 순조로운 상태."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',13,'用法 2','{"question":"『懸念』の使い方として最も自然なものはどれですか。","options":["安全面への懸念が残る","懸念を速く走る","懸念を食べる","空が懸念になる"],"answer":"安全面への懸念が残る","explanation":"懸念＝ 걱정스럽게 생각하는 점, 우려."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',14,'用法 3','{"question":"『強いる』の使い方として最も自然なものはどれですか。","options":["相手に無理な選択を強いる","花に水を強いる","景色を強いる","駅まで強いる"],"answer":"相手に無理な選択を強いる","explanation":"強いる＝ 상대에게 원치 않는 행동을 강요하다."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','vocab_question',15,'用法 4','{"question":"『妥当』の使い方として最も自然なものはどれですか。","options":["その判断は妥当だ","妥当な雨が降る","料理を妥当に食べる","妥当に眠い"],"answer":"その判断は妥当だ","explanation":"妥当＝ 상황에 잘 맞아 타당하고 적절함."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';

-- 오늘 문법 2개
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','grammar',1,'〜に至るまで','{"pattern":"〜に至るまで","meaningKo":"~에 이르기까지, ~까지도","explanation":"범위가 매우 넓거나 예상 밖의 곳까지 미친다는 점을 강조할 때 사용한다.","examples":[{"ja":"企画から運用に至るまで、彼は一貫してプロジェクトに携わった。","ko":"기획부터 운영에 이르기까지 그는 일관되게 프로젝트에 관여했다."},{"ja":"細部に至るまで十分な検討が必要だ。","ko":"세부에 이르기까지 충분한 검토가 필요하다."}]}' ,NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','grammar',2,'〜をものともせず','{"pattern":"〜をものともせず","meaningKo":"~을 아랑곳하지 않고","explanation":"어려움이나 장애를 문제 삼지 않고 행동하는 모습을 나타낸다.","examples":[{"ja":"多くの困難をものともせず、研究チームは目標を遂げた。","ko":"많은 어려움을 아랑곳하지 않고 연구팀은 목표를 달성했다."},{"ja":"周囲の懸念をものともせず、新しい挑戦を続けた。","ko":"주변의 우려를 아랑곳하지 않고 새로운 도전을 계속했다."}]}' ,NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';

-- 문법 확인 문제
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','grammar_question',1,'文法問題 1','{"question":"この資料は概要だけでなく、細かな注意事項（　）詳しく説明されている。","options":["に至るまで","をものともせず","にかかわらず","に先立って"],"answer":"に至るまで","explanation":"세세한 주의사항까지 범위가 미친다는 의미."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','grammar_question',2,'文法問題 2','{"question":"彼は周囲の反対（　）、計画を最後まで進めた。","options":["をものともせず","に至るまで","を皮切りに","に即して"],"answer":"をものともせず","explanation":"반대를 아랑곳하지 않았다는 의미."}',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';

-- 오늘 독해 1개
INSERT OR IGNORE INTO japanese_jlpt_daily_contents SELECT NULL,id,'2026-08-31','reading',1,'短文読解 Day 1','{"passage":"新しい制度を導入する際、効率だけを追求すると、利用者の理解を損なう懸念がある。特に、変更の目的や影響について十分な説明を怠れば、現場の協力を得ることは難しい。一方で、すべての反対意見を恐れて改善を滞らせるのも妥当ではない。重要なのは、関係者との対話を円滑に進めながら、必要な変更を段階的に促すことである。そうした過程を通じて培われた信頼が、最終的には組織の大きな成長を遂げる基盤となる。","questions":[{"question":"筆者が最も重要だと考えていることは何ですか。","options":["効率だけを最優先すること","反対意見があれば変更を中止すること","対話を続けながら必要な変更を進めること","制度の説明をできるだけ減らすこと"],"answer":"対話を続けながら必要な変更を進めること","explanation":"마지막 두 문장에서 필자의 핵심 주장이 제시된다."},{"question":"本文の内容と合っているものはどれですか。","options":["説明不足は利用者の理解を損なう可能性がある","改善は常に一度に実施すべきだ","反対意見はすべて無視すべきだ","信頼は組織の成長とは関係がない"],"answer":"説明不足は利用者の理解を損なう可能性がある","explanation":"첫 문단의 내용과 일치한다."}]}' ,NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL';
