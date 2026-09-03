-- 0069_jlpt_checkpoint_cadence_fix.sql
-- Canonical cadence is based on completed study days, not Sunday/month-end dates.
-- See data/curriculum/daily-generation-spec.json.
--
-- D1 cost rule: do not COUNT the session history on every completion. Maintain one
-- small per-plan counter and derive 7/30-day checkpoints from that value in O(1).

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_jlpt_schedule_weekly_test;
DROP TRIGGER IF EXISTS trg_jlpt_schedule_monthly_test;
DROP TRIGGER IF EXISTS trg_jlpt_schedule_cumulative_after_completion;
DROP TRIGGER IF EXISTS trg_jlpt_checkpoint_counter_after_completion;
DROP TRIGGER IF EXISTS trg_jlpt_checkpoint_counter_after_reopen;

CREATE TABLE IF NOT EXISTS japanese_jlpt_plan_progress_counters (
    plan_id INTEGER PRIMARY KEY,
    completed_study_days INTEGER NOT NULL DEFAULT 0 CHECK (completed_study_days >= 0),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE
);

-- One bounded bootstrap pass for plans that may already contain completed history.
-- This runs once at migration time, not once per day/session.
INSERT INTO japanese_jlpt_plan_progress_counters(plan_id, completed_study_days, updated_at)
SELECT p.id,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END), 0),
       strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM japanese_jlpt_study_plans AS p
LEFT JOIN japanese_jlpt_daily_sessions AS s ON s.plan_id = p.id
GROUP BY p.id
ON CONFLICT(plan_id) DO UPDATE SET
    completed_study_days = excluded.completed_study_days,
    updated_at = excluded.updated_at;

-- A cumulative test is created only when a real session becomes completed.
CREATE TRIGGER trg_jlpt_checkpoint_counter_after_completion
AFTER UPDATE OF status ON japanese_jlpt_daily_sessions
WHEN NEW.status = 'completed' AND OLD.status <> 'completed'
BEGIN
    INSERT OR IGNORE INTO japanese_jlpt_plan_progress_counters(plan_id, completed_study_days)
    VALUES(NEW.plan_id, 0);

    UPDATE japanese_jlpt_plan_progress_counters
    SET completed_study_days = completed_study_days + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE plan_id = NEW.plan_id;

    -- Every 7 completed study days: weekly cumulative test, 30 questions.
    INSERT OR IGNORE INTO japanese_jlpt_cumulative_tests
        (plan_id, admin_id, test_date, test_type, question_target, status)
    SELECT NEW.plan_id, p.admin_id, NEW.study_date, 'weekly', 30, 'not_started'
    FROM japanese_jlpt_study_plans AS p
    JOIN japanese_jlpt_plan_progress_counters AS c ON c.plan_id = p.id
    WHERE p.id = NEW.plan_id
      AND c.completed_study_days > 0
      AND c.completed_study_days % 7 = 0;

    -- Every 30 completed study days: monthly cumulative test, 100 questions.
    INSERT OR IGNORE INTO japanese_jlpt_cumulative_tests
        (plan_id, admin_id, test_date, test_type, question_target, status)
    SELECT NEW.plan_id, p.admin_id, NEW.study_date, 'monthly', 100, 'not_started'
    FROM japanese_jlpt_study_plans AS p
    JOIN japanese_jlpt_plan_progress_counters AS c ON c.plan_id = p.id
    WHERE p.id = NEW.plan_id
      AND c.completed_study_days > 0
      AND c.completed_study_days % 30 = 0;

    UPDATE japanese_jlpt_daily_sessions
    SET weekly_test_target = CASE WHEN (
            SELECT completed_study_days
            FROM japanese_jlpt_plan_progress_counters
            WHERE plan_id = NEW.plan_id
        ) % 7 = 0 THEN 30 ELSE 0 END,
        monthly_test_target = CASE WHEN (
            SELECT completed_study_days
            FROM japanese_jlpt_plan_progress_counters
            WHERE plan_id = NEW.plan_id
        ) % 30 = 0 THEN 100 ELSE 0 END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = NEW.id;
END;

-- Defensive correction if a completed session is ever reopened. Remove only an
-- untouched checkpoint that was created by that exact session date.
CREATE TRIGGER trg_jlpt_checkpoint_counter_after_reopen
AFTER UPDATE OF status ON japanese_jlpt_daily_sessions
WHEN OLD.status = 'completed' AND NEW.status <> 'completed'
BEGIN
    UPDATE japanese_jlpt_plan_progress_counters
    SET completed_study_days = MAX(completed_study_days - 1, 0),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE plan_id = NEW.plan_id;

    DELETE FROM japanese_jlpt_cumulative_tests
    WHERE plan_id = NEW.plan_id
      AND test_date = NEW.study_date
      AND status = 'not_started';

    UPDATE japanese_jlpt_daily_sessions
    SET weekly_test_target = 0,
        monthly_test_target = 0,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = NEW.id;
END;

-- No full-history assertion. Future transitions are constant-cost and the one-time
-- bootstrap above is the only history aggregation in this migration.
