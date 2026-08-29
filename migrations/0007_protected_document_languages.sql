-- 0007_protected_document_languages.sql
-- 보호 문서 / 접근 코드의 JA·KO 언어 분리

PRAGMA foreign_keys = ON;

ALTER TABLE protected_document_versions
ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'
    CHECK (language IN ('ja', 'ko'));

ALTER TABLE access_codes
ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'
    CHECK (language IN ('ja', 'ko'));

ALTER TABLE protected_documents
ADD COLUMN current_version_ja_id INTEGER REFERENCES protected_document_versions(id) ON DELETE SET NULL;

ALTER TABLE protected_documents
ADD COLUMN current_version_ko_id INTEGER REFERENCES protected_document_versions(id) ON DELETE SET NULL;

UPDATE protected_documents
SET current_version_ja_id = current_version_id
WHERE current_version_id IS NOT NULL
  AND current_version_ja_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_protected_document_versions_language
    ON protected_document_versions(document_id, language, version_no);

CREATE INDEX IF NOT EXISTS idx_access_codes_language
    ON access_codes(language, expires_at, revoked_at);

-- Application policies:
-- 1) New protected document uploads must explicitly choose ja or ko.
-- 2) current_version_ja_id / current_version_ko_id are the per-language published versions.
-- 3) Legacy current_version_id remains for backwards compatibility until all consumers migrate.
-- 4) New access codes are exactly 4 numeric digits and are scoped to one language.
