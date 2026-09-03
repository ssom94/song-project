-- 0065_jlpt_december_2026_february_2027.sql
-- Legacy compatibility migration.
--
-- The original implementation generated Dec 2026-Feb 2027 study rows by rotating
-- whatever small N1 vocabulary pool happened to exist in the database. On a clean
-- install that pool can contain fewer than 20 rows, so the migration failed before
-- later repairs could run. More importantly, recycling a partial pool is not valid
-- production JLPT content.
--
-- The canonical 3,000-word corpus and all prepared content for
-- 2026-09-07..2027-02-28 are rebuilt atomically by migration 0070 after offline
-- production validation. Preserve this migration number for Wrangler history, but
-- do not create temporary/fake future sessions, daily words, questions or scans.

PRAGMA foreign_keys = ON;
