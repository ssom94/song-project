-- 0013_it_skill_catalog.sql
-- Master IT skill catalog schema used by the editable skill sheet.
-- Seed rows are split into later migrations to stay below SQLite/D1 statement limits.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS it_skill_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    usage_area TEXT NOT NULL,
    description_ja TEXT NOT NULL DEFAULT '',
    description_ko TEXT NOT NULL DEFAULT '',
    aliases TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_it_skill_catalog_category
    ON it_skill_catalog(is_active, category, skill_type, name);

CREATE INDEX IF NOT EXISTS idx_it_skill_catalog_usage
    ON it_skill_catalog(is_active, usage_area, name);

CREATE TABLE IF NOT EXISTS skill_sheet_section_skills (
    section_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (section_id, skill_id),
    FOREIGN KEY (section_id) REFERENCES skill_sheet_summary_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES it_skill_catalog(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_skill_sheet_section_skills_order
    ON skill_sheet_section_skills(section_id, display_order, skill_id);
