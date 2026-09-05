import { getAuthenticatedAdminSession } from './auth/session';

type MockSubject = 'A' | 'B';
type MockExamStatus = 'draft' | 'ready' | 'archived';
type AttemptStatus = 'in_progress' | 'submitted' | 'graded';
type AnswerResult = 'correct' | 'partial' | 'wrong';

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
	selected_question_nos_json: string | null;
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
	content_json: string | null;
	grading_schema_json: string | null;
	selected_choice: number | null;
	answer_text: string | null;
	answer_json: string | null;
	result: AnswerResult | null;
	awarded_score: number | null;
}

interface GradeRow {
	question_id: number;
	question_no: number;
	correct_choice: number | null;
	max_score: number;
	is_mandatory: number;
	selected_choice: number | null;
	answer_text: string | null;
	answer_json: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function clean(value: unknown): string {
	return String(value ?? '').normalize('NFKC').trim();
}

function parseSubject(value: unknown): MockSubject | null {
	return value === 'A' || value === 'B' ? value : null;
}

function parseExamNo(value: unknown): number | null {
	const n = Number(value);
	return Number.isSafeInteger(n) && n > 0 && n <= 100 ? n : null;
}

function parseQuestionId(value: unknown): number | null {
	const n = Number(value);
	return Number.isSafeInteger(n) && n > 0 ? n : null;
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

function parseJsonObject(value: string | null): Record<string, unknown> | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? parsed as Record<string, unknown>
			: null;
	} catch {
		return null;
	}
}

function stringifyAnswerJson(value: unknown): string | null {
	if (value == null) return null;
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const text = JSON.stringify(value);
	return text.length <= 20000 ? text : null;
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

function remainingSeconds(row: MockExamRow): number | null {
	if (!row.started_at || row.attempt_status !== 'in_progress') return null;
	const started = Date.parse(row.started_at);
	if (!Number.isFinite(started)) return null;
	const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
	return Math.max(0, row.duration_minutes * 60 - elapsed);
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
			a.answered_count, a.selected_question_nos_json
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
	const remaining = remainingSeconds(row);
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
		remainingSeconds: remaining,
		expired: remaining === 0,
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
			selectedQuestionNos: parseJsonArray(row.selected_question_nos_json),
		} : null,
	};
}

async function requireActiveAttempt(
	request: Request,
	env: Env,
	subject: MockSubject,
	examNo: number,
): Promise<{ session: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAdminSession>>>; exam: MockExamRow } | Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
	const exam = await loadExam(env.song_project_db, subject, examNo, session.adminId);
	if (!exam) return json({ ok: false, error: 'EXAM_NOT_FOUND' }, 404);
	if (!exam.attempt_id) return json({ ok: false, error: 'ATTEMPT_NOT_FOUND' }, 404);
	return { session, exam };
}

async function loadGradeRows(db: D1Database, examId: number, attemptId: number): Promise<GradeRow[]> {
	const result = await db.prepare(`
		SELECT
			q.id AS question_id, q.question_no, q.correct_choice, q.max_score, q.is_mandatory,
			a.selected_choice, a.answer_text, a.answer_json
		FROM ap_mock_exam_questions q
		LEFT JOIN ap_mock_exam_answers a
		  ON a.question_id=q.id AND a.attempt_id=?2
		WHERE q.mock_exam_id=?1
		ORDER BY q.question_no ASC
	`).bind(examId, attemptId).all<GradeRow>();
	return result.results;
}

function hasWrittenAnswer(row: GradeRow): boolean {
	return Boolean(clean(row.answer_text) || clean(row.answer_json));
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
				a.answered_count, a.selected_question_nos_json
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
				q.is_mandatory, q.source_concept_code, q.content_json, q.grading_schema_json,
				a.selected_choice, a.answer_text, a.answer_json, a.result, a.awarded_score
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
				content: parseJsonObject(q.content_json),
				maxScore: q.max_score,
				mandatory: q.is_mandatory === 1,
				sourceConceptCode: q.source_concept_code,
				selectedChoice: q.selected_choice,
				answerText: q.answer_text,
				answerJson: parseJsonObject(q.answer_json),
				result: completed ? q.result : null,
				awardedScore: completed ? q.awarded_score : null,
				correctChoice: completed ? q.correct_choice : null,
				modelAnswerKo: completed ? q.model_answer_ko : null,
				modelAnswerJa: completed ? q.model_answer_ja : null,
				explanationKo: completed ? q.explanation_ko : null,
				explanationJa: completed ? q.explanation_ja : null,
				gradingSchema: completed ? parseJsonObject(q.grading_schema_json) : null,
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

export async function handleSaveAdminApMockExamAnswer(request: Request, env: Env): Promise<Response> {
	try {
		let body: {
			subject?: unknown;
			examNo?: unknown;
			questionId?: unknown;
			selectedChoice?: unknown;
			answerText?: unknown;
			answerJson?: unknown;
		};
		try {
			body = await request.json() as typeof body;
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const subject = parseSubject(body.subject);
		const examNo = parseExamNo(body.examNo);
		const questionId = parseQuestionId(body.questionId);
		if (!subject || !examNo || !questionId) return json({ ok: false, error: 'INVALID_ANSWER_KEY' }, 400);

		const active = await requireActiveAttempt(request, env, subject, examNo);
		if (active instanceof Response) return active;
		const { exam } = active;
		if (exam.attempt_status !== 'in_progress') return json({ ok: false, error: 'ATTEMPT_ALREADY_SUBMITTED' }, 409);
		if (remainingSeconds(exam) === 0) return json({ ok: false, error: 'EXAM_TIME_EXPIRED' }, 409);

		const question = await env.song_project_db.prepare(`
			SELECT id, question_no, question_type
			FROM ap_mock_exam_questions
			WHERE id=?1 AND mock_exam_id=?2
			LIMIT 1
		`).bind(questionId, exam.id).first<{ id: number; question_no: number; question_type: 'choice4' | 'written' }>();
		if (!question) return json({ ok: false, error: 'QUESTION_NOT_FOUND' }, 404);

		let selectedChoice: number | null = null;
		let answerText: string | null = null;
		let answerJson: string | null = null;
		if (question.question_type === 'choice4') {
			const choice = Number(body.selectedChoice);
			if (!Number.isInteger(choice) || choice < 0 || choice > 3) return json({ ok: false, error: 'INVALID_CHOICE' }, 400);
			selectedChoice = choice;
		} else {
			answerText = clean(body.answerText).slice(0, 10000) || null;
			answerJson = stringifyAnswerJson(body.answerJson);
			if (body.answerJson != null && answerJson == null) return json({ ok: false, error: 'INVALID_STRUCTURED_ANSWER' }, 400);
		}

		const hasAnswer = selectedChoice != null || Boolean(answerText || answerJson);
		if (!hasAnswer) {
			await env.song_project_db.prepare(`
				DELETE FROM ap_mock_exam_answers WHERE attempt_id=?1 AND question_id=?2
			`).bind(exam.attempt_id, questionId).run();
		} else {
			if (subject === 'B') {
				const count = await env.song_project_db.prepare(`
					SELECT COUNT(*) AS cnt
					FROM ap_mock_exam_answers a
					JOIN ap_mock_exam_questions q ON q.id=a.question_id
					WHERE a.attempt_id=?1 AND q.mock_exam_id=?2 AND a.question_id<>?3
					  AND (NULLIF(TRIM(COALESCE(a.answer_text,'')),'') IS NOT NULL OR NULLIF(TRIM(COALESCE(a.answer_json,'')),'') IS NOT NULL)
				`).bind(exam.attempt_id, exam.id, questionId).first<{ cnt: number }>();
				if (Number(count?.cnt ?? 0) >= exam.answer_count_target) {
					return json({ ok: false, error: 'SUBJECT_B_SELECTION_LIMIT' }, 409);
				}
			}
			await env.song_project_db.prepare(`
				INSERT INTO ap_mock_exam_answers(
					attempt_id, question_id, selected_choice, answer_text, answer_json, updated_at
				) VALUES (?1,?2,?3,?4,?5,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
				ON CONFLICT(attempt_id,question_id) DO UPDATE SET
					selected_choice=excluded.selected_choice,
					answer_text=excluded.answer_text,
					answer_json=excluded.answer_json,
					result=NULL,
					awarded_score=NULL,
					graded_at=NULL,
					updated_at=excluded.updated_at
			`).bind(exam.attempt_id, questionId, selectedChoice, answerText, answerJson).run();
		}

		const stats = await env.song_project_db.prepare(`
			SELECT COUNT(*) AS answered_count,
			       json_group_array(q.question_no) AS question_nos
			FROM ap_mock_exam_answers a
			JOIN ap_mock_exam_questions q ON q.id=a.question_id
			WHERE a.attempt_id=?1
			  AND (a.selected_choice IS NOT NULL OR NULLIF(TRIM(COALESCE(a.answer_text,'')),'') IS NOT NULL OR NULLIF(TRIM(COALESCE(a.answer_json,'')),'') IS NOT NULL)
		`).bind(exam.attempt_id).first<{ answered_count: number; question_nos: string | null }>();
		await env.song_project_db.prepare(`
			UPDATE ap_mock_exam_attempts
			SET answered_count=?2, selected_question_nos_json=?3,
			    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
			WHERE id=?1 AND status='in_progress'
		`).bind(exam.attempt_id, Number(stats?.answered_count ?? 0), stats?.question_nos ?? '[]').run();

		return json({ ok: true, persisted: true, answeredCount: Number(stats?.answered_count ?? 0) });
	} catch (error) {
		console.error('Failed to save AP mock exam answer', error);
		return json({ ok: false, error: 'AP_MOCK_ANSWER_SAVE_FAILED' }, 500);
	}
}

export async function handleSubmitAdminApMockExam(request: Request, env: Env): Promise<Response> {
	try {
		let body: { subject?: unknown; examNo?: unknown; force?: unknown };
		try {
			body = await request.json() as typeof body;
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const subject = parseSubject(body.subject);
		const examNo = parseExamNo(body.examNo);
		const force = body.force === true;
		if (!subject || !examNo) return json({ ok: false, error: 'INVALID_EXAM_KEY' }, 400);
		const active = await requireActiveAttempt(request, env, subject, examNo);
		if (active instanceof Response) return active;
		const { exam } = active;
		if (exam.attempt_status === 'graded' || exam.attempt_status === 'submitted') {
			return json({ ok: true, alreadySubmitted: true, exam: serializeExam(exam) });
		}

		const rows = await loadGradeRows(env.song_project_db, exam.id, exam.attempt_id!);
		const answered = subject === 'A'
			? rows.filter((r) => r.selected_choice != null)
			: rows.filter(hasWrittenAnswer);
		if (!force && subject === 'A' && answered.length !== exam.answer_count_target) {
			return json({ ok: false, error: 'ANSWER_ALL_REQUIRED', answeredCount: answered.length, requiredCount: exam.answer_count_target }, 409);
		}
		if (!force && subject === 'B') {
			if (answered.length !== exam.answer_count_target) {
				return json({ ok: false, error: 'SUBJECT_B_EXACTLY_FIVE_REQUIRED', answeredCount: answered.length, requiredCount: exam.answer_count_target }, 409);
			}
			const mandatory = rows.filter((r) => r.is_mandatory === 1);
			if (mandatory.length && !mandatory.some(hasWrittenAnswer)) {
				return json({ ok: false, error: 'SUBJECT_B_MANDATORY_REQUIRED' }, 409);
			}
		}

		const selectedNos = answered.map((r) => r.question_no).sort((a, b) => a - b);
		if (subject === 'A') {
			let score = 0;
			const updates = answered.map((row) => {
				const correct = row.correct_choice != null && row.selected_choice === row.correct_choice;
				if (correct) score += Number(row.max_score);
				return env.song_project_db.prepare(`
					UPDATE ap_mock_exam_answers
					SET result=?3, awarded_score=?4, graded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
					    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
					WHERE attempt_id=?1 AND question_id=?2
				`).bind(exam.attempt_id, row.question_id, correct ? 'correct' : 'wrong', correct ? row.max_score : 0);
			});
			if (updates.length) await env.song_project_db.batch(updates);
			score = Math.round(score * 100) / 100;
			await env.song_project_db.prepare(`
				UPDATE ap_mock_exam_attempts
				SET status='graded', submitted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
				    graded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), score=?2, max_score=?3,
				    answered_count=?4, selected_question_nos_json=?5,
				    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
				WHERE id=?1 AND status='in_progress'
			`).bind(exam.attempt_id, score, exam.total_score, answered.length, JSON.stringify(selectedNos)).run();
			return json({ ok: true, status: 'graded', score, maxScore: exam.total_score, answeredCount: answered.length });
		}

		await env.song_project_db.prepare(`
			UPDATE ap_mock_exam_attempts
			SET status='submitted', submitted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
			    score=NULL, max_score=?2, answered_count=?3, selected_question_nos_json=?4,
			    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
			WHERE id=?1 AND status='in_progress'
		`).bind(exam.attempt_id, exam.total_score, answered.length, JSON.stringify(selectedNos)).run();
		return json({ ok: true, status: 'submitted', requiresSelfGrade: true, answeredCount: answered.length });
	} catch (error) {
		console.error('Failed to submit AP mock exam', error);
		return json({ ok: false, error: 'AP_MOCK_EXAM_SUBMIT_FAILED' }, 500);
	}
}

export async function handleGradeAdminApMockExamWritten(request: Request, env: Env): Promise<Response> {
	try {
		let body: { subject?: unknown; examNo?: unknown; questionId?: unknown; awardedScore?: unknown };
		try {
			body = await request.json() as typeof body;
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const subject = parseSubject(body.subject);
		const examNo = parseExamNo(body.examNo);
		const questionId = parseQuestionId(body.questionId);
		if (subject !== 'B' || !examNo || !questionId) return json({ ok: false, error: 'INVALID_GRADE_KEY' }, 400);
		const active = await requireActiveAttempt(request, env, subject, examNo);
		if (active instanceof Response) return active;
		const { exam } = active;
		if (exam.attempt_status !== 'submitted' && exam.attempt_status !== 'graded') {
			return json({ ok: false, error: 'SUBMIT_BEFORE_GRADING' }, 409);
		}
		const row = await env.song_project_db.prepare(`
			SELECT q.id, q.max_score, a.answer_text, a.answer_json
			FROM ap_mock_exam_questions q
			JOIN ap_mock_exam_answers a ON a.question_id=q.id AND a.attempt_id=?3
			WHERE q.id=?1 AND q.mock_exam_id=?2 AND q.question_type='written'
			LIMIT 1
		`).bind(questionId, exam.id, exam.attempt_id).first<{ id: number; max_score: number; answer_text: string | null; answer_json: string | null }>();
		if (!row || (!clean(row.answer_text) && !clean(row.answer_json))) return json({ ok: false, error: 'ANSWER_NOT_FOUND' }, 404);
		const awarded = Number(body.awardedScore);
		if (!Number.isFinite(awarded) || awarded < 0 || awarded > Number(row.max_score)) {
			return json({ ok: false, error: 'INVALID_AWARDED_SCORE', maxScore: row.max_score }, 400);
		}
		const result: AnswerResult = awarded <= 0 ? 'wrong' : awarded >= Number(row.max_score) ? 'correct' : 'partial';
		await env.song_project_db.prepare(`
			UPDATE ap_mock_exam_answers
			SET result=?3, awarded_score=?4, graded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
			    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
			WHERE attempt_id=?1 AND question_id=?2
		`).bind(exam.attempt_id, questionId, result, awarded).run();

		const grade = await env.song_project_db.prepare(`
			SELECT COUNT(*) AS total_answers,
			       SUM(CASE WHEN graded_at IS NOT NULL THEN 1 ELSE 0 END) AS graded_answers,
			       COALESCE(SUM(CASE WHEN graded_at IS NOT NULL THEN awarded_score ELSE 0 END),0) AS score
			FROM ap_mock_exam_answers
			WHERE attempt_id=?1
			  AND (NULLIF(TRIM(COALESCE(answer_text,'')),'') IS NOT NULL OR NULLIF(TRIM(COALESCE(answer_json,'')),'') IS NOT NULL)
		`).bind(exam.attempt_id).first<{ total_answers: number; graded_answers: number; score: number }>();
		const totalAnswers = Number(grade?.total_answers ?? 0);
		const gradedAnswers = Number(grade?.graded_answers ?? 0);
		const score = Math.round(Number(grade?.score ?? 0) * 100) / 100;
		const finished = totalAnswers > 0 && gradedAnswers === totalAnswers;
		await env.song_project_db.prepare(`
			UPDATE ap_mock_exam_attempts
			SET status=?2, score=?3, graded_at=CASE WHEN ?4=1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE graded_at END,
			    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
			WHERE id=?1
		`).bind(exam.attempt_id, finished ? 'graded' : 'submitted', score, finished ? 1 : 0).run();
		return json({ ok: true, result, awardedScore: awarded, score, maxScore: exam.total_score, gradedAnswers, totalAnswers, finished });
	} catch (error) {
		console.error('Failed to grade AP written mock answer', error);
		return json({ ok: false, error: 'AP_MOCK_WRITTEN_GRADE_FAILED' }, 500);
	}
}
