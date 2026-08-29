function json(data: unknown, status = 200, headers?: HeadersInit): Response {
	return Response.json(data, {
		status,
		headers: { 'Cache-Control': 'no-store', ...(headers ?? {}) },
	});
}

async function sha256Hex(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function clientIp(request: Request): string {
	return request.headers.get('CF-Connecting-IP')
		?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
		?? 'local';
}

export async function handleProtectedAccessLogin(request: Request, env: Env): Promise<Response> {
	let payload: { code?: unknown; language?: unknown };
	try {
		payload = await request.json() as { code?: unknown; language?: unknown };
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const code = typeof payload.code === 'string' ? payload.code.trim() : '';
	const language = payload.language === 'ko' ? 'ko' : payload.language === 'ja' ? 'ja' : '';
	if (!/^\d{4}$/.test(code)) return json({ ok: false, error: 'INVALID_CODE_FORMAT' }, 400);
	if (!language) return json({ ok: false, error: 'INVALID_LANGUAGE' }, 400);

	const ipHash = await sha256Hex(clientIp(request));
	try {
		const recentFailures = await env.song_project_db.prepare(`
			SELECT COUNT(*) AS count
			FROM protected_access_attempts
			WHERE ip_hash = ?1
				AND success = 0
				AND datetime(created_at) > datetime('now', '-15 minutes')
		`).bind(ipHash).first<{ count: number }>();
		if ((Number(recentFailures?.count) || 0) >= 5) {
			return json({ ok: false, error: 'TOO_MANY_ATTEMPTS' }, 429, { 'Retry-After': '900' });
		}

		const codeHash = await sha256Hex(`${language}:${code}`);
		const access = await env.song_project_db.prepare(`
			SELECT id, language, allow_skill_sheet, allow_career_history, expires_at
			FROM access_codes
			WHERE code_hash = ?1
				AND language = ?2
				AND revoked_at IS NULL
				AND datetime(expires_at) > datetime('now')
			LIMIT 1
		`).bind(codeHash, language).first<{
			id: number;
			language: 'ja' | 'ko';
			allow_skill_sheet: number;
			allow_career_history: number;
			expires_at: string;
		}>();

		const now = new Date().toISOString();
		await env.song_project_db.prepare(`
			INSERT INTO protected_access_attempts (ip_hash, language, success, created_at)
			VALUES (?1, ?2, ?3, ?4)
		`).bind(ipHash, language, access ? 1 : 0, now).run();

		if (!access) return json({ ok: false, error: 'INVALID_OR_EXPIRED_CODE' }, 401);

		const rawToken = randomToken();
		const tokenHash = await sha256Hex(rawToken);
		const maximum = Date.now() + (30 * 24 * 60 * 60 * 1000);
		const parentExpiry = new Date(access.expires_at).getTime();
		const expiresAt = new Date(Math.min(maximum, parentExpiry)).toISOString();
		const countryCode = request.headers.get('CF-IPCountry');
		const userAgent = request.headers.get('User-Agent');

		const createdSession = await env.song_project_db.prepare(`
			INSERT INTO protected_access_sessions (
				access_code_id, token_hash, user_agent, ip_hash, country_code, created_at, last_seen_at, expires_at
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
			RETURNING id
		`).bind(access.id, tokenHash, userAgent, ipHash, countryCode, now, expiresAt).first<{ id: number }>();

		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				UPDATE access_codes
				SET last_used_at = ?1, use_count = use_count + 1
				WHERE id = ?2
			`).bind(now, access.id),
			env.song_project_db.prepare(`
				INSERT INTO protected_access_logs (
					access_code_id, session_id, action, ip_hash, ip_masked, country_code, user_agent, created_at
				) VALUES (?1, ?2, 'authenticate', ?3, NULL, ?4, ?5, ?6)
			`).bind(access.id, createdSession?.id ?? null, ipHash, countryCode, userAgent, now),
		]);

		const maxAge = Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
		const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
		const cookie = `protected_session=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
		return json({
			ok: true,
			access: {
				language: access.language,
				allowSkillSheet: access.allow_skill_sheet === 1,
				allowCareerHistory: access.allow_career_history === 1,
				expiresAt,
			},
			redirect: `/protected/viewer/?lang=${access.language}`,
		}, 200, { 'Set-Cookie': cookie });
	} catch (error) {
		console.error('Protected access authentication failed', error);
		return json({ ok: false, error: 'PROTECTED_ACCESS_FAILED' }, 500);
	}
}
