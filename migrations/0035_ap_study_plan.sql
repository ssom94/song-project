-- 0035_ap_study_plan.sql
-- AP 2026年度後期 학습계획 / 분야 진척 / 일일학습 / 오답복습 이력

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ap_study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    plan_code TEXT NOT NULL,
    study_start_date TEXT NOT NULL,
    registration_start_date TEXT NOT NULL,
    registration_end_date TEXT NOT NULL,
    subject_a_target_date TEXT NOT NULL,
    subject_b_target_date TEXT NOT NULL,
    daily_minutes INTEGER NOT NULL DEFAULT 60 CHECK (daily_minutes BETWEEN 15 AND 240),
    subject_b_focus_json TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (admin_id, plan_code),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_active_plan
    ON ap_study_plans(admin_id)
    WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS ap_study_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    topic_code TEXT NOT NULL,
    exam_part TEXT NOT NULL CHECK (exam_part IN ('A', 'B', 'AB')),
    domain_code TEXT NOT NULL,
    title_ko TEXT NOT NULL,
    title_ja TEXT NOT NULL,
    study_points_ko TEXT NOT NULL,
    study_points_ja TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    sort_order INTEGER NOT NULL,
    is_focus_b INTEGER NOT NULL DEFAULT 0 CHECK (is_focus_b IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, topic_code),
    UNIQUE (plan_id, sort_order),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ap_topics_focus
    ON ap_study_topics(plan_id, is_focus_b, priority DESC, sort_order);

CREATE TABLE IF NOT EXISTS ap_topic_progress (
    plan_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    learning_state TEXT NOT NULL DEFAULT 'unlearned'
        CHECK (learning_state IN ('unlearned', 'learning', 'uncertain', 'mastered')),
    mastery_score INTEGER NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    partial_count INTEGER NOT NULL DEFAULT 0 CHECK (partial_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    review_stage INTEGER NOT NULL DEFAULT 0 CHECK (review_stage BETWEEN 0 AND 6),
    first_studied_at TEXT,
    last_studied_at TEXT,
    next_review_on TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (plan_id, topic_id),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ap_topic_progress_review
    ON ap_topic_progress(plan_id, next_review_on, learning_state, mastery_score);

CREATE TABLE IF NOT EXISTS ap_daily_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    study_date TEXT NOT NULL,
    target_minutes INTEGER NOT NULL DEFAULT 60 CHECK (target_minutes >= 0),
    actual_minutes INTEGER NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    recommendation_reason_ko TEXT,
    recommendation_reason_ja TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, study_date),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ap_daily_sessions_date
    ON ap_daily_sessions(plan_id, study_date DESC);

CREATE TABLE IF NOT EXISTS ap_daily_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    topic_id INTEGER,
    item_kind TEXT NOT NULL
        CHECK (item_kind IN ('review', 'concept', 'subject_a', 'subject_b', 'wrong_answer', 'weekly_test', 'monthly_test')),
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    title_ko TEXT NOT NULL,
    title_ja TEXT NOT NULL,
    description_ko TEXT NOT NULL,
    description_ja TEXT NOT NULL,
    target_minutes INTEGER NOT NULL DEFAULT 10 CHECK (target_minutes >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    result TEXT CHECK (result IS NULL OR result IN ('correct', 'partial', 'wrong', 'completed')),
    score INTEGER CHECK (score IS NULL OR (score BETWEEN 0 AND 100)),
    confidence INTEGER CHECK (confidence IS NULL OR (confidence BETWEEN 1 AND 5)),
    note TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (session_id, sequence_no),
    FOREIGN KEY (session_id) REFERENCES ap_daily_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_daily_items_status
    ON ap_daily_items(session_id, status, sequence_no);

CREATE TABLE IF NOT EXISTS ap_study_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    topic_id INTEGER,
    result TEXT NOT NULL CHECK (result IN ('correct', 'partial', 'wrong', 'completed')),
    score INTEGER CHECK (score IS NULL OR (score BETWEEN 0 AND 100)),
    confidence INTEGER CHECK (confidence IS NULL OR (confidence BETWEEN 1 AND 5)),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES ap_daily_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES ap_daily_items(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_attempts_topic
    ON ap_study_attempts(plan_id, topic_id, created_at DESC);
