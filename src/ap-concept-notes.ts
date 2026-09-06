import { getAuthenticatedAdminSession } from './auth/session';

type NoteTargetType = 'concept' | 'question';

interface NoteRow {
	target_type: NoteTargetType;
	question_id: number | null;
	body: string;
	updated_at: string;
}

interface ResolvedTarget {
	conceptId: number;
	questionId: number | null;
	targetKey: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function cleanCode(value: unknown): string {
	return String(value ?? '').trim().toUpperCase();
}

function cleanTargetType(value: unknown): NoteTargetType | null {
	return value === 'concept' || value === 'question' ? value : null;
}

function cleanQuestionId(value: unknown): number | null {
	const n = Number(value);
	return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function cleanBody(value: unknown): string {
	return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

async function resolveTarget(
	db: D1Database,
	conceptCode: string,
	targetType: NoteTargetType,
	questionId: number | null,
): Promise<ResolvedTarget | null> {
	if (targetType === 'concept') {
		const row = await db.prepare(`
			SELECT id
			FROM ap_concepts
			WHERE concept_code = ?1 AND is_published = 1
			LIMIT 1
		`).bind(conceptCode).first<{ id: number }>();
		return row ? { conceptId: row.id, questionId: null, targetKey: `concept:${row.id}` } : null;
	}
	if (!questionId) return null;
	const row = await db.prepare(`
		SELECT c.id AS concept_id, q.id AS question_id
		FROM ap_concepts c
		JOIN ap_concept_problem_types t ON t.concept_id = c.id
		JOIN ap_concept_questions q ON q.problem_type_id = t.id
		WHERE c.concept_code = ?1
		  AND c.is_published = 1
		  AND q.id = ?2
		LIMIT 1
	`).bind(conceptCode, questionId).first<{ concept_id: number; question_id: number }>();
	return row ? { conceptId: row.concept_id, questionId: row.question_id, targetKey: `question:${row.question_id}` } : null;
}

export async function handleGetPublicApConceptNotes(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const conceptCode = cleanCode(url.searchParams.get('code'));
		if (!/^[AB]-\d{2}$/.test(conceptCode)) return json({ ok: false, error: 'INVALID_CONCEPT_CODE' }, 400);
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: true, viewer: { authenticated: false }, notes: [] });
		try {
			const result = await env.song_project_db.prepare(`
				SELECT n.target_type, n.question_id, n.body, n.updated_at
				FROM ap_concept_notes n
				JOIN ap_concepts c ON c.id = n.concept_id
				WHERE n.admin_id = ?1 AND c.concept_code = ?2
				ORDER BY CASE n.target_type WHEN 'concept' THEN 0 ELSE 1 END, n.question_id ASC
			`).bind(session.adminId, conceptCode).all<NoteRow>();
			return json({
				ok: true,
				viewer: { authenticated: true },
				notes: result.results.map((row) => ({
					targetType: row.target_type,
					questionId: row.question_id,
					body: row.body,
					updatedAt: row.updated_at,
				})),
			});
		} catch (error) {
			if (String(error).includes('no such table: ap_concept_notes')) {
				return json({ ok: true, viewer: { authenticated: true }, notes: [], migrationRequired: true });
			}
			throw error;
		}
	} catch (error) {
		console.error('Failed to load AP concept notes', error);
		return json({ ok: false, error: 'AP_CONCEPT_NOTES_LOAD_FAILED' }, 500);
	}
}

async function parseTargetRequest(request: Request): Promise<{
	conceptCode: string;
	targetType: NoteTargetType;
	questionId: number | null;
	body: string;
} | Response> {
	let payload: { conceptCode?: unknown; targetType?: unknown; questionId?: unknown; body?: unknown };
	try {
		payload = await request.json() as typeof payload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const conceptCode = cleanCode(payload.conceptCode);
	const targetType = cleanTargetType(payload.targetType);
	const questionId = cleanQuestionId(payload.questionId);
	const body = cleanBody(payload.body);
	if (!/^[AB]-\d{2}$/.test(conceptCode) || !targetType) return json({ ok: false, error: 'INVALID_NOTE_TARGET' }, 400);
	if (targetType === 'question' && !questionId) return json({ ok: false, error: 'INVALID_NOTE_QUESTION' }, 400);
	return { conceptCode, targetType, questionId, body };
}

export async function handlePatchAdminApConceptNote(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'FORBIDDEN_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const parsed = await parseTargetRequest(request);
	if (parsed instanceof Response) return parsed;
	if (!parsed.body || parsed.body.length > 4000) return json({ ok: false, error: 'INVALID_NOTE_BODY' }, 400);
	try {
		const target = await resolveTarget(env.song_project_db, parsed.conceptCode, parsed.targetType, parsed.questionId);
		if (!target) return json({ ok: false, error: 'NOTE_TARGET_NOT_FOUND' }, 404);
		await env.song_project_db.prepare(`
			INSERT INTO ap_concept_notes(
				admin_id, concept_id, question_id, target_type, target_key, body, created_at, updated_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6,
				strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			ON CONFLICT(admin_id, target_key) DO UPDATE SET
				body = excluded.body,
				concept_id = excluded.concept_id,
				question_id = excluded.question_id,
				target_type = excluded.target_type,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		`).bind(
			session.adminId,
			target.conceptId,
			target.questionId,
			parsed.targetType,
			target.targetKey,
			parsed.body,
		).run();
		return json({
			ok: true,
			note: {
				targetType: parsed.targetType,
				questionId: target.questionId,
				body: parsed.body,
			},
		});
	} catch (error) {
		console.error('Failed to save AP concept note', error);
		return json({ ok: false, error: 'AP_CONCEPT_NOTE_SAVE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminApConceptNote(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'FORBIDDEN_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const parsed = await parseTargetRequest(request);
	if (parsed instanceof Response) return parsed;
	try {
		const target = await resolveTarget(env.song_project_db, parsed.conceptCode, parsed.targetType, parsed.questionId);
		if (!target) return json({ ok: false, error: 'NOTE_TARGET_NOT_FOUND' }, 404);
		await env.song_project_db.prepare(`
			DELETE FROM ap_concept_notes
			WHERE admin_id = ?1 AND target_key = ?2
		`).bind(session.adminId, target.targetKey).run();
		return json({ ok: true, deleted: true });
	} catch (error) {
		console.error('Failed to delete AP concept note', error);
		return json({ ok: false, error: 'AP_CONCEPT_NOTE_DELETE_FAILED' }, 500);
	}
}
