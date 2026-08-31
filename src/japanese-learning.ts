import { getAuthenticatedAdminSession } from './auth/session';

export type JapaneseLearningState = 'mastered' | 'uncertain' | 'unlearned';

export interface LearningAdminContext {
	adminId: number | null;
	username: string | null;
	displayName: string | null;
	fromSession: boolean;
}

export async function ensureJapaneseAdminLearningStatsSchema(db: D1Database): Promise<void> {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS japanese_admin_word_learning_stats (
			admin_id INTEGER NOT NULL,
			word_id INTEGER NOT NULL,
			learning_state TEXT NOT NULL DEFAULT 'unlearned'
				CHECK (learning_state IN ('mastered', 'uncertain', 'unlearned')),
			correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
			wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
			last_answered_at TEXT,
			last_correct_at TEXT,
			last_wrong_at TEXT,
			first_learned_at TEXT,
			last_studied_at TEXT,
			review_stage INTEGER NOT NULL DEFAULT 0 CHECK (review_stage BETWEEN 0 AND 6),
			next_review_on TEXT,
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			PRIMARY KEY (admin_id, word_id),
			FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
			FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE
		)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_admin_learning_state
		ON japanese_admin_word_learning_stats(admin_id, learning_state, updated_at)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_admin_learning_word
		ON japanese_admin_word_learning_stats(word_id, admin_id)
	`).run();
}

export async function resolveLearningAdmin(
	request: Request,
	db: D1Database,
): Promise<LearningAdminContext> {
	const session = await getAuthenticatedAdminSession(request, db);
	if (session) {
		return {
			adminId: session.adminId,
			username: session.username,
			displayName: session.displayName,
			fromSession: true,
		};
	}

	const fallback = await db.prepare(`
		SELECT id, username, display_name
		FROM admins
		WHERE status = 'active'
		ORDER BY id ASC
		LIMIT 1
	`).first<{ id: number; username: string; display_name: string }>();

	return fallback
		? {
			adminId: fallback.id,
			username: fallback.username,
			displayName: fallback.display_name,
			fromSession: false,
		}
		: {
			adminId: null,
			username: null,
			displayName: null,
			fromSession: false,
		};
}