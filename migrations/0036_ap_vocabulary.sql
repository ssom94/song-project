-- 0036_ap_vocabulary.sql
-- AP 학습 중 모르는 일본어 기술용어를 별도 수집하고 복습/시험 이력을 관리한다.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ap_vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    topic_id INTEGER,
    term TEXT NOT NULL,
    reading TEXT,
    meaning_ko TEXT NOT NULL,
    meaning_ja TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('concept', 'question', 'manual')),
    source_text TEXT,
    note TEXT,
    learning_state TEXT NOT NULL DEFAULT 'unlearned'
        CHECK (learning_state IN ('unlearned', 'learning', 'uncertain', 'mastered')),
    review_stage INTEGER NOT NULL DEFAULT 0 CHECK (review_stage BETWEEN 0 AND 6),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_tested_at TEXT,
    next_review_on TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (plan_id, term),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_vocabulary_review
    ON ap_vocabulary(plan_id, next_review_on, learning_state, wrong_count DESC);

CREATE INDEX IF NOT EXISTS idx_ap_vocabulary_topic
    ON ap_vocabulary(plan_id, topic_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ap_vocabulary_quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    vocabulary_id INTEGER NOT NULL,
    quiz_type TEXT NOT NULL CHECK (quiz_type IN ('meaning', 'reading', 'context')),
    answer_text TEXT,
    result TEXT NOT NULL CHECK (result IN ('correct', 'wrong')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (vocabulary_id) REFERENCES ap_vocabulary(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ap_vocabulary_attempts
    ON ap_vocabulary_quiz_attempts(plan_id, vocabulary_id, created_at DESC);
