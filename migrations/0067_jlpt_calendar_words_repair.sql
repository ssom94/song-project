-- 0067_jlpt_calendar_words_repair.sql
-- Legacy compatibility migration.
--
-- 0067 repaired the temporary 0065 rotating-pool schedule and pre-created future
-- sessions/daily-word rows. That model is superseded by the canonical production
-- release: 3,000 unique new words are introduced exactly once, preview reads use
-- curriculum introduced_on, and review/progress rows are created only at runtime.
--
-- Keeping this migration as a no-op prevents a clean install from rebuilding data
-- that migration 0070 will deliberately replace and avoids unnecessary D1 reads.

PRAGMA foreign_keys = ON;
