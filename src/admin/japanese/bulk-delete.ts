import { getAuthenticatedAdminSession } from '../../auth/session';
import {
	ensureJapaneseWordHistorySchema,
	japaneseWordHistoryStatement,
} from './history';

type BulkDeletePayload = {
	ids?: unknown;
};

interface WordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	jlpt_level_id: number | null;
	note: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function normalizeIds(value: unknown): number[] | null {
	if (!Array.isArray(value) || value.length === 0 || value.length > 500) return null;
	const ids: number[] = [];
	for (const raw of value) {
		const id = Number(raw);
		if (!Number.isSafeInteger(id) || id <= 0) return null;
		if (!ids.includes(id)) ids.push(id);
	}
	return ids.length ? ids : null;
}

function placeholders(count: number): string {
	return Array.from({ length: count }, (_, index) => `?${index + 1}`).join(', ');
}

export async function handleBulkDeleteAdminJapaneseWords(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: BulkDeletePayload;
	try {
		payload = await request.json() as BulkDeletePayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const ids = normalizeIds(payload.ids);
	if (!ids) return json({ ok: false, error: 'INVALID_WORD_IDS' }, 400);

	try {
		await ensureJapaneseWordHistorySchema(env.song_project_db);
		const now = new Date().toISOString();
		let deleted = 0;

		for (let start = 0; start < ids.length; start += 60) {
			const chunk = ids.slice(start, start + 60);
			const marks = placeholders(chunk.length);
			const before = await env.song_project_db.prepare(`
				SELECT id, word, reading, meaning_ko, meaning_ja, jlpt_level_id, note
				FROM japanese_words
				WHERE deleted_at IS NULL AND id IN (${marks})
			`).bind(...chunk).all<WordRow>();
			if (!before.results.length) continue;

			const activeIds = before.results.map((row) => row.id);
			const activeMarks = placeholders(activeIds.length);
			const statements: D1PreparedStatement[] = [
				env.song_project_db.prepare(`
					UPDATE japanese_words
					SET deleted_at = ?1, updated_at = ?1
					WHERE deleted_at IS NULL AND id IN (${activeIds.map((_, index) => `?${index + 2}`).join(', ')})
				`).bind(now, ...activeIds),
				env.song_project_db.prepare(`
					UPDATE japanese_word_examples
					SET deleted_at = ?1, updated_at = ?1
					WHERE deleted_at IS NULL AND word_id IN (${activeIds.map((_, index) => `?${index + 2}`).join(', ')})
				`).bind(now, ...activeIds),
			];

			for (const row of before.results) {
				statements.push(japaneseWordHistoryStatement(env.song_project_db, {
					wordId: row.id,
					adminId: session.adminId,
					action: 'delete',
					sourceType: 'manual',
					details: { word: row.word, reading: row.reading, bulk: true },
					createdAt: now,
				}));
				statements.push(env.song_project_db.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent, created_at)
					VALUES (?1, 'japanese_word', ?2, 'delete', ?3, ?4, ?5, ?6)
				`).bind(
					session.adminId,
					row.id,
					JSON.stringify(row),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
					now,
				));
			}

			await env.song_project_db.batch(statements);
			deleted += before.results.length;
		}

		return json({ ok: true, requested: ids.length, deleted });
	} catch (error) {
		console.error('Failed to bulk delete Japanese words', error);
		return json({ ok: false, error: 'JAPANESE_WORD_BULK_DELETE_FAILED' }, 500);
	}
}
