import { ADMIN_SESSION_COOKIE } from './session';
import { verifyPassword } from './password';

const DEFAULT_SESSION_DAYS = 30;
const REMEMBER_SESSION_DAYS = 90;
const MAX_FAILED_LOGIN_COUNT = 5;
const LOCK_MINUTES = 15;

const DUMMY_PASSWORD_HASH =
	'scrypt$16384$8$5$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

interface LoginRequestBody {
	username?: unknown;
	password?: unknown;
	rememberMe?: unknown;
}

interface AdminLoginRow {
	id: number;
	username: string;
	password_hash: string;
	display_name: string;
	email: string | null;
	status: 'active' | 'disabled';
	two_factor_enabled: number;
	failed_login_count: number;
	locked_until: string | null;
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
	return Response.json(data, {
		status,
		headers: {
			'Cache-Control': 'no-store',
			...headers,
		},
	});
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createRandomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
}

function buildSessionCookie(request: Request, token: string, maxAgeSeconds: number): string {
	const url = new URL(request.url);
	const secure = url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
	return [
		`${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Strict',
		`Max-Age=${maxAgeSeconds}`,
		secure ? 'Secure' : null,
	]
		.filter(Boolean)
		.join('; ');
}

async function recordFailedLogin(db: D1Database, admin: AdminLoginRow): Promise<void> {
	const nextCount = admin.failed_login_count + 1;
	const shouldLock = nextCount >= MAX_FAILED_LOGIN_COUNT;
	const lockedUntil = shouldLock
		? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
		: admin.locked_until;

	await db
		.prepare(`
			UPDATE admins
			SET failed_login_count = ?1,
				locked_until = ?2,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE id = ?3
		`)
		.bind(nextCount, lockedUntil, admin.id)
		.run();
}

function isCurrentlyLocked(admin: AdminLoginRow): boolean {
	if (!admin.locked_until) {
		return false;
	}
	const lockedUntil = Date.parse(admin.locked_until);
	return Number.isFinite(lockedUntil) && lockedUntil > Date.now();
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
	const requestId = crypto.randomUUID();
	const respond = (data: unknown, status = 200, headers?: HeadersInit) =>
		json(data, status, { 'X-Request-Id': requestId, ...headers });

	let body: LoginRequestBody;
	try {
		body = (await request.json()) as LoginRequestBody;
	} catch {
		console.warn('[admin-login] invalid_json', { requestId });
		return respond({ error: 'INVALID_REQUEST' }, 400);
	}

	if (
		typeof body.username !== 'string' ||
		typeof body.password !== 'string' ||
		body.username.length < 1 ||
		body.username.length > 100 ||
		body.password.length < 1 ||
		body.password.length > 1024
	) {
		console.warn('[admin-login] invalid_request', { requestId });
		return respond({ error: 'INVALID_REQUEST' }, 400);
	}

	const username = body.username.trim();
	const rememberMe = body.rememberMe === true;

	try {
		const admin = await env.song_project_db
			.prepare(`
				SELECT
					id,
					username,
					password_hash,
					display_name,
					email,
					status,
					two_factor_enabled,
					failed_login_count,
					locked_until
				FROM admins
				WHERE username = ?1 COLLATE NOCASE
				LIMIT 1
			`)
			.bind(username)
			.first<AdminLoginRow>();

		if (!admin) {
			await verifyPassword(body.password, DUMMY_PASSWORD_HASH);
			console.warn('[admin-login] account_not_found', { requestId, username });
			return respond({ error: 'INVALID_CREDENTIALS' }, 401);
		}

		if (isCurrentlyLocked(admin)) {
			console.warn('[admin-login] account_locked', {
				requestId,
				adminId: admin.id,
				username: admin.username,
				lockedUntil: admin.locked_until,
			});
			return respond({ error: 'INVALID_CREDENTIALS' }, 401);
		}

		const passwordMatches = await verifyPassword(body.password, admin.password_hash);
		if (!passwordMatches) {
			await recordFailedLogin(env.song_project_db, admin);
			console.warn('[admin-login] password_mismatch', {
				requestId,
				adminId: admin.id,
				username: admin.username,
				hashAlgorithm: admin.password_hash.split('$', 1)[0] || 'unknown',
			});
			return respond({ error: 'INVALID_CREDENTIALS' }, 401);
		}

		if (admin.status !== 'active') {
			await recordFailedLogin(env.song_project_db, admin);
			console.warn('[admin-login] account_disabled', {
				requestId,
				adminId: admin.id,
				username: admin.username,
			});
			return respond({ error: 'INVALID_CREDENTIALS' }, 401);
		}

		if (admin.two_factor_enabled === 1) {
			console.info('[admin-login] two_factor_required', {
				requestId,
				adminId: admin.id,
				username: admin.username,
			});
			return respond({ error: 'TWO_FACTOR_REQUIRED' }, 403);
		}

		const rawToken = createRandomToken();
		const tokenHash = await sha256Hex(rawToken);
		const sessionDays = rememberMe ? REMEMBER_SESSION_DAYS : DEFAULT_SESSION_DAYS;
		const maxAgeSeconds = sessionDays * 24 * 60 * 60;
		const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();
		const userAgent = request.headers.get('User-Agent');

		await env.song_project_db.batch([
			env.song_project_db
				.prepare(`
					INSERT INTO admin_sessions (
						admin_id,
						token_hash,
						remember_me,
						user_agent,
						expires_at
					) VALUES (?1, ?2, ?3, ?4, ?5)
				`)
				.bind(admin.id, tokenHash, rememberMe ? 1 : 0, userAgent, expiresAt),
			env.song_project_db
				.prepare(`
					UPDATE admins
					SET failed_login_count = 0,
						locked_until = NULL,
						last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
						updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
					WHERE id = ?1
				`)
				.bind(admin.id),
		]);

		console.info('[admin-login] success', {
			requestId,
			adminId: admin.id,
			username: admin.username,
			rememberMe,
		});

		return respond(
			{
				authenticated: true,
				admin: {
					id: admin.id,
					username: admin.username,
					displayName: admin.display_name,
					email: admin.email,
					twoFactorEnabled: false,
				},
				expiresAt,
			},
			200,
			{
				'Set-Cookie': buildSessionCookie(request, rawToken, maxAgeSeconds),
			},
		);
	} catch (error) {
		console.error('[admin-login] server_error', {
			requestId,
			username,
			message: errorMessage(error),
		});
		return respond({ error: 'SERVER_ERROR' }, 500);
	}
}
