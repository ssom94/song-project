-- 0061_study_content_integrity_checks.sql
-- Fail with a named CHECK constraint so the missing coverage is immediately identifiable.

CREATE TABLE _assert_jlpt_start (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_start_date_20260907 CHECK (ok = 1)
);
INSERT INTO _assert_jlpt_start(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM japanese_jlpt_study_plans
  WHERE plan_code='N1_2027_JUL' AND study_start_date='2026-09-07'
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_start;

CREATE TABLE _assert_jlpt_words (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_daily_words_20_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_words(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*)
    FROM japanese_jlpt_curriculum_words c
    JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND c.introduced_on=dates.d
  ) <> 20
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_words;

CREATE TABLE _assert_jlpt_vocab (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_vocab_questions_15_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_vocab(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='vocab_question'
  ) <> 15
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_vocab;

CREATE TABLE _assert_jlpt_grammar (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_grammar_2_and_questions_3_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_grammar(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='grammar'
  ) <> 2
  OR (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='grammar_question'
  ) <> 3
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_grammar;

CREATE TABLE _assert_jlpt_reading (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_reading_1_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_reading(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='reading'
  ) <> 1
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_reading;

CREATE TABLE _assert_ap_start (
  ok INTEGER NOT NULL,
  CONSTRAINT ap_start_date_20261001 CHECK (ok = 1)
);
INSERT INTO _assert_ap_start(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM ap_study_plans WHERE plan_code='AP_2026_H2' AND study_start_date='2026-10-01'
) THEN 1 ELSE 0 END;
DROP TABLE _assert_ap_start;

CREATE TABLE _assert_ap_reset (
  ok INTEGER NOT NULL,
  CONSTRAINT ap_old_progress_history_cleared CHECK (ok = 1)
);
INSERT INTO _assert_ap_reset(ok)
SELECT CASE WHEN
  NOT EXISTS (SELECT 1 FROM ap_topic_progress tp JOIN ap_study_plans p ON p.id=tp.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_daily_sessions s JOIN ap_study_plans p ON p.id=s.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_study_attempts a JOIN ap_study_plans p ON p.id=a.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_question_attempts a JOIN ap_study_plans p ON p.id=a.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_wrong_notes w JOIN ap_study_plans p ON p.id=w.plan_id WHERE p.plan_code='AP_2026_H2')
THEN 1 ELSE 0 END;
DROP TABLE _assert_ap_reset;

CREATE TABLE _assert_ap_week (
  ok INTEGER NOT NULL,
  CONSTRAINT ap_week_concept1_a10_b1_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-10-01'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-10-07'
)
INSERT INTO _assert_ap_week(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM ap_daily_contents x JOIN ap_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='AP_2026_H2' AND x.study_date=dates.d AND x.content_type='concept'
  ) <> 1
  OR (
    SELECT COUNT(*) FROM ap_daily_contents x JOIN ap_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='AP_2026_H2' AND x.study_date=dates.d AND x.content_type='subject_a_question'
  ) <> 10
  OR (
    SELECT COUNT(*) FROM ap_daily_contents x JOIN ap_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='AP_2026_H2' AND x.study_date=dates.d AND x.content_type='subject_b_scenario'
  ) <> 1
) THEN 1 ELSE 0 END;
DROP TABLE _assert_ap_week;
