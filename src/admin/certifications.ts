import { getAuthenticatedAdminSession } from '../auth/session';

type LanguageFields = Record<string, unknown>;

type CertificationInput = LanguageFields & {
	id?: unknown;
	slug?: unknown;
	code?: unknown;
	category?: unknown;
	officialUrl?: unknown;
	guideUrl?: unknown;
	accentKey?: unknown;
	sourceCheckedAt?: unknown;
	displayOrder?: unknown;
	isActive?: unknown;
	schedules?: unknown;
	topics?: unknown;
};

type ScheduleInput = LanguageFields & {
	sequenceNo?: unknown;
	dateStart?: unknown;
	dateEnd?: unknown;
	announced?: unknown;
};

type TopicInput = LanguageFields & {
	type?: unknown;
	weightPercent?: unknown;
	displayOrder?: unknown;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function sameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function text(value: unknown, max = 4000): string {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nullableText(value: unknown, max = 4000): string | null {
	const parsed = text(value, max);
	return parsed || null;
}

function integer(value: unknown, fallback = 0, min = -999999, max = 999999): number {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function nullableInteger(value: unknown, min = 0, max = 100): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function date(value: unknown): string | null {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	return value;
}

async function requireAdmin(request: Request, env: Env) {
	return getAuthenticatedAdminSession(request, env.song_project_db);
}

async function loadCatalog(db: D1Database) {
	const [certifications, schedules, topics] = await Promise.all([
		db.prepare(`SELECT * FROM certifications ORDER BY display_order ASC, id ASC`).all<Record<string, unknown>>(),
		db.prepare(`SELECT * FROM certification_schedules ORDER BY certification_id ASC, sequence_no ASC, id ASC`).all<Record<string, unknown>>(),
		db.prepare(`SELECT * FROM certification_topics ORDER BY certification_id ASC, display_order ASC, id ASC`).all<Record<string, unknown>>(),
	]);
	const scheduleMap = new Map<number, Record<string, unknown>[]>();
	const topicMap = new Map<number, Record<string, unknown>[]>();
	for (const row of schedules.results) {
		const id = Number(row.certification_id);
		const list = scheduleMap.get(id) ?? [];
		list.push({
			id: Number(row.id), sequenceNo: Number(row.sequence_no ?? 0),
			labelJa: String(row.label_ja ?? ''), labelKo: String(row.label_ko ?? ''),
			applicationJa: String(row.application_ja ?? ''), applicationKo: String(row.application_ko ?? ''),
			examJa: String(row.exam_ja ?? ''), examKo: String(row.exam_ko ?? ''),
			resultJa: String(row.result_ja ?? ''), resultKo: String(row.result_ko ?? ''),
			noteJa: String(row.note_ja ?? ''), noteKo: String(row.note_ko ?? ''),
			dateStart: row.date_start ? String(row.date_start) : null,
			dateEnd: row.date_end ? String(row.date_end) : null,
			announced: Number(row.is_announced ?? 0) === 1,
		});
		scheduleMap.set(id, list);
	}
	for (const row of topics.results) {
		const id = Number(row.certification_id);
		const list = topicMap.get(id) ?? [];
		list.push({
			id: Number(row.id), type: String(row.topic_type ?? 'concept'),
			titleJa: String(row.title_ja ?? ''), titleKo: String(row.title_ko ?? ''),
			descriptionJa: String(row.description_ja ?? ''), descriptionKo: String(row.description_ko ?? ''),
			metaJa: String(row.meta_ja ?? ''), metaKo: String(row.meta_ko ?? ''),
			weightPercent: row.weight_percent === null || row.weight_percent === undefined ? null : Number(row.weight_percent),
			displayOrder: Number(row.display_order ?? 100),
		});
		topicMap.set(id, list);
	}
	return certifications.results.map((row) => {
		const id = Number(row.id);
		return {
			id, slug: String(row.slug ?? ''), code: String(row.code ?? ''), category: String(row.category ?? ''),
			titleJa: String(row.title_ja ?? ''), titleKo: String(row.title_ko ?? ''),
			subtitleJa: String(row.subtitle_ja ?? ''), subtitleKo: String(row.subtitle_ko ?? ''),
			providerJa: String(row.provider_ja ?? ''), providerKo: String(row.provider_ko ?? ''),
			summaryJa: String(row.summary_ja ?? ''), summaryKo: String(row.summary_ko ?? ''),
			examModeJa: String(row.exam_mode_ja ?? ''), examModeKo: String(row.exam_mode_ko ?? ''),
			feeJa: String(row.fee_ja ?? ''), feeKo: String(row.fee_ko ?? ''),
			durationJa: String(row.duration_ja ?? ''), durationKo: String(row.duration_ko ?? ''),
			questionsJa: String(row.questions_ja ?? ''), questionsKo: String(row.questions_ko ?? ''),
			passJa: String(row.pass_ja ?? ''), passKo: String(row.pass_ko ?? ''),
			officialUrl: String(row.official_url ?? ''), guideUrl: String(row.guide_url ?? ''),
			accentKey: String(row.accent_key ?? 'blue'), sourceCheckedAt: String(row.source_checked_at ?? ''),
			displayOrder: Number(row.display_order ?? 100), isActive: Number(row.is_active ?? 0) === 1,
			schedules: scheduleMap.get(id) ?? [], topics: topicMap.get(id) ?? [],
		};
	});
}

export async function handleGetAdminCertifications(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		return json({ ok: true, certifications: await loadCatalog(env.song_project_db) });
	} catch (error) {
		console.error('Failed to load admin certification catalog', error);
		return json({ ok: false, error: 'CERTIFICATION_ADMIN_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateAdminCertification(request: Request, env: Env): Promise<Response> {
	if (!sameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	let payload: CertificationInput;
	try {
		payload = await request.json() as CertificationInput;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const id = integer(payload.id, 0, 1, Number.MAX_SAFE_INTEGER);
	if (!id) return json({ ok: false, error: 'INVALID_CERTIFICATION_ID' }, 400);
	const slug = text(payload.slug, 100);
	const code = text(payload.code, 60);
	const category = text(payload.category, 60);
	const titleJa = text(payload.titleJa, 240);
	const titleKo = text(payload.titleKo, 240);
	const providerJa = text(payload.providerJa, 300);
	const providerKo = text(payload.providerKo, 300);
	const summaryJa = text(payload.summaryJa, 4000);
	const summaryKo = text(payload.summaryKo, 4000);
	const examModeJa = text(payload.examModeJa, 500);
	const examModeKo = text(payload.examModeKo, 500);
	const feeJa = text(payload.feeJa, 300);
	const feeKo = text(payload.feeKo, 300);
	const officialUrl = text(payload.officialUrl, 1000);
	if (!slug || !code || !category || !titleJa || !titleKo || !providerJa || !providerKo || !summaryJa || !summaryKo || !examModeJa || !examModeKo || !feeJa || !feeKo || !officialUrl) {
		return json({ ok: false, error: 'CERTIFICATION_REQUIRED_FIELD_MISSING' }, 400);
	}
	if (!Array.isArray(payload.schedules) || payload.schedules.length > 30 || !Array.isArray(payload.topics) || payload.topics.length > 100) {
		return json({ ok: false, error: 'INVALID_CERTIFICATION_CHILDREN' }, 400);
	}

	const statements: D1PreparedStatement[] = [env.song_project_db.prepare(`
		UPDATE certifications SET
			slug=?2, code=?3, category=?4,
			title_ja=?5, title_ko=?6, subtitle_ja=?7, subtitle_ko=?8,
			provider_ja=?9, provider_ko=?10, summary_ja=?11, summary_ko=?12,
			exam_mode_ja=?13, exam_mode_ko=?14, fee_ja=?15, fee_ko=?16,
			duration_ja=?17, duration_ko=?18, questions_ja=?19, questions_ko=?20,
			pass_ja=?21, pass_ko=?22, official_url=?23, guide_url=?24,
			accent_key=?25, source_checked_at=?26, display_order=?27, is_active=?28,
			updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
		WHERE id=?1
	`).bind(
		id, slug, code, category,
		titleJa, titleKo, nullableText(payload.subtitleJa, 500), nullableText(payload.subtitleKo, 500),
		providerJa, providerKo, summaryJa, summaryKo, examModeJa, examModeKo, feeJa, feeKo,
		nullableText(payload.durationJa, 500), nullableText(payload.durationKo, 500),
		nullableText(payload.questionsJa, 500), nullableText(payload.questionsKo, 500),
		nullableText(payload.passJa, 500), nullableText(payload.passKo, 500), officialUrl,
		nullableText(payload.guideUrl, 1000), text(payload.accentKey, 40) || 'blue',
		date(payload.sourceCheckedAt) || new Date().toISOString().slice(0, 10),
		integer(payload.displayOrder, 100), payload.isActive === false ? 0 : 1,
	)];

	statements.push(env.song_project_db.prepare(`DELETE FROM certification_schedules WHERE certification_id=?1`).bind(id));
	for (let index = 0; index < payload.schedules.length; index += 1) {
		const row = payload.schedules[index] as ScheduleInput;
		const labelJa = text(row.labelJa, 300);
		const labelKo = text(row.labelKo, 300);
		const examJa = text(row.examJa, 1200);
		const examKo = text(row.examKo, 1200);
		if (!labelJa || !labelKo || !examJa || !examKo) return json({ ok: false, error: 'SCHEDULE_REQUIRED_FIELD_MISSING' }, 400);
		statements.push(env.song_project_db.prepare(`
			INSERT INTO certification_schedules (
				certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko,
				exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced
			) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
		`).bind(
			id, integer(row.sequenceNo, index + 1, 1, 999), labelJa, labelKo,
			nullableText(row.applicationJa, 1200), nullableText(row.applicationKo, 1200), examJa, examKo,
			nullableText(row.resultJa, 1200), nullableText(row.resultKo, 1200),
			nullableText(row.noteJa, 2000), nullableText(row.noteKo, 2000), date(row.dateStart), date(row.dateEnd), row.announced === false ? 0 : 1,
		));
	}

	statements.push(env.song_project_db.prepare(`DELETE FROM certification_topics WHERE certification_id=?1`).bind(id));
	for (let index = 0; index < payload.topics.length; index += 1) {
		const row = payload.topics[index] as TopicInput;
		const type = ['format', 'domain', 'concept', 'study'].includes(String(row.type)) ? String(row.type) : 'concept';
		const titleJa = text(row.titleJa, 500);
		const titleKo = text(row.titleKo, 500);
		if (!titleJa || !titleKo) return json({ ok: false, error: 'TOPIC_TITLE_REQUIRED' }, 400);
		statements.push(env.song_project_db.prepare(`
			INSERT INTO certification_topics (
				certification_id, topic_type, title_ja, title_ko, description_ja, description_ko,
				meta_ja, meta_ko, weight_percent, display_order
			) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
		`).bind(
			id, type, titleJa, titleKo, nullableText(row.descriptionJa, 4000), nullableText(row.descriptionKo, 4000),
			nullableText(row.metaJa, 2000), nullableText(row.metaKo, 2000), nullableInteger(row.weightPercent), integer(row.displayOrder, (index + 1) * 10),
		));
	}

	try {
		await env.song_project_db.batch(statements);
		return json({ ok: true, certifications: await loadCatalog(env.song_project_db) });
	} catch (error) {
		console.error('Failed to update certification catalog', error);
		return json({ ok: false, error: 'CERTIFICATION_ADMIN_UPDATE_FAILED' }, 500);
	}
}
