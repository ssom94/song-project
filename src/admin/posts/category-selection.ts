export type PostCategorySelectionResult =
	| { ok: true; categoryId: number | null }
	| { ok: false; error: 'INVALID_CATEGORY' | 'CATEGORY_HAS_CHILDREN' };

export async function resolvePostCategoryId(db: D1Database, value: unknown): Promise<PostCategorySelectionResult> {
	if (value === null || value === undefined || value === '') {
		return { ok: true, categoryId: null };
	}

	const categoryId = Number(value);
	if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
		return { ok: false, error: 'INVALID_CATEGORY' };
	}

	const category = await db
		.prepare(`
			SELECT
				c.id,
				EXISTS(
					SELECT 1
					FROM categories AS child
					WHERE child.parent_id = c.id
						AND child.deleted_at IS NULL
				) AS has_children
			FROM categories AS c
			WHERE c.id = ?1
				AND c.deleted_at IS NULL
			LIMIT 1
		`)
		.bind(categoryId)
		.first<{ id: number; has_children: number }>();

	if (!category) return { ok: false, error: 'INVALID_CATEGORY' };
	if (Boolean(category.has_children)) return { ok: false, error: 'CATEGORY_HAS_CHILDREN' };
	return { ok: true, categoryId };
}
