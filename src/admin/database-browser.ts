import { getAuthenticatedAdminSession } from '../auth/session';

interface SchemaRow { cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number; }
interface MasterRow { name: string; }

const PAGE_SIZE_MAX = 50;
const OFFSET_MAX = 1000;
const HIDDEN_TABLES = new Set([
	'admins', 'admin_sessions', 'admin_recovery_codes', 'admin_login_attempts', 'admin_password_reset_tokens',
	'access_codes', 'protected_access_codes', 'protected_access_attempts', 'protected_access_logs',
	'protected_access_sessions', 'd1_migrations',
]);

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

async function requireAdmin(request: Request, env: Env) {
	return getAuthenticatedAdminSession(request, env.song_project_db);
}

async function visibleTables(db: D1Database): Promise<string[]> {
	const result = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 300").all<MasterRow>();
	return result.results.map((row) => row.name).filter((name) => !HIDDEN_TABLES.has(name) && !name.startsWith('_'));
}

async function checkedTable(db: D1Database, requested: string | null): Promise<string | null> {
	if (!requested) return null;
	return (await visibleTables(db)).includes(requested) ? requested : null;
}

async function tableSchema(db: D1Database, table: string): Promise<SchemaRow[]> {
	const result = await db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all<SchemaRow>();
	return result.results;
}

export async function handleAdminDatabaseTables(request: Request, env: Env): Promise<Response> {
	if (!(await requireAdmin(request, env))) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		return json({ ok: true, tables: await visibleTables(env.song_project_db) });
	} catch (error) {
		console.error('Failed to list database tables', error);
		return json({ ok: false, error: 'DATABASE_TABLE_LIST_FAILED' }, 500);
	}
}

export async function handleAdminDatabaseTable(request: Request, env: Env): Promise<Response> {
	if (!(await requireAdmin(request, env))) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		const url = new URL(request.url);
		const table = await checkedTable(env.song_project_db, url.searchParams.get('table'));
		if (!table) return json({ ok: false, error: 'TABLE_NOT_ALLOWED' }, 400);
		const columns = await tableSchema(env.song_project_db, table);
		const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || 25));
		const offset = Math.min(OFFSET_MAX, Math.max(0, Number(url.searchParams.get('offset')) || 0));
		const order = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
		const orderSql = order.length ? ` ORDER BY ${order.map((column) => quoteIdentifier(column.name)).join(', ')}` : '';
		const selectSql = columns.map((column) => quoteIdentifier(column.name)).join(', ');
		const result = await env.song_project_db.prepare(`SELECT ${selectSql} FROM ${quoteIdentifier(table)}${orderSql} LIMIT ?1 OFFSET ?2`).bind(limit + 1, offset).all<Record<string, unknown>>();
		const hasMore = offset < OFFSET_MAX && result.results.length > limit;
		return json({ ok: true, table, columns, rows: result.results.slice(0, limit), page: { limit, offset, hasMore }, editable: order.length > 0 });
	} catch (error) {
		console.error('Failed to browse database table', error);
		return json({ ok: false, error: 'DATABASE_TABLE_READ_FAILED' }, 500);
	}
}

export async function handleUpdateAdminDatabaseRow(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		const body = await request.json() as { table?: unknown; key?: unknown; values?: unknown };
		const table = await checkedTable(env.song_project_db, typeof body.table === 'string' ? body.table : null);
		if (!table) return json({ ok: false, error: 'TABLE_NOT_ALLOWED' }, 400);
		if (!body.key || typeof body.key !== 'object' || Array.isArray(body.key) || !body.values || typeof body.values !== 'object' || Array.isArray(body.values)) return json({ ok: false, error: 'INVALID_ROW_UPDATE' }, 400);
		const columns = await tableSchema(env.song_project_db, table);
		const names = new Set(columns.map((column) => column.name));
		const primary = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
		if (!primary.length) return json({ ok: false, error: 'TABLE_HAS_NO_PRIMARY_KEY' }, 409);
		const key = body.key as Record<string, unknown>;
		const values = body.values as Record<string, unknown>;
		if (primary.some((column) => !(column.name in key))) return json({ ok: false, error: 'PRIMARY_KEY_REQUIRED' }, 400);
		const updates = Object.entries(values).filter(([name, value]) => names.has(name) && !primary.some((column) => column.name === name) && (value === null || ['string', 'number'].includes(typeof value)));
		if (!updates.length || updates.length > 30) return json({ ok: false, error: 'NO_VALID_CHANGES' }, 400);
		const bindings = updates.map((entry) => entry[1]);
		const whereValues = primary.map((column) => key[column.name]);
		if (whereValues.some((value) => value === undefined || (value !== null && !['string', 'number'].includes(typeof value)))) return json({ ok: false, error: 'INVALID_PRIMARY_KEY' }, 400);
		const setSql = updates.map(([name], index) => `${quoteIdentifier(name)} = ?${index + 1}`).join(', ');
		const whereSql = primary.map((column, index) => `${quoteIdentifier(column.name)} IS ?${updates.length + index + 1}`).join(' AND ');
		const result = await env.song_project_db.prepare(`UPDATE ${quoteIdentifier(table)} SET ${setSql} WHERE ${whereSql}`).bind(...bindings, ...whereValues).run();
		if (Number(result.meta.changes || 0) !== 1) return json({ ok: false, error: 'ROW_NOT_FOUND_OR_NOT_UNIQUE' }, 409);
		console.info('Admin database row updated', { adminId: session.adminId, table, columns: updates.map(([name]) => name) });
		return json({ ok: true, changed: 1 });
	} catch (error) {
		console.error('Failed to update database row', error);
		return json({ ok: false, error: 'DATABASE_ROW_UPDATE_FAILED' }, 500);
	}
}
