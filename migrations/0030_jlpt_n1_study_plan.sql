-- 0030_jlpt_n1_study_plan.sql
-- JLPT N1 2027-07 학습 계획 / 커리큘럼 / 일일 학습 / 복습 주기

PRAGMA foreign_keys = ON;

-- 기존 학습 상태에 간격 반복 복습 정보를 추가한다.
ALTER TABLE japanese_admin_word_learning_stats ADD COLUMN first_learned_at TEXT;
ALTER TABLE japanese_admin_word_learning_stats ADD COLUMN last_studied_at TEXT;
ALTER TABLE japanese_admin_word_learning_stats ADD COLUMN review_stage INTEGER NOT NULL DEFAULT 0 CHECK (review_stage BETWEEN 0 AND 6);
ALTER TABLE japanese_admin_word_learning_stats ADD COLUMN next_review_on TEXT;

CREATE INDEX IF NOT EXISTS idx_japanese_admin_learning_review
    ON japanese_admin_word_learning_stats(admin_id, next_review_on, learning_state);

CREATE TABLE IF NOT EXISTS japanese_jlpt_study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    plan_code TEXT NOT NULL,
    jlpt_level_code TEXT NOT NULL DEFAULT 'N1'
        CHECK (jlpt_level_code IN ('N1', 'N2', 'N3', 'N4', 'N5')),
    study_start_date TEXT NOT NULL,
    target_exam_date TEXT NOT NULL,
    target_date_is_tentative INTEGER NOT NULL DEFAULT 1
        CHECK (target_date_is_tentative IN (0, 1)),
    target_word_count INTEGER NOT NULL DEFAULT 3000 CHECK (target_word_count > 0),
    daily_new_word_target INTEGER NOT NULL DEFAULT 20 CHECK (daily_new_word_target BETWEEN 0 AND 200),
    vocab_question_target INTEGER NOT NULL DEFAULT 15 CHECK (vocab_question_target BETWEEN 0 AND 200),
    grammar_target INTEGER NOT NULL DEFAULT 2 CHECK (grammar_target BETWEEN 0 AND 50),
    reading_target INTEGER NOT NULL DEFAULT 1 CHECK (reading_target BETWEEN 0 AND 20),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (admin_id, plan_code),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_japanese_jlpt_active_plan
    ON japanese_jlpt_study_plans(admin_id)
    WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS japanese_jlpt_curriculum_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    introduced_on TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, word_id),
    UNIQUE (plan_id, sort_order),
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_curriculum_date
    ON japanese_jlpt_curriculum_words(plan_id, introduced_on, sort_order);

CREATE TABLE IF NOT EXISTS japanese_jlpt_daily_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    study_date TEXT NOT NULL,
    review_target INTEGER NOT NULL DEFAULT 0 CHECK (review_target >= 0),
    new_word_target INTEGER NOT NULL DEFAULT 20 CHECK (new_word_target >= 0),
    vocab_question_target INTEGER NOT NULL DEFAULT 15 CHECK (vocab_question_target >= 0),
    grammar_target INTEGER NOT NULL DEFAULT 2 CHECK (grammar_target >= 0),
    reading_target INTEGER NOT NULL DEFAULT 1 CHECK (reading_target >= 0),
    review_completed INTEGER NOT NULL DEFAULT 0 CHECK (review_completed >= 0),
    new_word_completed INTEGER NOT NULL DEFAULT 0 CHECK (new_word_completed >= 0),
    vocab_question_completed INTEGER NOT NULL DEFAULT 0 CHECK (vocab_question_completed >= 0),
    grammar_completed INTEGER NOT NULL DEFAULT 0 CHECK (grammar_completed >= 0),
    reading_completed INTEGER NOT NULL DEFAULT 0 CHECK (reading_completed >= 0),
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, study_date),
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_daily_sessions_date
    ON japanese_jlpt_daily_sessions(plan_id, study_date DESC);

CREATE TABLE IF NOT EXISTS japanese_jlpt_daily_words (
    session_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    item_kind TEXT NOT NULL CHECK (item_kind IN ('review', 'new')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    state_before TEXT CHECK (state_before IS NULL OR state_before IN ('mastered', 'uncertain', 'unlearned')),
    state_after TEXT CHECK (state_after IS NULL OR state_after IN ('mastered', 'uncertain', 'unlearned')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (session_id, word_id, item_kind),
    FOREIGN KEY (session_id) REFERENCES japanese_jlpt_daily_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_daily_words_status
    ON japanese_jlpt_daily_words(session_id, item_kind, status);

-- 문법/독해/시험형 어휘 문제는 유연한 JSON payload로 저장한다.
CREATE TABLE IF NOT EXISTS japanese_jlpt_daily_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    study_date TEXT NOT NULL,
    content_type TEXT NOT NULL
        CHECK (content_type IN ('vocab_question', 'grammar', 'grammar_question', 'reading')),
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    title TEXT,
    payload_json TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, study_date, content_type, sequence_no),
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_daily_contents_date
    ON japanese_jlpt_daily_contents(plan_id, study_date, content_type, sequence_no);
