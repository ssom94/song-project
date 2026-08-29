-- 0008_access_code_rate_limit.sql
-- 4자리 보호문서 접근코드 brute-force 방지용 실패 이력

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS protected_access_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('ja', 'ko')),
    success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_protected_access_attempts_ip_time
    ON protected_access_attempts(ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_protected_access_attempts_cleanup
    ON protected_access_attempts(created_at);

-- Application policy:
-- 5 failed attempts from the same IP hash within 15 minutes => temporary 429 lockout.
