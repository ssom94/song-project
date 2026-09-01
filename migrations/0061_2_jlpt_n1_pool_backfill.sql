-- 0061_2_jlpt_n1_pool_backfill.sql
-- Safety migration for the Oct-Nov JLPT curriculum.
--
-- IMPORTANT:
-- Do NOT rewrite japanese_words.jlpt_level_id merely to make the N1 pool larger.
-- The N1 study plan may legitimately reinforce prerequisite N2/lower vocabulary,
-- but each word must keep its original JLPT classification.
--
-- 0062 performs the actual candidate selection in priority order:
-- N1 -> N2 -> unclassified -> N3 -> N4 -> N5.
-- This migration intentionally performs no data mutation.

SELECT 1;
