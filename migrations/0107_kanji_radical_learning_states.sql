-- 0107_kanji_radical_learning_states.sql
-- 부수 학습 상태를 기기 간 공유한다. 부수 설명 데이터는 정적 학습 자료로 제공한다.

CREATE TABLE IF NOT EXISTS japanese_admin_radical_states (
    admin_id INTEGER NOT NULL,
    radical TEXT NOT NULL,
    learning_state TEXT NOT NULL DEFAULT 'unlearned'
        CHECK (learning_state IN ('unlearned', 'unsure', 'mastered')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (admin_id, radical),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_radical_states_order
ON japanese_admin_radical_states(admin_id, learning_state, updated_at);
