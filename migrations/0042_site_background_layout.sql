-- 0042_site_background_layout.sql
-- Background fit, scale and focal position controls for public site visuals.

PRAGMA foreign_keys = ON;

ALTER TABLE site_visual_settings ADD COLUMN background_size_mode TEXT NOT NULL DEFAULT 'cover'
    CHECK (background_size_mode IN ('cover', 'contain', 'custom'));
ALTER TABLE site_visual_settings ADD COLUMN background_scale INTEGER NOT NULL DEFAULT 100
    CHECK (background_scale BETWEEN 50 AND 250);
ALTER TABLE site_visual_settings ADD COLUMN background_position_x INTEGER NOT NULL DEFAULT 50
    CHECK (background_position_x BETWEEN 0 AND 100);
ALTER TABLE site_visual_settings ADD COLUMN background_position_y INTEGER NOT NULL DEFAULT 50
    CHECK (background_position_y BETWEEN 0 AND 100);
