import {
	handleCreateAdminJapaneseWord,
	handleDeleteAdminJapaneseWord,
	handleUpdateAdminJapaneseWord,
} from './words';
import {
	ensureJapaneseWordHistorySchema,
	japaneseWordHistoryStatement,
} from './history';

async function safePayload(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const value = await request.clone().json();
		return value && typeof value === 'object' && !Array.isArray(value)
			? value as Record<string, unknown>
			: null;
	} catch {
		return null;
	}
}

function wordIdFromRequest(request: Request): number | null {
	const value = Number(new URL(request.url).searchParams.get('id'));
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function compactDetails(payload: Record<string, unknown> | null): Record<string, unknown> | null {
	if (!payload) return null;
	return {
		word: payload.word ?? null,
		reading: payload.reading ?? null,
		meaningKo: payload.meaningKo ?? null,
		meaningJa: payload.meaningJa ?? null,
		jlptLevelId: payload.jlptLevelId ?? null,
		partOfSpeechIds: payload.partOfSpeechIds ?? null,
		categoryId: payload.categoryId ?? null,
	};
}

async function recordManualHistory(
	env: Env,
	wordId: number,
	adminId: number | null,
	action: 'create' | 'update' | 'delete',
	details: unknown,
): Promise<void> {
	try {
		await japaneseWordHistoryStatement(env.song_project_db, {
			wordId,
			adminId,
			action,
			sourceType: 'manual',
			details,
		}).run();
	} catch (error) {
		console.warn('Failed to record Japanese word manual history', error);
	}
}

export async function handleCreateAdminJapaneseWordWithHistory(request: Request, env: Env): Promise<Response> {
	await ensureJapaneseWordHistorySchema(env.song_project_db);
	const payload = await safePayload(request);
	const response = await handleCreateAdminJapaneseWord(request, env);
	if (!response.ok) return response;

	try {
		const result = await response.clone().json() as { word?: { id?: unknown } };
		const wordId = Number(result?.word?.id);
		if (Number.isSafeInteger(wordId) && wordId > 0) {
			const adminRow = await env.song_project_db.prepare(`
				SELECT admin_id
				FROM audit_logs
				WHERE entity_type = 'japanese_word' AND entity_id = ?1 AND action = 'create'
				ORDER BY datetime(created_at) DESC, id DESC
				LIMIT 1
			`).bind(wordId).first<{ admin_id: number | null }>();
			await recordManualHistory(env, wordId, adminRow?.admin_id ?? null, 'create', compactDetails(payload));
		}
	} catch (error) {
		console.warn('Failed to inspect Japanese word create response for history', error);
	}
	return response;
}

export async function handleUpdateAdminJapaneseWordWithHistory(request: Request, env: Env): Promise<Response> {
	await ensureJapaneseWordHistorySchema(env.song_project_db);
	const wordId = wordIdFromRequest(request);
	const payload = await safePayload(request);
	const response = await handleUpdateAdminJapaneseWord(request, env);
	if (!response.ok || !wordId) return response;

	const adminRow = await env.song_project_db.prepare(`
		SELECT admin_id
		FROM audit_logs
		WHERE entity_type = 'japanese_word' AND entity_id = ?1 AND action = 'update'
		ORDER BY datetime(created_at) DESC, id DESC
		LIMIT 1
	`).bind(wordId).first<{ admin_id: number | null }>();
	await recordManualHistory(env, wordId, adminRow?.admin_id ?? null, 'update', compactDetails(payload));
	return response;
}

export async function handleDeleteAdminJapaneseWordWithHistory(request: Request, env: Env): Promise<Response> {
	await ensureJapaneseWordHistorySchema(env.song_project_db);
	const wordId = wordIdFromRequest(request);
	const before = wordId
		? await env.song_project_db.prepare(`
			SELECT word, reading
			FROM japanese_words
			WHERE id = ?1
			LIMIT 1
		`).bind(wordId).first<{ word: string; reading: string | null }>()
		: null;
	const response = await handleDeleteAdminJapaneseWord(request, env);
	if (!response.ok || !wordId) return response;

	const adminRow = await env.song_project_db.prepare(`
		SELECT admin_id
		FROM audit_logs
		WHERE entity_type = 'japanese_word' AND entity_id = ?1 AND action = 'delete'
		ORDER BY datetime(created_at) DESC, id DESC
		LIMIT 1
	`).bind(wordId).first<{ admin_id: number | null }>();
	await recordManualHistory(env, wordId, adminRow?.admin_id ?? null, 'delete', before);
	return response;
}
