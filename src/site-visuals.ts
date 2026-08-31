import { getAuthenticatedAdminSession } from './auth/session';

type CursorTheme = 'blue' | 'navy' | 'mint';
type BackgroundKind = 'default' | 'solid' | 'preset' | 'image';

interface VisualRow {
	cursor_enabled: number;
	cursor_theme: CursorTheme;
	background_kind: BackgroundKind;
	background_value: string;
	background_overlay: number;
}

interface LegacyVisualRow {
	cursor_enabled: number;
	cursor_theme: CursorTheme;
}

interface VisualPayload {
	cursorEnabled?: unknown;
	cursorTheme?: unknown;
	backgroundKind?: unknown;
	backgroundValue?: unknown;
	backgroundOverlay?: unknown;
}

interface VisualState {
	row: VisualRow;
	schemaReady: boolean;
}

const BACKGROUND_PRESETS = new Set([
	'soft-blue', 'mint', 'lavender', 'sunset', 'night', 'paper-grid',
	'song-main', 'couple', 'learning-flags',
]);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const BACKGROUND_IMAGE_KEY_RE = /^site-backgrounds\/[0-9a-f-]{20,80}\.(?:png|jpe?g|webp)$/i;
const REQUIRED_VISUAL_MIGRATIONS = ['0040_category_icons_site_cursor.sql', '0041_site_background_settings.sql'];

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function defaults(): VisualRow {
	return {
		cursor_enabled: 1,
		cursor_theme: 'blue',
		background_kind: 'default',
		background_value: '',
		background_overlay: 12,
	};
}

async function readSettingsState(db: D1Database): Promise<VisualState> {
	try {
		const row = await db.prepare(`
			SELECT cursor_enabled, cursor_theme, background_kind, background_value, background_overlay
			FROM site_visual_settings
			WHERE id = 1
			LIMIT 1
		`).first<VisualRow>();
		return { row: row ?? defaults(), schemaReady: true };
	} catch (fullSchemaError) {
		try {
			const legacy = await db.prepare(`
				SELECT cursor_enabled, cursor_theme
				FROM site_visual_settings
				WHERE id = 1
				LIMIT 1
			`).first<LegacyVisualRow>();
			const row = defaults();
			if (legacy) {
				row.cursor_enabled = legacy.cursor_enabled;
				row.cursor_theme = legacy.cursor_theme;
			}
			console.warn('Site background schema is not ready yet', fullSchemaError);
			return { row, schemaReady: false };
		} catch (legacySchemaError) {
			console.warn('Site visual settings schema is not ready yet', legacySchemaError);
			return { row: defaults(), schemaReady: false };
		}
	}
}

async function readSettings(db: D1Database): Promise<VisualRow> {
	return (await readSettingsState(db)).row;
}

function publicShape(row: VisualRow) {
	return {
		cursor: {
			enabled: row.cursor_enabled === 1,
			theme: row.cursor_theme,
		},
		background: {
			kind: row.background_kind,
			value: row.background_value,
			overlay: row.background_overlay,
			imageUrl: row.background_kind === 'image'
				? `/api/public/site-background?key=${encodeURIComponent(row.background_value)}`
				: null,
		},
	};
}

function parseCursorTheme(value: unknown, fallback: CursorTheme): CursorTheme | null {
	if (value === undefined) return fallback;
	return value === 'blue' || value === 'navy' || value === 'mint' ? value : null;
}

function parseBackgroundKind(value: unknown, fallback: BackgroundKind): BackgroundKind | null {
	if (value === undefined) return fallback;
	return value === 'default' || value === 'solid' || value === 'preset' || value === 'image' ? value : null;
}

function parseOverlay(value: unknown, fallback: number): number | null {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 && parsed <= 80 ? parsed : null;
}

function parseBackgroundValue(kind: BackgroundKind, value: unknown, fallback: string): string | null {
	if (value === undefined) {
		if (kind === 'default') return '';
		return fallback;
	}
	const text = typeof value === 'string' ? value.trim() : '';
	if (kind === 'default') return '';
	if (kind === 'solid') return COLOR_RE.test(text) ? text.toLowerCase() : null;
	if (kind === 'preset') return BACKGROUND_PRESETS.has(text) ? text : null;
	if (kind === 'image') return BACKGROUND_IMAGE_KEY_RE.test(text) ? text : null;
	return null;
}

export async function handleGetPublicSiteVisuals(_request: Request, env: Env): Promise<Response> {
	try {
		const state = await readSettingsState(env.song_project_db);
		return Response.json({ ok: true, ...publicShape(state.row) }, {
			headers: { 'Cache-Control': 'public, max-age=60' },
		});
	} catch (error) {
		console.warn('Failed to load public site visuals', error);
		return Response.json({ ok: true, ...publicShape(defaults()) }, {
			headers: { 'Cache-Control': 'public, max-age=30' },
		});
	}
}

export async function handleGetAdminSiteVisuals(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		const state = await readSettingsState(env.song_project_db);
		return json({
			ok: true,
			...publicShape(state.row),
			schemaReady: state.schemaReady,
			requiredMigrations: state.schemaReady ? [] : REQUIRED_VISUAL_MIGRATIONS,
		});
	} catch (error) {
		console.error('Failed to load admin site visuals', error);
		return json({ ok: false, error: 'SITE_VISUALS_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateAdminSiteVisuals(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: VisualPayload;
	try {
		payload = await request.json() as VisualPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	try {
		const state = await readSettingsState(env.song_project_db);
		if (!state.schemaReady) {
			return json({
				ok: false,
				error: 'SITE_VISUALS_MIGRATION_REQUIRED',
				requiredMigrations: REQUIRED_VISUAL_MIGRATIONS,
			}, 409);
		}
		const current = state.row;
		const cursorEnabled = payload.cursorEnabled === undefined
			? current.cursor_enabled === 1
			: typeof payload.cursorEnabled === 'boolean' ? payload.cursorEnabled : null;
		if (cursorEnabled === null) return json({ ok: false, error: 'INVALID_CURSOR_ENABLED' }, 400);

		const cursorTheme = parseCursorTheme(payload.cursorTheme, current.cursor_theme);
		if (!cursorTheme) return json({ ok: false, error: 'INVALID_CURSOR_THEME' }, 400);

		const backgroundKind = parseBackgroundKind(payload.backgroundKind, current.background_kind);
		if (!backgroundKind) return json({ ok: false, error: 'INVALID_BACKGROUND_KIND' }, 400);

		const backgroundOverlay = parseOverlay(payload.backgroundOverlay, current.background_overlay);
		if (backgroundOverlay === null) return json({ ok: false, error: 'INVALID_BACKGROUND_OVERLAY' }, 400);

		let backgroundFallback = current.background_value;
		if (backgroundKind !== current.background_kind && payload.backgroundValue === undefined) {
			backgroundFallback = backgroundKind === 'solid' ? '#eef5ff' : backgroundKind === 'preset' ? 'soft-blue' : '';
		}
		const backgroundValue = parseBackgroundValue(backgroundKind, payload.backgroundValue, backgroundFallback);
		if (backgroundValue === null) return json({ ok: false, error: 'INVALID_BACKGROUND_VALUE' }, 400);

		const now = new Date().toISOString();
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				INSERT INTO site_visual_settings
					(id, cursor_enabled, cursor_theme, background_kind, background_value, background_overlay, created_at, updated_at)
				VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?6)
				ON CONFLICT(id) DO UPDATE SET
					cursor_enabled = excluded.cursor_enabled,
					cursor_theme = excluded.cursor_theme,
					background_kind = excluded.background_kind,
					background_value = excluded.background_value,
					background_overlay = excluded.background_overlay,
					updated_at = excluded.updated_at
			`).bind(cursorEnabled ? 1 : 0, cursorTheme, backgroundKind, backgroundValue, backgroundOverlay, now),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'site_visual_settings', 1, 'update', ?2, ?3, ?4)
			`).bind(
				session.adminId,
				JSON.stringify({ cursorEnabled, cursorTheme, backgroundKind, backgroundValue, backgroundOverlay }),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			),
		]);

		return json({
			ok: true,
			...publicShape({
				cursor_enabled: cursorEnabled ? 1 : 0,
				cursor_theme: cursorTheme,
				background_kind: backgroundKind,
				background_value: backgroundValue,
				background_overlay: backgroundOverlay,
			}),
		});
	} catch (error) {
		console.error('Failed to update site visuals', error);
		return json({ ok: false, error: 'SITE_VISUALS_UPDATE_FAILED' }, 500);
	}
}
