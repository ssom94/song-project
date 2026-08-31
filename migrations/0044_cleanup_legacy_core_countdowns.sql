-- 0044_cleanup_legacy_core_countdowns.sql
-- JLPT/AP countdowns now use dashboard_goals as the single source of truth.
-- Remove only their legacy standalone D-Day rows, while preserving FP/AWS/portfolio rows.

UPDATE dashboard_goals
SET target_date = NULL,
    target_month = '2027-07',
    status = 'planned',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE goal_key = 'jlpt-n1';

UPDATE dashboard_goals
SET title = 'AP 科目A',
    target_date = NULL,
    target_month = '2027-02',
    status = 'planned',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE goal_key = 'ap';

-- These legacy rows duplicate the canonical JLPT/AP goals.
DELETE FROM dashboard_schedules
WHERE trim(title) IN (
    'JLPT N1',
    'AP',
    'AP 과목A',
    'AP 科目A'
);

-- Remove accidental custom JLPT/AP goals as well.
DELETE FROM dashboard_goals
WHERE goal_key LIKE 'custom-%'
  AND trim(title) IN (
    'JLPT N1',
    'AP',
    'AP 과목A',
    'AP 科目A'
  );
