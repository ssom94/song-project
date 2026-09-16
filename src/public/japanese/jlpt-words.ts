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
	parts_blob: string | null;
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
		const requestedGroup = (url.searchParams.get('group') ?? '').trim();
		const group = ['noun', 'verb', 'adjective-adverb', 'unclassified'].includes(requestedGroup) ? requestedGroup : '';
		const verbTypes: Record<string, string> = { general: '__GENERAL__', all: '', godan: '五段動詞', ichidan: '一段動詞', suru: 'サ変動詞', kuru: 'カ変動詞' };
		const requestedVerbType = (url.searchParams.get('verbType') ?? '').trim();
		const verbType = group === 'verb' && Object.hasOwn(verbTypes, requestedVerbType)
			? requestedVerbType
			: group === 'verb' ? 'general' : '';
		const verbPartName = verbType ? verbTypes[verbType] : '';
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
				COALESCE(s.learning_state, 'unlearned') AS learning_state,
				(SELECT GROUP_CONCAT(p.name_ja, CHAR(31))
				 FROM japanese_word_parts_of_speech wp
				 JOIN parts_of_speech p ON p.id=wp.part_of_speech_id AND p.deleted_at IS NULL
				 WHERE wp.word_id=w.id ORDER BY wp.is_primary DESC,p.display_order,p.id) AS parts_blob
			FROM japanese_jlpt_curriculum_words AS c
			JOIN japanese_words AS w ON w.id = c.word_id AND w.deleted_at IS NULL
			LEFT JOIN japanese_admin_word_learning_stats AS s
				ON s.word_id = c.word_id AND s.admin_id = ?2
			WHERE c.plan_id = ?1 AND (
				?3 = '' OR
				(?3 = 'unclassified' AND NOT EXISTS (SELECT 1 FROM japanese_word_parts_of_speech up WHERE up.word_id=w.id)) OR
				EXISTS (
					SELECT 1 FROM japanese_word_parts_of_speech fp
					JOIN parts_of_speech child ON child.id=fp.part_of_speech_id AND child.deleted_at IS NULL
					LEFT JOIN parts_of_speech parent ON parent.id=child.parent_id AND parent.deleted_at IS NULL
					WHERE fp.word_id=w.id AND (
						(?3='noun' AND COALESCE(parent.name_ja,child.name_ja)='名詞') OR
						(?3='verb' AND COALESCE(parent.name_ja,child.name_ja)='動詞') OR
						(?3='adjective-adverb' AND COALESCE(parent.name_ja,child.name_ja) IN ('形容詞','副詞'))
					)
				)
			) AND (?4 = '' OR (?4 = '__GENERAL__' AND NOT EXISTS (
				SELECT 1 FROM japanese_word_parts_of_speech gp
				JOIN parts_of_speech gpart ON gpart.id=gp.part_of_speech_id AND gpart.deleted_at IS NULL
				WHERE gp.word_id=w.id AND gpart.name_ja='サ変動詞'
			)) OR (?4 NOT IN ('', '__GENERAL__') AND EXISTS (
				SELECT 1 FROM japanese_word_parts_of_speech vp
				JOIN parts_of_speech vpart ON vpart.id=vp.part_of_speech_id AND vpart.deleted_at IS NULL
				WHERE vp.word_id=w.id AND vpart.name_ja=?4
			))
			ORDER BY CASE WHEN c.introduced_on IS NULL THEN 1 ELSE 0 END,
				c.introduced_on ASC, c.sort_order ASC, c.word_id ASC
			LIMIT ?5 OFFSET ?6
		`).bind(plan.id, admin.adminId, group, verbPartName, pageSize, offset).all<WordRow>();

		let total: number | null = null;
		if (includeTotal) {
			const row = await env.song_project_db.prepare(`
				SELECT COUNT(*) AS total
				FROM japanese_jlpt_curriculum_words AS c
				JOIN japanese_words AS w ON w.id = c.word_id AND w.deleted_at IS NULL
				WHERE c.plan_id = ?1 AND (
					?2 = '' OR
					(?2 = 'unclassified' AND NOT EXISTS (SELECT 1 FROM japanese_word_parts_of_speech up WHERE up.word_id=w.id)) OR
					EXISTS (
						SELECT 1 FROM japanese_word_parts_of_speech fp
						JOIN parts_of_speech child ON child.id=fp.part_of_speech_id AND child.deleted_at IS NULL
						LEFT JOIN parts_of_speech parent ON parent.id=child.parent_id AND parent.deleted_at IS NULL
						WHERE fp.word_id=w.id AND (
							(?2='noun' AND COALESCE(parent.name_ja,child.name_ja)='名詞') OR
							(?2='verb' AND COALESCE(parent.name_ja,child.name_ja)='動詞') OR
							(?2='adjective-adverb' AND COALESCE(parent.name_ja,child.name_ja) IN ('形容詞','副詞'))
						)
					)
				) AND (?3 = '' OR (?3 = '__GENERAL__' AND NOT EXISTS (
					SELECT 1 FROM japanese_word_parts_of_speech gp
					JOIN parts_of_speech gpart ON gpart.id=gp.part_of_speech_id AND gpart.deleted_at IS NULL
					WHERE gp.word_id=w.id AND gpart.name_ja='サ変動詞'
				)) OR (?3 NOT IN ('', '__GENERAL__') AND EXISTS (
					SELECT 1 FROM japanese_word_parts_of_speech vp
					JOIN parts_of_speech vpart ON vpart.id=vp.part_of_speech_id AND vpart.deleted_at IS NULL
					WHERE vp.word_id=w.id AND vpart.name_ja=?3
				))
			`).bind(plan.id, group, verbPartName).first<TotalRow>();
			total = Number(row?.total ?? 0);
		}

		return json({
			ok: true,
			plan: { level: plan.jlpt_level_code },
			page,
			pageSize,
			group: group || null,
			verbType: verbType || null,
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
				parts: row.parts_blob ? row.parts_blob.split(String.fromCharCode(31)).filter(Boolean) : [],
			})),
		});
	} catch (error) {
		console.error('Failed to list public JLPT curriculum words', error);
		return json({ ok: false, error: 'JLPT_WORD_LIST_FAILED' }, 500);
	}
}
