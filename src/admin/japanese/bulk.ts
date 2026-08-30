import { getAuthenticatedAdminSession } from '../../auth/session';

type BulkPayload = {
	wordIds?: unknown;
	applyJlpt?: unknown;
	jlptLevelId?: unknown;
	applyParts?: unknown;
	partOfSpeechIds?: unknown;
	applyCategory?: unknown;
	categoryId?: unknown;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function nullableId(value: unknown): number | null | 'INVALID' {
	if (value === null || value === undefined || value === '') return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : 'INVALID';
}

function idList(value: unknown, max = 500): number[] | 'INVALID' {
	if (!Array.isArray(value) || value.length === 0 || value.length > max) return 'INVALID';
	const ids: number[] = [];
	for (const item of value) {
		const id = Number(item);
		if (!Number.isSafeInteger(id) || id <= 0) return 'INVALID';
		if (!ids.includes(id)) ids.push(id);
	}
	return ids;
}

async function referenceExists(db: D1Database, table: string, id: number): Promise<boolean> {
	const allowed = new Set(['jlpt_levels', 'parts_of_speech', 'japanese_categories']);
	if (!allowed.has(table)) return false;
	const deletedClause = table === 'jlpt_levels' ? '' : ' AND deleted_at IS NULL';
	const row = await db.prepare(`SELECT id FROM ${table} WHERE id = ?1${deletedClause} LIMIT 1`).bind(id).first();
	return Boolean(row);
}

export async function handleBulkUpdateAdminJapaneseWords(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: BulkPayload;
	try {
		payload = await request.json() as BulkPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const wordIds = idList(payload.wordIds);
	if (wordIds === 'INVALID') return json({ ok: false, error: 'INVALID_WORD_IDS' }, 400);

	const applyJlpt = payload.applyJlpt === true;
	const applyParts = payload.applyParts === true;
	const applyCategory = payload.applyCategory === true;
	if (!applyJlpt && !applyParts && !applyCategory) {
		return json({ ok: false, error: 'NO_CHANGES' }, 400);
	}

	const jlptLevelId = nullableId(payload.jlptLevelId);
	const categoryId = nullableId(payload.categoryId);
	if (jlptLevelId === 'INVALID' || categoryId === 'INVALID') return json({ ok: false, error: 'INVALID_REFERENCE' }, 400);

	let partOfSpeechIds: number[] = [];
	if (applyParts) {
		if (!Array.isArray(payload.partOfSpeechIds) || payload.partOfSpeechIds.length > 20) {
			return json({ ok: false, error: 'INVALID_PARTS' }, 400);
		}
		for (const item of payload.partOfSpeechIds) {
			const id = Number(item);
			if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_PARTS' }, 400);
			if (!partOfSpeechIds.includes(id)) partOfSpeechIds.push(id);
		}
	}

	if (applyJlpt && jlptLevelId && !(await referenceExists(env.song_project_db, 'jlpt_levels', jlptLevelId))) {
		return json({ ok: false, error: 'JLPT_NOT_FOUND' }, 400);
	}
	if (applyCategory && categoryId && !(await referenceExists(env.song_project_db, 'japanese_categories', categoryId))) {
		return json({ ok: false, error: 'CATEGORY_NOT_FOUND' }, 400);
	}
	if (applyParts) {
		for (const partId of partOfSpeechIds) {
			if (!(await referenceExists(env.song_project_db, 'parts_of_speech', partId))) {
				return json({ ok: false, error: 'PART_OF_SPEECH_NOT_FOUND', partId }, 400);
			}
	}
	}

	const now = new Date().toISOString();
	let updated = 0;
	const missing: number[] = [];

	try {
		for (const wordId of wordIds) {
			const existing = await env.song_project_db
				.prepare('SELECT id FROM japanese_words WHERE id = ?1 AND deleted_at IS NULL LIMIT 1')
				.bind(wordId)
				.first<{ id: number }>();
			if (!existing) {
				missing.push(wordId);
				continue;
			}

			const statements: D1PreparedStatement[] = [];
			if (applyJlpt) {
				statements.push(env.song_project_db.prepare(`
					UPDATE japanese_words SET jlpt_level_id = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL
				`).bind(jlptLevelId, now, wordId));
			} else {
				statements.push(env.song_project_db.prepare(`
					UPDATE japanese_words SET updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL
				`).bind(now, wordId));
			}

			if (applyParts) {
				statements.push(env.song_project_db.prepare('DELETE FROM japanese_word_parts_of_speech WHERE word_id = ?1').bind(wordId));
				partOfSpeechIds.forEach((partId, index) => {
					statements.push(env.song_project_db.prepare(`
						INSERT INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
						VALUES (?1, ?2, ?3, ?4)
					`).bind(wordId, partId, index === 0 ? 1 : 0, now));
				});
			}

			if (applyCategory) {
				statements.push(env.song_project_db.prepare('DELETE FROM japanese_word_categories WHERE word_id = ?1').bind(wordId));
				if (categoryId) {
					statements.push(env.song_project_db.prepare(`
						INSERT INTO japanese_word_categories (word_id, category_id, created_at)
						VALUES (?1, ?2, ?3)
					`).bind(wordId, categoryId, now));
				}
			}

			statements.push(env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'japanese_word', ?2, 'bulk_update', ?3, ?4, ?5)
			`).bind(
				session.adminId,
				wordId,
				JSON.stringify({
					applyJlpt,
					jlptLevelId,
					applyParts,
					partOfSpeechIds,
					applyCategory,
					categoryId,
				}),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			));

			await env.song_project_db.batch(statements);
			updated += 1;
		}

		return json({ ok: true, requested: wordIds.length, updated, missing });
	} catch (error) {
		console.error('Failed to bulk update Japanese words', error);
		return json({ ok: false, error: 'JAPANESE_WORD_BULK_UPDATE_FAILED' }, 500);
	}
}
