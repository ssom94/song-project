-- 0040_category_icons_site_cursor.sql
-- Blog category icon/color appearance + lightweight public cursor settings

PRAGMA foreign_keys = ON;

ALTER TABLE categories ADD COLUMN icon_kind TEXT NOT NULL DEFAULT 'preset'
    CHECK (icon_kind IN ('preset', 'emoji', 'image', 'none'));
ALTER TABLE categories ADD COLUMN icon_value TEXT NOT NULL DEFAULT 'folder';
ALTER TABLE categories ADD COLUMN icon_color TEXT NOT NULL DEFAULT '#5b6ee1';

-- Give the two existing blog categories useful defaults when they exist.
UPDATE categories
SET icon_kind = 'preset', icon_value = 'briefcase', icon_color = '#356cc9'
WHERE id IN (
    SELECT category_id FROM category_translations
    WHERE name IN ('현장경험', '現場経験')
);

UPDATE categories
SET icon_kind = 'preset', icon_value = 'code', icon_color = '#7157c8'
WHERE id IN (
    SELECT category_id FROM category_translations
    WHERE name IN ('teamLab 전형', 'teamLab選考', 'teamLab 전형 ')
);

CREATE TABLE IF NOT EXISTS site_visual_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cursor_enabled INTEGER NOT NULL DEFAULT 1 CHECK (cursor_enabled IN (0, 1)),
    cursor_theme TEXT NOT NULL DEFAULT 'blue'
        CHECK (cursor_theme IN ('blue', 'navy', 'mint')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO site_visual_settings (id, cursor_enabled, cursor_theme)
VALUES (1, 1, 'blue');
