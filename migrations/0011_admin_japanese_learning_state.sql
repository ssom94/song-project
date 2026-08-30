-- 0011_admin_japanese_learning_state.sql
-- 일본어 단어 학습 상태/정오답 통계를 관리자별로 분리한다.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japanese_admin_word_learning_stats (
    admin_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    learning_state TEXT NOT NULL DEFAULT 'unlearned'
        CHECK (learning_state IN ('mastered', 'uncertain', 'unlearned')),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    last_answered_at TEXT,
    last_correct_at TEXT,
    last_wrong_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (admin_id, word_id),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_admin_learning_state
    ON japanese_admin_word_learning_stats(admin_id, learning_state, updated_at);

CREATE INDEX IF NOT EXISTS idx_japanese_admin_learning_word
    ON japanese_admin_word_learning_stats(word_id, admin_id);
