-- 0066_daily_study_generation_gate_20260907.sql
-- The combined "daily study" workflow starts on 2026-09-07.
-- Remove accidental AP prestart rows created for 2026-09-02 through 2026-09-06.
-- Date predicates use the existing plan/date indexes and remain safe to run repeatedly.

PRAGMA foreign_keys = ON;

DELETE FROM ap_daily_contents
WHERE plan_id IN (
  SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2'
)
AND study_date BETWEEN '2026-09-02' AND '2026-09-06';

-- ap_daily_items and ap_study_attempts are removed by the session's ON DELETE CASCADE.
DELETE FROM ap_daily_sessions
WHERE plan_id IN (
  SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2'
)
AND study_date BETWEEN '2026-09-02' AND '2026-09-06';
