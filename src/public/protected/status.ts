type Language = 'ja' | 'ko';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleGetProtectedDocumentStatus(request: Request, env: Env): Promise<Response> {
	const language: Language = new URL(request.url).searchParams.get('lang') === 'ko' ? 'ko' : 'ja';
	try {
		const rows = await env.song_project_db.prepare(`
			SELECT document_type, current_version_ja_id, current_version_ko_id
			FROM protected_documents
			WHERE is_active = 1
				AND document_type IN ('skill_sheet', 'career_history')
		`).all<Record<string, unknown>>();
		const status: Record<string, boolean> = { skill_sheet: false, career_history: false };
		for (const row of rows.results) {
			const type = String(row.document_type ?? '');
			if (!(type in status)) continue;
			const id = language === 'ko' ? Number(row.current_version_ko_id ?? 0) : Number(row.current_version_ja_id ?? 0);
			status[type] = id > 0;
		}
		return json({
			ok: true,
			language,
			documents: {
				skillSheet: { registered: status.skill_sheet },
				careerHistory: { registered: status.career_history },
			},
		});
	} catch (error) {
		console.error('Failed to load protected document status', error);
		return json({ ok: false, error: 'PROTECTED_DOCUMENT_STATUS_FAILED' }, 500);
	}
}
