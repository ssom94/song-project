-- 0001_admin_auth.sql
-- 관리자 인증 / 세션 / 2FA 복구 코드

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),
    two_factor_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (two_factor_enabled IN (0, 1)),
    totp_secret_encrypted TEXT,
    two_factor_enabled_at TEXT,
    last_login_at TEXT,
    last_login_ip_encrypted TEXT,
    last_login_ip_hash TEXT,
    last_login_country_code TEXT,
    failed_login_count INTEGER NOT NULL DEFAULT 0
        CHECK (failed_login_count >= 0),
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_nocase
    ON admins(lower(email))
    WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    remember_me INTEGER NOT NULL DEFAULT 0
        CHECK (remember_me IN (0, 1)),
    user_agent TEXT,
    ip_encrypted TEXT,
    ip_hash TEXT,
    country_code TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id
    ON admin_sessions(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
    ON admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_ip_hash
    ON admin_sessions(ip_hash);

CREATE TABLE IF NOT EXISTS admin_recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    UNIQUE (admin_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_admin_recovery_codes_admin_id
    ON admin_recovery_codes(admin_id);

-- 세션 정책(애플리케이션 레벨):
-- 기본 30일, 로그인 상태 유지 선택 시 최대 90일.
-- 실제 session token은 DB에 저장하지 않고 token_hash만 저장한다.
-- TOTP secret은 평문이 아니라 암호화된 값만 저장한다.
