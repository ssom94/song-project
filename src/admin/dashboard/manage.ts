import { getAuthenticatedAdminSession } from '../../auth/session';

type DashboardGoalInput = {
	id?: unknown;
	goalKey?: unknown;
	title?: unknown;
	goalType?: unknown;
	targetDate?: unknown;
	progressPercent?: unknown;
	targetCount?: unknown;
	completedCount?: unknown;
	status?: unknown;
	displayOrder?: unknown;
	isVisible?: unknown;
};

type DashboardPayload = {
	jlptGoalMode?: unknown;
	jlptManualTarget?: unknown;
	showJlpt?: unknown;
	goals?: unknown;
};

interface GoalRow {
	id: number;
	goal_key: string;
	title: string;
	goal_type: 'percent' | 'count' | 'jlpt_auto';
	target_date: string | null;
	progress_percent: number;
	target_count: number | null;
	completed_count: number;
	status: 'planned' | 'progress' | 'done';
	display_order: number;
	is_visible: number;
}

const CORE_KEYS = new Set(['jlpt-n1', 'ap', 'fp', 'aws-saa', 'portfolio']);

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function makeSafeId(): number {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return (Date.now() * 1000) + (random[0] % 1000);
}

function parseInteger(value: unknown, min: number, max: number, nullable = false): number | null | 'INVALID' {
	if ((value === null || value === undefined || value === '') && nullable) return null;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return 'INVALID';
	return parsed;
}

function parseDate(value: unknown): string | null | 'INVALID' {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'INVALID';
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? 'INVALID' : value;
}

function slugKey(title: string, id: number): string {
	const base = title
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50) || 'goal';
	return `custom-${base}-${id.toString(36)}`;
}

function mapGoal(row: GoalRow) {
	return {
		id: row.id,
		goalKey: row.goal_key,
		title: row.title,
		goalType: row.goal_type,
		targetDate: row.target_date,
		progressPercent: row.progress_percent,
		targetCount: row.target_count,
		completedCount: row.completed_count,
		status: row.status,
		displayOrder: row.display_order,
		isVisible: row.is_visible === 1,
	};
}

async function requireAdmin(request: Request, env: Env) {
	return getAuthenticatedAdminSession(request, env.song_project_db);
}

export async function handleGetAdminDashboard(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [settings, goals] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT jlpt_goal_mode, jlpt_manual_target, show_jlpt
				FROM dashboard_settings WHERE id = 1 LIMIT 1
			`).first<{ jlpt_goal_mode: 'auto' | 'manual'; jlpt_manual_target: number | null; show_jlpt: number }>(),
			env.song_project_db.prepare(`
				SELECT id, goal_key, title, goal_type, target_date, progress_percent,
					target_count, completed_count, status, display_order, is_visible
				FROM dashboard_goals
				ORDER BY display_order ASC, id ASC
			`).all<GoalRow>(),
		]);

		return json({
			ok: true,
			settings: {
				jlptGoalMode: settings?.jlpt_goal_mode ?? 'auto',
				jlptManualTarget: settings?.jlpt_manual_target ?? null,
				showJlpt: (settings?.show_jlpt ?? 1) === 1,
			},
			goals: goals.results.map(mapGoal),
		});
	} catch (error) {
		console.error('Failed to get admin dashboard settings', error);
		return json({ ok: false, error: 'DASHBOARD_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateAdminDashboard(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: DashboardPayload;
	try {
		payload = await request.json() as DashboardPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const mode = payload.jlptGoalMode === 'manual' ? 'manual' : payload.jlptGoalMode === 'auto' ? 'auto' : null;
	if (!mode) return json({ ok: false, error: 'INVALID_JLPT_GOAL_MODE' }, 400);
	const manualTarget = parseInteger(payload.jlptManualTarget, 1, 99999, true);
	if (manualTarget === 'INVALID') return json({ ok: false, error: 'INVALID_JLPT_TARGET' }, 400);
	if (mode === 'manual' && manualTarget === null) return json({ ok: false, error: 'JLPT_TARGET_REQUIRED' }, 400);
	if (typeof payload.showJlpt !== 'boolean') return json({ ok: false, error: 'INVALID_SHOW_JLPT' }, 400);
	if (!Array.isArray(payload.goals) || payload.goals.length > 50) return json({ ok: false, error: 'INVALID_GOALS' }, 400);

	const normalized: Array<{
		id: number;
		goalKey: string;
		title: string;
		goalType: 'percent' | 'count' | 'jlpt_auto';
		targetDate: string | null;
		progressPercent: number;
		targetCount: number | null;
		completedCount: number;
		status: 'planned' | 'progress' | 'done';
		displayOrder: number;
		isVisible: boolean;
	}> = [];

	const seenKeys = new Set<string>();
	for (let index = 0; index < payload.goals.length; index += 1) {
		const raw = payload.goals[index] as DashboardGoalInput;
		const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : '';
		if (!title) return json({ ok: false, error: 'GOAL_TITLE_REQUIRED' }, 400);
		const inputId = parseInteger(raw.id, 1, Number.MAX_SAFE_INTEGER, true);
		if (inputId === 'INVALID') return json({ ok: false, error: 'INVALID_GOAL_ID' }, 400);
		const id = inputId ?? makeSafeId();
		const rawKey = typeof raw.goalKey === 'string' ? raw.goalKey.trim() : '';
		const goalKey = CORE_KEYS.has(rawKey) ? rawKey : rawKey.startsWith('custom-') ? rawKey.slice(0, 100) : slugKey(title, id);
		if (seenKeys.has(goalKey)) return json({ ok: false, error: 'DUPLICATE_GOAL_KEY' }, 400);
		seenKeys.add(goalKey);

		const goalType = raw.goalType === 'count' || raw.goalType === 'jlpt_auto' || raw.goalType === 'percent'
			? raw.goalType
			: goalKey === 'portfolio' ? 'count' : goalKey === 'jlpt-n1' ? 'jlpt_auto' : 'percent';
		const targetDate = parseDate(raw.targetDate);
		const progressPercent = parseInteger(raw.progressPercent ?? 0, 0, 100);
		const targetCount = parseInteger(raw.targetCount, 1, 999999, true);
		const completedCount = parseInteger(raw.completedCount ?? 0, 0, 999999);
		const displayOrder = parseInteger(raw.displayOrder ?? ((index + 1) * 10), -999999, 999999);
		if ([targetDate, progressPercent, targetCount, completedCount, displayOrder].includes('INVALID')) {
			return json({ ok: false, error: 'INVALID_GOAL_FIELD' }, 400);
		}
		const status = raw.status === 'done' || raw.status === 'progress' || raw.status === 'planned' ? raw.status : null;
		if (!status || typeof raw.isVisible !== 'boolean') return json({ ok: false, error: 'INVALID_GOAL_STATE' }, 400);
		if (goalType === 'count' && targetCount === null) return json({ ok: false, error: 'COUNT_TARGET_REQUIRED' }, 400);

		normalized.push({
			id,
			goalKey,
			title,
			goalType,
			targetDate: targetDate as string | null,
			progressPercent: progressPercent as number,
			targetCount: targetCount as number | null,
			completedCount: completedCount as number,
			status,
			displayOrder: displayOrder as number,
			isVisible: raw.isVisible,
		});
	}

	try {
		const statements: D1PreparedStatement[] = [
			env.song_project_db.prepare(`
				INSERT INTO dashboard_settings (id, jlpt_goal_mode, jlpt_manual_target, show_jlpt, updated_at)
				VALUES (1, ?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
				ON CONFLICT(id) DO UPDATE SET
					jlpt_goal_mode = excluded.jlpt_goal_mode,
					jlpt_manual_target = excluded.jlpt_manual_target,
					show_jlpt = excluded.show_jlpt,
					updated_at = excluded.updated_at
			`).bind(mode, manualTarget, payload.showJlpt ? 1 : 0),
		];

		for (const goal of normalized) {
			statements.push(env.song_project_db.prepare(`
				INSERT INTO dashboard_goals (
					id, goal_key, title, goal_type, target_date, progress_percent,
					target_count, completed_count, status, display_order, is_visible, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
				ON CONFLICT(goal_key) DO UPDATE SET
					title = excluded.title,
					goal_type = excluded.goal_type,
					target_date = excluded.target_date,
					progress_percent = excluded.progress_percent,
					target_count = excluded.target_count,
					completed_count = excluded.completed_count,
					status = excluded.status,
					display_order = excluded.display_order,
					is_visible = excluded.is_visible,
					updated_at = excluded.updated_at
			`).bind(
				goal.id, goal.goalKey, goal.title, goal.goalType, goal.targetDate,
				goal.progressPercent, goal.targetCount, goal.completedCount, goal.status,
				goal.displayOrder, goal.isVisible ? 1 : 0,
			));
		}

		const customKeys = normalized.filter((goal) => !CORE_KEYS.has(goal.goalKey)).map((goal) => goal.goalKey);
		if (customKeys.length === 0) {
			statements.push(env.song_project_db.prepare(`DELETE FROM dashboard_goals WHERE goal_key LIKE 'custom-%'`));
		} else {
			const placeholders = customKeys.map((_, index) => `?${index + 1}`).join(', ');
			statements.push(env.song_project_db.prepare(`DELETE FROM dashboard_goals WHERE goal_key LIKE 'custom-%' AND goal_key NOT IN (${placeholders})`).bind(...customKeys));
		}

		await env.song_project_db.batch(statements);
		return handleGetAdminDashboard(request, env);
	} catch (error) {
		console.error('Failed to update dashboard settings', error);
		return json({ ok: false, error: 'DASHBOARD_UPDATE_FAILED' }, 500);
	}
}
