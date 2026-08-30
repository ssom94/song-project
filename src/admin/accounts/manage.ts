import { hashPassword } from '../../auth/password';
import { getAuthenticatedAdminSession } from '../../auth/session';

type AdminStatus = 'active' | 'disabled';

type CreatePayload = {
	username?: unknown;
	displayName?: unknown;
	email?: unknown;
	password?: unknown;
	status?: unknown;
};

type UpdatePayload = {
	id?: unknown;
	displayName?: unknown;
	email?: unknown;
	password?: unknown;
	status?: unknown;
};

interface AdminRow {
	id: number;
	username: string;
	display_name: string;
	email: string | null;
	status: AdminStatus;
	two_factor_enabled: number;
	last_login_at: string | null;
	created_at: string;
	updated_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function text(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeEmail(value: unknown): string | null {
	const email = text(value, 254).toLowerCase();
	if (!email) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '__INVALID__';
	return email;
}

function statusValue(value: unknown): AdminStatus | null {
	return value === 'active' || value === 'disabled' ? value : null;
}

function serialize(row: AdminRow, currentAdminId: number) {
	return {
		id: row.id,
		username: row.username,
		displayName: row.display_name,
		email: row.email,
		status: row.status,
		twoFactorEnabled: row.two_factor_enabled === 1,
		lastLoginAt: row.last_login_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		isCurrent: row.id === currentAdminId,
	};
}

async function findConflict(db: D1Database, username: string, email: string | null, excludeId = 0) {
	return db.prepare(`
		SELECT id, username, email
		FROM admins
		WHERE id <> ?1
			AND (
				lower(username) = lower(?2)
				OR (?3 IS NOT NULL AND email IS NOT NULL AND lower(email) = lower(?3))
			)
		LIMIT 1
	`).bind(excludeId, username, email).first<{ id: number; username: string; email: string | null }>();
}

export async function handleListAdminAccounts(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const result = await env.song_project_db.prepare(`
			SELECT id, username, display_name, email, status, two_factor_enabled,
				last_login_at, created_at, updated_at
			FROM admins
			ORDER BY id ASC
		`).all<AdminRow>();
		return json({
			ok: true,
			currentAdminId: session.adminId,
			accounts: result.results.map((row) => serialize(row, session.adminId)),
		});
	} catch (error) {
		console.error('Failed to list admin accounts', error);
		return json({ ok: false, error: 'ADMIN_ACCOUNTS_LOAD_FAILED' }, 500);
	}
}

export async function handleCreateAdminAccount(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: CreatePayload;
	try {
		payload = await request.json() as CreatePayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const username = text(payload.username, 32);
	const displayName = text(payload.displayName, 80);
	const password = typeof payload.password === 'string' ? payload.password : '';
	const email = normalizeEmail(payload.email);
	const status = payload.status == null ? 'active' : statusValue(payload.status);

	if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) return json({ ok: false, error: 'INVALID_USERNAME' }, 400);
	if (!displayName) return json({ ok: false, error: 'DISPLAY_NAME_REQUIRED' }, 400);
	if (email === '__INVALID__') return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
	if (password.length < 10 || password.length > 128) return json({ ok: false, error: 'INVALID_PASSWORD' }, 400);
	if (!status) return json({ ok: false, error: 'INVALID_STATUS' }, 400);

	try {
		const conflict = await findConflict(env.song_project_db, username, email);
		if (conflict) {
			if (conflict.username.toLowerCase() === username.toLowerCase()) return json({ ok: false, error: 'USERNAME_EXISTS' }, 409);
			return json({ ok: false, error: 'EMAIL_EXISTS' }, 409);
		}

		const passwordHash = await hashPassword(password);
		const insert = await env.song_project_db.prepare(`
			INSERT INTO admins (username, password_hash, display_name, email, status, updated_at)
			VALUES (?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		`).bind(username, passwordHash, displayName, email, status).run();
		const id = Number(insert.meta.last_row_id);
		const row = await env.song_project_db.prepare(`
			SELECT id, username, display_name, email, status, two_factor_enabled,
				last_login_at, created_at, updated_at
			FROM admins WHERE id = ?1 LIMIT 1
		`).bind(id).first<AdminRow>();
		if (!row) throw new Error('Created admin could not be reloaded');
		return json({ ok: true, account: serialize(row, session.adminId) }, 201);
	} catch (error) {
		console.error('Failed to create admin account', error);
		return json({ ok: false, error: 'ADMIN_ACCOUNT_CREATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminAccount(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: UpdatePayload;
	try {
		payload = await request.json() as UpdatePayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const id = Number(payload.id);
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_ADMIN_ID' }, 400);

	try {
		const current = await env.song_project_db.prepare(`
			SELECT id, username, display_name, email, status, two_factor_enabled,
				last_login_at, created_at, updated_at
			FROM admins WHERE id = ?1 LIMIT 1
		`).bind(id).first<AdminRow>();
		if (!current) return json({ ok: false, error: 'ADMIN_NOT_FOUND' }, 404);

		const displayName = payload.displayName == null ? current.display_name : text(payload.displayName, 80);
		const email = payload.email == null ? current.email : normalizeEmail(payload.email);
		const status = payload.status == null ? current.status : statusValue(payload.status);
		const password = payload.password == null ? '' : (typeof payload.password === 'string' ? payload.password : '');

		if (!displayName) return json({ ok: false, error: 'DISPLAY_NAME_REQUIRED' }, 400);
		if (email === '__INVALID__') return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
		if (!status) return json({ ok: false, error: 'INVALID_STATUS' }, 400);
		if (password && (password.length < 10 || password.length > 128)) return json({ ok: false, error: 'INVALID_PASSWORD' }, 400);
		if (id === session.adminId && status === 'disabled') return json({ ok: false, error: 'CANNOT_DISABLE_SELF' }, 400);

		if (current.status === 'active' && status === 'disabled') {
			const active = await env.song_project_db.prepare(`SELECT COUNT(*) AS count FROM admins WHERE status = 'active'`).first<{ count: number }>();
			if (Number(active?.count ?? 0) <= 1) return json({ ok: false, error: 'CANNOT_DISABLE_LAST_ADMIN' }, 400);
		}

		const conflict = await findConflict(env.song_project_db, current.username, email, id);
		if (conflict?.email && email && conflict.email.toLowerCase() === email.toLowerCase()) return json({ ok: false, error: 'EMAIL_EXISTS' }, 409);

		const statements: D1PreparedStatement[] = [];
		if (password) {
			const passwordHash = await hashPassword(password);
			statements.push(env.song_project_db.prepare(`
				UPDATE admins
				SET display_name = ?2, email = ?3, status = ?4, password_hash = ?5,
					failed_login_count = 0, locked_until = NULL,
					updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
				WHERE id = ?1
			`).bind(id, displayName, email, status, passwordHash));
		} else {
			statements.push(env.song_project_db.prepare(`
				UPDATE admins
				SET display_name = ?2, email = ?3, status = ?4,
					updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
				WHERE id = ?1
			`).bind(id, displayName, email, status));
		}
		if (current.status !== status && status === 'disabled') {
			statements.push(env.song_project_db.prepare(`
				UPDATE admin_sessions
				SET revoked_at = COALESCE(revoked_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
				WHERE admin_id = ?1 AND revoked_at IS NULL
			`).bind(id));
		}
		await env.song_project_db.batch(statements);

		const row = await env.song_project_db.prepare(`
			SELECT id, username, display_name, email, status, two_factor_enabled,
				last_login_at, created_at, updated_at
			FROM admins WHERE id = ?1 LIMIT 1
		`).bind(id).first<AdminRow>();
		if (!row) throw new Error('Updated admin could not be reloaded');
		return json({ ok: true, account: serialize(row, session.adminId) });
	} catch (error) {
		console.error('Failed to update admin account', error);
		return json({ ok: false, error: 'ADMIN_ACCOUNT_UPDATE_FAILED' }, 500);
	}
}
