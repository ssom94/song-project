-- 0061_study_content_integrity_checks.sql
-- Legacy compatibility migration.
--
-- The original version repaired a temporary September JLPT seed and then verified
-- every study date with recursive date CTEs plus correlated COUNT(*) subqueries.
-- On Cloudflare D1 Free this could consume a large part of the daily row-read budget
-- before the real production release was applied.
--
-- Those temporary JLPT rows are superseded by the validated production rebuild
-- (0070), and AP receives its own release/validation pass after JLPT is complete.
-- Keep the migration filename so Wrangler's migration ordering remains stable, but
-- intentionally perform no content scans or legacy data regeneration here.
--
-- IMPORTANT: production integrity is validated offline by
-- scripts/jlpt/validate-production.mjs before SQL generation. Runtime DB checks must
-- remain bounded and index-driven rather than re-scanning every prepared date.

PRAGMA foreign_keys = ON;
