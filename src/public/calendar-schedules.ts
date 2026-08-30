interface CalendarScheduleRow {
	id: number;
	content: string;
	due_date: string;
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
			due_date TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		)
	`).run();
	await db.prepare('CREATE INDEX IF NOT EXISTS idx_calendar_schedules_due_date ON calendar_schedules(due_date, id)').run();
}

export async function handleListPublicCalendarSchedules(_request: Request, env: Env): Promise<Response> {
	try {
		await ensureSchema(env.song_project_db);
		const result = await env.song_project_db.prepare(`
			SELECT id, content, due_date, created_at, updated_at
			FROM calendar_schedules
			ORDER BY due_date ASC, id ASC
		`).all<CalendarScheduleRow>();
		return json({
			ok: true,
			schedules: result.results.map((row) => ({
				id: row.id,
				content: row.content,
				dueDate: row.due_date,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			})),
		});
	} catch (error) {
		console.error('Failed to load public calendar schedules', error);
		return json({ ok: false, error: 'PUBLIC_CALENDAR_SCHEDULE_LIST_FAILED' }, 500);
	}
}
