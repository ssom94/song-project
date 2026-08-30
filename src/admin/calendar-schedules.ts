import { getAuthenticatedAdminSession } from '../auth/session';

interface CalendarScheduleRow {
	id: number;
	content: string;
	start_date: string | null;
	end_date: string | null;
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
	const id = Number(url.searchParams.get('id'));
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseOptionalDate(value: unknown): string | null | 'INVALID' {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'INVALID';
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? 'INVALID' : value;
}

function parseScheduleDates(payload: Record<string, unknown>): { startDate: string | null; endDate: string | null } | 'INVALID' {
	const startDate = parseOptionalDate(payload.startDate);
	const endDate = parseOptionalDate(payload.endDate);
	if (startDate === 'INVALID' || endDate === 'INVALID') return 'INVALID';
	if (!startDate && endDate) return 'INVALID';
	if (startDate && endDate && endDate < startDate) return 'INVALID';
	return { startDate, endDate };
}

function mapRow(row: CalendarScheduleRow) {
	return {
		id: row.id,
		content: row.content,
		startDate: row.start_date,
		endDate: row.end_date,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

async function ensureSchema(db: D1Database): Promise<void> {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS calendar_schedules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			content TEXT NOT NULL,
			start_date TEXT,
			end_date TEXT,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			CHECK (end_date IS NULL OR start_date IS NOT NULL),
			CHECK (end_date IS NULL OR end_date >= start_date)
		)
	`).run();
	await db.prepare('CREATE INDEX IF NOT EXISTS idx_calendar_schedules_start_date ON calendar_schedules(start_date, id)').run();
	await db.prepare('CREATE INDEX IF NOT EXISTS idx_calendar_schedules_end_date ON calendar_schedules(end_date, id)').run();
}

async function requireAdmin(request: Request, env: Env) {
	return getAuthenticatedAdminSession(request, env.song_project_db);
}

export async function handleListAdminCalendarSchedules(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		await ensureSchema(env.song_project_db);
		const result = await env.song_project_db.prepare(`
			SELECT id, content, start_date, end_date, created_at, updated_at
			FROM calendar_schedules
			ORDER BY CASE WHEN start_date IS NULL THEN 1 ELSE 0 END, start_date ASC, id ASC
		`).all<CalendarScheduleRow>();
		return json({ ok: true, schedules: result.results.map(mapRow) });
	} catch (error) {
		console.error('Failed to list calendar schedules', error);
		return json({ ok: false, error: 'CALENDAR_SCHEDULE_LIST_FAILED' }, 500);
	}
}

export async function handleCreateAdminCalendarSchedule(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	let payload: Record<string, unknown>;
	try {
		payload = await request.json() as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const content = typeof payload.content === 'string' ? payload.content.trim() : '';
	if (!content) return json({ ok: false, error: 'CONTENT_REQUIRED' }, 400);
	if (content.length > 500) return json({ ok: false, error: 'CONTENT_TOO_LONG' }, 400);
	const dates = parseScheduleDates(payload);
	if (dates === 'INVALID') return json({ ok: false, error: 'INVALID_SCHEDULE_DATES' }, 400);

	try {
		await ensureSchema(env.song_project_db);
		const row = await env.song_project_db.prepare(`
			INSERT INTO calendar_schedules (content, start_date, end_date, updated_at)
			VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			RETURNING id, content, start_date, end_date, created_at, updated_at
		`).bind(content, dates.startDate, dates.endDate).first<CalendarScheduleRow>();
		return json({ ok: true, schedule: row ? mapRow(row) : null }, 201);
	} catch (error) {
		console.error('Failed to create calendar schedule', error);
		return json({ ok: false, error: 'CALENDAR_SCHEDULE_CREATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminCalendarSchedule(request: Request, env: Env): Promise<Response> {
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
	const content = typeof payload.content === 'string' ? payload.content.trim() : '';
	if (!content) return json({ ok: false, error: 'CONTENT_REQUIRED' }, 400);
	if (content.length > 500) return json({ ok: false, error: 'CONTENT_TOO_LONG' }, 400);
	const dates = parseScheduleDates(payload);
	if (dates === 'INVALID') return json({ ok: false, error: 'INVALID_SCHEDULE_DATES' }, 400);

	try {
		await ensureSchema(env.song_project_db);
		const row = await env.song_project_db.prepare(`
			UPDATE calendar_schedules
			SET content = ?1, start_date = ?2, end_date = ?3,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE id = ?4
			RETURNING id, content, start_date, end_date, created_at, updated_at
		`).bind(content, dates.startDate, dates.endDate, id).first<CalendarScheduleRow>();
		if (!row) return json({ ok: false, error: 'NOT_FOUND' }, 404);
		return json({ ok: true, schedule: mapRow(row) });
	} catch (error) {
		console.error('Failed to update calendar schedule', error);
		return json({ ok: false, error: 'CALENDAR_SCHEDULE_UPDATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminCalendarSchedule(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = parseId(new URL(request.url));
	if (!id) return json({ ok: false, error: 'INVALID_ID' }, 400);
	try {
		await ensureSchema(env.song_project_db);
		const row = await env.song_project_db.prepare('DELETE FROM calendar_schedules WHERE id = ?1 RETURNING id').bind(id).first<{ id: number }>();
		if (!row) return json({ ok: false, error: 'NOT_FOUND' }, 404);
		return json({ ok: true, id: row.id });
	} catch (error) {
		console.error('Failed to delete calendar schedule', error);
		return json({ ok: false, error: 'CALENDAR_SCHEDULE_DELETE_FAILED' }, 500);
	}
}
