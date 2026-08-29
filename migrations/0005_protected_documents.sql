-- 0005_protected_documents.sql
-- 스킬표 / 직무경력서 보호 문서, 버전, 프리뷰, 접근 코드 및 접근 로그

PRAGMA foreign_keys = ON;

-- ============================================================
-- Protected documents
-- ============================================================
CREATE TABLE IF NOT EXISTS protected_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    document_type TEXT NOT NULL UNIQUE
        CHECK (document_type IN ('skill_sheet', 'career_history')),
    title_ja TEXT NOT NULL,
    title_ko TEXT NOT NULL,
    current_version_id INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (current_version_id) REFERENCES protected_document_versions(id) ON DELETE SET NULL
);

-- ============================================================
-- Immutable document versions
-- ============================================================
CREATE TABLE IF NOT EXISTS protected_document_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL
        CHECK (version_no > 0),
    original_file_key TEXT NOT NULL UNIQUE,
    original_file_name TEXT NOT NULL,
    original_file_size INTEGER NOT NULL
        CHECK (original_file_size >= 0),
    original_file_sha256 TEXT NOT NULL,
    change_summary TEXT,
    conversion_status TEXT NOT NULL DEFAULT 'queued'
        CHECK (conversion_status IN ('queued', 'processing', 'ready', 'failed')),
    conversion_error TEXT,
    conversion_started_at TEXT,
    conversion_finished_at TEXT,
    preview_page_count INTEGER NOT NULL DEFAULT 0
        CHECK (preview_page_count >= 0),
    uploaded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (document_id) REFERENCES protected_documents(id) ON DELETE RESTRICT,
    FOREIGN KEY (uploaded_by) REFERENCES admins(id) ON DELETE SET NULL,
    UNIQUE (document_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_protected_document_versions_document_id
    ON protected_document_versions(document_id);

CREATE INDEX IF NOT EXISTS idx_protected_document_versions_status
    ON protected_document_versions(conversion_status);

CREATE INDEX IF NOT EXISTS idx_protected_document_versions_sha256
    ON protected_document_versions(original_file_sha256);

-- ============================================================
-- Preview PNG pages
-- ============================================================
CREATE TABLE IF NOT EXISTS protected_document_preview_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    page_no INTEGER NOT NULL
        CHECK (page_no > 0),
    sheet_name TEXT,
    image_key TEXT NOT NULL UNIQUE,
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (version_id) REFERENCES protected_document_versions(id) ON DELETE CASCADE,
    UNIQUE (version_id, page_no)
);

CREATE INDEX IF NOT EXISTS idx_protected_preview_pages_version_id
    ON protected_document_preview_pages(version_id);

-- ============================================================
-- Access codes
-- Actual code is shown once and never stored in plaintext.
-- ============================================================
CREATE TABLE IF NOT EXISTS access_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    code_hint TEXT,
    label TEXT,
    allow_skill_sheet INTEGER NOT NULL DEFAULT 1
        CHECK (allow_skill_sheet IN (0, 1)),
    allow_career_history INTEGER NOT NULL DEFAULT 1
        CHECK (allow_career_history IN (0, 1)),
    issued_by INTEGER,
    issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    use_count INTEGER NOT NULL DEFAULT 0
        CHECK (use_count >= 0),
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (issued_by) REFERENCES admins(id) ON DELETE SET NULL,
    CHECK (allow_skill_sheet = 1 OR allow_career_history = 1)
);

CREATE INDEX IF NOT EXISTS idx_access_codes_expires_at
    ON access_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_access_codes_revoked_at
    ON access_codes(revoked_at);

-- ============================================================
-- Visitor access sessions
-- Cookie contains the raw random token; D1 stores only token_hash.
-- ============================================================
CREATE TABLE IF NOT EXISTS protected_access_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_code_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip_encrypted TEXT,
    ip_hash TEXT,
    country_code TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (access_code_id) REFERENCES access_codes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_protected_access_sessions_code_id
    ON protected_access_sessions(access_code_id);

CREATE INDEX IF NOT EXISTS idx_protected_access_sessions_expires_at
    ON protected_access_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_protected_access_sessions_ip_hash
    ON protected_access_sessions(ip_hash);

-- ============================================================
-- Protected document access / download logs
-- ============================================================
CREATE TABLE IF NOT EXISTS protected_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_code_id INTEGER,
    session_id INTEGER,
    document_id INTEGER,
    version_id INTEGER,
    action TEXT NOT NULL
        CHECK (action IN ('authenticate', 'view_preview', 'download_excel')),
    ip_encrypted TEXT,
    ip_hash TEXT,
    ip_masked TEXT,
    country_code TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (access_code_id) REFERENCES access_codes(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES protected_access_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES protected_documents(id) ON DELETE SET NULL,
    FOREIGN KEY (version_id) REFERENCES protected_document_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_protected_access_logs_code_id
    ON protected_access_logs(access_code_id);

CREATE INDEX IF NOT EXISTS idx_protected_access_logs_document_id
    ON protected_access_logs(document_id);

CREATE INDEX IF NOT EXISTS idx_protected_access_logs_created_at
    ON protected_access_logs(created_at);

-- ============================================================
-- Initial protected document definitions
-- No current version exists until the first successful upload/conversion.
-- ============================================================
INSERT OR IGNORE INTO protected_documents (
    slug,
    document_type,
    title_ja,
    title_ko
) VALUES
    ('skill-sheet', 'skill_sheet', 'スキルシート', '스킬표'),
    ('career-history', 'career_history', '職務経歴書', '직무경력서');

-- Application-level policies:
-- 1) Access code default expiry = issued_at + 30 days.
-- 2) A valid code requires: hash match, revoked_at IS NULL, and current time < expires_at.
-- 3) Visitor session expires_at must never exceed the parent access code expires_at.
-- 4) Revoked/expired code invalidates its sessions immediately; requests should join/check access_codes.
-- 5) Only a version with conversion_status='ready' may become current_version_id.
-- 6) Uploading a new Excel file creates a new immutable version; do not overwrite prior R2 objects.
-- 7) Re-conversion of the same original file reuses the same version_no.
-- 8) Visitors may preview/download only current versions allowed by their code permissions.
-- 9) Admins may access/download all historical versions.
-- 10) R2 original/preview objects stay private and are served only after Worker authorization.
