-- 0003_comments_history_audit.sql
-- 댓글 / 게시글 버전 이력 / 관리자 감사 로그

PRAGMA foreign_keys = ON;

-- ============================================================
-- Comments
-- 비회원 댓글 + 관리자 답글 + 1단계 답글 UI를 위한 구조
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    parent_id INTEGER,
    admin_id INTEGER,
    nickname TEXT NOT NULL,
    password_hash TEXT,
    content TEXT NOT NULL,
    ip_encrypted TEXT,
    ip_hash TEXT,
    ip_masked TEXT,
    country_code TEXT,
    language_code TEXT NOT NULL
        CHECK (language_code IN ('ja', 'ko')),
    status TEXT NOT NULL DEFAULT 'visible'
        CHECK (status IN ('visible', 'hidden', 'spam')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    CHECK (parent_id IS NULL OR parent_id <> id),
    CHECK (
        (admin_id IS NULL AND password_hash IS NOT NULL)
        OR
        (admin_id IS NOT NULL AND password_hash IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id
    ON comments(post_id);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
    ON comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_status
    ON comments(status);

CREATE INDEX IF NOT EXISTS idx_comments_created_at
    ON comments(created_at);

CREATE INDEX IF NOT EXISTS idx_comments_ip_hash
    ON comments(ip_hash);

-- ============================================================
-- Post revisions
-- 게시글 언어별 저장 이력. 과거 상태 복원 시 기존 revision을 수정하지 않고
-- 새로운 revision을 추가한다.
-- ============================================================
CREATE TABLE IF NOT EXISTS post_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    language_code TEXT NOT NULL
        CHECK (language_code IN ('ja', 'ko')),
    revision_no INTEGER NOT NULL
        CHECK (revision_no > 0),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    status_snapshot TEXT NOT NULL
        CHECK (status_snapshot IN ('draft', 'published', 'private')),
    category_id_snapshot INTEGER,
    thumbnail_key_snapshot TEXT,
    change_type TEXT NOT NULL
        CHECK (change_type IN (
            'create',
            'manual_edit',
            'ai_translation',
            'translation_edit',
            'publish',
            'unpublish',
            'restore'
        )),
    change_summary TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id_snapshot) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
    UNIQUE (post_id, language_code, revision_no)
);

CREATE INDEX IF NOT EXISTS idx_post_revisions_post_language
    ON post_revisions(post_id, language_code);

CREATE INDEX IF NOT EXISTS idx_post_revisions_created_at
    ON post_revisions(created_at);

-- ============================================================
-- Audit logs
-- 관리자 작업 및 보안 이벤트 기록. 일반 관리자 UI에서는 삭제하지 않는다.
-- before_data / after_data는 JSON 문자열을 저장한다.
-- 비밀번호, 세션 토큰, TOTP secret, recovery code 등 민감값은 기록 금지.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    ip_encrypted TEXT,
    ip_hash TEXT,
    country_code TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id
    ON audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_hash
    ON audit_logs(ip_hash);

-- Application-level notes:
-- 1) 댓글 화면의 답글은 1단계까지만 표시한다.
--    답글에 다시 답글을 달 경우 애플리케이션에서 최상위 댓글 id를 parent_id로 사용한다.
-- 2) 방문자 댓글은 password_hash가 필수이며, 관리자 댓글은 admin_id를 사용한다.
-- 3) 댓글 본문은 기본 plain text로 취급하며 HTML을 escape한다.
-- 4) 댓글 삭제는 기본적으로 deleted_at을 사용하는 soft delete이다.
-- 5) IP 원문은 ip_encrypted에 암호화하여 저장하고, 검색/차단용으로 ip_hash를 사용한다.
--    공개 화면에는 ip_masked만 사용하며 복호화 키/HMAC secret은 Worker Secret에 둔다.
-- 6) post_revisions는 명시적 저장 시 생성하고, 과거 revision 복원도 새 revision으로 기록한다.
-- 7) audit_logs에는 password_hash, session token, TOTP secret, recovery code를 절대 기록하지 않는다.
