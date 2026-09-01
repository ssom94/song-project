import { getAuthenticatedAdminSession } from './auth/session';
import { ensureDefaultApStudyPlan } from './ap-study';
import { resolveLearningAdmin } from './japanese-learning';
import { addDays, japanDateString, validDateText } from './jlpt-study';

type ApPracticeType = 'concept' | 'subject_a' | 'subject_b';
type ApContentType = 'concept' | 'concept_question' | 'subject_a_question' | 'subject_b_scenario';
type ApPracticeResult = 'correct' | 'partial' | 'wrong';

interface ApContentRow {
	id: number;
	plan_id: number;
	study_date: string;
	topic_id: number | null;
	content_type: ApContentType;
	sequence_no: number;
	title_ko: string | null;
	title_ja: string | null;
	payload_json: string;
	completed_at: string | null;
	topic_code: string | null;
	topic_title_ko: string | null;
	topic_title_ja: string | null;
}

interface ResolvedApQuestion {
	key: string;
	type: ApPracticeType;
	contentId: number;
	studyDate: string;
	topicId: number | null;
	prompt: string;
	options: string[];
	correctAnswer: string;
	explanation: string;
}

interface ApWrongNoteRow {
	question_key: string;
	question_type: ApPracticeType;
	study_date: string;
	topic_id: number | null;
	prompt: string;
	options_json: string | null;
	selected_answer: string | null;
	correct_answer: string | null;
	explanation: string | null;
	wrong_count: number;
	last_wrong_at: string;
	resolved_at: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function clean(value: unknown): string {
	return String(value ?? '').normalize('NFKC').trim();
}

function safePayload(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
	} catch {
		return {};
	}
}

function safeOptions(value: unknown): string[] {
	return Array.isArray(value) ? value.map(clean).filter(Boolean).slice(0, 12) : [];
}

function validStudyDate(value: unknown, today: string): string | null {
	const date = validDateText(value) ?? today;
	return date >= addDays(today, -365) && date <= addDays(today, 30) ? date : null;
}

async function loadContents(db: D1Database, planId: number, studyDate: string): Promise<ApContentRow[]> {
	const result = await db.prepare(`
		SELECT c.id, c.plan_id, c.study_date, c.topic_id, c.content_type, c.sequence_no,
			c.title_ko, c.title_ja, c.payload_json, c.completed_at,
			t.topic_code, t.title_ko AS topic_title_ko, t.title_ja AS topic_title_ja
		FROM ap_daily_contents AS c
		LEFT JOIN ap_study_topics AS t ON t.id = c.topic_id
		WHERE c.plan_id = ?1 AND c.study_date = ?2
		ORDER BY CASE c.content_type
			WHEN 'concept' THEN 0
			WHEN 'concept_question' THEN 1
			WHEN 'subject_a_question' THEN 2
			ELSE 3 END, c.sequence_no ASC
	`).bind(planId, studyDate).all<ApContentRow>();
	return result.results;
}

function titleOf(row: ApContentRow) {
	return {
		ko: row.title_ko || row.topic_title_ko || '',
		ja: row.title_ja || row.topic_title_ja || '',
	};
}

function resolveAnswer(payload: Record<string, unknown>): { options: string[]; answer: string } {
	const options = safeOptions(payload.options ?? payload.choices);
	const raw = payload.answer;
	if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < options.length) {
		return { options, answer: options[raw] };
	}
	return { options, answer: clean(raw) };
}

function serializeContents(rows: ApContentRow[]) {
	const concepts: unknown[] = [];
	const subjectA: unknown[] = [];
	const subjectB: unknown[] = [];

	for (const row of rows) {
		const payload = safePayload(row.payload_json);
		const title = titleOf(row);
		if (row.content_type === 'concept') {
			const check = payload.check && typeof payload.check === 'object' && !Array.isArray(payload.check)
				? payload.check as Record<string, unknown>
				: null;
			let checkQuestion = null;
			if (check) {
				const answer = resolveAnswer(check);
				checkQuestion = {
					key: `content:${row.id}:concept`,
					type: 'concept',
					prompt: clean(check.question ?? check.prompt),
					options: answer.options,
				};
			}
			concepts.push({
				id: row.id,
				topicCode: row.topic_code,
				titleKo: title.ko,
				titleJa: title.ja,
				summaryKo: clean(payload.summary_ko ?? payload.summaryKo),
				summaryJa: clean(payload.summary_ja ?? payload.summaryJa),
				keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
				check: checkQuestion,
				completed: Boolean(row.completed_at),
			});
			continue;
		}
		if (row.content_type === 'concept_question' || row.content_type === 'subject_a_question') {
			const answer = resolveAnswer(payload);
			const type: ApPracticeType = row.content_type === 'concept_question' ? 'concept' : 'subject_a';
			const target = row.content_type === 'subject_a_question' ? subjectA : concepts;
			target.push({
				id: row.id,
				key: `content:${row.id}`,
				type,
				topicCode: row.topic_code,
				titleKo: title.ko,
				titleJa: title.ja,
				prompt: clean(payload.question ?? payload.prompt),
				options: answer.options,
				completed: Boolean(row.completed_at),
			});
			continue;
		}
		const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
		subjectB.push({
			id: row.id,
			topicCode: row.topic_code,
			titleKo: title.ko,
			titleJa: title.ja,
			scenario: clean(payload.scenario ?? payload.passage),
			estimatedMinutes: Number(payload.estimated_minutes ?? payload.estimatedMinutes ?? 0),
			questions: rawQuestions.map((raw, index) => {
				const q = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
				return {
					key: `content:${row.id}:b:${index}`,
					type: 'subject_b',
					prompt: clean(q.question ?? q.prompt),
				};
			}),
			answeringTipKo: clean(payload.answering_tip_ko ?? payload.answeringTipKo),
			answeringTipJa: clean(payload.answering_tip_ja ?? payload.answeringTipJa),
			completed: Boolean(row.completed_at),
		});
	}
	return { concepts, subjectA, subjectB };
}

async function resolveQuestion(db: D1Database, planId: number, questionKey: string): Promise<ResolvedApQuestion | null> {
	const conceptMatch = questionKey.match(/^content:(\d+):concept$/);
	const subjectBMatch = questionKey.match(/^content:(\d+):b:(\d+)$/);
	const topMatch = questionKey.match(/^content:(\d+)$/);
	const contentId = Number(conceptMatch?.[1] ?? subjectBMatch?.[1] ?? topMatch?.[1]);
	if (!Number.isSafeInteger(contentId) || contentId <= 0) return null;
	const row = await db.prepare(`
		SELECT c.id, c.plan_id, c.study_date, c.topic_id, c.content_type, c.sequence_no,
			c.title_ko, c.title_ja, c.payload_json, c.completed_at,
			t.topic_code, t.title_ko AS topic_title_ko, t.title_ja AS topic_title_ja
		FROM ap_daily_contents AS c
		LEFT JOIN ap_study_topics AS t ON t.id = c.topic_id
		WHERE c.id = ?1 AND c.plan_id = ?2 LIMIT 1
	`).bind(contentId, planId).first<ApContentRow>();
	if (!row) return null;
	const payload = safePayload(row.payload_json);

	if (conceptMatch && row.content_type === 'concept') {
		const check = payload.check && typeof payload.check === 'object' && !Array.isArray(payload.check)
			? payload.check as Record<string, unknown>
			: {};
		const answer = resolveAnswer(check);
		const prompt = clean(check.question ?? check.prompt);
		if (!prompt || !answer.answer) return null;
		return {
			key: questionKey,
			type: 'concept',
			contentId: row.id,
			studyDate: row.study_date,
			topicId: row.topic_id,
			prompt,
			options: answer.options,
			correctAnswer: answer.answer,
			explanation: clean(check.explanation_ko ?? check.explanation_ja ?? check.explanation),
		};
	}

	if (topMatch && (row.content_type === 'concept_question' || row.content_type === 'subject_a_question')) {
		const answer = resolveAnswer(payload);
		const prompt = clean(payload.question ?? payload.prompt);
		if (!prompt || !answer.answer) return null;
		return {
			key: questionKey,
			type: row.content_type === 'concept_question' ? 'concept' : 'subject_a',
			contentId: row.id,
			studyDate: row.study_date,
			topicId: row.topic_id,
			prompt,
			options: answer.options,
			correctAnswer: answer.answer,
			explanation: clean(payload.explanation_ko ?? payload.explanation_ja ?? payload.explanation),
		};
	}

	if (subjectBMatch && row.content_type === 'subject_b_scenario') {
		const index = Number(subjectBMatch[2]);
		const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
		const raw = rawQuestions[index];
		const q = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
		const prompt = clean(q.question ?? q.prompt);
		const correctAnswer = clean(q.answer ?? q.modelAnswer);
		if (!prompt || !correctAnswer) return null;
		return {
			key: questionKey,
			type: 'subject_b',
			contentId: row.id,
			studyDate: row.study_date,
			topicId: row.topic_id,
			prompt,
			options: [],
			correctAnswer,
			explanation: clean(q.explanation_ko ?? q.explanation_ja ?? q.explanation),
		};
	}
	return null;
}

export async function handleGetPublicApPractice(request: Request, env: Env): Promise<Response> {
	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);
		const plan = await ensureDefaultApStudyPlan(env.song_project_db, admin.adminId);
		const today = japanDateString();
		const url = new URL(request.url);
		const studyDate = validStudyDate(url.searchParams.get('date'), today);
		if (!studyDate) return json({ ok: false, error: 'DATE_OUT_OF_RANGE' }, 400);
		const rows = await loadContents(env.song_project_db, plan.id, studyDate);
		return json({
			ok: true,
			viewer: { authenticated: admin.fromSession },
			today,
			studyDate,
			isFuture: studyDate > today,
			questionsEnabled: studyDate <= today,
			...serializeContents(rows),
		});
	} catch (error) {
		console.error('Failed to load AP practice', error);
		return json({ ok: false, error: 'AP_PRACTICE_LOAD_FAILED' }, 500);
	}
}

async function parseGradeRequest(request: Request): Promise<{ questionKey: string; selectedAnswer: string; selfResult: ApPracticeResult | null } | Response> {
	let payload: { questionKey?: unknown; selectedAnswer?: unknown; selfResult?: unknown };
	try {
		payload = await request.json() as { questionKey?: unknown; selectedAnswer?: unknown; selfResult?: unknown };
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	const questionKey = clean(payload.questionKey);
	const selectedAnswer = clean(payload.selectedAnswer);
	const selfResult = payload.selfResult === 'correct' || payload.selfResult === 'partial' || payload.selfResult === 'wrong'
		? payload.selfResult
		: null;
	if (!questionKey || questionKey.length > 160 || selectedAnswer.length > 4000) {
		return json({ ok: false, error: 'INVALID_ANSWER' }, 400);
	}
	return { questionKey, selectedAnswer, selfResult };
}

function automaticResult(question: ResolvedApQuestion, selectedAnswer: string): ApPracticeResult {
	return clean(selectedAnswer) === clean(question.correctAnswer) ? 'correct' : 'wrong';
}

export async function handleGradePublicApPractice(request: Request, env: Env): Promise<Response> {
	try {
		const parsed = await parseGradeRequest(request);
		if (parsed instanceof Response) return parsed;
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);
		const plan = await ensureDefaultApStudyPlan(env.song_project_db, admin.adminId);
		const question = await resolveQuestion(env.song_project_db, plan.id, parsed.questionKey);
		if (!question) return json({ ok: false, error: 'QUESTION_NOT_FOUND' }, 404);
		if (question.studyDate > japanDateString()) return json({ ok: false, error: 'FUTURE_QUESTION_LOCKED' }, 409);
		if (question.type === 'subject_b' && !parsed.selfResult) {
			return json({
				ok: true,
				persisted: false,
				requiresSelfGrade: true,
				selectedAnswer: parsed.selectedAnswer,
				correctAnswer: question.correctAnswer,
				explanation: question.explanation,
			});
		}
		const result = question.type === 'subject_b' ? parsed.selfResult! : automaticResult(question, parsed.selectedAnswer);
		return json({
			ok: true,
			persisted: false,
			result,
			correct: result === 'correct',
			selectedAnswer: parsed.selectedAnswer,
			correctAnswer: question.correctAnswer,
			explanation: question.explanation,
		});
	} catch (error) {
		console.error('Failed to grade public AP practice', error);
		return json({ ok: false, error: 'AP_PRACTICE_GRADE_FAILED' }, 500);
	}
}

export async function handleGradeAdminApPractice(request: Request, env: Env): Promise<Response> {
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const parsed = await parseGradeRequest(request);
		if (parsed instanceof Response) return parsed;
		const plan = await ensureDefaultApStudyPlan(env.song_project_db, session.adminId);
		const question = await resolveQuestion(env.song_project_db, plan.id, parsed.questionKey);
		if (!question) return json({ ok: false, error: 'QUESTION_NOT_FOUND' }, 404);
		if (question.studyDate > japanDateString()) return json({ ok: false, error: 'FUTURE_QUESTION_LOCKED' }, 409);
		if (question.type === 'subject_b' && !parsed.selfResult) {
			return json({
				ok: true,
				persisted: false,
				requiresSelfGrade: true,
				selectedAnswer: parsed.selectedAnswer,
				correctAnswer: question.correctAnswer,
				explanation: question.explanation,
			});
		}
		const result = question.type === 'subject_b' ? parsed.selfResult! : automaticResult(question, parsed.selectedAnswer);
		const now = new Date().toISOString();
		await env.song_project_db.prepare(`
			INSERT INTO ap_question_attempts
				(admin_id, plan_id, study_date, question_key, question_type, topic_id, prompt,
				 selected_answer, correct_answer, result, attempted_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
		`).bind(
			session.adminId, plan.id, question.studyDate, question.key, question.type, question.topicId,
			question.prompt, parsed.selectedAnswer || null, question.correctAnswer || null, result, now,
		).run();

		let wrongNoteSaved = false;
		let wrongNoteResolved = false;
		if (result === 'wrong' || result === 'partial') {
			await env.song_project_db.prepare(`
				INSERT INTO ap_wrong_notes
					(admin_id, plan_id, question_key, question_type, study_date, topic_id, prompt, options_json,
					 selected_answer, correct_answer, explanation, wrong_count, last_wrong_at, resolved_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, NULL, ?12)
				ON CONFLICT(admin_id, plan_id, question_key) DO UPDATE SET
					question_type = excluded.question_type,
					study_date = excluded.study_date,
					topic_id = excluded.topic_id,
					prompt = excluded.prompt,
					options_json = excluded.options_json,
					selected_answer = excluded.selected_answer,
					correct_answer = excluded.correct_answer,
					explanation = excluded.explanation,
					wrong_count = ap_wrong_notes.wrong_count + 1,
					last_wrong_at = excluded.last_wrong_at,
					resolved_at = NULL,
					updated_at = excluded.updated_at
			`).bind(
				session.adminId, plan.id, question.key, question.type, question.studyDate, question.topicId,
				question.prompt, JSON.stringify(question.options), parsed.selectedAnswer || null,
				question.correctAnswer || null, question.explanation || null, now,
			).run();
			wrongNoteSaved = true;
		} else {
			const open = await env.song_project_db.prepare(`
				SELECT id FROM ap_wrong_notes
				WHERE admin_id = ?1 AND plan_id = ?2 AND question_key = ?3 AND resolved_at IS NULL LIMIT 1
			`).bind(session.adminId, plan.id, question.key).first<{ id: number }>();
			if (open) {
				await env.song_project_db.prepare(`
					UPDATE ap_wrong_notes SET resolved_at = ?2, updated_at = ?2 WHERE id = ?1
				`).bind(open.id, now).run();
				wrongNoteResolved = true;
			}
		}
		await env.song_project_db.prepare(`
			UPDATE ap_daily_contents SET completed_at = COALESCE(completed_at, ?2), updated_at = ?2 WHERE id = ?1
		`).bind(question.contentId, now).run();
		return json({
			ok: true,
			persisted: true,
			result,
			correct: result === 'correct',
			selectedAnswer: parsed.selectedAnswer,
			correctAnswer: question.correctAnswer,
			explanation: question.explanation,
			wrongNoteSaved,
			wrongNoteResolved,
		});
	} catch (error) {
		console.error('Failed to grade admin AP practice', error);
		return json({ ok: false, error: 'AP_PRACTICE_GRADE_FAILED' }, 500);
	}
}

export async function handleListAdminApWrongNotes(request: Request, env: Env): Promise<Response> {
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const plan = await ensureDefaultApStudyPlan(env.song_project_db, session.adminId);
		const url = new URL(request.url);
		const includeResolved = url.searchParams.get('resolved') === 'all';
		const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 10) || 10));
		const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1);
		const offset = (page - 1) * pageSize;
		const count = await env.song_project_db.prepare(`
			SELECT COUNT(*) AS value FROM ap_wrong_notes
			WHERE admin_id = ?1 AND plan_id = ?2 AND (?3 = 1 OR resolved_at IS NULL)
		`).bind(session.adminId, plan.id, includeResolved ? 1 : 0).first<{ value: number }>();
		const total = Number(count?.value ?? 0);
		const result = await env.song_project_db.prepare(`
			SELECT question_key, question_type, study_date, topic_id, prompt, options_json,
				selected_answer, correct_answer, explanation, wrong_count, last_wrong_at, resolved_at
			FROM ap_wrong_notes
			WHERE admin_id = ?1 AND plan_id = ?2 AND (?3 = 1 OR resolved_at IS NULL)
			ORDER BY CASE WHEN resolved_at IS NULL THEN 0 ELSE 1 END, last_wrong_at DESC
			LIMIT ?4 OFFSET ?5
		`).bind(session.adminId, plan.id, includeResolved ? 1 : 0, pageSize, offset).all<ApWrongNoteRow>();
		return json({
			ok: true,
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
			items: result.results.map((row) => ({
				questionKey: row.question_key,
				type: row.question_type,
				studyDate: row.study_date,
				topicId: row.topic_id,
				prompt: row.prompt,
				options: safeOptions(row.options_json ? JSON.parse(row.options_json) : []),
				selectedAnswer: row.selected_answer,
				correctAnswer: row.correct_answer,
				explanation: row.explanation,
				wrongCount: row.wrong_count,
				lastWrongAt: row.last_wrong_at,
				resolvedAt: row.resolved_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list AP wrong notes', error);
		return json({ ok: false, error: 'AP_WRONG_NOTES_LOAD_FAILED' }, 500);
	}
}
