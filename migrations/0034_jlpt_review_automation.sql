-- 0034_jlpt_review_automation.sql
-- 장기복습 90/180일 보정 + 매일 랜덤 유지복습 + 주간/월간 누적시험 예약

PRAGMA foreign_keys = ON;

-- 기존 API가 review_stage=6 이후 long_review_stage를 직접 저장하지 않는 경우에도
-- DB에서 60일 다음은 90일, 그 다음부터는 180일 간격으로 보정한다.
CREATE TRIGGER IF NOT EXISTS trg_jlpt_long_review_after_update
AFTER UPDATE OF learning_state, review_stage, next_review_on ON japanese_admin_word_learning_stats
WHEN NEW.learning_state = 'mastered'
 AND OLD.review_stage = 6
 AND NEW.review_stage = 6
BEGIN
    UPDATE japanese_admin_word_learning_stats
    SET long_review_stage = CASE
            WHEN OLD.long_review_stage = 0 THEN 1
            ELSE 2
        END,
        next_review_on = CASE
            WHEN OLD.long_review_stage = 0 THEN date(COALESCE(NEW.last_studied_at, NEW.updated_at), '+90 day')
            ELSE date(COALESCE(NEW.last_studied_at, NEW.updated_at), '+180 day')
        END
    WHERE admin_id = NEW.admin_id
      AND word_id = NEW.word_id;
END;

-- 오늘 복습 예정이 아닌 '외움' 단어 중 최대 10개를 유지복습으로 섞는다.
-- 너무 최근에 학습한 단어는 제외하고 최소 14일 이상 지난 단어만 대상으로 한다.
CREATE TRIGGER IF NOT EXISTS trg_jlpt_daily_maintenance_reviews
AFTER INSERT ON japanese_jlpt_daily_sessions
BEGIN
    INSERT OR IGNORE INTO japanese_jlpt_daily_words
        (session_id, word_id, item_kind, status, state_before, review_reason, created_at)
    SELECT
        NEW.id,
        c.word_id,
        'review',
        'pending',
        s.learning_state,
        'maintenance',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM japanese_jlpt_curriculum_words AS c
    JOIN japanese_jlpt_study_plans AS p ON p.id = c.plan_id
    JOIN japanese_admin_word_learning_stats AS s
      ON s.word_id = c.word_id
     AND s.admin_id = p.admin_id
    WHERE c.plan_id = NEW.plan_id
      AND s.learning_state = 'mastered'
      AND s.first_learned_at IS NOT NULL
      AND date(s.first_learned_at) <= date(NEW.study_date, '-14 day')
      AND (s.next_review_on IS NULL OR s.next_review_on > NEW.study_date)
      AND NOT EXISTS (
          SELECT 1
          FROM japanese_jlpt_daily_words AS existing
          WHERE existing.session_id = NEW.id
            AND existing.word_id = c.word_id
      )
    ORDER BY RANDOM()
    LIMIT 10;
END;

-- 일요일에는 학습한 단어가 20개 이상일 때 주간 누적테스트를 예약한다.
CREATE TRIGGER IF NOT EXISTS trg_jlpt_schedule_weekly_test
AFTER INSERT ON japanese_jlpt_daily_sessions
WHEN strftime('%w', NEW.study_date) = '0'
BEGIN
    INSERT OR IGNORE INTO japanese_jlpt_cumulative_tests
        (plan_id, admin_id, test_date, test_type, question_target, status)
    SELECT
        NEW.plan_id,
        p.admin_id,
        NEW.study_date,
        'weekly',
        CASE WHEN COUNT(*) < 30 THEN COUNT(*) ELSE 30 END,
        'not_started'
    FROM japanese_jlpt_study_plans AS p
    JOIN japanese_jlpt_curriculum_words AS c ON c.plan_id = p.id
    JOIN japanese_admin_word_learning_stats AS s
      ON s.word_id = c.word_id
     AND s.admin_id = p.admin_id
    WHERE p.id = NEW.plan_id
      AND s.first_learned_at IS NOT NULL
    HAVING COUNT(*) >= 20;
END;

-- 월 마지막 날에는 학습한 단어가 100개 이상일 때 월간 누적테스트를 예약한다.
CREATE TRIGGER IF NOT EXISTS trg_jlpt_schedule_monthly_test
AFTER INSERT ON japanese_jlpt_daily_sessions
WHEN strftime('%d', date(NEW.study_date, '+1 day')) = '01'
BEGIN
    INSERT OR IGNORE INTO japanese_jlpt_cumulative_tests
        (plan_id, admin_id, test_date, test_type, question_target, status)
    SELECT
        NEW.plan_id,
        p.admin_id,
        NEW.study_date,
        'monthly',
        CASE WHEN COUNT(*) < 100 THEN COUNT(*) ELSE 100 END,
        'not_started'
    FROM japanese_jlpt_study_plans AS p
    JOIN japanese_jlpt_curriculum_words AS c ON c.plan_id = p.id
    JOIN japanese_admin_word_learning_stats AS s
      ON s.word_id = c.word_id
     AND s.admin_id = p.admin_id
    WHERE p.id = NEW.plan_id
      AND s.first_learned_at IS NOT NULL
    HAVING COUNT(*) >= 100;
END;
