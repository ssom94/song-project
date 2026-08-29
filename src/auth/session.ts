const ADMIN_SESSION_COOKIE = 'admin_session';

export interface AuthenticatedAdminSession {
	adminId: number;
	username: string;
	displayName: string;
	email: string | null;
	twoFactorEnabled: boolean;
	expiresAt: string;
}

interface AdminSessionRow {
	admin_id: number;
	username: string;
	display_name: string;
	email: string | null;
	two_factor_enabled: number;
	expires_at: string;
}

function getCookie(request: Request, name: string): string | null {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) {
		return null;
	}

	for (const part of cookieHeader.split(';')) {
		const [rawName, ...rawValueParts] = part.trim().split('=');
		if (rawName === name) {
			return decodeURIComponent(rawValueParts.join('='));
		}
	}

	return null;
}

async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getAuthenticatedAdminSession(
	request: Request,
	db: D1Database,
): Promise<AuthenticatedAdminSession | null> {
	const rawToken = getCookie(request, ADMIN_SESSION_COOKIE);
	if (!rawToken) {
		return null;
	}

	const tokenHash = await sha256Hex(rawToken);
	const row = await db
		.prepare(`
			SELECT
				s.admin_id,
				s.expires_at,
				a.username,
				a.display_name,
				a.email,
				a.two_factor_enabled
			FROM admin_sessions AS s
			INNER JOIN admins AS a ON a.id = s.admin_id
			WHERE s.token_hash = ?1
				AND s.revoked_at IS NULL
				AND datetime(s.expires_at) > datetime('now')
				AND a.status = 'active'
			LIMIT 1
		`)
		.bind(tokenHash)
		.first<AdminSessionRow>();

	if (!row) {
		return null;
	}

	return {
		adminId: row.admin_id,
		username: row.username,
		displayName: row.display_name,
		email: row.email,
		twoFactorEnabled: row.two_factor_enabled === 1,
		expiresAt: row.expires_at,
	};
}

export async function handleAdminSessionStatus(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);

	return Response.json(
		session
			? {
					authenticated: true,
					admin: {
						id: session.adminId,
						username: session.username,
						displayName: session.displayName,
						email: session.email,
						twoFactorEnabled: session.twoFactorEnabled,
					},
					expiresAt: session.expiresAt,
				}
			: { authenticated: false },
		{
			headers: {
				'Cache-Control': 'no-store',
			},
		},
	);
}
