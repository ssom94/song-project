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
		const [summary, sections, document] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT heading_ja, heading_ko, description_ja, description_ko, updated_at
				FROM skill_sheet_summary
				WHERE id = 1
			`).first<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT section_key, title_ja, title_ko, description_ja, description_ko, skills_json
				FROM skill_sheet_summary_sections
				WHERE is_visible = 1
				ORDER BY display_order ASC, id ASC
			`).all<Record<string, unknown>>(),
			env.song_project_db.prepare(`
				SELECT id, current_version_ja_id, current_version_ko_id
				FROM protected_documents
				WHERE document_type = 'skill_sheet' AND is_active = 1
				LIMIT 1
			`).first<Record<string, unknown>>(),
		]);

		if (!summary) return json({ ok: false, error: 'SKILL_SHEET_NOT_INITIALIZED' }, 500);
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
				sections: sections.results.map((section) => {
					let skills: unknown = [];
					try { skills = JSON.parse(String(section.skills_json ?? '[]')); } catch { skills = []; }
					return {
						key: section.section_key,
						title: language === 'ko' ? section.title_ko : section.title_ja,
						description: language === 'ko' ? section.description_ko : section.description_ja,
						skills: Array.isArray(skills) ? skills : [],
					};
				}),
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
