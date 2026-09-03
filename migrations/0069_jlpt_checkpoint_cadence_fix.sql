-- 0069_jlpt_checkpoint_cadence_fix.sql
-- Canonical cadence is based on completed study days, not Sunday/month-end dates.
-- See data/curriculum/daily-generation-spec.json.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_jlpt_schedule_weekly_test;
DROP TRIGGER IF EXISTS trg_jlpt_schedule_monthly_test;
DROP TRIGGER IF EXISTS trg_jlpt_schedule_cumulative_after_completion;

-- A cumulative test is created only when a real session becomes completed.
-- The completed-session count is bounded by one plan and uses the existing
-- (plan_id, study_date) session index; no curriculum/stat table scan is needed.
CREATE TRIGGER trg_jlpt_schedule_cumulative_after_completion
AFTER UPDATE OF status ON japanese_jlpt_daily_sessions
WHEN NEW.status = 'completed' AND OLD.status <> 'completed'
BEGIN
    -- Every 7 completed study days: weekly cumulative test, 30 questions.
    INSERT OR IGNORE INTO japanese_jlpt_cumulative_tests
        (plan_id, admin_id, test_date, test_type, question_target, status)
    SELECT
        NEW.plan_id,
        p.admin_id,
        NEW.study_date,
        'weekly',
        30,
        'not_started'
    FROM japanese_jlpt_study_plans AS p
    WHERE p.id = NEW.plan_id
      AND (
          SELECT COUNT(*)
          FROM japanese_jlpt_daily_sessions AS s
          WHERE s.plan_id = NEW.plan_id
            AND s.status = 'completed'
            AND s.study_date <= NEW.study_date
      ) % 7 = 0;

    -- Every 30 completed study days: monthly cumulative test, 100 questions.
    INSERT OR IGNORE INTO japanese_jlpt_cumulative_tests
        (plan_id, admin_id, test_date, test_type, question_target, status)
    SELECT
        NEW.plan_id,
        p.admin_id,
        NEW.study_date,
        'monthly',
        100,
        'not_started'
    FROM japanese_jlpt_study_plans AS p
    WHERE p.id = NEW.plan_id
      AND (
          SELECT COUNT(*)
          FROM japanese_jlpt_daily_sessions AS s
          WHERE s.plan_id = NEW.plan_id
            AND s.status = 'completed'
            AND s.study_date <= NEW.study_date
      ) % 30 = 0;

    UPDATE japanese_jlpt_daily_sessions
    SET weekly_test_target = CASE
            WHEN (
                SELECT COUNT(*)
                FROM japanese_jlpt_daily_sessions AS s
                WHERE s.plan_id = NEW.plan_id
                  AND s.status = 'completed'
                  AND s.study_date <= NEW.study_date
            ) % 7 = 0 THEN 30 ELSE 0 END,
        monthly_test_target = CASE
            WHEN (
                SELECT COUNT(*)
                FROM japanese_jlpt_daily_sessions AS s
                WHERE s.plan_id = NEW.plan_id
                  AND s.status = 'completed'
                  AND s.study_date <= NEW.study_date
            ) % 30 = 0 THEN 100 ELSE 0 END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = NEW.id;
END;

-- Intentionally no full-history assertion: this migration affects future state
-- transitions only. It does not retroactively create tests for legacy sessions.
