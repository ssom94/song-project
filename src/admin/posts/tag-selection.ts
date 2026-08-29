export function parseTagIds(value: unknown): number[] | null {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value) || value.length > 30) return null;

	const ids: number[] = [];
	const seen = new Set<number>();
	for (const item of value) {
		const id = Number(item);
		if (!Number.isSafeInteger(id) || id <= 0) return null;
		if (!seen.has(id)) {
			seen.add(id);
			ids.push(id);
		}
	}

	return ids.sort((a, b) => a - b);
}

export async function validateTagIds(db: D1Database, tagIds: number[]): Promise<boolean> {
	if (tagIds.length === 0) return true;

	const placeholders = tagIds.map((_, index) => `?${index + 1}`).join(', ');
	const result = await db
		.prepare(`SELECT id FROM tags WHERE deleted_at IS NULL AND id IN (${placeholders})`)
		.bind(...tagIds)
		.all<{ id: number }>();

	return result.results.length === tagIds.length;
}

export function prepareInsertPostTagStatements(
	db: D1Database,
	postId: number,
	tagIds: number[],
): D1PreparedStatement[] {
	return tagIds.map((tagId) =>
		db
			.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?1, ?2)')
			.bind(postId, tagId),
	);
}
