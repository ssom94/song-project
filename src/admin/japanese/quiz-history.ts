import { getAuthenticatedAdminSession } from '../../auth/session';

type ClientQuestionType = 'reading' | 'meaning' | 'sentence';
type DbQuestionType = 'reading' | 'meaning_ko' | 'sentence_blank';

type QuizAttemptPayload = {
	wordId?: unknown;
	type?: unknown;
	answerMode?: unknown;
	answer?: unknown;
};

type CompletePayload = {
	setup?: unknown;
	startedAt?: unknown;
	attempts?: unknown;
};

interface QuizWordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	example_id: number | null;
	example_sentence: string | null;
}

interface HistoryRow {
	id: number;
	settings_json: string;
	question_count: number;
	correct_count: number;
	wrong_count: number;
	status: string;
	started_at: string;
	completed_at: string | null;
}

interface AttemptRow {
	id: number;
	word_id: number;
	question_type: DbQuestionType;
	answer_mode: 'input' | 'choice';
	prompt_text: string;
	expected_answer: string;
	answer_text: string;
	is_correct: number;
	answered_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function makeId(): number {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return (Date.now() * 1000) + (random[0] % 1000);
}

function normalize(value: unknown): string {
	return String(value ?? '')
		.normalize('NFKC')
		.trim()
		.toLocaleLowerCase()
		.replace(/[。．.!！?？\s]+$/g, '');
}

function meaningAnswers(value: string | null): string[] {
	const original = String(value ?? '').trim();
	if (!original) return [];
	return [...new Set([
		original,
		...original.split(/[,/／、;；·|]/).map((item) => item.trim()).filter(Boolean),
	])];
}

function clientType(value: unknown): ClientQuestionType | null {
	return value === 'reading' || value === 'meaning' || value === 'sentence' ? value : null;
}

function dbType(value: ClientQuestionType): DbQuestionType {
	if (value === 'meaning') return 'meaning_ko';
	if (value === 'sentence') return 'sentence_blank';
	return 'reading';
}

function toClientType(value: DbQuestionType): ClientQuestionType {
	if (value === 'meaning_ko') return 'meaning';
	if (value === 'sentence_blank') return 'sentence';
	return 'reading';
}

function safeJson(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function normalizedStartedAt(value: unknown): string {
	if (typeof value !== 'string') return new Date().toISOString();
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return new Date().toISOString();
	const now = Date.now();
	if (date.getTime() > now || now - date.getTime() > 24 * 60 * 60 * 1000) return new Date().toISOString();
	return date.toISOString();
}

function questionData(row: QuizWordRow, type: ClientQuestionType) {
	if (type === 'reading') {
		if (!row.reading) return null;
		return { expected: row.reading, answers: [row.reading], prompt: row.word, exampleId: null };
	}
	if (type === 'meaning') {
		const answers = meaningAnswers(row.meaning_ko);
		if (!answers.length) return null;
		return { expected: row.meaning_ko ?? answers[0], answers, prompt: row.word, exampleId: null };
	}
	if (!row.example_sentence || !row.example_sentence.includes(row.word)) return null;
	return {
		expected: row.word,
		answers: [row.word],
		prompt: row.example_sentence.replace(row.word, '＿＿＿＿'),
		exampleId: row.example_id,
	};
}

export async function handleCompleteAdminJapaneseQuiz(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: CompletePayload;
	try {
		payload = await request.json() as CompletePayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	if (!Array.isArray(payload.attempts) || payload.attempts.length < 1 || payload.attempts.length > 200) {
		return json({ ok: false, error: 'INVALID_ATTEMPTS' }, 400);
	}

	const attempts = payload.attempts.map((raw) => raw as QuizAttemptPayload);
	const normalizedAttempts: Array<{ wordId: number; type: ClientQuestionType; answerMode: 'input' | 'choice'; answer: string }> = [];
	for (const attempt of attempts) {
		const wordId = Number(attempt.wordId);
		const type = clientType(attempt.type);
		const answerMode = attempt.answerMode === 'choice' ? 'choice' : attempt.answerMode === 'input' ? 'input' : null;
		const answer = typeof attempt.answer === 'string' ? attempt.answer.slice(0, 1000) : '';
		if (!Number.isSafeInteger(wordId) || wordId <= 0 || !type || !answerMode) {
			return json({ ok: false, error: 'INVALID_ATTEMPT' }, 400);
		}
		normalizedAttempts.push({ wordId, type, answerMode, answer });
	}

	try {
		const lookup = env.song_project_db.prepare(`
			SELECT
				w.id, w.word, w.reading, w.meaning_ko,
				ex.id AS example_id, ex.sentence_ja AS example_sentence
			FROM japanese_words AS w
			LEFT JOIN japanese_word_examples AS ex ON ex.id = (
				SELECT e.id FROM japanese_word_examples AS e
				WHERE e.word_id = w.id AND e.deleted_at IS NULL
				ORDER BY e.id ASC LIMIT 1
			)
			WHERE w.id = ?1 AND w.deleted_at IS NULL
			LIMIT 1
		`);
		const rows = await env.song_project_db.batch(
			normalizedAttempts.map((attempt) => lookup.bind(attempt.wordId)),
		);

		const graded: Array<{
			wordId: number;
			type: ClientQuestionType;
			answerMode: 'input' | 'choice';
			answer: string;
			prompt: string;
			expected: string;
			exampleId: number | null;
			isCorrect: boolean;
		}> = [];

		for (let index = 0; index < normalizedAttempts.length; index += 1) {
			const row = rows[index]?.results?.[0] as QuizWordRow | undefined;
			const attempt = normalizedAttempts[index];
			if (!row) return json({ ok: false, error: 'WORD_NOT_FOUND' }, 400);
			const question = questionData(row, attempt.type);
			if (!question) return json({ ok: false, error: 'QUESTION_DATA_MISSING' }, 400);
			const answer = normalize(attempt.answer);
			const isCorrect = Boolean(answer) && question.answers.some((expected) => normalize(expected) === answer);
			graded.push({ ...attempt, prompt: question.prompt, expected: question.expected, exampleId: question.exampleId, isCorrect });
		}

		const sessionId = makeId();
		const startedAt = normalizedStartedAt(payload.startedAt);
		const completedAt = new Date().toISOString();
		const correctCount = graded.filter((item) => item.isCorrect).length;
		const wrongCount = graded.length - correctCount;
		const settings = payload.setup && typeof payload.setup === 'object' && !Array.isArray(payload.setup) ? payload.setup : {};
		const statements: D1PreparedStatement[] = [
			env.song_project_db.prepare(`
				INSERT INTO japanese_quiz_sessions
					(id, admin_id, settings_json, question_count, correct_count, wrong_count, status, started_at, completed_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'completed', ?7, ?8, ?8)
			`).bind(sessionId, session.adminId, JSON.stringify(settings), graded.length, correctCount, wrongCount, startedAt, completedAt),
		];

		for (const item of graded) {
			const attemptId = makeId() + statements.length;
			statements.push(env.song_project_db.prepare(`
				INSERT INTO japanese_quiz_attempts
					(id, session_id, word_id, example_id, question_type, answer_mode, prompt_text, expected_answer, answer_text, is_correct, answered_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
			`).bind(
				attemptId, sessionId, item.wordId, item.exampleId, dbType(item.type), item.answerMode,
				item.prompt, item.expected, item.answer, item.isCorrect ? 1 : 0, completedAt,
			));
			statements.push(env.song_project_db.prepare(`
				INSERT INTO japanese_word_learning_stats
					(word_id, correct_count, wrong_count, needs_review, last_answered_at, last_correct_at, last_wrong_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?5)
				ON CONFLICT(word_id) DO UPDATE SET
					correct_count = correct_count + excluded.correct_count,
					wrong_count = wrong_count + excluded.wrong_count,
					needs_review = excluded.needs_review,
					last_answered_at = excluded.last_answered_at,
					last_correct_at = COALESCE(excluded.last_correct_at, last_correct_at),
					last_wrong_at = COALESCE(excluded.last_wrong_at, last_wrong_at),
					updated_at = excluded.updated_at
			`).bind(
				item.wordId,
				item.isCorrect ? 1 : 0,
				item.isCorrect ? 0 : 1,
				item.isCorrect ? 0 : 1,
				completedAt,
				item.isCorrect ? completedAt : null,
				item.isCorrect ? null : completedAt,
			));
		}
		await env.song_project_db.batch(statements);
		return json({
			ok: true,
			session: { id: sessionId, total: graded.length, correct: correctCount, wrong: wrongCount, startedAt, completedAt },
			attempts: graded.map((item) => ({
				wordId: item.wordId, type: item.type, prompt: item.prompt, answer: item.answer,
				correct: item.expected, isCorrect: item.isCorrect,
			})),
		}, 201);
	} catch (error) {
		console.error('Failed to complete Japanese quiz', error);
		return json({ ok: false, error: 'QUIZ_COMPLETE_FAILED' }, 500);
	}
}

export async function handleListAdminJapaneseQuizHistory(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		const result = await env.song_project_db.prepare(`
			SELECT id, settings_json, question_count, correct_count, wrong_count, status, started_at, completed_at
			FROM japanese_quiz_sessions
			WHERE admin_id = ?1
			ORDER BY datetime(started_at) DESC, id DESC
			LIMIT 100
		`).bind(session.adminId).all<HistoryRow>();
		return json({
			ok: true,
			sessions: result.results.map((row) => ({
				id: row.id,
				settings: safeJson(row.settings_json),
				total: row.question_count,
				correct: row.correct_count,
				wrong: row.wrong_count,
				status: row.status,
				startedAt: row.started_at,
				completedAt: row.completed_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list Japanese quiz history', error);
		return json({ ok: false, error: 'QUIZ_HISTORY_FAILED' }, 500);
	}
}

export async function handleGetAdminJapaneseQuizHistory(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_SESSION_ID' }, 400);
	try {
		const row = await env.song_project_db.prepare(`
			SELECT id, settings_json, question_count, correct_count, wrong_count, status, started_at, completed_at
			FROM japanese_quiz_sessions
			WHERE id = ?1 AND admin_id = ?2
			LIMIT 1
		`).bind(id, session.adminId).first<HistoryRow>();
		if (!row) return json({ ok: false, error: 'SESSION_NOT_FOUND' }, 404);
		const attempts = await env.song_project_db.prepare(`
			SELECT id, word_id, question_type, answer_mode, prompt_text, expected_answer, answer_text, is_correct, answered_at
			FROM japanese_quiz_attempts
			WHERE session_id = ?1
			ORDER BY datetime(answered_at) ASC, id ASC
		`).bind(id).all<AttemptRow>();
		return json({
			ok: true,
			session: {
				id: row.id, settings: safeJson(row.settings_json), total: row.question_count,
				correct: row.correct_count, wrong: row.wrong_count, status: row.status,
				startedAt: row.started_at, completedAt: row.completed_at,
				attempts: attempts.results.map((item) => ({
					id: item.id,
					wordId: item.word_id,
					type: toClientType(item.question_type),
					answerMode: item.answer_mode,
					prompt: item.prompt_text,
					correct: item.expected_answer,
					answer: item.answer_text,
					isCorrect: item.is_correct === 1,
					answeredAt: item.answered_at,
				})),
			},
		});
	} catch (error) {
		console.error('Failed to get Japanese quiz history', error);
		return json({ ok: false, error: 'QUIZ_HISTORY_DETAIL_FAILED' }, 500);
	}
}
