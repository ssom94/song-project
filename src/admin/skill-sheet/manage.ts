import { getAuthenticatedAdminSession } from '../../auth/session';

type SkillSheetSectionInput = {
	sectionKey?: unknown;
	titleJa?: unknown;
	titleKo?: unknown;
	descriptionJa?: unknown;
	descriptionKo?: unknown;
	skills?: unknown;
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

function parseSkills(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length > 60) return null;
	const result: string[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item !== 'string') return null;
		const skill = item.trim();
		if (!skill) continue;
		if (skill.length > 80) return null;
		const key = skill.toLocaleLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(skill);
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
		skills: string[];
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
		const skills = parseSkills(raw.skills);
		if (!titleJa || !titleKo || descriptionJa === null || descriptionKo === null || !skills) return null;
		sectionKeys.add(sectionKey);
		sections.push({
			sectionKey,
			titleJa,
			titleKo,
			descriptionJa,
			descriptionKo,
			skills,
			isVisible: raw.isVisible !== false,
		});
	}

	return { headingJa, headingKo, descriptionJa, descriptionKo, sections };
}

export async function handleGetAdminSkillSheetSummary(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [summary, sections] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT heading_ja, heading_ko, description_ja, description_ko, updated_at
				FROM skill_sheet_summary
				WHERE id = 1
			`).first(),
			env.song_project_db.prepare(`
				SELECT section_key, title_ja, title_ko, description_ja, description_ko, skills_json, display_order, is_visible
				FROM skill_sheet_summary_sections
				ORDER BY display_order ASC, id ASC
			`).all(),
		]);
		if (!summary) return json({ ok: false, error: 'SKILL_SHEET_SUMMARY_NOT_INITIALIZED' }, 500);

		return json({
			ok: true,
			summary: {
				headingJa: summary.heading_ja,
				headingKo: summary.heading_ko,
				descriptionJa: summary.description_ja,
				descriptionKo: summary.description_ko,
				updatedAt: summary.updated_at,
				sections: sections.results.map((section: Record<string, unknown>) => {
					let skills: unknown = [];
					try { skills = JSON.parse(String(section.skills_json ?? '[]')); } catch { skills = []; }
					return {
						sectionKey: section.section_key,
						titleJa: section.title_ja,
						titleKo: section.title_ko,
						descriptionJa: section.description_ja,
						descriptionKo: section.description_ko,
						skills: Array.isArray(skills) ? skills : [],
						isVisible: Number(section.is_visible) === 1,
					};
				}),
			},
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
		const statements = [
			env.song_project_db.prepare(`
				UPDATE skill_sheet_summary
				SET heading_ja = ?1,
					heading_ko = ?2,
					description_ja = ?3,
					description_ko = ?4,
					updated_by = ?5,
					updated_at = ?6
				WHERE id = 1
			`).bind(parsed.headingJa, parsed.headingKo, parsed.descriptionJa, parsed.descriptionKo, session.adminId, now),
			env.song_project_db.prepare('DELETE FROM skill_sheet_summary_sections'),
		];

		parsed.sections.forEach((section, index) => {
			statements.push(env.song_project_db.prepare(`
				INSERT INTO skill_sheet_summary_sections (
					section_key, title_ja, title_ko, description_ja, description_ko,
					skills_json, display_order, is_visible, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
			`).bind(
				section.sectionKey,
				section.titleJa,
				section.titleKo,
				section.descriptionJa,
				section.descriptionKo,
				JSON.stringify(section.skills),
				(index + 1) * 10,
				section.isVisible ? 1 : 0,
				now,
			));
		});
		await env.song_project_db.batch(statements);
		return json({ ok: true, updatedAt: now });
	} catch (error) {
		console.error('Failed to update skill sheet summary', error);
		return json({ ok: false, error: 'SKILL_SHEET_SUMMARY_UPDATE_FAILED' }, 500);
	}
}
