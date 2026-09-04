import type { JlptStudyPlanRow } from './jlpt-study';

const PLAN_COLUMNS = `id,admin_id,plan_code,jlpt_level_code,study_start_date,target_exam_date,target_date_is_tentative,target_word_count,daily_new_word_target,vocab_question_target,grammar_target,reading_target,is_active`;

/** Read-only lookup for GET endpoints. Never creates schema, inserts plans, or updates rows. */
export async function loadJlptStudyPlanReadOnly(db: D1Database, adminId: number): Promise<JlptStudyPlanRow | null> {
	const preferred = await db
		.prepare(`SELECT ${PLAN_COLUMNS} FROM japanese_jlpt_study_plans WHERE admin_id=?1 AND plan_code='N1_2027_JUL' LIMIT 1`)
		.bind(adminId)
		.first<JlptStudyPlanRow>();
	if (preferred) return preferred;

	return db
		.prepare(`SELECT ${PLAN_COLUMNS} FROM japanese_jlpt_study_plans WHERE admin_id=?1 AND is_active=1 ORDER BY id ASC LIMIT 1`)
		.bind(adminId)
		.first<JlptStudyPlanRow>();
}
