-- 0024_it_skill_catalog_seed_08.sql
-- Split IT skill master seed; safe for Cloudflare D1 / SQLite statement limits.

INSERT OR IGNORE INTO it_skill_catalog
(skill_key, name, category, skill_type, usage_area, aliases, display_order)
VALUES
('tableau','Tableau','Tools','Tool','Data,BI,Visualization','',4210);

UPDATE it_skill_catalog
SET description_ja = CASE WHEN description_ja = '' THEN '主な用途: ' || replace(usage_area, ',', ' / ') || '。' ELSE description_ja END,
    description_ko = CASE WHEN description_ko = '' THEN '주요 용도: ' || replace(usage_area, ',', ' / ') || '.' ELSE description_ko END;
