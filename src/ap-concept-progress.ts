import { getAuthenticatedAdminSession } from './auth/session';
import { resolveLearningAdmin } from './japanese-learning';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

export async function handleGetPublicApConceptProgress(request: Request, env: Env): Promise<Response> {
	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok:true, completed:[] });
		try {
			const result = await env.song_project_db.prepare(`
				SELECT c.concept_code AS conceptCode, t.type_no AS typeNo
				FROM ap_concept_type_progress p
				JOIN ap_concept_problem_types t ON t.id = p.problem_type_id
				JOIN ap_concepts c ON c.id = t.concept_id
				WHERE p.admin_id = ?1
				ORDER BY c.sort_order ASC, t.sort_order ASC, t.type_no ASC
			`).bind(admin.adminId).all<{ conceptCode:string; typeNo:number }>();
			return json({ ok:true, completed:result.results });
		} catch (error) {
			const message = String(error);
			if (message.includes('no such table: ap_concept_type_progress')) return json({ ok:true, completed:[], migrationRequired:true });
			throw error;
		}
	} catch (error) {
		console.error('Failed to load AP concept progress', error);
		return json({ ok:false, error:'AP_CONCEPT_PROGRESS_FAILED' }, 500);
	}
}

export async function handlePatchAdminApConceptProgress(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok:false, error:'FORBIDDEN_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok:false, error:'UNAUTHORIZED' }, 401);
	let body: { conceptCode?:unknown; typeNo?:unknown; completed?:unknown };
	try { body = await request.json(); } catch { return json({ ok:false, error:'INVALID_JSON' }, 400); }
	const conceptCode = String(body.conceptCode || '').trim().toUpperCase();
	const typeNo = Number(body.typeNo);
	const completed = body.completed;
	if (!/^[AB]-\d{2}$/.test(conceptCode) || !Number.isInteger(typeNo) || typeNo <= 0 || typeof completed !== 'boolean') {
		return json({ ok:false, error:'INVALID_PROGRESS_INPUT' }, 400);
	}
	try {
		if (completed) {
			await env.song_project_db.prepare(`
				INSERT OR IGNORE INTO ap_concept_type_progress (admin_id, problem_type_id, completed_at)
				SELECT ?1, t.id, CURRENT_TIMESTAMP
				FROM ap_concept_problem_types t
				JOIN ap_concepts c ON c.id = t.concept_id
				WHERE c.concept_code = ?2 AND t.type_no = ?3
			`).bind(session.adminId, conceptCode, typeNo).run();
		} else {
			await env.song_project_db.prepare(`
				DELETE FROM ap_concept_type_progress
				WHERE admin_id = ?1 AND problem_type_id IN (
					SELECT t.id FROM ap_concept_problem_types t
					JOIN ap_concepts c ON c.id = t.concept_id
					WHERE c.concept_code = ?2 AND t.type_no = ?3
				)
			`).bind(session.adminId, conceptCode, typeNo).run();
		}
		return json({ ok:true, conceptCode, typeNo, completed });
	} catch (error) {
		console.error('Failed to update AP concept progress', error);
		return json({ ok:false, error:'AP_CONCEPT_PROGRESS_UPDATE_FAILED' }, 500);
	}
}
