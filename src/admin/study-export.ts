import { ensureDefaultApStudyPlan } from '../ap-study';
import { getAuthenticatedAdminSession } from '../auth/session';
import { japanDateString } from '../jlpt-study';
import { createStudyXlsx, type StudyExportRow } from '../study-xlsx';

type ExportSource = 'all' | 'jlpt' | 'ap';
type ExportFilter = 'all' | 'wrong' | 'uncertain' | 'unlearned' | 'mastered' | 'due';

interface WordRow {
	word: string;
	reading: string | null;
	meaning_ko: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function sourceParam(value: string | null): ExportSource {
	return value === 'jlpt' || value === 'ap' ? value : 'all';
}

function filterParam(value: string | null): ExportFilter {
	return value === 'wrong' || value === 'uncertain' || value === 'unlearned' || value === 'mastered' || value === 'due'
		? value
		: 'all';
}

function japaneseFilterSql(filter: ExportFilter): string {
	if (filter === 'wrong') return 'AND COALESCE(s.wrong_count, 0) > 0';
	if (filter === 'uncertain') return "AND s.learning_state = 'uncertain'";
	if (filter === 'unlearned') return "AND COALESCE(s.learning_state, 'unlearned') = 'unlearned'";
	if (filter === 'mastered') return "AND s.learning_state = 'mastered'";
	if (filter === 'due') return 'AND s.next_review_on IS NOT NULL AND s.next_review_on <= ?2';
	return '';
}

function apFilterSql(filter: ExportFilter): string {
	if (filter === 'wrong') return 'AND v.wrong_count > 0';
	if (filter === 'uncertain') return "AND v.learning_state = 'uncertain'";
	if (filter === 'unlearned') return "AND v.learning_state = 'unlearned'";
	if (filter === 'mastered') return "AND v.learning_state = 'mastered'";
	if (filter === 'due') return 'AND v.next_review_on IS NOT NULL AND v.next_review_on <= ?2';
	return '';
}

async function loadAllWords(db: D1Database, adminId: number, filter: ExportFilter, today: string): Promise<WordRow[]> {
	const result = await db.prepare(`
		SELECT w.word, w.reading, w.meaning_ko
		FROM japanese_words AS w
		LEFT JOIN japanese_admin_word_learning_stats AS s
			ON s.word_id = w.id AND s.admin_id = ?1
		WHERE w.deleted_at IS NULL
			${japaneseFilterSql(filter)}
		ORDER BY w.word COLLATE NOCASE ASC, w.id ASC
	`).bind(adminId, today).all<WordRow>();
	return result.results;
}

async function loadJlptWords(db: D1Database, adminId: number, filter: ExportFilter, today: string): Promise<WordRow[]> {
	const plan = await db.prepare(`
		SELECT id FROM japanese_jlpt_study_plans
		WHERE admin_id = ?1 AND is_active = 1
		ORDER BY id DESC LIMIT 1
	`).bind(adminId).first<{ id: number }>();
	if (!plan) return [];
	const result = await db.prepare(`
		SELECT w.word, w.reading, w.meaning_ko
		FROM japanese_jlpt_curriculum_words AS c
		JOIN japanese_words AS w ON w.id = c.word_id AND w.deleted_at IS NULL
		LEFT JOIN japanese_admin_word_learning_stats AS s
			ON s.word_id = w.id AND s.admin_id = ?1
		WHERE c.plan_id = ?3
			${japaneseFilterSql(filter)}
		ORDER BY c.sort_order ASC, w.id ASC
	`).bind(adminId, today, plan.id).all<WordRow>();
	return result.results;
}

async function loadApWords(db: D1Database, adminId: number, filter: ExportFilter, today: string): Promise<WordRow[]> {
	const plan = await ensureDefaultApStudyPlan(db, adminId);
	const result = await db.prepare(`
		SELECT v.term AS word, v.reading, v.meaning_ko
		FROM ap_vocabulary AS v
		WHERE v.plan_id = ?1
			${apFilterSql(filter)}
		ORDER BY CASE v.learning_state WHEN 'uncertain' THEN 0 WHEN 'unlearned' THEN 1 WHEN 'learning' THEN 2 ELSE 3 END,
			v.wrong_count DESC, v.term COLLATE NOCASE ASC
	`).bind(plan.id, today).all<WordRow>();
	return result.results;
}

function toExportRows(rows: WordRow[]): StudyExportRow[] {
	return rows.map((row) => ({
		word: row.word ?? '',
		reading: row.reading ?? '',
		meaningKo: row.meaning_ko ?? '',
	}));
}

export async function handleExportStudyXlsx(request: Request, env: Env): Promise<Response> {
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const url = new URL(request.url);
		const source = sourceParam(url.searchParams.get('source'));
		const filter = filterParam(url.searchParams.get('filter'));
		const today = japanDateString();
		const rows = source === 'jlpt'
			? await loadJlptWords(env.song_project_db, session.adminId, filter, today)
			: source === 'ap'
				? await loadApWords(env.song_project_db, session.adminId, filter, today)
				: await loadAllWords(env.song_project_db, session.adminId, filter, today);
		const workbook = createStudyXlsx(toExportRows(rows));
		const filename = `song-${source}-${filter}-${today.replaceAll('-', '')}.xlsx`;
		return new Response(workbook.buffer, {
			status: 200,
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-store',
				'X-Export-Rows': String(rows.length),
			},
		});
	} catch (error) {
		console.error('Failed to export study XLSX', error);
		return json({ ok: false, error: 'STUDY_EXPORT_FAILED' }, 500);
	}
}
