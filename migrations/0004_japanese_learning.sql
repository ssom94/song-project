-- 0004_japanese_learning.sql
-- 일본어 학습 모듈: JLPT / 단어 / 품사 / 학습 분류 / 예문 / AI 초안 / 필기

PRAGMA foreign_keys = ON;

-- ============================================================
-- JLPT Levels
-- ============================================================
CREATE TABLE IF NOT EXISTS jlpt_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE
        CHECK (code IN ('N1', 'N2', 'N3', 'N4', 'N5')),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO jlpt_levels (code, display_order) VALUES
    ('N1', 1),
    ('N2', 2),
    ('N3', 3),
    ('N4', 4),
    ('N5', 5);

-- ============================================================
-- Parts of Speech
-- ============================================================
CREATE TABLE IF NOT EXISTS parts_of_speech (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ja TEXT NOT NULL,
    name_ko TEXT NOT NULL,
    parent_id INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES parts_of_speech(id) ON DELETE RESTRICT,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_parts_of_speech_parent_id
    ON parts_of_speech(parent_id);

CREATE INDEX IF NOT EXISTS idx_parts_of_speech_display_order
    ON parts_of_speech(display_order);

-- ============================================================
-- Japanese Study Categories
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    name_ja TEXT NOT NULL,
    name_ko TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES japanese_categories(id) ON DELETE RESTRICT,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_japanese_categories_parent_id
    ON japanese_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_japanese_categories_display_order
    ON japanese_categories(display_order);

-- ============================================================
-- Japanese Words
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    reading TEXT,
    meaning_ko TEXT,
    meaning_ja TEXT,
    jlpt_level_id INTEGER,
    ai_status TEXT NOT NULL DEFAULT 'not_analyzed'
        CHECK (ai_status IN ('not_analyzed', 'analyzed', 'reviewed')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (jlpt_level_id) REFERENCES jlpt_levels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_japanese_words_word
    ON japanese_words(word);

CREATE INDEX IF NOT EXISTS idx_japanese_words_reading
    ON japanese_words(reading);

CREATE INDEX IF NOT EXISTS idx_japanese_words_jlpt_level_id
    ON japanese_words(jlpt_level_id);

CREATE INDEX IF NOT EXISTS idx_japanese_words_ai_status
    ON japanese_words(ai_status);

CREATE INDEX IF NOT EXISTS idx_japanese_words_deleted_at
    ON japanese_words(deleted_at);

-- ============================================================
-- Word <-> Parts of Speech
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_word_parts_of_speech (
    word_id INTEGER NOT NULL,
    part_of_speech_id INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0
        CHECK (is_primary IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (word_id, part_of_speech_id),
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE,
    FOREIGN KEY (part_of_speech_id) REFERENCES parts_of_speech(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_japanese_word_pos_part_id
    ON japanese_word_parts_of_speech(part_of_speech_id);

-- 한 단어에는 대표 품사를 최대 하나만 허용한다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_japanese_word_pos_primary
    ON japanese_word_parts_of_speech(word_id)
    WHERE is_primary = 1;

-- ============================================================
-- Word <-> Study Categories
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_word_categories (
    word_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (word_id, category_id),
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES japanese_categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_japanese_word_categories_category_id
    ON japanese_word_categories(category_id);

-- ============================================================
-- Examples
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_word_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    sentence_ja TEXT NOT NULL,
    reading TEXT,
    translation_ko TEXT,
    note TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('manual', 'ai')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_word_examples_word_id
    ON japanese_word_examples(word_id);

CREATE INDEX IF NOT EXISTS idx_japanese_word_examples_deleted_at
    ON japanese_word_examples(deleted_at);

-- ============================================================
-- AI Review Drafts
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_word_ai_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER,
    input_word TEXT NOT NULL,
    suggestion_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'reviewed', 'applied', 'rejected')),
    provider TEXT,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    reviewed_at TEXT,
    applied_at TEXT,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_japanese_word_ai_drafts_word_id
    ON japanese_word_ai_drafts(word_id);

CREATE INDEX IF NOT EXISTS idx_japanese_word_ai_drafts_status
    ON japanese_word_ai_drafts(status);

CREATE INDEX IF NOT EXISTS idx_japanese_word_ai_drafts_created_at
    ON japanese_word_ai_drafts(created_at);

-- ============================================================
-- Handwriting Attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS japanese_handwriting_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    stroke_data TEXT NOT NULL,
    image_key TEXT NOT NULL,
    canvas_width INTEGER NOT NULL CHECK (canvas_width > 0),
    canvas_height INTEGER NOT NULL CHECK (canvas_height > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_handwriting_word_id
    ON japanese_handwriting_attempts(word_id);

CREATE INDEX IF NOT EXISTS idx_japanese_handwriting_created_at
    ON japanese_handwriting_attempts(created_at);

-- Notes:
-- 1) parts_of_speech / japanese_categories의 순환 참조는 관리자 애플리케이션에서도 추가 검증한다.
-- 2) 단어 자체는 동형이의어/복수 의미 가능성을 고려해 UNIQUE로 강제하지 않는다.
-- 3) AI suggestion_json은 검토용 초안이며 관리자 승인 전에는 본 데이터에 자동 반영하지 않는다.
-- 4) 필기 PNG 원본은 R2에 저장하고 D1에는 image_key와 stroke JSON만 저장한다.
-- 5) updated_at은 UPDATE 시 애플리케이션에서 현재 UTC 시각으로 갱신한다.
