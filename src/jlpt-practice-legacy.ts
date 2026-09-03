import { getAuthenticatedAdminSession } from './auth/session';
import { resolveLearningAdmin } from './japanese-learning';
import { addDays, daysBetween, ensureDefaultJlptStudyPlan, japanDateString, validDateText } from './jlpt-study';

type QuestionType = 'vocab' | 'grammar' | 'reading';
type ContentType = 'vocab_question' | 'grammar' | 'grammar_question' | 'reading';

interface ContentRow {
	id: number;
	plan_id: number;
	study_date: string;
	content_type: ContentType;
	sequence_no: number;
	title: string | null;
	payload_json: string;
	completed_at: string | null;
}

interface PracticeQuestion {
	key: string;
	type: QuestionType;
	title: string | null;
	prompt: string;
	options: string[];
}

interface ResolvedQuestion extends PracticeQuestion {
	contentId: number;
	studyDate: string;
	correctAnswer: string;
	explanation: string;
}

interface WrongNoteRow {
	question_key: string;
	question_type: QuestionType;
	study_date: string;
	prompt: string;
	options_json: string | null;
	selected_answer: string | null;
	correct_answer: string;
	explanation: string | null;
	wrong_count: number;
	last_wrong_at: string;
	resolved_at: string | null;
}

const PREVIEW_GRAMMAR = [
	['〜あっての', '〜이 있어야 비로소'], ['〜いかんでは', '〜여하에 따라서는'],
	['〜いかんにかかわらず', '〜여하에 관계없이'], ['〜ずくめ', '온통 〜뿐'],
	['〜ずにはおかない', '반드시 〜하게 만들다'], ['〜ずにはすまない', '〜하지 않고는 끝나지 않다'],
	['〜そばから', '〜하자마자 곧'], ['〜たが最後', '〜했다 하면 끝장이다'],
	['〜たところで', '〜해 보아도'], ['〜だに', '〜하기만 해도'],
	['〜たりとも', '단 하나라도'], ['〜であれ', '〜라 할지라도'],
	['〜てからというもの', '〜하고 나서부터 줄곧'], ['〜てやまない', '진심으로 계속 〜하다'],
	['〜とあって', '〜라는 특별한 상황이라'], ['〜とあれば', '〜라면'],
	['〜といい〜といい', '〜도 그렇고 〜도 그렇고'], ['〜といえども', '〜라 할지라도'],
	['〜ときたら', '〜라고 하면'], ['〜ところを', '〜한 상황인데도'],
	['〜ともなく', '딱히 〜하려 한 것도 아닌데'], ['〜ともなると', '〜정도가 되면'],
	['〜ないまでも', '〜까지는 아니더라도'], ['〜ないものでもない', '〜하지 못할 것도 없다'],
	['〜ながらに', '〜인 채로'], ['〜なくして', '〜없이는'],
	['〜ならでは', '〜이기에 가능한'], ['〜なり', '〜하자마자'],
	['〜にあって', '〜한 상황에서'], ['〜に至って', '〜에 이르러서'],
	['〜に至るまで', '〜에 이르기까지'], ['〜にかたくない', '쉽게 〜할 수 있다'],
	['〜にかまけて', '〜에 정신이 팔려'], ['〜にして', '〜에 이르러서야'],
	['〜に即して', '〜에 입각하여'], ['〜にたえる', '〜할 가치가 있다'],
	['〜に足る', '〜할 만하다'], ['〜にひきかえ', '〜와는 대조적으로'],
	['〜にもまして', '〜보다도 더욱'], ['〜の極み', '〜의 극치'],
	['〜の至り', '더없이 〜함'], ['〜ばこそ', '바로 〜이기 때문에'],
	['〜べからず', '〜해서는 안 된다'], ['〜べく', '〜하기 위해'],
	['〜べくもない', '도저히 〜할 수 없다'], ['〜まじき', '〜해서는 안 될'],
	['〜までだ', '그저 〜할 뿐이다'], ['〜までもない', '〜할 필요도 없다'],
	['〜まみれ', '온통 〜투성이'], ['〜めく', '〜다운 분위기가 나다'],
	['〜もさることながら', '〜도 물론이지만'], ['〜ものを', '〜했더라면 좋았을 텐데'],
	['〜や否や', '〜하자마자'], ['〜ゆえに', '〜이기 때문에'],
	['〜ようが〜まいが', '〜하든 말든'], ['〜をおいて', '〜을 제외하고는'],
	['〜を皮切りに', '〜을 시작으로'], ['〜を禁じ得ない', '〜을 금할 수 없다'],
	['〜をものともせず', '〜을 아랑곳하지 않고'], ['〜んがため', '〜하기 위하여'],
] as const;

const READING_FOCUS = [
	['주장 파악', '筆者の主張をつかむ'],
	['접속 관계', '接続関係を追う'],
	['지시어 추적', '指示語の内容を特定する'],
	['이유·근거 찾기', '理由・根拠を探す'],
	['대조 구조', '対比構造を読む'],
	['요지 요약', '要旨をまとめる'],
	['문장 삽입 위치', '文の挿入位置を判断する'],
	['정보 검색', '必要な情報を探す'],
	['필자의 태도', '筆者の態度を判断する'],
	['장문 흐름', '長文の論理展開を追う'],
] as const;

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function safePayload(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
	} catch {
		return {};
	}
}

function cleanText(value: unknown): string {
	return String(value ?? '').normalize('NFKC').trim();
}

function cleanOptions(value: unknown): string[] {
	return Array.isArray(value) ? value.map(cleanText).filter(Boolean).slice(0, 12) : [];
}

function publicQuestion(key: string, type: QuestionType, title: string | null, payload: Record<string, unknown>): PracticeQuestion | null {
	const prompt = cleanText(payload.prompt ?? payload.question);
	const options = cleanOptions(payload.options);
	if (!prompt || !options.length) return null;
	return { key, type, title, prompt, options };
}

async function loadContents(db: D1Database, planId: number, studyDate: string): Promise<ContentRow[]> {
	const result = await db.prepare(`
		SELECT id, plan_id, study_date, content_type, sequence_no, title, payload_json, completed_at
		FROM japanese_jlpt_daily_contents
		WHERE plan_id = ?1 AND study_date = ?2
		ORDER BY CASE content_type
			WHEN 'vocab_question' THEN 0
			WHEN 'grammar' THEN 1
			WHEN 'grammar_question' THEN 2
			ELSE 3 END, sequence_no ASC
	`).bind(planId, studyDate).all<ContentRow>();
	return result.results;
}

async function loadPreviewWords(db: D1Database, planId: number, studyDate: string) {
	const result = await db.prepare(`
		SELECT w.id, w.word, w.reading, w.meaning_ko, w.meaning_ja, c.sort_order
		FROM japanese_jlpt_curriculum_words c
		JOIN japanese_words w ON w.id = c.word_id AND w.deleted_at IS NULL
		WHERE c.plan_id = ?1 AND c.introduced_on = ?2
		ORDER BY c.sort_order ASC
		LIMIT 40
	`).bind(planId, studyDate).all<{
		id: number;
		word: string;
		reading: string | null;
		meaning_ko: string | null;
		meaning_ja: string | null;
		sort_order: number;
	}>();
	return result.results.map((row) => ({
		id: row.id,
		word: row.word,
		reading: row.reading,
		meaningKo: row.meaning_ko,
		meaningJa: row.meaning_ja,
		sortOrder: row.sort_order,
	}));
}

function previewTopics(studyStartDate: string, studyDate: string) {
	const dayIndex = Math.max(0, daysBetween(studyStartDate, studyDate));
	const grammarStart = (dayIndex * 2) % PREVIEW_GRAMMAR.length;
	const grammar = [0, 1].map((offset) => {
		const item = PREVIEW_GRAMMAR[(grammarStart + offset) % PREVIEW_GRAMMAR.length];
		return { pattern: item[0], meaningKo: item[1] };
	});
	const reading = READING_FOCUS[dayIndex % READING_FOCUS.length];
	return { grammar, reading: { focusKo: reading[0], focusJa: reading[1] } };
}

function serializeContents(rows: ContentRow[]) {
	const questions: PracticeQuestion[] = [];
	const grammar: Array<{ id: number; title: string | null; payload: Record<string, unknown>; completed: boolean }> = [];
	const readings: Array<{ id: number; title: string | null; passage: string; questions: PracticeQuestion[]; completed: boolean }> = [];

	for (const row of rows) {
		const payload = safePayload(row.payload_json);
		if (row.content_type === 'vocab_question' || row.content_type === 'grammar_question') {
			const question = publicQuestion(
				`content:${row.id}`,
				row.content_type === 'vocab_question' ? 'vocab' : 'grammar',
				row.title,
				payload,
			);
			if (question) questions.push(question);
			continue;
		}
		if (row.content_type === 'grammar') {
			grammar.push({ id: row.id, title: row.title, payload, completed: Boolean(row.completed_at) });
			continue;
		}
		if (row.content_type === 'reading') {
			const readingQuestions: PracticeQuestion[] = [];
			const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
			rawQuestions.forEach((raw, index) => {
				const questionPayload = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
				const question = publicQuestion(`content:${row.id}:reading:${index}`, 'reading', row.title, questionPayload);
				if (question) readingQuestions.push(question);
			});
			readings.push({
				id: row.id,
				title: row.title,
				passage: cleanText(payload.passage ?? payload.text),
				questions: readingQuestions,
				completed: Boolean(row.completed_at),
			});
		}
	}
	return { questions, grammar, readings };
}

async function resolveQuestion(db: D1Database, planId: number, questionKey: string): Promise<ResolvedQuestion | null> {
	const top = questionKey.match(/^content:(\d+)$/);
	const reading = questionKey.match(/^content:(\d+):reading:(\d+)$/);
	const contentId = Number(top?.[1] ?? reading?.[1]);
	if (!Number.isSafeInteger(contentId) || contentId <= 0) return null;
	const row = await db.prepare(`
		SELECT id, plan_id, study_date, content_type, sequence_no, title, payload_json, completed_at
		FROM japanese_jlpt_daily_contents
		WHERE id = ?1 AND plan_id = ?2
		LIMIT 1
	`).bind(contentId, planId).first<ContentRow>();
	if (!row) return null;
	const payload = safePayload(row.payload_json);

	if (top && (row.content_type === 'vocab_question' || row.content_type === 'grammar_question')) {
		const type: QuestionType = row.content_type === 'vocab_question' ? 'vocab' : 'grammar';
		const safe = publicQuestion(questionKey, type, row.title, payload);
		const correctAnswer = cleanText(payload.answer);
		if (!safe || !correctAnswer) return null;
		return {
			...safe,
			contentId: row.id,
			studyDate: row.study_date,
			correctAnswer,
			explanation: cleanText(payload.explanation),
		};
	}

	if (reading && row.content_type === 'reading') {
		const index = Number(reading[2]);
		const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
		const raw = rawQuestions[index];
		const questionPayload = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
		const safe = publicQuestion(questionKey, 'reading', row.title, questionPayload);
		const correctAnswer = cleanText(questionPayload.answer);
		if (!safe || !correctAnswer) return null;
		return {
			...safe,
			contentId: row.id,
			studyDate: row.study_date,
			correctAnswer,
			explanation: cleanText(questionPayload.explanation),
		};
	}
	return null;
}

function validatePracticeDate(value: unknown, today: string): string | null {
	const date = validDateText(value) ?? today;
	const lower = addDays(today, -365);
	const upper = addDays(today, 365);
	return date >= lower && date <= upper ? date : null;
}

export async function handleGetPublicJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);
		const plan = await ensureDefaultJlptStudyPlan(env.song_project_db, admin.adminId);
		const today = japanDateString();
		const url = new URL(request.url);
		const studyDate = validatePracticeDate(url.searchParams.get('date'), today);
		if (!studyDate) return json({ ok: false, error: 'DATE_OUT_OF_RANGE' }, 400);
		const [words, rows] = await Promise.all([
			loadPreviewWords(env.song_project_db, plan.id, studyDate),
			loadContents(env.song_project_db, plan.id, studyDate),
		]);
		const contents = serializeContents(rows);
		const previewDates = Array.from({ length: 31 }, (_, offset) => addDays(today, offset));
		return json({
			ok: true,
			viewer: { authenticated: admin.fromSession },
			plan: { studyStartDate: plan.study_start_date, level: plan.jlpt_level_code },
			today,
			studyDate,
			isFuture: studyDate > today,
			questionsEnabled: studyDate <= today,
			previewDates,
			words,
			preview: previewTopics(plan.study_start_date, studyDate),
			...contents,
		});
	} catch (error) {
		console.error('Failed to load public JLPT practice', error);
		return json({ ok: false, error: 'JLPT_PRACTICE_LOAD_FAILED' }, 500);
	}
}

async function parseGradeRequest(request: Request): Promise<{ questionKey: string; selectedAnswer: string } | Response> {
	let payload: { questionKey?: unknown; selectedAnswer?: unknown };
	try {
		payload = await request.json() as { questionKey?: unknown; selectedAnswer?: unknown };
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const questionKey = cleanText(payload.questionKey);
	const selectedAnswer = cleanText(payload.selectedAnswer);
	if (!questionKey || questionKey.length > 120 || !selectedAnswer || selectedAnswer.length > 1000) {
		return json({ ok: false, error: 'INVALID_ANSWER' }, 400);
	}
	return { questionKey, selectedAnswer };
}

function gradeResult(question: ResolvedQuestion, selectedAnswer: string) {
	const correct = cleanText(selectedAnswer) === cleanText(question.correctAnswer);
	return {
		correct,
		selectedAnswer,
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
	};
}

export async function handleGradePublicJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	try {
		const parsed = await parseGradeRequest(request);
		if (parsed instanceof Response) return parsed;
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);
		const plan = await ensureDefaultJlptStudyPlan(env.song_project_db, admin.adminId);
		const question = await resolveQuestion(env.song_project_db, plan.id, parsed.questionKey);
		if (!question) return json({ ok: false, error: 'QUESTION_NOT_FOUND' }, 404);
		if (question.studyDate > japanDateString()) return json({ ok: false, error: 'FUTURE_QUESTION_LOCKED' }, 409);
		return json({ ok: true, persisted: false, ...gradeResult(question, parsed.selectedAnswer) });
	} catch (error) {
		console.error('Failed to grade public JLPT practice', error);
		return json({ ok: false, error: 'JLPT_PRACTICE_GRADE_FAILED' }, 500);
	}
}

async function syncVocabQuestionProgress(db: D1Database, planId: number, contentId: number, studyDate: string, now: string) {
	const content = await db.prepare(`
		SELECT content_type FROM japanese_jlpt_daily_contents
		WHERE id = ?1 AND plan_id = ?2 LIMIT 1
	`).bind(contentId, planId).first<{ content_type: ContentType }>();
	if (!content || (content.content_type !== 'vocab_question' && content.content_type !== 'grammar_question')) return;

	await db.prepare(`
		UPDATE japanese_jlpt_daily_contents
		SET completed_at = COALESCE(completed_at, ?2), updated_at = ?2
		WHERE id = ?1
	`).bind(contentId, now).run();
	if (content.content_type !== 'vocab_question') return;

	const session = await db.prepare(`
		SELECT id, review_target, new_word_target, vocab_question_target, grammar_target, reading_target,
			review_completed, new_word_completed, vocab_question_completed, grammar_completed, reading_completed
		FROM japanese_jlpt_daily_sessions
		WHERE plan_id = ?1 AND study_date = ?2 LIMIT 1
	`).bind(planId, studyDate).first<{
		id: number;
		review_target: number;
		new_word_target: number;
		vocab_question_target: number;
		grammar_target: number;
		reading_target: number;
		review_completed: number;
		new_word_completed: number;
		vocab_question_completed: number;
		grammar_completed: number;
		reading_completed: number;
	}>();
	if (!session) return;
	const count = await db.prepare(`
		SELECT COUNT(*) AS value
		FROM japanese_jlpt_daily_contents
		WHERE plan_id = ?1 AND study_date = ?2 AND content_type = 'vocab_question' AND completed_at IS NOT NULL
	`).bind(planId, studyDate).first<{ value: number }>();
	const vocabCompleted = Math.min(session.vocab_question_target, Number(count?.value ?? 0));
	const finished = session.review_completed >= session.review_target
		&& session.new_word_completed >= session.new_word_target
		&& vocabCompleted >= session.vocab_question_target
		&& session.grammar_completed >= session.grammar_target
		&& session.reading_completed >= session.reading_target;
	await db.prepare(`
		UPDATE japanese_jlpt_daily_sessions
		SET vocab_question_completed = ?2,
			status = ?3,
			completed_at = CASE WHEN ?3 = 'completed' THEN COALESCE(completed_at, ?4) ELSE NULL END,
			updated_at = ?4
		WHERE id = ?1
	`).bind(session.id, vocabCompleted, finished ? 'completed' : 'in_progress', now).run();
}

export async function handleGradeAdminJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const parsed = await parseGradeRequest(request);
		if (parsed instanceof Response) return parsed;
		const plan = await ensureDefaultJlptStudyPlan(env.song_project_db, session.adminId);
		const question = await resolveQuestion(env.song_project_db, plan.id, parsed.questionKey);
		if (!question) return json({ ok: false, error: 'QUESTION_NOT_FOUND' }, 404);
		const today = japanDateString();
		if (question.studyDate > today) return json({ ok: false, error: 'FUTURE_QUESTION_LOCKED' }, 409);
		const result = gradeResult(question, parsed.selectedAnswer);
		const now = new Date().toISOString();
		const previous = await env.song_project_db.prepare(`
			SELECT resolved_at FROM japanese_jlpt_wrong_notes
			WHERE admin_id = ?1 AND plan_id = ?2 AND question_key = ?3 LIMIT 1
		`).bind(session.adminId, plan.id, question.key).first<{ resolved_at: string | null }>();

		await env.song_project_db.prepare(`
			INSERT INTO japanese_jlpt_question_attempts
				(admin_id, plan_id, study_date, question_key, question_type, prompt,
				 selected_answer, correct_answer, is_correct, attempted_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
		`).bind(
			session.adminId, plan.id, question.studyDate, question.key, question.type, question.prompt,
			result.selectedAnswer, result.correctAnswer, result.correct ? 1 : 0, now,
		).run();

		let wrongNoteSaved = false;
		let wrongNoteResolved = false;
		if (!result.correct) {
			await env.song_project_db.prepare(`
				INSERT INTO japanese_jlpt_wrong_notes
					(admin_id, plan_id, question_key, question_type, study_date, prompt, options_json,
					 selected_answer, correct_answer, explanation, wrong_count, last_wrong_at, resolved_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, NULL, ?11)
				ON CONFLICT(admin_id, plan_id, question_key) DO UPDATE SET
					question_type = excluded.question_type,
					study_date = excluded.study_date,
					prompt = excluded.prompt,
					options_json = excluded.options_json,
					selected_answer = excluded.selected_answer,
					correct_answer = excluded.correct_answer,
					explanation = excluded.explanation,
					wrong_count = japanese_jlpt_wrong_notes.wrong_count + 1,
					last_wrong_at = excluded.last_wrong_at,
					resolved_at = NULL,
					updated_at = excluded.updated_at
			`).bind(
				session.adminId, plan.id, question.key, question.type, question.studyDate, question.prompt,
				JSON.stringify(question.options), result.selectedAnswer, result.correctAnswer, question.explanation, now,
			).run();
			wrongNoteSaved = true;
		} else if (previous && previous.resolved_at === null) {
			await env.song_project_db.prepare(`
				UPDATE japanese_jlpt_wrong_notes
				SET resolved_at = ?4, updated_at = ?4
				WHERE admin_id = ?1 AND plan_id = ?2 AND question_key = ?3
			`).bind(session.adminId, plan.id, question.key, now).run();
			wrongNoteResolved = true;
		}

		await syncVocabQuestionProgress(env.song_project_db, plan.id, question.contentId, question.studyDate, now);
		return json({
			ok: true,
			persisted: true,
			wrongNoteSaved,
			wrongNoteResolved,
			...result,
		});
	} catch (error) {
		console.error('Failed to grade admin JLPT practice', error);
		return json({ ok: false, error: 'JLPT_PRACTICE_GRADE_FAILED' }, 500);
	}
}

export async function handleListAdminJapaneseJlptWrongNotes(request: Request, env: Env): Promise<Response> {
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const plan = await ensureDefaultJlptStudyPlan(env.song_project_db, session.adminId);
		const url = new URL(request.url);
		const includeResolved = url.searchParams.get('resolved') === 'all';
		const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 30) || 30));
		const result = await env.song_project_db.prepare(`
			SELECT question_key, question_type, study_date, prompt, options_json, selected_answer,
				correct_answer, explanation, wrong_count, last_wrong_at, resolved_at
			FROM japanese_jlpt_wrong_notes
			WHERE admin_id = ?1 AND plan_id = ?2
				AND (?3 = 1 OR resolved_at IS NULL)
			ORDER BY CASE WHEN resolved_at IS NULL THEN 0 ELSE 1 END, last_wrong_at DESC
			LIMIT ?4
		`).bind(session.adminId, plan.id, includeResolved ? 1 : 0, limit).all<WrongNoteRow>();
		return json({
			ok: true,
			items: result.results.map((row) => ({
				questionKey: row.question_key,
				type: row.question_type,
				studyDate: row.study_date,
				prompt: row.prompt,
				options: cleanOptions(row.options_json ? JSON.parse(row.options_json) : []),
				selectedAnswer: row.selected_answer,
				correctAnswer: row.correct_answer,
				explanation: row.explanation,
				wrongCount: row.wrong_count,
				lastWrongAt: row.last_wrong_at,
				resolvedAt: row.resolved_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list JLPT wrong notes', error);
		return json({ ok: false, error: 'JLPT_WRONG_NOTES_LOAD_FAILED' }, 500);
	}
}
