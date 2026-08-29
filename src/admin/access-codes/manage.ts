import { getAuthenticatedAdminSession } from '../../auth/session';

type Language = 'ja' | 'ko';

type IssuePayload = {
	label?: unknown;
	language?: unknown;
	expiresAt?: unknown;
	allowSkillSheet?: unknown;
	allowCareerHistory?: unknown;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function isLanguage(value: unknown): value is Language {
	return value === 'ja' || value === 'ko';
}

async function sha256Hex(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomFourDigitCode(): string {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return String(random[0] % 10000).padStart(4, '0');
}

function parseExpiry(value: unknown): string | null {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T23:59:59.999+09:00`);
	if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
	return date.toISOString();
}

export async function handleListAdminAccessCodes(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const rows = await env.song_project_db.prepare(`
			SELECT
				id,
				label,
				language,
				allow_skill_sheet,
				allow_career_history,
				issued_at,
				expires_at,
				last_used_at,
				use_count,
				revoked_at,
				CASE
					WHEN revoked_at IS NOT NULL THEN 'revoked'
					WHEN datetime(expires_at) <= datetime('now') THEN 'expired'
					ELSE 'active'
				END AS status
			FROM access_codes
			ORDER BY datetime(issued_at) DESC, id DESC
			LIMIT 200
		`).all();

		const metrics = await env.song_project_db.prepare(`
			SELECT
				SUM(CASE WHEN revoked_at IS NULL AND datetime(expires_at) > datetime('now') THEN 1 ELSE 0 END) AS active_count,
				SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked_count,
				SUM(CASE WHEN date(last_used_at) = date('now') THEN 1 ELSE 0 END) AS today_access_count
			FROM access_codes
		`).first();

		return json({ ok: true, codes: rows.results, metrics: metrics ?? {} });
	} catch (error) {
		console.error('Failed to list access codes', error);
		return json({ ok: false, error: 'ACCESS_CODE_LIST_FAILED' }, 500);
	}
}

export async function handleIssueAdminAccessCode(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: IssuePayload;
	try {
		payload = await request.json() as IssuePayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const label = typeof payload.label === 'string' ? payload.label.trim().slice(0, 120) : '';
	if (!label) return json({ ok: false, error: 'LABEL_REQUIRED' }, 400);
	if (!isLanguage(payload.language)) return json({ ok: false, error: 'INVALID_LANGUAGE' }, 400);
	const expiresAt = parseExpiry(payload.expiresAt);
	if (!expiresAt) return json({ ok: false, error: 'INVALID_EXPIRY' }, 400);
	const allowSkillSheet = payload.allowSkillSheet === true;
	const allowCareerHistory = payload.allowCareerHistory === true;
	if (!allowSkillSheet && !allowCareerHistory) return json({ ok: false, error: 'PERMISSION_REQUIRED' }, 400);

	let rawCode = '';
	let codeHash = '';
	for (let attempt = 0; attempt < 60; attempt += 1) {
		rawCode = randomFourDigitCode();
		codeHash = await sha256Hex(`${payload.language}:${rawCode}`);
		const existing = await env.song_project_db
			.prepare('SELECT id FROM access_codes WHERE code_hash = ?1 LIMIT 1')
			.bind(codeHash)
			.first();
		if (!existing) break;
		rawCode = '';
		codeHash = '';
	}
	if (!rawCode || !codeHash) return json({ ok: false, error: 'CODE_SPACE_BUSY' }, 503);

	const now = new Date().toISOString();
	try {
		const created = await env.song_project_db.prepare(`
			INSERT INTO access_codes (
				code_hash,
				code_hint,
				label,
				language,
				allow_skill_sheet,
				allow_career_history,
				issued_by,
				issued_at,
				expires_at,
				created_at
			) VALUES (?1, '••••', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?7)
			RETURNING id
		`).bind(
			codeHash,
			label,
			payload.language,
			allowSkillSheet ? 1 : 0,
			allowCareerHistory ? 1 : 0,
			session.adminId,
			now,
			expiresAt,
		).first<{ id: number }>();

		return json({
			ok: true,
			code: {
				id: created?.id ?? null,
				value: rawCode,
				language: payload.language,
				label,
				expiresAt,
				allowSkillSheet,
				allowCareerHistory,
			},
		}, 201);
	} catch (error) {
		console.error('Failed to issue access code', error);
		return json({ ok: false, error: 'ACCESS_CODE_ISSUE_FAILED' }, 500);
	}
}

export async function handleRevokeAdminAccessCode(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_ID' }, 400);

	const now = new Date().toISOString();
	try {
		const row = await env.song_project_db.prepare(`
			UPDATE access_codes
			SET revoked_at = COALESCE(revoked_at, ?1)
			WHERE id = ?2
			RETURNING id
		`).bind(now, id).first();
		if (!row) return json({ ok: false, error: 'NOT_FOUND' }, 404);

		await env.song_project_db.prepare(`
			UPDATE protected_access_sessions
			SET revoked_at = COALESCE(revoked_at, ?1)
			WHERE access_code_id = ?2
		`).bind(now, id).run();
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to revoke access code', error);
		return json({ ok: false, error: 'ACCESS_CODE_REVOKE_FAILED' }, 500);
	}
}
