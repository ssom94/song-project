import { getAuthenticatedAdminSession } from '../../auth/session';
import { parseCategoryAppearance } from '../../category-appearance';
import { handleCreateAdminCategory, handleUpdateAdminCategory } from './manage';

interface CategoryPayload {
	iconKind?: unknown;
	iconValue?: unknown;
	iconColor?: unknown;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function hasAppearance(payload: CategoryPayload): boolean {
	return payload.iconKind !== undefined || payload.iconValue !== undefined || payload.iconColor !== undefined;
}

async function parsePayload(request: Request): Promise<{ raw: CategoryPayload; appearance: ReturnType<typeof parseCategoryAppearance> | null } | Response> {
	let raw: CategoryPayload;
	try {
		raw = await request.clone().json() as CategoryPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	if (!hasAppearance(raw)) return { raw, appearance: null };
	const appearance = parseCategoryAppearance(raw);
	if (!appearance) return json({ ok: false, error: 'INVALID_CATEGORY_APPEARANCE' }, 400);
	return { raw, appearance };
}

async function saveAppearance(db: D1Database, categoryId: number, appearance: NonNullable<ReturnType<typeof parseCategoryAppearance>>) {
	await db.prepare(`
		UPDATE categories
		SET icon_kind = ?1, icon_value = ?2, icon_color = ?3,
			updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		WHERE id = ?4 AND deleted_at IS NULL
	`).bind(appearance.iconKind, appearance.iconValue, appearance.iconColor, categoryId).run();
}

export async function handleCreateAdminCategoryWithAppearance(request: Request, env: Env): Promise<Response> {
	const parsed = await parsePayload(request);
	if (parsed instanceof Response) return parsed;
	const response = await handleCreateAdminCategory(request, env);
	if (!response.ok || !parsed.appearance) return response;
	try {
		const body = await response.clone().json() as { category?: { id?: unknown } };
		const categoryId = Number(body.category?.id);
		if (Number.isSafeInteger(categoryId) && categoryId > 0) await saveAppearance(env.song_project_db, categoryId, parsed.appearance);
		return response;
	} catch (error) {
		console.error('Failed to save new category appearance', error);
		return json({ ok: false, error: 'CATEGORY_APPEARANCE_SAVE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminCategoryWithAppearance(request: Request, env: Env): Promise<Response> {
	const parsed = await parsePayload(request);
	if (parsed instanceof Response) return parsed;
	const response = await handleUpdateAdminCategory(request, env);
	if (!response.ok || !parsed.appearance) return response;
	const categoryId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return response;
	try {
		await saveAppearance(env.song_project_db, categoryId, parsed.appearance);
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (session) {
			await env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'category_appearance', ?2, 'update', ?3, ?4, ?5)
			`).bind(
				session.adminId,
				categoryId,
				JSON.stringify(parsed.appearance),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			).run();
		}
		return response;
	} catch (error) {
		console.error('Failed to save category appearance', error);
		return json({ ok: false, error: 'CATEGORY_APPEARANCE_SAVE_FAILED' }, 500);
	}
}
