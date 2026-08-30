-- 0016_teamlab_post_revisions.sql
-- Seeded TeamLab posts should participate in the same revision history as posts created in Admin.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO post_revisions (
    post_id,
    language_code,
    revision_no,
    title,
    slug,
    content,
    excerpt,
    status_snapshot,
    category_id_snapshot,
    thumbnail_key_snapshot,
    change_type,
    change_summary,
    created_by,
    created_at
)
SELECT
    pt.post_id,
    pt.language_code,
    1,
    pt.title,
    pt.slug,
    pt.content,
    pt.excerpt,
    p.status,
    p.category_id,
    p.thumbnail_key,
    CASE
        WHEN pt.language_code = p.original_language THEN 'create'
        ELSE 'translation_edit'
    END,
    'Seeded TeamLab article initial revision',
    NULL,
    pt.created_at
FROM post_translations AS pt
INNER JOIN posts AS p ON p.id = pt.post_id
WHERE pt.post_id BETWEEN 810000001 AND 810000009;
