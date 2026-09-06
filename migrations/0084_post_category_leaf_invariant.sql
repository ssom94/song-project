-- Parent categories are grouping/filter nodes only.
-- Existing posts assigned directly to a parent category are moved to the
-- first active leaf descendant by category display order.

WITH RECURSIVE
roots(root_id) AS (
	SELECT DISTINCT p.category_id
	FROM posts AS p
	WHERE p.deleted_at IS NULL
		AND p.category_id IS NOT NULL
		AND EXISTS (
			SELECT 1
			FROM categories AS child
			WHERE child.parent_id = p.category_id
				AND child.deleted_at IS NULL
		)
),
descendants(root_id, category_id, sort_path) AS (
	SELECT
		roots.root_id,
		child.id,
		printf('%010d-%020d', child.display_order, child.id)
	FROM roots
	INNER JOIN categories AS child
		ON child.parent_id = roots.root_id
		AND child.deleted_at IS NULL

	UNION ALL

	SELECT
		descendants.root_id,
		child.id,
		descendants.sort_path || '/' || printf('%010d-%020d', child.display_order, child.id)
	FROM descendants
	INNER JOIN categories AS child
		ON child.parent_id = descendants.category_id
		AND child.deleted_at IS NULL
),
leaf_candidates AS (
	SELECT
		descendants.root_id,
		descendants.category_id,
		descendants.sort_path,
		ROW_NUMBER() OVER (
			PARTITION BY descendants.root_id
			ORDER BY descendants.sort_path ASC, descendants.category_id ASC
		) AS leaf_rank
	FROM descendants
	WHERE NOT EXISTS (
		SELECT 1
		FROM categories AS child
		WHERE child.parent_id = descendants.category_id
			AND child.deleted_at IS NULL
	)
),
first_leaf AS (
	SELECT root_id, category_id AS leaf_id
	FROM leaf_candidates
	WHERE leaf_rank = 1
)
UPDATE posts
SET category_id = (
	SELECT first_leaf.leaf_id
	FROM first_leaf
	WHERE first_leaf.root_id = posts.category_id
)
WHERE posts.deleted_at IS NULL
	AND posts.category_id IN (SELECT root_id FROM first_leaf);

-- Defense in depth: even a direct API/SQL write cannot assign a post to an
-- active category that currently owns child categories.
CREATE TRIGGER IF NOT EXISTS trg_posts_leaf_category_insert
BEFORE INSERT ON posts
WHEN NEW.category_id IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM categories AS child
		WHERE child.parent_id = NEW.category_id
			AND child.deleted_at IS NULL
	)
BEGIN
	SELECT RAISE(ABORT, 'CATEGORY_HAS_CHILDREN');
END;

CREATE TRIGGER IF NOT EXISTS trg_posts_leaf_category_update
BEFORE UPDATE OF category_id ON posts
WHEN NEW.category_id IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM categories AS child
		WHERE child.parent_id = NEW.category_id
			AND child.deleted_at IS NULL
	)
BEGIN
	SELECT RAISE(ABORT, 'CATEGORY_HAS_CHILDREN');
END;
