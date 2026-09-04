import { resolveLearningAdmin } from './japanese-learning';
import { addDays, japanDateString, validDateText } from './jlpt-study';
import { loadJlptStudyPlanReadOnly } from './jlpt-study-read';

export * from './jlpt-practice-legacy';

type ContentType = 'vocab_question' | 'grammar' | 'grammar_question' | 'reading';
interface ContentRow {
	id: number;
	content_type: ContentType;
	sequence_no: number;
	title: string | null;
	payload_json: string;
	completed_at: string | null;
}
interface ScheduledPreviewWordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	item_kind: 'review' | 'new';
	sort_order: number | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function cleanText(value: unknown): string {
	return String(value ?? '').normalize('NFKC').trim();
}
function cleanOptions(value: unknown): string[] {
	return Array.isArray(value) ? value.map(cleanText).filter(Boolean).slice(0, 12) : [];
}
function safePayload(value: string): Record<string, any> {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch { return {}; }
}
function validatePracticeDate(value: unknown, today: string): string | null {
	const date = validDateText(value) ?? today;
	return date >= addDays(today, -365) && date <= addDays(today, 365) ? date : null;
}

async function loadScheduledPreviewWords(db: D1Database, adminId: number, studyDate: string) {
	const result = await db.prepare(`
		SELECT w.id,w.word,w.reading,w.meaning_ko,w.meaning_ja,dw.item_kind,c.sort_order
		FROM japanese_jlpt_study_plans AS p
		JOIN japanese_jlpt_daily_sessions AS ds ON ds.plan_id=p.id AND ds.study_date=?2
		JOIN japanese_jlpt_daily_words AS dw ON dw.session_id=ds.id
		JOIN japanese_words AS w ON w.id=dw.word_id AND w.deleted_at IS NULL
		LEFT JOIN japanese_jlpt_curriculum_words AS c ON c.plan_id=p.id AND c.word_id=w.id
		WHERE p.admin_id=?1 AND p.plan_code='N1_2027_JUL' AND p.is_active=1
		ORDER BY CASE dw.item_kind WHEN 'review' THEN 0 ELSE 1 END,COALESCE(c.sort_order,2147483647),w.id ASC
		LIMIT 40
	`).bind(adminId, studyDate).all<ScheduledPreviewWordRow>();
	return result.results.map((row, index) => ({
		id: row.id, word: row.word, reading: row.reading, meaningKo: row.meaning_ko, meaningJa: row.meaning_ja,
		itemKind: row.item_kind, sortOrder: row.sort_order ?? index + 1,
	}));
}

async function loadCurriculumPreviewWords(db: D1Database, planId: number, studyDate: string) {
	const result = await db.prepare(`
		SELECT w.id,w.word,w.reading,w.meaning_ko,w.meaning_ja,c.sort_order
		FROM japanese_jlpt_curriculum_words AS c
		JOIN japanese_words AS w ON w.id=c.word_id AND w.deleted_at IS NULL
		WHERE c.plan_id=?1 AND c.introduced_on=?2
		ORDER BY c.sort_order ASC LIMIT 40
	`).bind(planId, studyDate).all<any>();
	return result.results.map((row: any) => ({ id: row.id, word: row.word, reading: row.reading, meaningKo: row.meaning_ko, meaningJa: row.meaning_ja, itemKind: 'new', sortOrder: row.sort_order }));
}

async function loadContents(db: D1Database, planId: number, studyDate: string): Promise<ContentRow[]> {
	const result = await db.prepare(`
		SELECT id,content_type,sequence_no,title,payload_json,completed_at
		FROM japanese_jlpt_daily_contents
		WHERE plan_id=?1 AND study_date=?2
		ORDER BY CASE content_type WHEN 'vocab_question' THEN 0 WHEN 'grammar' THEN 1 WHEN 'grammar_question' THEN 2 ELSE 3 END,sequence_no ASC
	`).bind(planId, studyDate).all<ContentRow>();
	return result.results;
}

function serializeContents(rows: ContentRow[]) {
	const questions: any[] = [];
	const grammar: any[] = [];
	const readings: any[] = [];
	for (const row of rows) {
		const payload = safePayload(row.payload_json);
		if (row.content_type === 'vocab_question' || row.content_type === 'grammar_question') {
			const prompt = cleanText(payload.prompt ?? payload.question);
			const options = cleanOptions(payload.options);
			if (prompt && options.length) questions.push({ key: `content:${row.id}`, type: row.content_type === 'vocab_question' ? 'vocab' : 'grammar', title: row.title, prompt, options });
			continue;
		}
		if (row.content_type === 'grammar') {
			grammar.push({ id: row.id, title: row.title, payload, completed: Boolean(row.completed_at) });
			continue;
		}
		if (row.content_type === 'reading') {
			const readingQuestions = (Array.isArray(payload.questions) ? payload.questions : []).map((raw: any, index: number) => {
				const prompt = cleanText(raw?.prompt ?? raw?.question);
				const options = cleanOptions(raw?.options);
				return prompt && options.length ? { key: `content:${row.id}:reading:${index}`, type: 'reading', title: row.title, prompt, options } : null;
			}).filter(Boolean);
			readings.push({ id: row.id, title: row.title, passage: cleanText(payload.passage ?? payload.text), questions: readingQuestions, completed: Boolean(row.completed_at) });
		}
	}
	return { questions, grammar, readings };
}

/** Read-only selected-date practice endpoint. No schema creation, INSERT, UPDATE, or UPSERT. */
export async function handleGetPublicJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);
		const plan = await loadJlptStudyPlanReadOnly(env.song_project_db, admin.adminId);
		if (!plan) return json({ ok: false, error: 'JLPT_STUDY_PLAN_NOT_FOUND' }, 404);

		const today = japanDateString();
		const studyDate = validatePracticeDate(new URL(request.url).searchParams.get('date'), today);
		if (!studyDate) return json({ ok: false, error: 'DATE_OUT_OF_RANGE' }, 400);
		const [scheduledWords, rows] = await Promise.all([
			loadScheduledPreviewWords(env.song_project_db, admin.adminId, studyDate),
			loadContents(env.song_project_db, plan.id, studyDate),
		]);
		const words = scheduledWords.length ? scheduledWords : await loadCurriculumPreviewWords(env.song_project_db, plan.id, studyDate);
		return json({
			ok: true,
			viewer: { authenticated: admin.fromSession },
			plan: { studyStartDate: plan.study_start_date, level: plan.jlpt_level_code },
			today,
			studyDate,
			isFuture: studyDate > today,
			questionsEnabled: studyDate <= today,
			previewDates: Array.from({ length: 31 }, (_, offset) => addDays(today, offset)),
			words,
			preview: { grammar: [], reading: null },
			...serializeContents(rows),
		});
	} catch (error) {
		console.error('Failed to load public JLPT practice', error);
		return json({ ok: false, error: 'JLPT_PRACTICE_LOAD_FAILED' }, 500);
	}
}
