-- 0068_jlpt_review_queue_runtime_fix.sql
-- Align JLPT review scheduling with the canonical runtime SRS model.
--
-- Old 0063 behavior eagerly copied every previously introduced unmastered word into
-- every future prepared session. At a 3,000-word curriculum this grows roughly
-- quadratically, makes future sessions enormous, and conflicts with the canonical
-- 1/3/7/14/30/60/90/180-day review policy.
--
-- startSession() already loads review rows from japanese_admin_word_learning_stats
-- where next_review_on <= the actual study date. Keep that as the source of truth.
-- Future preview data should come from curriculum introduced_on + daily content,
-- not pre-created progress/review rows.

PRAGMA foreign_keys = ON;

-- Remove eager cumulative propagation into every future session.
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_daily_word;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_stats_insert;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_stats_update;
DROP TRIGGER IF EXISTS trg_jlpt_cumulative_after_session_insert;

-- The random maintenance-review trigger scans/order-randomizes the mastered pool on
-- each session insert. Canonical study order uses due/overdue SRS reviews and
-- unresolved weak items first, so do not add arbitrary future review rows here.
DROP TRIGGER IF EXISTS trg_jlpt_daily_maintenance_reviews;

-- 0063 recalculated COUNT(*) for the session after every review-row insert/delete.
-- Replace that with O(1) target maintenance. startSession() still performs one final
-- bounded aggregate for the active session after its batch insert, which is cheap
-- and authoritative.
DROP TRIGGER IF EXISTS trg_jlpt_review_target_after_insert;
DROP TRIGGER IF EXISTS trg_jlpt_review_target_after_delete;

CREATE TRIGGER trg_jlpt_review_target_after_insert
AFTER INSERT ON japanese_jlpt_daily_words
WHEN NEW.item_kind = 'review'
BEGIN
  UPDATE japanese_jlpt_daily_sessions
  SET review_target = review_target + 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.session_id;
END;

CREATE TRIGGER trg_jlpt_review_target_after_delete
AFTER DELETE ON japanese_jlpt_daily_words
WHEN OLD.item_kind = 'review'
BEGIN
  UPDATE japanese_jlpt_daily_sessions
  SET review_target = MAX(review_target - 1, 0),
      review_completed = MIN(review_completed, MAX(review_target - 1, 0)),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = OLD.session_id;
END;

-- No table-wide validation scan here by design. Production rebuild validation is
-- performed from source JSON before SQL generation, and active-session targets are
-- reconciled once by startSession(). This keeps D1 row reads bounded.
