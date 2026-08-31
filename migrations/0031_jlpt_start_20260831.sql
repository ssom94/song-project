-- 0031_jlpt_start_20260831.sql
-- JLPT N1 정식 학습 시작일을 2026-08-31로 조정한다.

UPDATE japanese_jlpt_study_plans
SET study_start_date = '2026-08-31',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE plan_code = 'N1_2027_JUL'
  AND study_start_date > '2026-08-31';
