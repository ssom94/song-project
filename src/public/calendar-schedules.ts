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

export async function handleListPublicCalendarSchedules(_request: Request, env: Env): Promise<Response> {
	try {
		await ensureSchema(env.song_project_db);
		const result = await env.song_project_db.prepare(`
			SELECT id, content, start_date, end_date, created_at, updated_at
			FROM calendar_schedules
			ORDER BY CASE WHEN start_date IS NULL THEN 1 ELSE 0 END, start_date ASC, id ASC
		`).all<CalendarScheduleRow>();
		return json({
			ok: true,
			schedules: result.results.map((row) => ({
				id: row.id,
				content: row.content,
				startDate: row.start_date,
				endDate: row.end_date,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			})),
		});
	} catch (error) {
		console.error('Failed to load public calendar schedules', error);
		return json({ ok: false, error: 'PUBLIC_CALENDAR_SCHEDULE_LIST_FAILED' }, 500);
	}
}
