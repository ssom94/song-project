-- 0006_quiz_dashboard.sql
-- 일본어 퀴즈 이력 + 홈 목표/D-Day 설정

PRAGMA foreign_keys = ON;

-- ============================================================
-- Japanese quiz sessions (owner/admin learning history)
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_quiz_sessions (
    id INTEGER PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    settings_json TEXT NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'abandoned')),
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_quiz_sessions_admin_status
    ON japanese_quiz_sessions(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_japanese_quiz_sessions_started_at
    ON japanese_quiz_sessions(started_at);

-- ============================================================
-- Japanese quiz attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_quiz_attempts (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    example_id INTEGER,
    question_type TEXT NOT NULL
        CHECK (question_type IN ('reading', 'meaning_ko', 'sentence_blank')),
    answer_mode TEXT NOT NULL
        CHECK (answer_mode IN ('input', 'choice')),
    prompt_text TEXT NOT NULL,
    expected_answer TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    answered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES japanese_quiz_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE,
    FOREIGN KEY (example_id) REFERENCES japanese_word_examples(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_japanese_quiz_attempts_session_id
    ON japanese_quiz_attempts(session_id, answered_at);
CREATE INDEX IF NOT EXISTS idx_japanese_quiz_attempts_word_id
    ON japanese_quiz_attempts(word_id, answered_at);
CREATE INDEX IF NOT EXISTS idx_japanese_quiz_attempts_answered_at
    ON japanese_quiz_attempts(answered_at);

-- ============================================================
-- Per-word learning state
-- needs_review = 1 means the latest evaluated answer for the word was wrong.
-- A later correct answer clears needs_review.
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_word_learning_stats (
    word_id INTEGER PRIMARY KEY,
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
    last_answered_at TEXT,
    last_correct_at TEXT,
    last_wrong_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_word_learning_review
    ON japanese_word_learning_stats(needs_review, last_wrong_at);

-- ============================================================
-- Public home dashboard settings (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    jlpt_goal_mode TEXT NOT NULL DEFAULT 'auto'
        CHECK (jlpt_goal_mode IN ('auto', 'manual')),
    jlpt_manual_target INTEGER CHECK (jlpt_manual_target IS NULL OR jlpt_manual_target > 0),
    show_jlpt INTEGER NOT NULL DEFAULT 1 CHECK (show_jlpt IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO dashboard_settings (id, jlpt_goal_mode, jlpt_manual_target, show_jlpt)
VALUES (1, 'auto', NULL, 1);

-- ============================================================
-- Dashboard goals / D-Day
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_goals (
    id INTEGER PRIMARY KEY,
    goal_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    goal_type TEXT NOT NULL DEFAULT 'percent'
        CHECK (goal_type IN ('percent', 'count', 'jlpt_auto')),
    target_date TEXT,
    progress_percent INTEGER NOT NULL DEFAULT 0
        CHECK (progress_percent BETWEEN 0 AND 100),
    target_count INTEGER CHECK (target_count IS NULL OR target_count > 0),
    completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'progress', 'done')),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_goals_order
    ON dashboard_goals(display_order, id);
CREATE INDEX IF NOT EXISTS idx_dashboard_goals_visible
    ON dashboard_goals(is_visible, display_order);

INSERT OR IGNORE INTO dashboard_goals
    (id, goal_key, title, goal_type, target_date, progress_percent, target_count, completed_count, status, display_order, is_visible)
VALUES
    (910000001, 'jlpt-n1', 'JLPT N1', 'jlpt_auto', NULL, 0, NULL, 0, 'planned', 10, 1),
    (910000002, 'ap', 'AP', 'percent', NULL, 0, NULL, 0, 'planned', 20, 1),
    (910000003, 'fp', 'FP', 'percent', NULL, 0, NULL, 0, 'planned', 30, 1),
    (910000004, 'aws-saa', 'AWS SAA', 'percent', NULL, 0, NULL, 0, 'planned', 40, 1),
    (910000005, 'portfolio', 'Portfolio × 2', 'count', NULL, 0, 2, 0, 'planned', 50, 1);

-- Notes:
-- 1) Persistent quiz writes are admin-authenticated so public visitors cannot alter owner learning stats.
-- 2) Public quiz UI may use ephemeral/sessionStorage play until a separate visitor-history model is introduced.
-- 3) needs_review represents current review backlog, not cumulative wrong attempts.
-- 4) JLPT dashboard auto mode uses registered active words and needs_review count.
-- 5) Custom dashboard goals use generated safe integer IDs and unique goal_key values.
