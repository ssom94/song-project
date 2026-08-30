let schemaReady = false;

export async function ensureDashboardSchedulesSchema(db: D1Database): Promise<void> {
	if (schemaReady) return;

	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS dashboard_schedules (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				target_date TEXT,
				display_order INTEGER NOT NULL DEFAULT 0,
				is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
				created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
				updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			)
		`),
		db.prepare(`
			CREATE INDEX IF NOT EXISTS idx_dashboard_schedules_visible_order
			ON dashboard_schedules(is_visible, display_order, id)
		`),
	]);

	schemaReady = true;
}
