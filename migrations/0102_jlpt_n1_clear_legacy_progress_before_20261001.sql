-- Remove the superseded JLPT N1 study run before the curated 2026-10-01 start.
-- The scope is deliberately limited to N1_2027_JUL and dates before 2026-10-01.
-- AP data, other JLPT plans, and the curated October/November batches are untouched.
DROP TABLE IF EXISTS _n1_legacy_words_0102;
CREATE TABLE _n1_legacy_words_0102 (
  admin_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  PRIMARY KEY (admin_id, word_id)
);

INSERT OR IGNORE INTO _n1_legacy_words_0102(admin_id, word_id)
SELECT p.admin_id, dw.word_id
FROM japanese_jlpt_study_plans AS p
JOIN japanese_jlpt_daily_sessions AS s ON s.plan_id = p.id
JOIN japanese_jlpt_daily_words AS dw ON dw.session_id = s.id
WHERE p.plan_code = 'N1_2027_JUL'
  AND s.study_date < '2026-10-01';

UPDATE japanese_admin_word_learning_stats
SET learning_state = 'unlearned',
    correct_count = 0,
    wrong_count = 0,
    last_answered_at = NULL,
    last_correct_at = NULL,
    last_wrong_at = NULL,
    first_learned_at = NULL,
    last_studied_at = NULL,
    review_stage = 0,
    next_review_on = NULL,
    long_review_stage = 0,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE (admin_id, word_id) IN (
  SELECT admin_id, word_id FROM _n1_legacy_words_0102
);

DELETE FROM japanese_jlpt_question_attempts
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code = 'N1_2027_JUL'
)
  AND study_date < '2026-10-01';

DELETE FROM japanese_jlpt_wrong_notes
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code = 'N1_2027_JUL'
)
  AND study_date < '2026-10-01';

DELETE FROM japanese_jlpt_cumulative_tests
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code = 'N1_2027_JUL'
)
  AND test_date < '2026-10-01';

DELETE FROM japanese_jlpt_daily_words
WHERE session_id IN (
  SELECT s.id
  FROM japanese_jlpt_daily_sessions AS s
  JOIN japanese_jlpt_study_plans AS p ON p.id = s.plan_id
  WHERE p.plan_code = 'N1_2027_JUL'
    AND s.study_date < '2026-10-01'
);

DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code = 'N1_2027_JUL'
)
  AND study_date < '2026-10-01';

DELETE FROM japanese_jlpt_daily_sessions
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code = 'N1_2027_JUL'
)
  AND study_date < '2026-10-01';

UPDATE japanese_jlpt_plan_progress_counters
SET completed_study_days = 0,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code = 'N1_2027_JUL'
);

UPDATE japanese_jlpt_study_plans
SET study_start_date = '2026-10-01',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE plan_code = 'N1_2027_JUL';

DROP TABLE _n1_legacy_words_0102;
