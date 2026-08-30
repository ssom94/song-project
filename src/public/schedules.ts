import { ensureDashboardSchedulesSchema } from '../dashboard/schedules-schema';

interface ScheduleRow {
	id: number;
	title: string;
	target_date: string | null;
	display_order: number;
	created_at: string;
	updated_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleListPublicDashboardSchedules(_request: Request, env: Env): Promise<Response> {
	try {
		await ensureDashboardSchedulesSchema(env.song_project_db);
		const result = await env.song_project_db.prepare(`
			SELECT id, title, target_date, display_order, created_at, updated_at
			FROM dashboard_schedules
			WHERE is_visible = 1
			ORDER BY display_order ASC, id ASC
		`).all<ScheduleRow>();
		return json({
			ok: true,
			schedules: result.results.map((row) => ({
				id: row.id,
				title: row.title,
				targetDate: row.target_date,
				displayOrder: row.display_order,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			})),
		});
	} catch (error) {
		console.error('Failed to load public dashboard schedules', error);
		return json({ ok: false, error: 'PUBLIC_SCHEDULE_LIST_FAILED' }, 500);
	}
}
