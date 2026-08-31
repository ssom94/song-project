-- 0029_cleanup_legacy_test_seed_data.sql
-- Remove reusable development/test seed rows from production-safe data.
-- Reserved test ID range is 900000001+ (see seeds/test_data.sql).
-- Real seeded content such as teamLab (810...) and field experience (820...) is untouched.

PRAGMA foreign_keys = ON;

-- ============================================================
-- Blog test data
-- ============================================================
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

-- categories.parent_id uses ON DELETE RESTRICT, so detach any child first.
UPDATE categories
SET parent_id = NULL
WHERE parent_id >= 900000001;

DELETE FROM categories
WHERE id >= 900000001;

-- ============================================================
-- Japanese-learning test data
-- ============================================================
-- Remove or detach dependent learning records before words/taxonomy.
DELETE FROM japanese_quiz_attempts
WHERE id >= 900000001 OR word_id >= 900000001 OR example_id >= 900000001;

DELETE FROM japanese_word_learning_stats
WHERE word_id >= 900000001;

DELETE FROM japanese_admin_word_learning_stats
WHERE word_id >= 900000001;

DELETE FROM japanese_word_history
WHERE word_id >= 900000001;

DELETE FROM japanese_handwriting_attempts
WHERE id >= 900000001 OR word_id >= 900000001;

UPDATE japanese_word_ai_drafts
SET word_id = NULL
WHERE word_id >= 900000001;

DELETE FROM japanese_word_examples
WHERE id >= 900000001 OR word_id >= 900000001;

DELETE FROM japanese_word_categories
WHERE word_id >= 900000001 OR category_id >= 900000001;

DELETE FROM japanese_word_parts_of_speech
WHERE word_id >= 900000001 OR part_of_speech_id >= 900000001;

DELETE FROM japanese_words
WHERE id >= 900000001;

-- Self-referencing taxonomy tables use ON DELETE RESTRICT.
UPDATE japanese_categories
SET parent_id = NULL
WHERE parent_id >= 900000001;

DELETE FROM japanese_categories
WHERE id >= 900000001;

UPDATE parts_of_speech
SET parent_id = NULL
WHERE parent_id >= 900000001;

DELETE FROM parts_of_speech
WHERE id >= 900000001;
