-- 0100_jlpt_missed_daily_learning_recovery.sql
-- Keep recently missed JLPT daily words recoverable after their scheduled date.
--
-- 0068 intentionally removed eager propagation into every future session to avoid
-- quadratic D1 growth. This recovery queue is different: it only populates a
-- session that is being created for today/past, and only looks back 30 days.
-- The existing (plan_id, introduced_on, sort_order) index keeps the lookup bounded.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_jlpt_recover_missed_words_on_session_insert;

CREATE TRIGGER trg_jlpt_recover_missed_words_on_session_insert
AFTER INSERT ON japanese_jlpt_daily_sessions
WHEN NEW.study_date <= date('now', '+9 hours')
BEGIN
  INSERT OR IGNORE INTO japanese_jlpt_daily_words
    (session_id, word_id, item_kind, state_before, created_at)
  SELECT
    NEW.id,
    c.word_id,
    'review',
    COALESCE(s.learning_state, 'unlearned'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM japanese_jlpt_curriculum_words AS c
  JOIN japanese_jlpt_study_plans AS p
    ON p.id = c.plan_id
   AND p.id = NEW.plan_id
  LEFT JOIN japanese_admin_word_learning_stats AS s
    ON s.admin_id = p.admin_id
   AND s.word_id = c.word_id
  WHERE c.introduced_on IS NOT NULL
    AND c.introduced_on < NEW.study_date
    AND c.introduced_on >= date(NEW.study_date, '-30 day')
    AND COALESCE(s.learning_state, 'unlearned') <> 'mastered';
END;

-- Repair the active unfinished session once so the feature also works when the
-- current session was created before this migration was applied.
INSERT OR IGNORE INTO japanese_jlpt_daily_words
  (session_id, word_id, item_kind, state_before, created_at)
SELECT
  ds.id,
  c.word_id,
  'review',
  COALESCE(s.learning_state, 'unlearned'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM japanese_jlpt_daily_sessions AS ds
JOIN japanese_jlpt_study_plans AS p
  ON p.id = ds.plan_id
LEFT JOIN japanese_admin_word_learning_stats AS s
  ON s.admin_id = p.admin_id
 AND s.word_id = c.word_id
JOIN japanese_jlpt_curriculum_words AS c
  ON c.plan_id = ds.plan_id
 AND c.introduced_on IS NOT NULL
 AND c.introduced_on < ds.study_date
 AND c.introduced_on >= date(ds.study_date, '-30 day')
WHERE ds.study_date = date('now', '+9 hours')
  AND ds.status <> 'completed'
  AND COALESCE(s.learning_state, 'unlearned') <> 'mastered';
