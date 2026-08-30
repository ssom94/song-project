import { getAuthenticatedAdminSession } from '../../auth/session';

type CommentStatus = 'visible' | 'hidden' | 'spam';

interface CommentRow {
	id: number;
	post_id: number;
	parent_id: number | null;
	nickname: string;
	content: string;
	ip_masked: string | null;
	language_code: 'ja' | 'ko';
	status: CommentStatus;
	created_at: string;
	updated_at: string;
	title_ja: string | null;
	title_ko: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function parseStatus(value: unknown): CommentStatus | '' | null {
	if (value === null || value === undefined || value === '') return '';
	return value === 'visible' || value === 'hidden' || value === 'spam' ? value : null;
}

function parseLanguage(value: unknown): 'ja' | 'ko' | '' | null {
	if (value === null || value === undefined || value === '') return '';
	return value === 'ja' || value === 'ko' ? value : null;
}

export async function handleListAdminComments(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const url = new URL(request.url);
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
	const status = parseStatus(url.searchParams.get('status'));
	const language = parseLanguage(url.searchParams.get('lang'));
	if (status === null || language === null) return json({ ok: false, error: 'INVALID_FILTER' }, 400);

	const like = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
	try {
		const [rows, metrics] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT
					c.id,
					c.post_id,
					c.parent_id,
					c.nickname,
					c.content,
					c.ip_masked,
					c.language_code,
					c.status,
					c.created_at,
					c.updated_at,
					ja.title AS title_ja,
					ko.title AS title_ko
				FROM comments AS c
				LEFT JOIN post_translations AS ja ON ja.post_id = c.post_id AND ja.language_code = 'ja'
				LEFT JOIN post_translations AS ko ON ko.post_id = c.post_id AND ko.language_code = 'ko'
				WHERE c.deleted_at IS NULL
					AND (?1 = '' OR c.status = ?1)
					AND (?2 = '' OR c.language_code = ?2)
					AND (?3 = '' OR c.nickname LIKE ?4 ESCAPE '\\' OR c.content LIKE ?4 ESCAPE '\\')
				ORDER BY datetime(c.created_at) DESC, c.id DESC
				LIMIT 500
			`).bind(status, language, query, like).all<CommentRow>(),
			env.song_project_db.prepare(`
				SELECT
					COUNT(*) AS all_count,
					SUM(CASE WHEN status = 'visible' THEN 1 ELSE 0 END) AS visible_count,
					SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden_count,
					SUM(CASE WHEN status = 'spam' THEN 1 ELSE 0 END) AS spam_count
				FROM comments
				WHERE deleted_at IS NULL
			`).first<{ all_count: number; visible_count: number | null; hidden_count: number | null; spam_count: number | null }>(),
		]);

		return json({
			ok: true,
			metrics: {
				all: metrics?.all_count ?? 0,
				visible: metrics?.visible_count ?? 0,
				hidden: metrics?.hidden_count ?? 0,
				spam: metrics?.spam_count ?? 0,
			},
			comments: rows.results.map((row) => ({
				id: row.id,
				postId: row.post_id,
				parentId: row.parent_id,
				nickname: row.nickname,
				content: row.content,
				ipMasked: row.ip_masked,
				languageCode: row.language_code,
				status: row.status,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				titleJa: row.title_ja,
				titleKo: row.title_ko,
			})),
		});
	} catch (error) {
		console.error('Failed to list admin comments', error);
		return json({ ok: false, error: 'COMMENT_LIST_FAILED' }, 500);
	}
}

export async function handleUpdateAdminCommentStatus(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const commentId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(commentId) || commentId <= 0) return json({ ok: false, error: 'INVALID_COMMENT_ID' }, 400);

	let payload: { status?: unknown };
	try {
		payload = await request.json() as { status?: unknown };
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const status = parseStatus(payload.status);
	if (!status) return json({ ok: false, error: 'INVALID_COMMENT_STATUS' }, 400);

	const existing = await env.song_project_db.prepare(`
		SELECT id, status FROM comments WHERE id = ?1 AND deleted_at IS NULL LIMIT 1
	`).bind(commentId).first<{ id: number; status: CommentStatus }>();
	if (!existing) return json({ ok: false, error: 'COMMENT_NOT_FOUND' }, 404);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`UPDATE comments SET status = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL`).bind(status, now, commentId),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
				VALUES (?1, 'comment', ?2, 'status_update', ?3, ?4, ?5, ?6)
			`).bind(session.adminId, commentId, JSON.stringify({ status: existing.status }), JSON.stringify({ status }), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to update comment status', error);
		return json({ ok: false, error: 'COMMENT_STATUS_UPDATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminComment(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const commentId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(commentId) || commentId <= 0) return json({ ok: false, error: 'INVALID_COMMENT_ID' }, 400);

	const existing = await env.song_project_db.prepare(`
		SELECT id, post_id, parent_id, nickname, content, status
		FROM comments
		WHERE id = ?1 AND deleted_at IS NULL
		LIMIT 1
	`).bind(commentId).first<{ id: number; post_id: number; parent_id: number | null; nickname: string; content: string; status: CommentStatus }>();
	if (!existing) return json({ ok: false, error: 'COMMENT_NOT_FOUND' }, 404);

	const now = new Date().toISOString();
	try {
		const statements: D1PreparedStatement[] = [
			env.song_project_db.prepare(`UPDATE comments SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL`).bind(now, commentId),
		];
		if (existing.parent_id === null) {
			statements.push(env.song_project_db.prepare(`UPDATE comments SET deleted_at = ?1, updated_at = ?1 WHERE parent_id = ?2 AND deleted_at IS NULL`).bind(now, commentId));
		}
		statements.push(env.song_project_db.prepare(`
			INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent)
			VALUES (?1, 'comment', ?2, 'delete', ?3, ?4, ?5)
		`).bind(session.adminId, commentId, JSON.stringify({ postId: existing.post_id, nickname: existing.nickname, content: existing.content, status: existing.status }), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')));
		await env.song_project_db.batch(statements);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to delete comment', error);
		return json({ ok: false, error: 'COMMENT_DELETE_FAILED' }, 500);
	}
}
