-- 0044_ap_daily_content_archive.sql
-- AP 날짜별 개념/문제 아카이브 + 문제 시도/오답노트

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ap_daily_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    study_date TEXT NOT NULL,
    topic_id INTEGER,
    content_type TEXT NOT NULL
        CHECK (content_type IN ('concept', 'concept_question', 'subject_a_question', 'subject_b_scenario')),
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    title_ko TEXT,
    title_ja TEXT,
    payload_json TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, study_date, content_type, sequence_no),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_daily_contents_date
    ON ap_daily_contents(plan_id, study_date, content_type, sequence_no);

CREATE TABLE IF NOT EXISTS ap_question_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    study_date TEXT NOT NULL,
    question_key TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('concept', 'subject_a', 'subject_b')),
    topic_id INTEGER,
    prompt TEXT NOT NULL,
    selected_answer TEXT,
    correct_answer TEXT,
    result TEXT NOT NULL CHECK (result IN ('correct', 'partial', 'wrong')),
    attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_question_attempts_history
    ON ap_question_attempts(admin_id, plan_id, study_date DESC, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ap_question_attempts_topic
    ON ap_question_attempts(plan_id, topic_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS ap_wrong_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    question_key TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('concept', 'subject_a', 'subject_b')),
    study_date TEXT NOT NULL,
    topic_id INTEGER,
    prompt TEXT NOT NULL,
    options_json TEXT,
    selected_answer TEXT,
    correct_answer TEXT,
    explanation TEXT,
    wrong_count INTEGER NOT NULL DEFAULT 1 CHECK (wrong_count > 0),
    last_wrong_at TEXT NOT NULL,
    resolved_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (admin_id, plan_id, question_key),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_wrong_notes_open
    ON ap_wrong_notes(admin_id, plan_id, resolved_at, last_wrong_at DESC);
