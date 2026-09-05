import { getAuthenticatedAdminSession } from './auth/session';

type MockSubject = 'A' | 'B';
type MockExamStatus = 'draft' | 'ready' | 'archived';
type AttemptStatus = 'in_progress' | 'submitted' | 'graded';

interface MockExamRow {
	id: number;
	subject: MockSubject;
	exam_no: number;
	title_ko: string;
	title_ja: string;
	duration_minutes: number;
	question_count_target: number;
	answer_count_target: number;
	loaded_question_count: number;
	total_score: number;
	passing_score: number;
	status: MockExamStatus;
	attempt_id: number | null;
	attempt_no: number | null;
	attempt_status: AttemptStatus | null;
	started_at: string | null;
	submitted_at: string | null;
	graded_at: string | null;
	score: number | null;
	max_score: number | null;
	answered_count: number | null;
}

interface MockQuestionRow {
	id: number;
	question_no: number;
	section_code: string | null;
	question_type: 'choice4' | 'written';
	prompt_ko: string;
	prompt_ja: string;
	choices_ko_json: string | null;
	choices_ja_json: string | null;
	correct_choice: number | null;
	model_answer_ko: string | null;
	model_answer_ja: string | null;
	explanation_ko: string;
	explanation_ja: string;
	max_score: number;
	is_mandatory: number;
	source_concept_code: string | null;
	selected_choice: number | null;
	answer_text: string | null;
	result: 'correct' | 'partial' | 'wrong' | null;
	awarded_score: number | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseSubject(value: unknown): MockSubject | null {
	return value === 'A' || value === 'B' ? value : null;
}

function parseExamNo(value: unknown): number | null {
	const n = Number(value);
	return Number.isSafeInteger(n) && n > 0 && n <= 100 ? n : null;
}

function parseJsonArray(value: string | null): unknown[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function ready(row: MockExamRow): boolean {
	return row.status === 'ready' && row.loaded_question_count === row.question_count_target;
}

function clientState(row: MockExamRow) {
	if (row.attempt_status === 'graded' || row.attempt_status === 'submitted') return 'completed';
	if (row.attempt_status === 'in_progress') return 'in_progress';
	return 'not_started';
}

function actionMode(row: MockExamRow) {
	const state = clientState(row);
	if (state === 'completed') return 'result';
	if (state === 'in_progress') return 'resume';
	return ready(row) ? 'start' : 'preparing';
}

async function loadExam(
	db: D1Database,
	subject: MockSubject,
	examNo: number,
	adminId: number | null,
): Promise<MockExamRow | null> {
	return db.prepare(`
		SELECT
			e.id, e.subject, e.exam_no, e.title_ko, e.title_ja,
			e.duration_minutes, e.question_count_target, e.answer_count_target,
			e.loaded_question_count, e.total_score, e.passing_score, e.status,
			a.id AS attempt_id, a.attempt_no, a.status AS attempt_status,
			a.started_at, a.submitted_at, a.graded_at, a.score, a.max_score,
			a.answered_count
		FROM ap_mock_exams e
		LEFT JOIN ap_mock_exam_attempts a ON a.id = (
			SELECT x.id
			FROM ap_mock_exam_attempts x
			WHERE x.mock_exam_id = e.id
			  AND x.admin_id = ?3
			ORDER BY x.attempt_no DESC
			LIMIT 1
		)
		WHERE e.subject = ?1 AND e.exam_no = ?2 AND e.status <> 'archived'
		LIMIT 1
	`).bind(subject, examNo, adminId ?? -1).first<MockExamRow>();
}

function serializeExam(row: MockExamRow) {
	const state = clientState(row);
	return {
		id: row.id,
		subject: row.subject,
		examNo: row.exam_no,
		titleKo: row.title_ko,
		titleJa: row.title_ja,
		durationMinutes: row.duration_minutes,
		questionCountTarget: row.question_count_target,
		answerCountTarget: row.answer_count_target,
		loadedQuestionCount: row.loaded_question_count,
		totalScore: row.total_score,
		passingScore: row.passing_score,
		ready: ready(row),
		state,
		actionMode: actionMode(row),
		attempt: row.attempt_id ? {
			id: row.attempt_id,
			attemptNo: row.attempt_no,
			status: row.attempt_status,
			startedAt: row.started_at,
			submittedAt: row.submitted_at,
			gradedAt: row.graded_at,
			score: row.score,
			maxScore: row.max_score ?? row.total_score,
			answeredCount: row.answered_count ?? 0,
		} : null,
	};
}

export async function handleListPublicApMockExams(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const subject = parseSubject(url.searchParams.get('subject')) ?? 'A';
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		const adminId = session?.adminId ?? -1;
		const result = await env.song_project_db.prepare(`
			SELECT
				e.id, e.subject, e.exam_no, e.title_ko, e.title_ja,
				e.duration_minutes, e.question_count_target, e.answer_count_target,
				e.loaded_question_count, e.total_score, e.passing_score, e.status,
				a.id AS attempt_id, a.attempt_no, a.status AS attempt_status,
				a.started_at, a.submitted_at, a.graded_at, a.score, a.max_score,
				a.answered_count
			FROM ap_mock_exams e
			LEFT JOIN ap_mock_exam_attempts a ON a.id = (
				SELECT x.id
				FROM ap_mock_exam_attempts x
				WHERE x.mock_exam_id = e.id
				  AND x.admin_id = ?2
				ORDER BY x.attempt_no DESC
				LIMIT 1
			)
			WHERE e.subject = ?1 AND e.status <> 'archived'
			ORDER BY e.exam_no ASC
		`).bind(subject, adminId).all<MockExamRow>();

		return json({
			ok: true,
			subject,
			viewer: { authenticated: Boolean(session) },
			exams: result.results.map(serializeExam),
		});
	} catch (error) {
		console.error('Failed to list AP mock exams', error);
		return json({ ok: false, error: 'AP_MOCK_EXAM_LIST_FAILED' }, 500);
	}
}

export async function handleGetPublicApMockExam(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const subject = parseSubject(url.searchParams.get('subject'));
		const examNo = parseExamNo(url.searchParams.get('no'));
		if (!subject || !examNo) return json({ ok: false, error: 'INVALID_EXAM_KEY' }, 400);
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		const exam = await loadExam(env.song_project_db, subject, examNo, session?.adminId ?? null);
		if (!exam) return json({ ok: false, error: 'EXAM_NOT_FOUND' }, 404);

		const serialized = serializeExam(exam);
		if (!ready(exam) || !session || !exam.attempt_id) {
			return json({ ok: true, viewer: { authenticated: Boolean(session) }, exam: serialized, questions: [] });
		}

		const completed = exam.attempt_status === 'submitted' || exam.attempt_status === 'graded';
		const questions = await env.song_project_db.prepare(`
			SELECT
				q.id, q.question_no, q.section_code, q.question_type,
				q.prompt_ko, q.prompt_ja, q.choices_ko_json, q.choices_ja_json,
				q.correct_choice, q.model_answer_ko, q.model_answer_ja,
				q.explanation_ko, q.explanation_ja, q.max_score,
				q.is_mandatory, q.source_concept_code,
				a.selected_choice, a.answer_text, a.result, a.awarded_score
			FROM ap_mock_exam_questions q
			LEFT JOIN ap_mock_exam_answers a
			  ON a.question_id = q.id AND a.attempt_id = ?2
			WHERE q.mock_exam_id = ?1
			ORDER BY q.question_no ASC
		`).bind(exam.id, exam.attempt_id).all<MockQuestionRow>();

		return json({
			ok: true,
			viewer: { authenticated: true },
			exam: serialized,
			questions: questions.results.map((q) => ({
				id: q.id,
				questionNo: q.question_no,
				sectionCode: q.section_code,
				type: q.question_type,
				promptKo: q.prompt_ko,
				promptJa: q.prompt_ja,
				choicesKo: parseJsonArray(q.choices_ko_json),
				choicesJa: parseJsonArray(q.choices_ja_json),
				maxScore: q.max_score,
				mandatory: q.is_mandatory === 1,
				sourceConceptCode: q.source_concept_code,
				selectedChoice: q.selected_choice,
				answerText: q.answer_text,
				result: completed ? q.result : null,
				awardedScore: completed ? q.awarded_score : null,
				correctChoice: completed ? q.correct_choice : null,
				modelAnswerKo: completed ? q.model_answer_ko : null,
				modelAnswerJa: completed ? q.model_answer_ja : null,
				explanationKo: completed ? q.explanation_ko : null,
				explanationJa: completed ? q.explanation_ja : null,
			})),
		});
	} catch (error) {
		console.error('Failed to load AP mock exam', error);
		return json({ ok: false, error: 'AP_MOCK_EXAM_LOAD_FAILED' }, 500);
	}
}

export async function handleStartAdminApMockExam(request: Request, env: Env): Promise<Response> {
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
		let body: { subject?: unknown; examNo?: unknown };
		try {
			body = await request.json() as { subject?: unknown; examNo?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const subject = parseSubject(body.subject);
		const examNo = parseExamNo(body.examNo);
		if (!subject || !examNo) return json({ ok: false, error: 'INVALID_EXAM_KEY' }, 400);

		const exam = await loadExam(env.song_project_db, subject, examNo, session.adminId);
		if (!exam) return json({ ok: false, error: 'EXAM_NOT_FOUND' }, 404);
		if (!ready(exam)) return json({ ok: false, error: 'EXAM_NOT_READY' }, 409);
		if (exam.attempt_status === 'in_progress' && exam.attempt_id) {
			return json({ ok: true, resumed: true, attemptId: exam.attempt_id });
		}

		const next = await env.song_project_db.prepare(`
			SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next_no
			FROM ap_mock_exam_attempts
			WHERE mock_exam_id = ?1 AND admin_id = ?2
		`).bind(exam.id, session.adminId).first<{ next_no: number }>();
		const nextNo = Math.max(1, Number(next?.next_no ?? 1));
		try {
			await env.song_project_db.prepare(`
				INSERT INTO ap_mock_exam_attempts(
					mock_exam_id, admin_id, attempt_no, status, max_score
				) VALUES (?1, ?2, ?3, 'in_progress', ?4)
			`).bind(exam.id, session.adminId, nextNo, exam.total_score).run();
		} catch (error) {
			// Concurrent starts are collapsed by the partial UNIQUE index.
			console.warn('AP mock exam start conflict; reloading current attempt', error);
		}
		const current = await loadExam(env.song_project_db, subject, examNo, session.adminId);
		if (!current?.attempt_id) return json({ ok: false, error: 'ATTEMPT_CREATE_FAILED' }, 500);
		return json({ ok: true, resumed: current.attempt_no !== nextNo, attemptId: current.attempt_id });
	} catch (error) {
		console.error('Failed to start AP mock exam', error);
		return json({ ok: false, error: 'AP_MOCK_EXAM_START_FAILED' }, 500);
	}
}
