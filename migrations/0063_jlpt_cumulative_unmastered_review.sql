-- 0063_jlpt_cumulative_unmastered_review.sql
-- Keep every previously introduced JLPT word in cumulative daily review until it is mastered.
-- Mastered words leave the cumulative queue and continue to use the existing next_review_on schedule.
-- This migration also repairs already-created future sessions (notably 2026-10/11).

DROP TRIGGER IF EXISTS trg_jlpt_review_target_after_insert;
DROP TRIGGER IF EXISTS trg_jlpt_review_target_after_delete;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_daily_word;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_stats_insert;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_stats_update;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_session_insert;

-- Keep session.review_target synchronized with the actual review rows.
CREATE TRIGGER trg_jlpt_review_target_after_insert
AFTER INSERT ON japanese_jlpt_daily_words
WHEN NEW.item_kind = 'review'
BEGIN
  UPDATE japanese_jlpt_daily_sessions
  SET review_target = (
        SELECT COUNT(*)
        FROM japanese_jlpt_daily_words
        WHERE session_id = NEW.session_id AND item_kind = 'review'
      ),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.session_id;
END;

CREATE TRIGGER trg_jlpt_review_target_after_delete
AFTER DELETE ON japanese_jlpt_daily_words
WHEN OLD.item_kind = 'review'
BEGIN
  UPDATE japanese_jlpt_daily_sessions
  SET review_target = (
        SELECT COUNT(*)
        FROM japanese_jlpt_daily_words
        WHERE session_id = OLD.session_id AND item_kind = 'review'
      ),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = OLD.session_id;
END;

-- Whenever a JLPT word is completed on a study day:
--   uncertain/unlearned -> keep it in every later prepared session as review
--   mastered            -> remove it from the cumulative future review queue
-- The normal startSession() due-review query will add it again when next_review_on arrives.
CREATE TRIGGER trg_jlpt_cumulative_after_daily_word
AFTER UPDATE OF status, state_after ON japanese_jlpt_daily_words
WHEN NEW.status = 'completed'
 AND NEW.state_after IN ('mastered','uncertain','unlearned')
BEGIN
  DELETE FROM japanese_jlpt_daily_words
  WHERE NEW.state_after = 'mastered'
    AND item_kind = 'review'
    AND word_id = NEW.word_id
    AND session_id IN (
      SELECT future.id
      FROM japanese_jlpt_daily_sessions current
      JOIN japanese_jlpt_daily_sessions future
        ON future.plan_id = current.plan_id
       AND future.study_date > current.study_date
       AND future.status <> 'completed'
      WHERE current.id = NEW.session_id
    );

  INSERT OR IGNORE INTO japanese_jlpt_daily_words
    (session_id, word_id, item_kind, state_before, created_at)
  SELECT future.id,
         NEW.word_id,
         'review',
         NEW.state_after,
         strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM japanese_jlpt_daily_sessions current
  JOIN japanese_jlpt_daily_sessions future
    ON future.plan_id = current.plan_id
   AND future.study_date > current.study_date
   AND future.status <> 'completed'
  JOIN japanese_jlpt_curriculum_words c
    ON c.plan_id = current.plan_id
   AND c.word_id = NEW.word_id
   AND c.introduced_on IS NOT NULL
   AND c.introduced_on < future.study_date
  WHERE current.id = NEW.session_id
    AND NEW.state_after IN ('uncertain','unlearned');
END;

-- If a word state is changed from another learning screen (word list/random quiz),
-- synchronize future prepared JLPT sessions as well. Do not touch today's row here;
-- the daily-word trigger above handles the active study session without duplication.
CREATE TRIGGER trg_jlpt_cumulative_after_stats_insert
AFTER INSERT ON japanese_admin_word_learning_stats
WHEN NEW.learning_state IN ('mastered','uncertain','unlearned')
BEGIN
  DELETE FROM japanese_jlpt_daily_words
  WHERE NEW.learning_state = 'mastered'
    AND item_kind = 'review'
    AND word_id = NEW.word_id
    AND session_id IN (
      SELECT ds.id
      FROM japanese_jlpt_daily_sessions ds
      JOIN japanese_jlpt_study_plans p ON p.id = ds.plan_id
      WHERE p.admin_id = NEW.admin_id
        AND ds.study_date > date('now','+9 hours')
        AND ds.status <> 'completed'
    );

  INSERT OR IGNORE INTO japanese_jlpt_daily_words
    (session_id, word_id, item_kind, state_before, created_at)
  SELECT ds.id,
         NEW.word_id,
         'review',
         NEW.learning_state,
         strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM japanese_jlpt_daily_sessions ds
  JOIN japanese_jlpt_study_plans p
    ON p.id = ds.plan_id AND p.admin_id = NEW.admin_id
  JOIN japanese_jlpt_curriculum_words c
    ON c.plan_id = ds.plan_id
   AND c.word_id = NEW.word_id
   AND c.introduced_on IS NOT NULL
   AND c.introduced_on < ds.study_date
  WHERE ds.study_date > date('now','+9 hours')
    AND ds.status <> 'completed'
    AND NEW.learning_state IN ('uncertain','unlearned');
END;

CREATE TRIGGER trg_jlpt_cumulative_after_stats_update
AFTER UPDATE OF learning_state ON japanese_admin_word_learning_stats
WHEN NEW.learning_state IN ('mastered','uncertain','unlearned')
BEGIN
  DELETE FROM japanese_jlpt_daily_words
  WHERE NEW.learning_state = 'mastered'
    AND item_kind = 'review'
    AND word_id = NEW.word_id
    AND session_id IN (
      SELECT ds.id
      FROM japanese_jlpt_daily_sessions ds
      JOIN japanese_jlpt_study_plans p ON p.id = ds.plan_id
      WHERE p.admin_id = NEW.admin_id
        AND ds.study_date > date('now','+9 hours')
        AND ds.status <> 'completed'
    );

  INSERT OR IGNORE INTO japanese_jlpt_daily_words
    (session_id, word_id, item_kind, state_before, created_at)
  SELECT ds.id,
         NEW.word_id,
         'review',
         NEW.learning_state,
         strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM japanese_jlpt_daily_sessions ds
  JOIN japanese_jlpt_study_plans p
    ON p.id = ds.plan_id AND p.admin_id = NEW.admin_id
  JOIN japanese_jlpt_curriculum_words c
    ON c.plan_id = ds.plan_id
   AND c.word_id = NEW.word_id
   AND c.introduced_on IS NOT NULL
   AND c.introduced_on < ds.study_date
  WHERE ds.study_date > date('now','+9 hours')
    AND ds.status <> 'completed'
    AND NEW.learning_state IN ('uncertain','unlearned');
END;

-- New sessions created in December and later automatically receive every older
-- curriculum word that is still not mastered. Missing stats means unlearned.
CREATE TRIGGER trg_jlpt_cumulative_after_session_insert
AFTER INSERT ON japanese_jlpt_daily_sessions
BEGIN
  INSERT OR IGNORE INTO japanese_jlpt_daily_words
    (session_id, word_id, item_kind, state_before, created_at)
  SELECT NEW.id,
         c.word_id,
         'review',
         COALESCE(s.learning_state,'unlearned'),
         strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM japanese_jlpt_study_plans p
  JOIN japanese_jlpt_curriculum_words c
    ON c.plan_id = p.id
   AND c.introduced_on IS NOT NULL
   AND c.introduced_on < NEW.study_date
  LEFT JOIN japanese_admin_word_learning_stats s
    ON s.admin_id = p.admin_id AND s.word_id = c.word_id
  WHERE p.id = NEW.plan_id
    AND COALESCE(s.learning_state,'unlearned') <> 'mastered';
END;

-- Repair sessions that already exist before these triggers were installed.
-- This is deliberately all unfinished sessions, not only Oct/Nov, so retry/history
-- behavior stays consistent with the same cumulative-review rule.
INSERT OR IGNORE INTO japanese_jlpt_daily_words
  (session_id, word_id, item_kind, state_before, created_at)
SELECT ds.id,
       c.word_id,
       'review',
       COALESCE(s.learning_state,'unlearned'),
       strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM japanese_jlpt_daily_sessions ds
JOIN japanese_jlpt_study_plans p ON p.id = ds.plan_id
JOIN japanese_jlpt_curriculum_words c
  ON c.plan_id = ds.plan_id
 AND c.introduced_on IS NOT NULL
 AND c.introduced_on < ds.study_date
LEFT JOIN japanese_admin_word_learning_stats s
  ON s.admin_id = p.admin_id AND s.word_id = c.word_id
WHERE ds.status <> 'completed'
  AND COALESCE(s.learning_state,'unlearned') <> 'mastered';

-- Recalculate all unfinished session review targets once after the backfill.
UPDATE japanese_jlpt_daily_sessions
SET review_target = (
      SELECT COUNT(*)
      FROM japanese_jlpt_daily_words dw
      WHERE dw.session_id = japanese_jlpt_daily_sessions.id
        AND dw.item_kind = 'review'
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE status <> 'completed';

-- Integrity guard: no unfinished session may have a review_target that differs
-- from its actual review rows.
CREATE TABLE _assert_jlpt_cumulative_review_0063 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_cumulative_review_targets_match CHECK(ok=1)
);
INSERT INTO _assert_jlpt_cumulative_review_0063(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1
  FROM japanese_jlpt_daily_sessions ds
  WHERE ds.status <> 'completed'
    AND ds.review_target <> (
      SELECT COUNT(*)
      FROM japanese_jlpt_daily_words dw
      WHERE dw.session_id = ds.id AND dw.item_kind = 'review'
    )
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_cumulative_review_0063;
