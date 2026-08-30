type Language = 'ja' | 'ko';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function languageFromRequest(request: Request): Language {
	const value = new URL(request.url).searchParams.get('lang');
	return value === 'ko' ? 'ko' : 'ja';
}

export async function handleGetPublicSkillSheet(request: Request, env: Env): Promise<Response> {
	const language = languageFromRequest(request);
	try {
		const [summary, sections, links, document] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT heading_ja, heading_ko, description_ja, description_ko, updated_at
				FROM skill_sheet_summary
				WHERE id = 1
			`).first<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT id, section_key, title_ja, title_ko, description_ja, description_ko
				FROM skill_sheet_summary_sections
				WHERE is_visible = 1
				ORDER BY display_order ASC, id ASC
			`).all<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT ss.section_id, c.id AS skill_id, c.name
				FROM skill_sheet_section_skills AS ss
				INNER JOIN it_skill_catalog AS c ON c.id = ss.skill_id AND c.is_active = 1
				ORDER BY ss.section_id ASC, ss.display_order ASC, ss.skill_id ASC
			`).all<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT id, current_version_ja_id, current_version_ko_id
				FROM protected_documents
				WHERE document_type = 'skill_sheet' AND is_active = 1
				LIMIT 1
			`).first<Record<string, unknown>>(),
		]);

		if (!summary) return json({ ok: false, error: 'SKILL_SHEET_NOT_INITIALIZED' }, 500);

		const skillsBySection = new Map<number, string[]>();
		for (const link of links.results) {
			const sectionId = Number(link.section_id);
			if (!skillsBySection.has(sectionId)) skillsBySection.set(sectionId, []);
			skillsBySection.get(sectionId)?.push(String(link.name ?? ''));
		}

		const currentVersionId = language === 'ko'
			? Number(document?.current_version_ko_id ?? 0)
			: Number(document?.current_version_ja_id ?? 0);

		let currentVersion: Record<string, unknown> | null = null;
		if (currentVersionId > 0) {
			currentVersion = await env.song_project_db.prepare(`
				SELECT id, version_no, original_file_name, preview_page_count, created_at
				FROM protected_document_versions
				WHERE id = ?1 AND conversion_status = 'ready'
				LIMIT 1
			`).bind(currentVersionId).first<Record<string, unknown>>();
		}

		return json({
			ok: true,
			language,
			summary: {
				heading: language === 'ko' ? summary.heading_ko : summary.heading_ja,
				description: language === 'ko' ? summary.description_ko : summary.description_ja,
				updatedAt: summary.updated_at,
				sections: sections.results.map((section) => ({
					key: section.section_key,
					title: language === 'ko' ? section.title_ko : section.title_ja,
					description: language === 'ko' ? section.description_ko : section.description_ja,
					skills: skillsBySection.get(Number(section.id)) ?? [],
				})),
			},
			excel: currentVersion ? {
				registered: true,
				versionId: currentVersion.id,
				versionNo: currentVersion.version_no,
				fileName: currentVersion.original_file_name,
				sheetCount: currentVersion.preview_page_count,
				registeredAt: currentVersion.created_at,
			} : { registered: false },
		});
	} catch (error) {
		console.error('Failed to load public skill sheet', error);
		return json({ ok: false, error: 'PUBLIC_SKILL_SHEET_FAILED' }, 500);
	}
}
