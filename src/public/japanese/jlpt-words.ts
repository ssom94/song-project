import { resolveLearningAdmin } from '../../japanese-learning';

interface PlanRow { id: number; jlpt_level_code: string; }
interface TotalRow { total: number; }
interface WordRow {
	word_id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	introduced_on: string | null;
	learning_state: 'mastered' | 'uncertain' | 'unlearned';
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function positiveInteger(value: string | null, fallback: number): number {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function handleListPublicJapaneseJlptWords(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const page = positiveInteger(url.searchParams.get('page'), 1);
		const requestedSize = positiveInteger(url.searchParams.get('pageSize'), 50);
		const pageSize = Math.min(requestedSize, 200);
		const includeTotal = url.searchParams.get('includeTotal') !== '0';
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);

		const plan = await env.song_project_db.prepare(`
			SELECT id, jlpt_level_code
			FROM japanese_jlpt_study_plans
			WHERE admin_id = ?1 AND is_active = 1
			ORDER BY id ASC LIMIT 1
		`).bind(admin.adminId).first<PlanRow>();
		if (!plan) return json({ ok: false, error: 'JLPT_STUDY_PLAN_NOT_FOUND' }, 404);

		const offset = (page - 1) * pageSize;
		const words = await env.song_project_db.prepare(`
			SELECT c.word_id, w.word, w.reading, w.meaning_ko, c.introduced_on,
				COALESCE(s.learning_state, 'unlearned') AS learning_state
			FROM japanese_jlpt_curriculum_words AS c
			JOIN japanese_words AS w ON w.id = c.word_id AND w.deleted_at IS NULL
			LEFT JOIN japanese_admin_word_learning_stats AS s
				ON s.word_id = c.word_id AND s.admin_id = ?2
			WHERE c.plan_id = ?1
			ORDER BY CASE WHEN c.introduced_on IS NULL THEN 1 ELSE 0 END,
				c.introduced_on ASC, c.sort_order ASC, c.word_id ASC
			LIMIT ?3 OFFSET ?4
		`).bind(plan.id, admin.adminId, pageSize, offset).all<WordRow>();

		let total: number | null = null;
		if (includeTotal) {
			const row = await env.song_project_db.prepare(`
				SELECT COUNT(*) AS total
				FROM japanese_jlpt_curriculum_words AS c
				JOIN japanese_words AS w ON w.id = c.word_id AND w.deleted_at IS NULL
				WHERE c.plan_id = ?1
			`).bind(plan.id).first<TotalRow>();
			total = Number(row?.total ?? 0);
		}

		return json({
			ok: true,
			plan: { level: plan.jlpt_level_code },
			page,
			pageSize,
			total,
			canEdit: admin.fromSession,
			words: words.results.map((row, index) => ({
				number: offset + index + 1,
				id: row.word_id,
				word: row.word,
				reading: row.reading ?? '',
				meaningKo: row.meaning_ko ?? '',
				introducedOn: row.introduced_on,
				learningState: row.learning_state,
			})),
		});
	} catch (error) {
		console.error('Failed to list public JLPT curriculum words', error);
		return json({ ok: false, error: 'JLPT_WORD_LIST_FAILED' }, 500);
	}
}
