import { getAuthenticatedAdminSession } from './auth/session';

type CursorTheme = 'blue' | 'navy' | 'mint';

interface VisualRow {
	cursor_enabled: number;
	cursor_theme: CursorTheme;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

async function readSettings(db: D1Database): Promise<VisualRow> {
	const row = await db.prepare(`
		SELECT cursor_enabled, cursor_theme
		FROM site_visual_settings
		WHERE id = 1
		LIMIT 1
	`).first<VisualRow>();
	return row ?? { cursor_enabled: 1, cursor_theme: 'blue' };
}

function publicShape(row: VisualRow) {
	return {
		cursor: {
			enabled: row.cursor_enabled === 1,
			theme: row.cursor_theme,
		},
	};
}

export async function handleGetPublicSiteVisuals(_request: Request, env: Env): Promise<Response> {
	try {
		const row = await readSettings(env.song_project_db);
		return Response.json({ ok: true, ...publicShape(row) }, {
			headers: { 'Cache-Control': 'public, max-age=60' },
		});
	} catch (error) {
		console.warn('Failed to load public site visuals', error);
		return Response.json({ ok: true, cursor: { enabled: false, theme: 'blue' } }, {
			headers: { 'Cache-Control': 'public, max-age=30' },
		});
	}
}

export async function handleGetAdminSiteVisuals(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		const row = await readSettings(env.song_project_db);
		return json({ ok: true, ...publicShape(row) });
	} catch (error) {
		console.error('Failed to load admin site visuals', error);
		return json({ ok: false, error: 'SITE_VISUALS_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateAdminSiteVisuals(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	let payload: { cursorEnabled?: unknown; cursorTheme?: unknown };
	try {
		payload = await request.json() as { cursorEnabled?: unknown; cursorTheme?: unknown };
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	if (typeof payload.cursorEnabled !== 'boolean') return json({ ok: false, error: 'INVALID_CURSOR_ENABLED' }, 400);
	if (payload.cursorTheme !== 'blue' && payload.cursorTheme !== 'navy' && payload.cursorTheme !== 'mint') {
		return json({ ok: false, error: 'INVALID_CURSOR_THEME' }, 400);
	}
	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				INSERT INTO site_visual_settings (id, cursor_enabled, cursor_theme, created_at, updated_at)
				VALUES (1, ?1, ?2, ?3, ?3)
				ON CONFLICT(id) DO UPDATE SET cursor_enabled = excluded.cursor_enabled,
					cursor_theme = excluded.cursor_theme, updated_at = excluded.updated_at
			`).bind(payload.cursorEnabled ? 1 : 0, payload.cursorTheme, now),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'site_visual_settings', 1, 'update', ?2, ?3, ?4)
			`).bind(
				session.adminId,
				JSON.stringify({ cursorEnabled: payload.cursorEnabled, cursorTheme: payload.cursorTheme }),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			),
		]);
		return json({ ok: true, cursor: { enabled: payload.cursorEnabled, theme: payload.cursorTheme } });
	} catch (error) {
		console.error('Failed to update site visuals', error);
		return json({ ok: false, error: 'SITE_VISUALS_UPDATE_FAILED' }, 500);
	}
}
