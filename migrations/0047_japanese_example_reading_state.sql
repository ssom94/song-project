-- 0047_japanese_example_reading_state.sql
-- 일본어 예문 독해 상태 관리

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japanese_example_reading_states (
    admin_id INTEGER NOT NULL,
    example_id INTEGER NOT NULL,
    reading_state TEXT NOT NULL DEFAULT 'unlearned'
        CHECK (reading_state IN ('mastered', 'review', 'unlearned')),
    checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (admin_id, example_id),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (example_id) REFERENCES japanese_word_examples(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_example_reading_states_status
    ON japanese_example_reading_states(admin_id, reading_state, checked, updated_at DESC);
