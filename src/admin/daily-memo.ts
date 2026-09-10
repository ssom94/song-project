import { getAuthenticatedAdminSession } from '../auth/session';
import { japanDateString } from '../jlpt-study';

const MAX_MEMO_LENGTH = 10000;

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

export async function handleAdminDailyMemo(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const memoDate = japanDateString();

	if (request.method === 'GET') {
		const row = await env.song_project_db.prepare(`
			SELECT content, updated_at FROM admin_daily_memos
			WHERE admin_id = ?1 AND memo_date = ?2 LIMIT 1
		`).bind(session.adminId, memoDate).first<{ content: string; updated_at: string }>();
		return json({ ok: true, memoDate, content: row?.content ?? '', updatedAt: row?.updated_at ?? null });
	}

	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	let payload: { content?: unknown };
	try {
		payload = await request.json() as { content?: unknown };
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	if (typeof payload.content !== 'string' || payload.content.length > MAX_MEMO_LENGTH) {
		return json({ ok: false, error: 'INVALID_MEMO' }, 400);
	}
	const now = new Date().toISOString();
	await env.song_project_db.prepare(`
		INSERT INTO admin_daily_memos (admin_id, memo_date, content, created_at, updated_at)
		VALUES (?1, ?2, ?3, ?4, ?4)
		ON CONFLICT(admin_id, memo_date) DO UPDATE SET
			content = excluded.content,
			updated_at = excluded.updated_at
	`).bind(session.adminId, memoDate, payload.content, now).run();
	return json({ ok: true, memoDate, content: payload.content, updatedAt: now });
}
