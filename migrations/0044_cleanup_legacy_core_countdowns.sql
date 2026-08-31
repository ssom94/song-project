-- 0044_cleanup_legacy_core_countdowns.sql
-- Core certification goals are now the single source of truth for home D-Day.
-- Remove legacy schedule/custom-goal duplicates left from the previous D-Day model.

-- Re-assert the intended month-only targets in case an older certification sync
-- previously displayed/stored an obsolete exact date in the UI.
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

-- These rows were created by the old standalone D-Day system and now duplicate
-- the canonical dashboard_goals entries.
DELETE FROM dashboard_schedules
WHERE trim(title) IN (
    'JLPT N1',
    'AP',
    'AP 과목A',
    'AP 科目A',
    'FP',
    'AWS SAA',
    'Portfolio × 2',
    'Portfolio x 2'
);

-- Also remove accidental custom goals that duplicate a canonical core goal.
DELETE FROM dashboard_goals
WHERE goal_key LIKE 'custom-%'
  AND trim(title) IN (
    'JLPT N1',
    'AP',
    'AP 과목A',
    'AP 科目A',
    'FP',
    'AWS SAA',
    'Portfolio × 2',
    'Portfolio x 2'
  );
