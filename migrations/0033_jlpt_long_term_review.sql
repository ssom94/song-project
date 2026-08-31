-- 0033_jlpt_long_term_review.sql
-- 90/180일 장기복습, 랜덤 유지복습, 주간/월간 누적테스트

PRAGMA foreign_keys = ON;

ALTER TABLE japanese_admin_word_learning_stats
    ADD COLUMN long_review_stage INTEGER NOT NULL DEFAULT 0
    CHECK (long_review_stage BETWEEN 0 AND 2);

ALTER TABLE japanese_jlpt_daily_words
    ADD COLUMN review_reason TEXT
    CHECK (review_reason IS NULL OR review_reason IN ('scheduled', 'maintenance', 'carryover'));

ALTER TABLE japanese_jlpt_daily_sessions
    ADD COLUMN weekly_test_target INTEGER NOT NULL DEFAULT 0 CHECK (weekly_test_target >= 0);
ALTER TABLE japanese_jlpt_daily_sessions
    ADD COLUMN weekly_test_completed INTEGER NOT NULL DEFAULT 0 CHECK (weekly_test_completed >= 0);
ALTER TABLE japanese_jlpt_daily_sessions
    ADD COLUMN monthly_test_target INTEGER NOT NULL DEFAULT 0 CHECK (monthly_test_target >= 0);
ALTER TABLE japanese_jlpt_daily_sessions
    ADD COLUMN monthly_test_completed INTEGER NOT NULL DEFAULT 0 CHECK (monthly_test_completed >= 0);

CREATE TABLE IF NOT EXISTS japanese_jlpt_cumulative_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    admin_id INTEGER NOT NULL,
    test_date TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK (test_type IN ('weekly', 'monthly')),
    question_target INTEGER NOT NULL CHECK (question_target > 0),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, admin_id, test_date, test_type),
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_cumulative_tests_date
    ON japanese_jlpt_cumulative_tests(plan_id, admin_id, test_date DESC, test_type);

CREATE TABLE IF NOT EXISTS japanese_jlpt_cumulative_test_items (
    test_id INTEGER NOT NULL,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    word_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_option INTEGER NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
    selected_option INTEGER CHECK (selected_option IS NULL OR selected_option BETWEEN 0 AND 3),
    is_correct INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
    answered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (test_id, sequence_no),
    UNIQUE (test_id, word_id),
    FOREIGN KEY (test_id) REFERENCES japanese_jlpt_cumulative_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_cumulative_items_answer
    ON japanese_jlpt_cumulative_test_items(test_id, is_correct, sequence_no);
