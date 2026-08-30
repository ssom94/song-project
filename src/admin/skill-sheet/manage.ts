import { getAuthenticatedAdminSession } from '../../auth/session';

type SkillSheetSectionInput = {
	sectionKey?: unknown;
	titleJa?: unknown;
	titleKo?: unknown;
	descriptionJa?: unknown;
	descriptionKo?: unknown;
	selectedSkillIds?: unknown;
	isVisible?: unknown;
};

type SkillSheetPayload = {
	headingJa?: unknown;
	headingKo?: unknown;
	descriptionJa?: unknown;
	descriptionKo?: unknown;
	sections?: unknown;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function requiredText(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	if (!normalized || normalized.length > max) return null;
	return normalized;
}

function optionalText(value: unknown, max: number): string | null {
	if (value === null || value === undefined) return '';
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized.length <= max ? normalized : null;
}

function parseSkillIds(value: unknown): number[] | null {
	if (!Array.isArray(value) || value.length > 100) return null;
	const result: number[] = [];
	const seen = new Set<number>();
	for (const item of value) {
		const id = Number(item);
		if (!Number.isSafeInteger(id) || id <= 0) return null;
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(id);
	}
	return result;
}

function parsePayload(payload: SkillSheetPayload) {
	const headingJa = requiredText(payload.headingJa, 120);
	const headingKo = requiredText(payload.headingKo, 120);
	const descriptionJa = requiredText(payload.descriptionJa, 1200);
	const descriptionKo = requiredText(payload.descriptionKo, 1200);
	if (!headingJa || !headingKo || !descriptionJa || !descriptionKo) return null;
	if (!Array.isArray(payload.sections) || payload.sections.length > 20) return null;

	const sectionKeys = new Set<string>();
	const sections = [] as Array<{
		sectionKey: string;
		titleJa: string;
		titleKo: string;
		descriptionJa: string;
		descriptionKo: string;
		selectedSkillIds: number[];
		isVisible: boolean;
	}>;

	for (const raw of payload.sections as SkillSheetSectionInput[]) {
		if (!raw || typeof raw !== 'object') return null;
		const sectionKey = typeof raw.sectionKey === 'string' ? raw.sectionKey.trim().toLowerCase() : '';
		if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(sectionKey) || sectionKeys.has(sectionKey)) return null;
		const titleJa = requiredText(raw.titleJa, 120);
		const titleKo = requiredText(raw.titleKo, 120);
		const descriptionJa = optionalText(raw.descriptionJa, 1000);
		const descriptionKo = optionalText(raw.descriptionKo, 1000);
		const selectedSkillIds = parseSkillIds(raw.selectedSkillIds);
		if (!titleJa || !titleKo || descriptionJa === null || descriptionKo === null || selectedSkillIds === null) return null;
		sectionKeys.add(sectionKey);
		sections.push({
			sectionKey,
			titleJa,
			titleKo,
			descriptionJa,
			descriptionKo,
			selectedSkillIds,
			isVisible: raw.isVisible !== false,
		});
	}

	return { headingJa, headingKo, descriptionJa, descriptionKo, sections };
}

function catalogItem(row: Record<string, unknown>) {
	return {
		id: Number(row.id),
		key: String(row.skill_key ?? ''),
		name: String(row.name ?? ''),
		category: String(row.category ?? ''),
		type: String(row.skill_type ?? ''),
		usageArea: String(row.usage_area ?? ''),
		descriptionJa: String(row.description_ja ?? ''),
		descriptionKo: String(row.description_ko ?? ''),
		aliases: String(row.aliases ?? ''),
	};
}

export async function handleGetAdminSkillSheetSummary(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [summary, sections, links, catalog] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT heading_ja, heading_ko, description_ja, description_ko, updated_at
				FROM skill_sheet_summary
				WHERE id = 1
			`).first<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT id, section_key, title_ja, title_ko, description_ja, description_ko, display_order, is_visible
				FROM skill_sheet_summary_sections
				ORDER BY display_order ASC, id ASC
			`).all<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT ss.section_id, ss.skill_id, c.name, ss.display_order
				FROM skill_sheet_section_skills AS ss
				INNER JOIN it_skill_catalog AS c ON c.id = ss.skill_id AND c.is_active = 1
				ORDER BY ss.section_id ASC, ss.display_order ASC, ss.skill_id ASC
			`).all<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT id, skill_key, name, category, skill_type, usage_area,
					description_ja, description_ko, aliases
				FROM it_skill_catalog
				WHERE is_active = 1
				ORDER BY display_order ASC, name COLLATE NOCASE ASC
			`).all<Record<string, unknown>>(),
		]);
		if (!summary) return json({ ok: false, error: 'SKILL_SHEET_SUMMARY_NOT_INITIALIZED' }, 500);

		const selectedBySection = new Map<number, Array<{ id: number; name: string }>>();
		for (const link of links.results) {
			const sectionId = Number(link.section_id);
			if (!selectedBySection.has(sectionId)) selectedBySection.set(sectionId, []);
			selectedBySection.get(sectionId)?.push({ id: Number(link.skill_id), name: String(link.name ?? '') });
		}

		return json({
			ok: true,
			summary: {
				headingJa: summary.heading_ja,
				headingKo: summary.heading_ko,
				descriptionJa: summary.description_ja,
				descriptionKo: summary.description_ko,
				updatedAt: summary.updated_at,
				sections: sections.results.map((section) => {
					const selected = selectedBySection.get(Number(section.id)) ?? [];
					return {
						sectionKey: section.section_key,
						titleJa: section.title_ja,
						titleKo: section.title_ko,
						descriptionJa: section.description_ja,
						descriptionKo: section.description_ko,
						selectedSkillIds: selected.map((item) => item.id),
						skills: selected.map((item) => item.name),
						isVisible: Number(section.is_visible) === 1,
					};
				}),
			},
			catalog: catalog.results.map(catalogItem),
		});
	} catch (error) {
		console.error('Failed to load skill sheet summary', error);
		return json({ ok: false, error: 'SKILL_SHEET_SUMMARY_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateAdminSkillSheetSummary(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: SkillSheetPayload;
	try {
		payload = await request.json() as SkillSheetPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const parsed = parsePayload(payload);
	if (!parsed) return json({ ok: false, error: 'INVALID_SKILL_SHEET_SUMMARY' }, 400);

	const now = new Date().toISOString();
	try {
		const activeCatalog = await env.song_project_db.prepare(`SELECT id FROM it_skill_catalog WHERE is_active = 1`).all<{ id: number }>();
		const validSkillIds = new Set(activeCatalog.results.map((row) => Number(row.id)));
		for (const section of parsed.sections) {
			if (section.selectedSkillIds.some((id) => !validSkillIds.has(id))) {
				return json({ ok: false, error: 'SKILL_NOT_FOUND' }, 400);
			}
		}

		await env.song_project_db.prepare(`
			UPDATE skill_sheet_summary
			SET heading_ja = ?1,
				heading_ko = ?2,
				description_ja = ?3,
				description_ko = ?4,
				updated_by = ?5,
				updated_at = ?6
			WHERE id = 1
		`).bind(parsed.headingJa, parsed.headingKo, parsed.descriptionJa, parsed.descriptionKo, session.adminId, now).run();

		const keptSectionIds: number[] = [];
		for (const [index, section] of parsed.sections.entries()) {
			const existing = await env.song_project_db.prepare(`
				SELECT id FROM skill_sheet_summary_sections WHERE section_key = ?1 LIMIT 1
			`).bind(section.sectionKey).first<{ id: number }>();

			let sectionId = Number(existing?.id) || 0;
			if (sectionId) {
				await env.song_project_db.prepare(`
					UPDATE skill_sheet_summary_sections
					SET title_ja = ?1, title_ko = ?2, description_ja = ?3, description_ko = ?4,
						display_order = ?5, is_visible = ?6, updated_at = ?7
					WHERE id = ?8
				`).bind(
					section.titleJa, section.titleKo, section.descriptionJa, section.descriptionKo,
					(index + 1) * 10, section.isVisible ? 1 : 0, now, sectionId,
				).run();
			} else {
				const inserted = await env.song_project_db.prepare(`
					INSERT INTO skill_sheet_summary_sections (
						section_key, title_ja, title_ko, description_ja, description_ko,
						skills_json, display_order, is_visible, created_at, updated_at
					) VALUES (?1, ?2, ?3, ?4, ?5, '[]', ?6, ?7, ?8, ?8)
					RETURNING id
				`).bind(
					section.sectionKey, section.titleJa, section.titleKo, section.descriptionJa,
					section.descriptionKo, (index + 1) * 10, section.isVisible ? 1 : 0, now,
				).first<{ id: number }>();
				sectionId = Number(inserted?.id) || 0;
				if (!sectionId) throw new Error('SECTION_INSERT_FAILED');
			}
			keptSectionIds.push(sectionId);

			const statements = [
				env.song_project_db.prepare(`DELETE FROM skill_sheet_section_skills WHERE section_id = ?1`).bind(sectionId),
			];
			section.selectedSkillIds.forEach((skillId, skillIndex) => {
				statements.push(env.song_project_db.prepare(`
					INSERT INTO skill_sheet_section_skills (section_id, skill_id, display_order, created_at)
					VALUES (?1, ?2, ?3, ?4)
				`).bind(sectionId, skillId, (skillIndex + 1) * 10, now));
			});
			await env.song_project_db.batch(statements);
		}

		const existingSections = await env.song_project_db.prepare(`SELECT id FROM skill_sheet_summary_sections`).all<{ id: number }>();
		const removeIds = existingSections.results.map((row) => Number(row.id)).filter((id) => !keptSectionIds.includes(id));
		if (removeIds.length) {
			await env.song_project_db.batch(removeIds.map((id) => env.song_project_db.prepare(`DELETE FROM skill_sheet_summary_sections WHERE id = ?1`).bind(id)));
		}

		return json({ ok: true, updatedAt: now });
	} catch (error) {
		console.error('Failed to update skill sheet summary', error);
		return json({ ok: false, error: 'SKILL_SHEET_SUMMARY_UPDATE_FAILED' }, 500);
	}
}
