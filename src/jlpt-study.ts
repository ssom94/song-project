import { ensureJapaneseAdminLearningStatsSchema, type JapaneseLearningState } from './japanese-learning';

export const DEFAULT_JLPT_PLAN_CODE = 'N1_2027_JUL';
export const DEFAULT_JLPT_STUDY_START_DATE = '2026-09-07';
// 2027년 공식 JLPT 일정 발표 전까지 첫째 일요일을 임시 목표일로 사용한다.
export const DEFAULT_JLPT_TARGET_EXAM_DATE = '2027-07-04';
export const DEFAULT_JLPT_TARGET_WORD_COUNT = 3000;
export const DEFAULT_JLPT_DAILY_NEW_WORDS = 20;
export const DEFAULT_JLPT_VOCAB_QUESTIONS = 15;
export const DEFAULT_JLPT_GRAMMAR_TARGET = 2;
export const DEFAULT_JLPT_READING_TARGET = 1;
export const DEFAULT_JLPT_MAINTENANCE_REVIEW_TARGET = 10;
export const DEFAULT_JLPT_WEEKLY_TEST_TARGET = 30;
export const DEFAULT_JLPT_MONTHLY_TEST_TARGET = 100;

export interface JlptStudyPlanRow {
	id: number;
	admin_id: number;
	plan_code: string;
	jlpt_level_code: string;
	study_start_date: string;
	target_exam_date: string;
	target_date_is_tentative: number;
	target_word_count: number;
	daily_new_word_target: number;
	vocab_question_target: number;
	grammar_target: number;
	reading_target: number;
	is_active: number;
}

export interface LearningProgressRow {
	learning_state: JapaneseLearningState;
	first_learned_at: string | null;
	last_studied_at: string | null;
	review_stage: number;
	long_review_stage: number;
	next_review_on: string | null;
}

const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

export async function ensureJapaneseJlptStudySchema(db: D1Database): Promise<void> {
	await ensureJapaneseAdminLearningStatsSchema(db);
	await db.batch([
		db.prepare(`CREATE TABLE IF NOT EXISTS japanese_jlpt_study_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL, plan_code TEXT NOT NULL, jlpt_level_code TEXT NOT NULL DEFAULT 'N1' CHECK (jlpt_level_code IN ('N1','N2','N3','N4','N5')), study_start_date TEXT NOT NULL, target_exam_date TEXT NOT NULL, target_date_is_tentative INTEGER NOT NULL DEFAULT 1 CHECK (target_date_is_tentative IN (0,1)), target_word_count INTEGER NOT NULL DEFAULT 3000 CHECK (target_word_count>0), daily_new_word_target INTEGER NOT NULL DEFAULT 20 CHECK (daily_new_word_target BETWEEN 0 AND 200), vocab_question_target INTEGER NOT NULL DEFAULT 15 CHECK (vocab_question_target BETWEEN 0 AND 200), grammar_target INTEGER NOT NULL DEFAULT 2 CHECK (grammar_target BETWEEN 0 AND 50), reading_target INTEGER NOT NULL DEFAULT 1 CHECK (reading_target BETWEEN 0 AND 20), is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(admin_id,plan_code), FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE)`),
		db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_japanese_jlpt_active_plan ON japanese_jlpt_study_plans(admin_id) WHERE is_active = 1`),
		db.prepare(`CREATE TABLE IF NOT EXISTS japanese_jlpt_curriculum_words (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL, word_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, introduced_on TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(plan_id,word_id), UNIQUE(plan_id,sort_order), FOREIGN KEY(plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE, FOREIGN KEY(word_id) REFERENCES japanese_words(id) ON DELETE CASCADE)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_curriculum_date ON japanese_jlpt_curriculum_words(plan_id,introduced_on,sort_order)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS japanese_jlpt_daily_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL, study_date TEXT NOT NULL, review_target INTEGER NOT NULL DEFAULT 0 CHECK(review_target>=0), new_word_target INTEGER NOT NULL DEFAULT 20 CHECK(new_word_target>=0), vocab_question_target INTEGER NOT NULL DEFAULT 15 CHECK(vocab_question_target>=0), grammar_target INTEGER NOT NULL DEFAULT 2 CHECK(grammar_target>=0), reading_target INTEGER NOT NULL DEFAULT 1 CHECK(reading_target>=0), review_completed INTEGER NOT NULL DEFAULT 0 CHECK(review_completed>=0), new_word_completed INTEGER NOT NULL DEFAULT 0 CHECK(new_word_completed>=0), vocab_question_completed INTEGER NOT NULL DEFAULT 0 CHECK(vocab_question_completed>=0), grammar_completed INTEGER NOT NULL DEFAULT 0 CHECK(grammar_completed>=0), reading_completed INTEGER NOT NULL DEFAULT 0 CHECK(reading_completed>=0), status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','completed')), started_at TEXT, completed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(plan_id,study_date), FOREIGN KEY(plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_daily_sessions_date ON japanese_jlpt_daily_sessions(plan_id,study_date DESC)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS japanese_jlpt_daily_words (session_id INTEGER NOT NULL, word_id INTEGER NOT NULL, item_kind TEXT NOT NULL CHECK(item_kind IN ('review','new')), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')), state_before TEXT CHECK(state_before IS NULL OR state_before IN ('mastered','uncertain','unlearned')), state_after TEXT CHECK(state_after IS NULL OR state_after IN ('mastered','uncertain','unlearned')), completed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(session_id,word_id,item_kind), FOREIGN KEY(session_id) REFERENCES japanese_jlpt_daily_sessions(id) ON DELETE CASCADE, FOREIGN KEY(word_id) REFERENCES japanese_words(id) ON DELETE CASCADE)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_daily_words_status ON japanese_jlpt_daily_words(session_id,item_kind,status)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS japanese_jlpt_daily_contents (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL, study_date TEXT NOT NULL, content_type TEXT NOT NULL CHECK(content_type IN ('vocab_question','grammar','grammar_question','reading')), sequence_no INTEGER NOT NULL CHECK(sequence_no>0), title TEXT, payload_json TEXT NOT NULL, completed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(plan_id,study_date,content_type,sequence_no), FOREIGN KEY(plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_daily_contents_date ON japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no)`),
	]);
}

export async function ensureDefaultJlptStudyPlan(db: D1Database, adminId: number): Promise<JlptStudyPlanRow> {
	await ensureJapaneseJlptStudySchema(db);
	const now = new Date().toISOString();
	await db.prepare(`INSERT OR IGNORE INTO japanese_jlpt_study_plans (admin_id,plan_code,jlpt_level_code,study_start_date,target_exam_date,target_date_is_tentative,target_word_count,daily_new_word_target,vocab_question_target,grammar_target,reading_target,is_active,created_at,updated_at) VALUES (?1,?2,'N1',?3,?4,1,?5,?6,?7,?8,?9,1,?10,?10)`).bind(adminId,DEFAULT_JLPT_PLAN_CODE,DEFAULT_JLPT_STUDY_START_DATE,DEFAULT_JLPT_TARGET_EXAM_DATE,DEFAULT_JLPT_TARGET_WORD_COUNT,DEFAULT_JLPT_DAILY_NEW_WORDS,DEFAULT_JLPT_VOCAB_QUESTIONS,DEFAULT_JLPT_GRAMMAR_TARGET,DEFAULT_JLPT_READING_TARGET,now).run();
	const plan = await db.prepare(`SELECT id,admin_id,plan_code,jlpt_level_code,study_start_date,target_exam_date,target_date_is_tentative,target_word_count,daily_new_word_target,vocab_question_target,grammar_target,reading_target,is_active FROM japanese_jlpt_study_plans WHERE admin_id=?1 AND plan_code=?2 LIMIT 1`).bind(adminId,DEFAULT_JLPT_PLAN_CODE).first<JlptStudyPlanRow>();
	if (plan) return plan;
	const active = await db.prepare(`SELECT id,admin_id,plan_code,jlpt_level_code,study_start_date,target_exam_date,target_date_is_tentative,target_word_count,daily_new_word_target,vocab_question_target,grammar_target,reading_target,is_active FROM japanese_jlpt_study_plans WHERE admin_id=?1 AND is_active=1 ORDER BY id ASC LIMIT 1`).bind(adminId).first<JlptStudyPlanRow>();
	if (!active) throw new Error('JLPT_STUDY_PLAN_NOT_AVAILABLE');
	return active;
}

export function japanDateString(date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part)=>[part.type,part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}
export function addDays(dateText:string,days:number):string { const base=Date.parse(`${dateText}T00:00:00+09:00`); if(Number.isNaN(base)) return dateText; return japanDateString(new Date(base+days*86_400_000)); }
export function daysBetween(fromDate:string,toDate:string):number { const from=Date.parse(`${fromDate}T00:00:00+09:00`); const to=Date.parse(`${toDate}T00:00:00+09:00`); if(Number.isNaN(from)||Number.isNaN(to)) return 0; return Math.ceil((to-from)/86_400_000); }
export function validDateText(value:unknown):string|null { if(typeof value!=='string') return null; const text=value.trim(); if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const parsed=Date.parse(`${text}T00:00:00+09:00`); return Number.isNaN(parsed)?null:text; }
export function nextReview(current:LearningProgressRow|null,nextState:JapaneseLearningState,studyDate:string) { const firstStudy=!current?.first_learned_at; if(nextState!=='mastered') return {reviewStage:0,longReviewStage:0,nextReviewOn:addDays(studyDate,1)}; const currentStage=Math.max(0,Math.min(6,Number(current?.review_stage??0))); const currentLongStage=Math.max(0,Math.min(2,Number(current?.long_review_stage??0))); if(firstStudy) return {reviewStage:1,longReviewStage:0,nextReviewOn:addDays(studyDate,1)}; if(currentStage<6){const nextStage=currentStage+1;const interval=REVIEW_INTERVAL_DAYS[nextStage-1]??60;return {reviewStage:nextStage,longReviewStage:0,nextReviewOn:addDays(studyDate,interval)}} if(currentLongStage===0)return{reviewStage:6,longReviewStage:1,nextReviewOn:addDays(studyDate,90)}; return{reviewStage:6,longReviewStage:2,nextReviewOn:addDays(studyDate,180)}; }
export async function enrollWordsInJlptPlan(db:D1Database,planId:number,wordIds:number[],introducedOn:string):Promise<{added:number;already:number}>{const uniqueIds=[...new Set(wordIds.filter((id)=>Number.isSafeInteger(id)&&id>0))];if(!uniqueIds.length)return{added:0,already:0};const maxRow=await db.prepare(`SELECT COALESCE(MAX(sort_order),0) AS max_order FROM japanese_jlpt_curriculum_words WHERE plan_id=?1`).bind(planId).first<{max_order:number}>();let nextOrder=Number(maxRow?.max_order??0)+1;let added=0;let already=0;for(const wordId of uniqueIds){const existing=await db.prepare(`SELECT id FROM japanese_jlpt_curriculum_words WHERE plan_id=?1 AND word_id=?2 LIMIT 1`).bind(planId,wordId).first<{id:number}>();if(existing){already+=1;await db.prepare(`UPDATE japanese_jlpt_curriculum_words SET introduced_on=COALESCE(introduced_on,?3) WHERE plan_id=?1 AND word_id=?2`).bind(planId,wordId,introducedOn).run();continue;}await db.prepare(`INSERT INTO japanese_jlpt_curriculum_words(plan_id,word_id,sort_order,introduced_on) VALUES(?1,?2,?3,?4)`).bind(planId,wordId,nextOrder,introducedOn).run();nextOrder+=1;added+=1;}return{added,already};}
