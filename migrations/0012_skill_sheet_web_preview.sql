-- 0012_skill_sheet_web_preview.sql
-- Editable public skill-sheet summary + parsed Excel sheet previews.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS skill_sheet_summary (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    heading_ja TEXT NOT NULL,
    heading_ko TEXT NOT NULL,
    description_ja TEXT NOT NULL,
    description_ko TEXT NOT NULL,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS skill_sheet_summary_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_key TEXT NOT NULL UNIQUE,
    title_ja TEXT NOT NULL,
    title_ko TEXT NOT NULL,
    description_ja TEXT NOT NULL DEFAULT '',
    description_ko TEXT NOT NULL DEFAULT '',
    skills_json TEXT NOT NULL DEFAULT '[]',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_skill_sheet_summary_sections_order
    ON skill_sheet_summary_sections(is_visible, display_order, id);

CREATE TABLE IF NOT EXISTS protected_document_sheet_previews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    sheet_index INTEGER NOT NULL CHECK (sheet_index >= 0),
    sheet_name TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    column_count INTEGER NOT NULL DEFAULT 0 CHECK (column_count >= 0),
    rows_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (version_id) REFERENCES protected_document_versions(id) ON DELETE CASCADE,
    UNIQUE (version_id, sheet_index)
);

CREATE INDEX IF NOT EXISTS idx_protected_document_sheet_previews_version
    ON protected_document_sheet_previews(version_id, sheet_index);

INSERT OR IGNORE INTO skill_sheet_summary (
    id, heading_ja, heading_ko, description_ja, description_ko
) VALUES (
    1,
    '技術スキル',
    '기술 스킬',
    'Webアプリケーション開発を中心に、フロントエンド、バックエンド、DB、運用・移行までの経験をまとめています。',
    '웹 애플리케이션 개발을 중심으로 프론트엔드, 백엔드, DB, 운영·마이그레이션 경험을 정리했습니다.'
);

INSERT OR IGNORE INTO skill_sheet_summary_sections (
    section_key, title_ja, title_ko, description_ja, description_ko, skills_json, display_order
) VALUES
    ('frontend', 'Frontend', 'Frontend', 'SPA開発、画面実装、API連携、障害調査など。', 'SPA 개발, 화면 구현, API 연동, 장애 조사 등.', '["Angular","TypeScript","JavaScript","HTML/CSS","Vue"]', 10),
    ('backend', 'Backend', 'Backend', 'REST API、業務ロジック、既存システム保守・改修。', 'REST API, 업무 로직, 기존 시스템 유지보수·개선.', '["Java","Spring","REST API","Liberty / WAS"]', 20),
    ('database-migration', 'Database & Migration', 'Database & Migration', '設計、SQL、データ移行、権限・所有者、監査ログ対応。', '설계, SQL, 데이터 이행, 권한·소유자, 감사 로그 대응.', '["PostgreSQL","Db2","Oracle","psql","Shell"]', 30),
    ('delivery-operations', 'Delivery & Operations', 'Delivery & Operations', 'ビルド、CI/CD、ジョブ運用、チーム内リーダー代行経験。', '빌드, CI/CD, 잡 운영, 팀 내 리더 대행 경험.', '["Git","Jenkins","JP1","JobCenter","AWS Learning"]', 40);
