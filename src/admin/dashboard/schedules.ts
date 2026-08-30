import { getAuthenticatedAdminSession } from '../../auth/session';
import { ensureDashboardSchedulesSchema } from '../../dashboard/schedules-schema';

interface ScheduleRow {
	id: number;
	title: string;
	target_date: string | null;
	display_order: number;
	is_visible: number;
	created_at: string;
	updated_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function parseId(url: URL): number | null {
	const value = Number(url.searchParams.get('id'));
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseDate(value: unknown): string | null | 'INVALID' {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'INVALID';
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? 'INVALID' : value;
}

function mapRow(row: ScheduleRow) {
	return {
		id: row.id,
		title: row.title,
		targetDate: row.target_date,
		displayOrder: row.display_order,
		isVisible: row.is_visible === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

async function requireAdmin(request: Request, env: Env) {
	return getAuthenticatedAdminSession(request, env.song_project_db);
}

async function prepareScheduleDb(env: Env): Promise<void> {
	await ensureDashboardSchedulesSchema(env.song_project_db);
}

export async function handleListAdminDashboardSchedules(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		await prepareScheduleDb(env);
		const result = await env.song_project_db.prepare(`
			SELECT id, title, target_date, display_order, is_visible, created_at, updated_at
			FROM dashboard_schedules
			ORDER BY display_order ASC, id ASC
		`).all<ScheduleRow>();
		return json({ ok: true, schedules: result.results.map(mapRow) });
	} catch (error) {
		console.error('Failed to list dashboard schedules', error);
		return json({ ok: false, error: 'SCHEDULE_LIST_FAILED' }, 500);
	}
}

export async function handleCreateAdminDashboardSchedule(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: Record<string, unknown>;
	try {
		payload = await request.json() as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '';
	if (!title) return json({ ok: false, error: 'TITLE_REQUIRED' }, 400);
	const targetDate = parseDate(payload.targetDate);
	if (targetDate === 'INVALID') return json({ ok: false, error: 'INVALID_DATE' }, 400);
	const isVisible = payload.isVisible === undefined ? true : payload.isVisible;
	if (typeof isVisible !== 'boolean') return json({ ok: false, error: 'INVALID_VISIBILITY' }, 400);

	try {
		await prepareScheduleDb(env);
		const orderRow = await env.song_project_db.prepare(`SELECT COALESCE(MAX(display_order), 0) AS max_order FROM dashboard_schedules`).first<{ max_order: number }>();
		const result = await env.song_project_db.prepare(`
			INSERT INTO dashboard_schedules (title, target_date, display_order, is_visible, updated_at)
			VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			RETURNING id, title, target_date, display_order, is_visible, created_at, updated_at
		`).bind(title, targetDate, Number(orderRow?.max_order ?? 0) + 10, isVisible ? 1 : 0).first<ScheduleRow>();
		return json({ ok: true, schedule: result ? mapRow(result) : null }, 201);
	} catch (error) {
		console.error('Failed to create dashboard schedule', error);
		return json({ ok: false, error: 'SCHEDULE_CREATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminDashboardSchedule(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = parseId(new URL(request.url));
	if (!id) return json({ ok: false, error: 'INVALID_ID' }, 400);

	let payload: Record<string, unknown>;
	try {
		payload = await request.json() as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	try {
		await prepareScheduleDb(env);
		const current = await env.song_project_db.prepare(`
			SELECT id, title, target_date, display_order, is_visible, created_at, updated_at
			FROM dashboard_schedules WHERE id = ?1 LIMIT 1
		`).bind(id).first<ScheduleRow>();
		if (!current) return json({ ok: false, error: 'NOT_FOUND' }, 404);

		const title = payload.title === undefined ? current.title : typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '';
		if (!title) return json({ ok: false, error: 'TITLE_REQUIRED' }, 400);
		const targetDate = payload.targetDate === undefined ? current.target_date : parseDate(payload.targetDate);
		if (targetDate === 'INVALID') return json({ ok: false, error: 'INVALID_DATE' }, 400);
		const isVisible = payload.isVisible === undefined ? current.is_visible === 1 : payload.isVisible;
		if (typeof isVisible !== 'boolean') return json({ ok: false, error: 'INVALID_VISIBILITY' }, 400);

		const result = await env.song_project_db.prepare(`
			UPDATE dashboard_schedules
			SET title = ?1, target_date = ?2, is_visible = ?3,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE id = ?4
			RETURNING id, title, target_date, display_order, is_visible, created_at, updated_at
		`).bind(title, targetDate, isVisible ? 1 : 0, id).first<ScheduleRow>();
		return json({ ok: true, schedule: result ? mapRow(result) : null });
	} catch (error) {
		console.error('Failed to update dashboard schedule', error);
		return json({ ok: false, error: 'SCHEDULE_UPDATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminDashboardSchedule(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = parseId(new URL(request.url));
	if (!id) return json({ ok: false, error: 'INVALID_ID' }, 400);

	try {
		await prepareScheduleDb(env);
		const result = await env.song_project_db.prepare(`DELETE FROM dashboard_schedules WHERE id = ?1 RETURNING id`).bind(id).first<{ id: number }>();
		if (!result) return json({ ok: false, error: 'NOT_FOUND' }, 404);
		return json({ ok: true, id: result.id });
	} catch (error) {
		console.error('Failed to delete dashboard schedule', error);
		return json({ ok: false, error: 'SCHEDULE_DELETE_FAILED' }, 500);
	}
}
