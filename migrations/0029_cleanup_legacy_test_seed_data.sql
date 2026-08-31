-- 0029_cleanup_legacy_test_seed_data.sql
-- Remove reusable development/test seed rows from production-safe data.
-- Reserved test ID range is 900000001+ (see seeds/test_data.sql).
-- Real seeded content such as teamLab (810...) and field experience (820...) is untouched.

PRAGMA foreign_keys = ON;

-- Blog test data: delete dependent rows first.
DELETE FROM comments
WHERE id >= 900000001 OR post_id >= 900000001;

DELETE FROM post_revisions
WHERE id >= 900000001 OR post_id >= 900000001;

DELETE FROM post_tags
WHERE post_id >= 900000001 OR tag_id >= 900000001;

DELETE FROM post_translations
WHERE id >= 900000001 OR post_id >= 900000001;

DELETE FROM posts
WHERE id >= 900000001;

DELETE FROM tag_translations
WHERE id >= 900000001 OR tag_id >= 900000001;

DELETE FROM tags
WHERE id >= 900000001;

DELETE FROM category_translations
WHERE id >= 900000001 OR category_id >= 900000001;

DELETE FROM categories
WHERE id >= 900000001;

-- Japanese-learning test data.
DELETE FROM japanese_word_history
WHERE word_id >= 900000001;

DELETE FROM japanese_word_examples
WHERE id >= 900000001 OR word_id >= 900000001;

DELETE FROM japanese_word_categories
WHERE word_id >= 900000001 OR category_id >= 900000001;

DELETE FROM japanese_word_parts_of_speech
WHERE word_id >= 900000001 OR part_of_speech_id >= 900000001;

DELETE FROM japanese_words
WHERE id >= 900000001;

DELETE FROM japanese_categories
WHERE id >= 900000001;

DELETE FROM parts_of_speech
WHERE id >= 900000001;
