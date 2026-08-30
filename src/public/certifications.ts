type Language = 'ja' | 'ko';

type CertificationRow = Record<string, unknown>;

type ScheduleRow = Record<string, unknown>;
type TopicRow = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { 'Cache-Control': 'public, max-age=300' },
	});
}

function languageFromRequest(request: Request): Language {
	return new URL(request.url).searchParams.get('lang') === 'ko' ? 'ko' : 'ja';
}

function localized(row: CertificationRow | ScheduleRow | TopicRow, field: string, language: Language): string {
	return String(row[`${field}_${language}`] ?? '');
}

function certificationPayload(row: CertificationRow, language: Language) {
	return {
		id: Number(row.id),
		slug: String(row.slug ?? ''),
		code: String(row.code ?? ''),
		category: String(row.category ?? ''),
		title: localized(row, 'title', language),
		subtitle: localized(row, 'subtitle', language),
		provider: localized(row, 'provider', language),
		summary: localized(row, 'summary', language),
		examMode: localized(row, 'exam_mode', language),
		fee: localized(row, 'fee', language),
		duration: localized(row, 'duration', language),
		questions: localized(row, 'questions', language),
		pass: localized(row, 'pass', language),
		officialUrl: String(row.official_url ?? ''),
		guideUrl: String(row.guide_url ?? ''),
		accentKey: String(row.accent_key ?? 'blue'),
		sourceCheckedAt: String(row.source_checked_at ?? ''),
		displayOrder: Number(row.display_order ?? 100),
	};
}

function schedulePayload(row: ScheduleRow, language: Language) {
	return {
		id: Number(row.id),
		sequenceNo: Number(row.sequence_no ?? 0),
		label: localized(row, 'label', language),
		application: localized(row, 'application', language),
		exam: localized(row, 'exam', language),
		result: localized(row, 'result', language),
		note: localized(row, 'note', language),
		dateStart: row.date_start ? String(row.date_start) : null,
		dateEnd: row.date_end ? String(row.date_end) : null,
		announced: Number(row.is_announced ?? 0) === 1,
	};
}

function topicPayload(row: TopicRow, language: Language) {
	return {
		id: Number(row.id),
		type: String(row.topic_type ?? ''),
		title: localized(row, 'title', language),
		description: localized(row, 'description', language),
		meta: localized(row, 'meta', language),
		weightPercent: row.weight_percent === null || row.weight_percent === undefined
			? null
			: Number(row.weight_percent),
		displayOrder: Number(row.display_order ?? 100),
	};
}

export async function handleGetPublicCertifications(request: Request, env: Env): Promise<Response> {
	const language = languageFromRequest(request);
	const slug = new URL(request.url).searchParams.get('slug')?.trim() ?? '';

	try {
		if (slug) {
			const certification = await env.song_project_db.prepare(`
				SELECT *
				FROM certifications
				WHERE slug = ?1 AND is_active = 1
				LIMIT 1
			`).bind(slug).first<CertificationRow>();
			if (!certification) return json({ ok: false, error: 'CERTIFICATION_NOT_FOUND' }, 404);

			const [schedules, topics] = await Promise.all([
				env.song_project_db.prepare(`
					SELECT *
					FROM certification_schedules
					WHERE certification_id = ?1
					ORDER BY sequence_no ASC, id ASC
				`).bind(Number(certification.id)).all<ScheduleRow>(),
				env.song_project_db.prepare(`
					SELECT *
					FROM certification_topics
					WHERE certification_id = ?1
					ORDER BY CASE topic_type
						WHEN 'format' THEN 1
						WHEN 'domain' THEN 2
						WHEN 'concept' THEN 3
						WHEN 'study' THEN 4
						ELSE 9 END,
						display_order ASC,
						id ASC
				`).bind(Number(certification.id)).all<TopicRow>(),
			]);

			return json({
				ok: true,
				language,
				certification: certificationPayload(certification, language),
				schedules: schedules.results.map((row) => schedulePayload(row, language)),
				topics: topics.results.map((row) => topicPayload(row, language)),
			});
		}

		const [certifications, schedules] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT *
				FROM certifications
				WHERE is_active = 1
				ORDER BY display_order ASC, id ASC
			`).all<CertificationRow>(),
			env.song_project_db.prepare(`
				SELECT s.*
				FROM certification_schedules AS s
				INNER JOIN certifications AS c ON c.id = s.certification_id
				WHERE c.is_active = 1
				ORDER BY c.display_order ASC, s.sequence_no ASC, s.id ASC
			`).all<ScheduleRow>(),
		]);

		const schedulesByCertification = new Map<number, ReturnType<typeof schedulePayload>[]>();
		for (const row of schedules.results) {
			const certificationId = Number(row.certification_id);
			const list = schedulesByCertification.get(certificationId) ?? [];
			list.push(schedulePayload(row, language));
			schedulesByCertification.set(certificationId, list);
		}

		return json({
			ok: true,
			language,
			certifications: certifications.results.map((row) => ({
				...certificationPayload(row, language),
				schedules: schedulesByCertification.get(Number(row.id)) ?? [],
			})),
		});
	} catch (error) {
		console.error('Failed to load certification catalog', error);
		return json({ ok: false, error: 'CERTIFICATION_CATALOG_FAILED' }, 500);
	}
}
