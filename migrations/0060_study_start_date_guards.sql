-- 0060_study_start_date_guards.sql
-- Keep runtime-created plans aligned with the reset dates even while older application constants may still exist.
PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_jlpt_n1_restart_date_after_insert
AFTER INSERT ON japanese_jlpt_study_plans
WHEN NEW.plan_code = 'N1_2027_JUL' AND NEW.study_start_date <> '2026-09-07'
BEGIN
  UPDATE japanese_jlpt_study_plans
  SET study_start_date='2026-09-07', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ap_restart_date_after_insert
AFTER INSERT ON ap_study_plans
WHEN NEW.plan_code = 'AP_2026_H2' AND NEW.study_start_date <> '2026-10-01'
BEGIN
  UPDATE ap_study_plans
  SET study_start_date='2026-10-01', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id=NEW.id;
END;

UPDATE japanese_jlpt_study_plans
SET study_start_date='2026-09-07', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE plan_code='N1_2027_JUL';

UPDATE ap_study_plans
SET study_start_date='2026-10-01', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE plan_code='AP_2026_H2';
