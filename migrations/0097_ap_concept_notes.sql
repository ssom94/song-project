-- 0097_ap_concept_notes.sql
-- 개인 AP 개념/예상문제 메모

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ap_concept_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    concept_id INTEGER NOT NULL,
    question_id INTEGER,
    target_type TEXT NOT NULL
        CHECK (target_type IN ('concept', 'question')),
    target_key TEXT NOT NULL,
    body TEXT NOT NULL
        CHECK (length(trim(body)) BETWEEN 1 AND 4000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (concept_id) REFERENCES ap_concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES ap_concept_questions(id) ON DELETE CASCADE,
    CHECK (
        (target_type = 'concept' AND question_id IS NULL)
        OR
        (target_type = 'question' AND question_id IS NOT NULL)
    ),
    UNIQUE (admin_id, target_key)
);

CREATE INDEX IF NOT EXISTS idx_ap_concept_notes_admin_concept
    ON ap_concept_notes(admin_id, concept_id, target_type);

CREATE INDEX IF NOT EXISTS idx_ap_concept_notes_question
    ON ap_concept_notes(question_id)
    WHERE question_id IS NOT NULL;
