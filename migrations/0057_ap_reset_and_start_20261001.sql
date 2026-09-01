-- 0057_ap_reset_and_start_20261001.sql
-- Reset only AP study/progress history, preserve AP concept/question library, and restart daily study on 2026-10-01.
PRAGMA foreign_keys = ON;

DELETE FROM ap_wrong_notes
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2');

DELETE FROM ap_question_attempts
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2');

DELETE FROM ap_study_attempts
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2');

DELETE FROM ap_daily_items
WHERE session_id IN (
  SELECT s.id
  FROM ap_daily_sessions s
  JOIN ap_study_plans p ON p.id = s.plan_id
  WHERE p.plan_code = 'AP_2026_H2'
);

DELETE FROM ap_daily_sessions
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2');

DELETE FROM ap_daily_contents
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2');

DELETE FROM ap_topic_progress
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code = 'AP_2026_H2');

UPDATE ap_study_plans
SET study_start_date = '2026-10-01',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE plan_code = 'AP_2026_H2';
