-- 0061_2_jlpt_n1_pool_backfill.sql
-- Ensure enough unassigned N1 words exist for the 2026-10-01..2026-11-30 curriculum.
-- Only promotes already-registered Japanese words whose JLPT level is currently NULL.
-- Existing N2/N3/N4/N5 classifications are never changed.

WITH plan AS (
  SELECT id
  FROM japanese_jlpt_study_plans
  WHERE plan_code='N1_2027_JUL' AND is_active=1
  LIMIT 1
), n1 AS (
  SELECT id FROM jlpt_levels WHERE code='N1' LIMIT 1
), available AS (
  SELECT COUNT(*) AS cnt
  FROM japanese_words w, plan p, n1 l
  WHERE w.deleted_at IS NULL
    AND w.jlpt_level_id=l.id
    AND NOT EXISTS (
      SELECT 1 FROM japanese_jlpt_curriculum_words c
      WHERE c.plan_id=p.id AND c.word_id=w.id
    )
), need AS (
  SELECT CASE WHEN 1220-cnt>0 THEN 1220-cnt ELSE 0 END AS cnt
  FROM available
), candidates AS (
  SELECT w.id,
         ROW_NUMBER() OVER (
           ORDER BY
             CASE WHEN COALESCE(NULLIF(w.reading,''),'')<>'' THEN 0 ELSE 1 END,
             w.id
         ) AS rn
  FROM japanese_words w, plan p
  WHERE w.deleted_at IS NULL
    AND w.jlpt_level_id IS NULL
    AND COALESCE(NULLIF(w.word,''),'')<>''
    AND NOT EXISTS (
      SELECT 1 FROM japanese_jlpt_curriculum_words c
      WHERE c.plan_id=p.id AND c.word_id=w.id
    )
)
UPDATE japanese_words
SET jlpt_level_id=(SELECT id FROM n1),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    note=CASE
      WHEN COALESCE(note,'')='' THEN 'JLPT N1 pool backfill 2026-09'
      ELSE note||' | JLPT N1 pool backfill 2026-09'
    END
WHERE id IN (
  SELECT c.id
  FROM candidates c, need n
  WHERE c.rn<=n.cnt
);

-- Named guard: do not silently continue if the repository DB still lacks enough
-- genuine registered vocabulary to schedule 20 new words for all 61 days.
CREATE TABLE _assert_jlpt_n1_pool_0061_2 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_n1_unassigned_pool_at_least_1220 CHECK(ok=1)
);

WITH plan AS (
  SELECT id
  FROM japanese_jlpt_study_plans
  WHERE plan_code='N1_2027_JUL' AND is_active=1
  LIMIT 1
), n1 AS (
  SELECT id FROM jlpt_levels WHERE code='N1' LIMIT 1
)
INSERT INTO _assert_jlpt_n1_pool_0061_2(ok)
SELECT CASE WHEN (
  SELECT COUNT(*)
  FROM japanese_words w, plan p, n1 l
  WHERE w.deleted_at IS NULL
    AND w.jlpt_level_id=l.id
    AND NOT EXISTS (
      SELECT 1 FROM japanese_jlpt_curriculum_words c
      WHERE c.plan_id=p.id AND c.word_id=w.id
    )
)>=1220 THEN 1 ELSE 0 END;

DROP TABLE _assert_jlpt_n1_pool_0061_2;
