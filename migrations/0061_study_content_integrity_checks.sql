-- 0061_study_content_integrity_checks.sql
-- Fail migration application if the requested restart/content coverage is incomplete.
PRAGMA foreign_keys = ON;

CREATE TABLE _study_content_assert_0061 (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

-- JLPT: every day 9/7-9/30 must have 20 words, 15 vocab questions,
-- 2 grammar points, 3 grammar questions and 1 reading set.
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d < '2026-09-30'
), plan AS (
  SELECT id,study_start_date FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' LIMIT 1
), daily AS (
  SELECT dates.d,
    (SELECT COUNT(*) FROM japanese_jlpt_curriculum_words c JOIN plan p ON p.id=c.plan_id WHERE c.introduced_on=dates.d) AS word_count,
    (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='vocab_question') AS vocab_count,
    (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='grammar') AS grammar_count,
    (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='grammar_question') AS grammar_q_count,
    (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='reading') AS reading_count
  FROM dates
)
INSERT INTO _study_content_assert_0061(ok)
SELECT CASE WHEN
  (SELECT study_start_date FROM plan)='2026-09-07'
  AND NOT EXISTS (
    SELECT 1 FROM daily
    WHERE word_count<>20 OR vocab_count<>15 OR grammar_count<>2 OR grammar_q_count<>3 OR reading_count<>1
  )
THEN 1 ELSE 0 END;

DELETE FROM _study_content_assert_0061;

-- AP: reset date must be 10/1; old progress/history must be gone;
-- each first-week day must contain concept + 10 科目A + 1 科目B set.
WITH RECURSIVE dates(d) AS (
  SELECT '2026-10-01'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d < '2026-10-07'
), plan AS (
  SELECT id,study_start_date FROM ap_study_plans WHERE plan_code='AP_2026_H2' LIMIT 1
), daily AS (
  SELECT dates.d,
    (SELECT COUNT(*) FROM ap_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='concept') AS concept_count,
    (SELECT COUNT(*) FROM ap_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='subject_a_question') AS a_count,
    (SELECT COUNT(*) FROM ap_daily_contents x JOIN plan p ON p.id=x.plan_id WHERE x.study_date=dates.d AND x.content_type='subject_b_scenario') AS b_count
  FROM dates
)
INSERT INTO _study_content_assert_0061(ok)
SELECT CASE WHEN
  (SELECT study_start_date FROM plan)='2026-10-01'
  AND NOT EXISTS (SELECT 1 FROM ap_topic_progress WHERE plan_id=(SELECT id FROM plan))
  AND NOT EXISTS (SELECT 1 FROM ap_daily_sessions WHERE plan_id=(SELECT id FROM plan))
  AND NOT EXISTS (SELECT 1 FROM ap_study_attempts WHERE plan_id=(SELECT id FROM plan))
  AND NOT EXISTS (SELECT 1 FROM ap_question_attempts WHERE plan_id=(SELECT id FROM plan))
  AND NOT EXISTS (SELECT 1 FROM ap_wrong_notes WHERE plan_id=(SELECT id FROM plan))
  AND NOT EXISTS (SELECT 1 FROM daily WHERE concept_count<>1 OR a_count<>10 OR b_count<>1)
THEN 1 ELSE 0 END;

DROP TABLE _study_content_assert_0061;
