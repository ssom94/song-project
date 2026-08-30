-- 0028_seed_exam_calendar_schedules.sql
-- 공식 시험 일정 기준으로 JLPT N1 / AP / FP 일정을 기본 등록한다.
-- JLPT: 2026-12-06
-- AP: 2026년도 전기 CBT 과목 A/B 실시기간
-- FP 2·3급: CBT 상시 실시이므로 날짜 없는 일정으로 등록

INSERT INTO calendar_schedules (content, start_date, end_date)
SELECT 'JLPT N1 시험 / 試験', '2026-12-06', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM calendar_schedules
    WHERE content = 'JLPT N1 시험 / 試験'
      AND start_date = '2026-12-06'
);

INSERT INTO calendar_schedules (content, start_date, end_date)
SELECT 'AP 과목A 시험기간 / 科目A試験期間', '2026-10-28', '2026-11-10'
WHERE NOT EXISTS (
    SELECT 1 FROM calendar_schedules
    WHERE content = 'AP 과목A 시험기간 / 科目A試験期間'
      AND start_date = '2026-10-28'
      AND end_date = '2026-11-10'
);

INSERT INTO calendar_schedules (content, start_date, end_date)
SELECT 'AP 과목B 시험기간 / 科目B試験期間', '2026-11-24', '2026-12-06'
WHERE NOT EXISTS (
    SELECT 1 FROM calendar_schedules
    WHERE content = 'AP 과목B 시험기간 / 科目B試験期間'
      AND start_date = '2026-11-24'
      AND end_date = '2026-12-06'
);

INSERT INTO calendar_schedules (content, start_date, end_date)
SELECT 'FP 2·3급 CBT 상시 / 2・3級 CBT随時', NULL, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM calendar_schedules
    WHERE content = 'FP 2·3급 CBT 상시 / 2・3級 CBT随時'
      AND start_date IS NULL
      AND end_date IS NULL
);
