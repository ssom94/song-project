let schemaReady = false;

export async function ensureDashboardGoalsSchema(db: D1Database): Promise<void> {
	if (schemaReady) return;

	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS dashboard_settings (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				jlpt_goal_mode TEXT NOT NULL DEFAULT 'auto'
					CHECK (jlpt_goal_mode IN ('auto', 'manual')),
				jlpt_manual_target INTEGER
					CHECK (jlpt_manual_target IS NULL OR jlpt_manual_target > 0),
				show_jlpt INTEGER NOT NULL DEFAULT 1 CHECK (show_jlpt IN (0, 1)),
				updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS dashboard_goals (
				id INTEGER PRIMARY KEY,
				goal_key TEXT NOT NULL UNIQUE,
				title TEXT NOT NULL,
				goal_type TEXT NOT NULL DEFAULT 'percent'
					CHECK (goal_type IN ('percent', 'count', 'jlpt_auto')),
				target_date TEXT,
				target_month TEXT,
				progress_percent INTEGER NOT NULL DEFAULT 0
					CHECK (progress_percent BETWEEN 0 AND 100),
				target_count INTEGER CHECK (target_count IS NULL OR target_count > 0),
				completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
				status TEXT NOT NULL DEFAULT 'planned'
					CHECK (status IN ('planned', 'progress', 'done')),
				display_order INTEGER NOT NULL DEFAULT 0,
				is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
				created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
				updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			)
		`),
		db.prepare(`
			CREATE INDEX IF NOT EXISTS idx_dashboard_goals_order
			ON dashboard_goals(display_order, id)
		`),
		db.prepare(`
			CREATE INDEX IF NOT EXISTS idx_dashboard_goals_visible
			ON dashboard_goals(is_visible, display_order)
		`),
		db.prepare(`
			INSERT OR IGNORE INTO dashboard_settings
				(id, jlpt_goal_mode, jlpt_manual_target, show_jlpt)
			VALUES (1, 'auto', NULL, 1)
		`),
		db.prepare(`
			INSERT OR IGNORE INTO dashboard_goals
				(id, goal_key, title, goal_type, target_date, target_month, progress_percent, target_count, completed_count, status, display_order, is_visible)
			VALUES
				(910000001, 'jlpt-n1', 'JLPT N1', 'jlpt_auto', NULL, '2027-07', 0, NULL, 0, 'planned', 10, 1),
				(910000002, 'ap', 'AP 科目A', 'percent', NULL, '2027-02', 0, NULL, 0, 'planned', 20, 1),
				(910000003, 'fp', 'FP', 'percent', NULL, NULL, 0, NULL, 0, 'planned', 30, 1),
				(910000004, 'aws-saa', 'AWS SAA', 'percent', NULL, NULL, 0, NULL, 0, 'planned', 40, 1),
				(910000005, 'portfolio', 'Portfolio × 2', 'count', NULL, NULL, 0, 2, 0, 'planned', 50, 1)
		`),
	]);

	schemaReady = true;
}
