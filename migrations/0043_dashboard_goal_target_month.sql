-- 0043_dashboard_goal_target_month.sql
-- 정확한 시험일이 미정인 목표를 YYYY-MM 단위의 예정 월로 관리한다.

ALTER TABLE dashboard_goals ADD COLUMN target_month TEXT;

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
