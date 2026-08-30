-- 0016_reset_seed_sequences.sql
-- Fixed seed rows use a reserved high ID range for idempotency.
-- Keep future user-created rows on the normal AUTOINCREMENT sequence.

UPDATE sqlite_sequence
SET seq = COALESCE((SELECT MAX(id) FROM categories WHERE id < 800000000), 0)
WHERE name = 'categories' AND seq >= 800000000;

UPDATE sqlite_sequence
SET seq = COALESCE((SELECT MAX(id) FROM category_translations WHERE id < 800000000), 0)
WHERE name = 'category_translations' AND seq >= 800000000;

UPDATE sqlite_sequence
SET seq = COALESCE((SELECT MAX(id) FROM tags WHERE id < 800000000), 0)
WHERE name = 'tags' AND seq >= 800000000;

UPDATE sqlite_sequence
SET seq = COALESCE((SELECT MAX(id) FROM tag_translations WHERE id < 800000000), 0)
WHERE name = 'tag_translations' AND seq >= 800000000;

UPDATE sqlite_sequence
SET seq = COALESCE((SELECT MAX(id) FROM posts WHERE id < 800000000), 0)
WHERE name = 'posts' AND seq >= 800000000;

UPDATE sqlite_sequence
SET seq = COALESCE((SELECT MAX(id) FROM post_translations WHERE id < 800000000), 0)
WHERE name = 'post_translations' AND seq >= 800000000;
