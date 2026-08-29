-- 0002_blog_core.sql
-- 블로그 핵심: 카테고리 / 태그 / 게시글 / 다국어 번역

PRAGMA foreign_keys = ON;

-- ============================================================
-- Categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id
    ON categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_display_order
    ON categories(display_order);

CREATE TABLE IF NOT EXISTS category_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    language_code TEXT NOT NULL
        CHECK (language_code IN ('ja', 'ko')),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE (category_id, language_code),
    UNIQUE (language_code, slug)
);

CREATE INDEX IF NOT EXISTS idx_category_translations_category_id
    ON category_translations(category_id);

-- ============================================================
-- Tags
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tag_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id INTEGER NOT NULL,
    language_code TEXT NOT NULL
        CHECK (language_code IN ('ja', 'ko')),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE (tag_id, language_code),
    UNIQUE (language_code, slug)
);

CREATE INDEX IF NOT EXISTS idx_tag_translations_tag_id
    ON tag_translations(tag_id);

-- ============================================================
-- Posts
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_language TEXT NOT NULL
        CHECK (original_language IN ('ja', 'ko')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'private')),
    category_id INTEGER,
    thumbnail_key TEXT,
    view_count INTEGER NOT NULL DEFAULT 0
        CHECK (view_count >= 0),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status
    ON posts(status);

CREATE INDEX IF NOT EXISTS idx_posts_category_id
    ON posts(category_id);

CREATE INDEX IF NOT EXISTS idx_posts_published_at
    ON posts(published_at);

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at
    ON posts(deleted_at);

CREATE TABLE IF NOT EXISTS post_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    language_code TEXT NOT NULL
        CHECK (language_code IN ('ja', 'ko')),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    translation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (translation_status IN ('original', 'pending', 'translated', 'reviewed')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE (post_id, language_code),
    UNIQUE (language_code, slug)
);

CREATE INDEX IF NOT EXISTS idx_post_translations_post_id
    ON post_translations(post_id);

CREATE INDEX IF NOT EXISTS idx_post_translations_language_code
    ON post_translations(language_code);

-- ============================================================
-- Post <-> Tags (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id
    ON post_tags(tag_id);

-- Notes:
-- 1) 카테고리 순환(parent -> descendant)은 DB의 단순 CHECK만으로 완전히 막을 수 없으므로
--    관리자 애플리케이션에서 추가 검증한다.
-- 2) categories/tags/posts는 기본적으로 soft delete를 사용한다.
-- 3) updated_at은 UPDATE 시 애플리케이션에서 현재 UTC 시각으로 갱신한다.
-- 4) 게시글 본문은 Markdown 원문을 post_translations.content에 저장한다.
