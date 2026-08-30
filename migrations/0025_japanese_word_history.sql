-- 0025_japanese_word_history.sql
-- 일본어 단어 등록/병합/수정 이력과 입력 출처(직접입력/파일)를 기록한다.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japanese_word_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    admin_id INTEGER,
    action TEXT NOT NULL
        CHECK (action IN ('create', 'merge', 'update', 'delete')),
    source_type TEXT NOT NULL
        CHECK (source_type IN ('manual', 'file', 'legacy')),
    source_name TEXT,
    source_row INTEGER,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_japanese_word_history_word
    ON japanese_word_history(word_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_japanese_word_history_source
    ON japanese_word_history(source_type, source_name);

-- 기존 데이터는 과거 audit_logs의 create 기록이 확인되면 직접입력으로,
-- 확인할 수 없으면 '기존 데이터(출처 기록 전)'로 백필한다.
INSERT INTO japanese_word_history (
    word_id,
    admin_id,
    action,
    source_type,
    source_name,
    source_row,
    details_json,
    created_at
)
SELECT
    w.id,
    (
        SELECT al.admin_id
        FROM audit_logs AS al
        WHERE al.entity_type = 'japanese_word'
          AND al.entity_id = w.id
          AND al.action = 'create'
        ORDER BY datetime(al.created_at) ASC, al.id ASC
        LIMIT 1
    ),
    'create',
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM audit_logs AS al
            WHERE al.entity_type = 'japanese_word'
              AND al.entity_id = w.id
              AND al.action = 'create'
        ) THEN 'manual'
        ELSE 'legacy'
    END,
    NULL,
    NULL,
    '{"backfilled":true}',
    w.created_at
FROM japanese_words AS w
WHERE NOT EXISTS (
    SELECT 1
    FROM japanese_word_history AS h
    WHERE h.word_id = w.id
);
