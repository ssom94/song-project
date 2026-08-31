-- 0041_site_background_settings.sql
-- Public site background customization managed from SONG Admin.

PRAGMA foreign_keys = ON;

ALTER TABLE site_visual_settings ADD COLUMN background_kind TEXT NOT NULL DEFAULT 'default'
    CHECK (background_kind IN ('default', 'solid', 'preset', 'image'));
ALTER TABLE site_visual_settings ADD COLUMN background_value TEXT NOT NULL DEFAULT '';
ALTER TABLE site_visual_settings ADD COLUMN background_overlay INTEGER NOT NULL DEFAULT 12
    CHECK (background_overlay BETWEEN 0 AND 80);
