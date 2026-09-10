import { resolveLearningAdmin } from '../../japanese-learning';
import { japanDateString, validDateText } from '../../jlpt-study';

interface PlanRow {
	id: number;
	jlpt_level_code: string;
	study_start_date: string;
}

interface SessionRow {
	id: number;
	study_date: string;
	status: string;
	review_target: number;
	new_word_target: number;
	review_completed: number;
	new_word_completed: number;
	vocab_question_target: number;
	grammar_target: number;
	reading_target: number;
	vocab_question_completed: number;
	grammar_completed: number;
	reading_completed: number;
	started_at: string | null;
	completed_at: string | null;
}

interface WordRow {
	word_id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	item_kind: 'review' | 'new';
	item_status: 'pending' | 'completed';
	completed_at: string | null;
	learning_state: 'mastered' | 'uncertain' | 'unlearned';
}

interface ContentRow {
	id: number;
	content_type: 'vocab_question' | 'grammar' | 'grammar_question' | 'reading';
	sequence_no: number;
	title: string | null;
	payload_json: string;
	completed_at: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function safePayload(value: string): unknown {
	try { return JSON.parse(value); } catch { return null; }
}

export async function handleGetPublicJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	try {
		const date = validDateText(new URL(request.url).searchParams.get('date'));
		if (!date) return json({ ok: false, error: 'INVALID_DATE' }, 400);

		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);

		const plan = await env.song_project_db.prepare(`
			SELECT id, jlpt_level_code, study_start_date
			FROM japanese_jlpt_study_plans
			WHERE admin_id = ?1 AND is_active = 1
			ORDER BY id ASC LIMIT 1
		`).bind(admin.adminId).first<PlanRow>();
		if (!plan) return json({ ok: false, error: 'JLPT_STUDY_PLAN_NOT_FOUND' }, 404);

		const today = japanDateString();
		if (date < plan.study_start_date || date > today) return json({ ok: false, error: 'INVALID_STUDY_DATE' }, 400);

		const session = await env.song_project_db.prepare(`
			SELECT id, study_date, status, review_target, new_word_target,
				review_completed, new_word_completed, vocab_question_target,
				grammar_target, reading_target, vocab_question_completed,
				grammar_completed, reading_completed, started_at, completed_at
			FROM japanese_jlpt_daily_sessions
			WHERE plan_id = ?1 AND study_date = ?2 LIMIT 1
		`).bind(plan.id, date).first<SessionRow>();

		if (!session) return json({ ok: true, studyDate: date, session: null, words: [], questions: [], grammar: [], readings: [] });

		const [wordResult, contentResult] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT dw.word_id, w.word, w.reading, w.meaning_ko, w.meaning_ja,
					dw.item_kind, dw.status AS item_status, dw.completed_at,
					COALESCE(s.learning_state, 'unlearned') AS learning_state
				FROM japanese_jlpt_daily_words AS dw
				JOIN japanese_words AS w ON w.id = dw.word_id AND w.deleted_at IS NULL
				LEFT JOIN japanese_admin_word_learning_stats AS s
					ON s.word_id = dw.word_id AND s.admin_id = ?2
				WHERE dw.session_id = ?1
				ORDER BY CASE dw.item_kind WHEN 'review' THEN 0 ELSE 1 END, dw.word_id ASC
			`).bind(session.id, admin.adminId).all<WordRow>(),
			env.song_project_db.prepare(`
				SELECT id, content_type, sequence_no, title, payload_json, completed_at
				FROM japanese_jlpt_daily_contents
				WHERE plan_id = ?1 AND study_date = ?2
				ORDER BY CASE content_type WHEN 'vocab_question' THEN 0 WHEN 'grammar' THEN 1 WHEN 'grammar_question' THEN 2 ELSE 3 END, sequence_no ASC
			`).bind(plan.id, date).all<ContentRow>(),
		]);

		const contents = contentResult.results.map((row) => ({
			id: row.id,
			type: row.content_type,
			sequence: row.sequence_no,
			title: row.title,
			payload: safePayload(row.payload_json),
			completed: Boolean(row.completed_at),
		}));
		const questions = contents.filter((row) => row.type === 'vocab_question' || row.type === 'grammar_question').flatMap((row) => {
			const payload = row.payload as { questions?: unknown[] } | null;
			if (Array.isArray(payload?.questions)) return payload.questions;
			return row.payload && typeof row.payload === 'object' ? [row.payload] : [];
		});
		const grammar = contents.filter((row) => row.type === 'grammar');
		const readings = contents.filter((row) => row.type === 'reading').map((row) => {
			const payload = row.payload as { title?: string; passage?: string; questions?: unknown[] } | null;
			return { id: row.id, title: payload?.title ?? row.title ?? '', passage: payload?.passage ?? '', questions: payload?.questions ?? [] };
		});

		return json({
			ok: true,
			studyDate: date,
			session,
			words: wordResult.results.map((row) => ({
				id: row.word_id,
				word: row.word,
				reading: row.reading,
				meaningKo: row.meaning_ko,
				meaningJa: row.meaning_ja,
				itemKind: row.item_kind,
				status: row.item_status,
				completedAt: row.completed_at,
				learningState: row.learning_state,
			})),
			questions,
			grammar,
			readings,
		});
	} catch (error) {
		console.error('Failed to load public JLPT practice history', error);
		return json({ ok: false, error: 'JLPT_PRACTICE_FAILED' }, 500);
	}
}
