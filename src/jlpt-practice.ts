import { handleGetPublicJapaneseJlptPractice as handleGetPublicJapaneseJlptPracticeLegacy } from './jlpt-practice-legacy';
import { resolveLearningAdmin } from './japanese-learning';

export * from './jlpt-practice-legacy';

interface ScheduledPreviewWordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	item_kind: 'review' | 'new';
	sort_order: number | null;
}

async function loadScheduledPreviewWords(db: D1Database, adminId: number, studyDate: string) {
	const result = await db.prepare(`
		SELECT
			w.id,
			w.word,
			w.reading,
			w.meaning_ko,
			w.meaning_ja,
			dw.item_kind,
			c.sort_order
		FROM japanese_jlpt_study_plans AS p
		JOIN japanese_jlpt_daily_sessions AS ds
			ON ds.plan_id = p.id AND ds.study_date = ?2
		JOIN japanese_jlpt_daily_words AS dw ON dw.session_id = ds.id
		JOIN japanese_words AS w ON w.id = dw.word_id AND w.deleted_at IS NULL
		LEFT JOIN japanese_jlpt_curriculum_words AS c
			ON c.plan_id = p.id AND c.word_id = w.id
		WHERE p.admin_id = ?1
			AND p.plan_code = 'N1_2027_JUL'
			AND p.is_active = 1
		ORDER BY
			CASE dw.item_kind WHEN 'review' THEN 0 ELSE 1 END,
			COALESCE(c.sort_order, 2147483647),
			w.id ASC
		LIMIT 40
	`).bind(adminId, studyDate).all<ScheduledPreviewWordRow>();
	return result.results.map((row, index) => ({
		id: row.id,
		word: row.word,
		reading: row.reading,
		meaningKo: row.meaning_ko,
		meaningJa: row.meaning_ja,
		itemKind: row.item_kind,
		sortOrder: row.sort_order ?? index + 1,
	}));
}

/**
 * Public selected-date practice wrapper.
 *
 * The legacy handler still owns question/grammar/reading serialization and grading keys.
 * For vocabulary, a prepared date reflects the actual daily schedule, including review
 * words. The lookup is bounded by the active plan + indexed study_date/session keys and
 * avoids the old introduced_on-only blind spot without calendar-wide per-date queries.
 */
export async function handleGetPublicJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	const response = await handleGetPublicJapaneseJlptPracticeLegacy(request, env);
	if (!response.ok) return response;

	const data = await response.json().catch(() => null) as Record<string, any> | null;
	if (!data?.ok || typeof data.studyDate !== 'string') {
		return Response.json(data ?? { ok: false, error: 'JLPT_PRACTICE_LOAD_FAILED' }, {
			status: response.status,
			headers: { 'Cache-Control': 'no-store' },
		});
	}

	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (admin.adminId) {
			const words = await loadScheduledPreviewWords(env.song_project_db, admin.adminId, data.studyDate);
			if (words.length) data.words = words;
		}
	} catch (error) {
		console.error('Failed to replace JLPT preview words with scheduled words', error);
		// Keep the legacy curriculum preview rather than failing the whole selected-date view.
	}

	return Response.json(data, {
		status: response.status,
		headers: { 'Cache-Control': 'no-store' },
	});
}
