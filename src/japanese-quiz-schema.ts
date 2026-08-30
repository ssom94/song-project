export async function ensureJapaneseQuizHistorySchema(db: D1Database): Promise<void> {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS japanese_quiz_sessions (
			id INTEGER PRIMARY KEY,
			admin_id INTEGER NOT NULL,
			settings_json TEXT NOT NULL,
			question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
			correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
			wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
			status TEXT NOT NULL DEFAULT 'active'
				CHECK (status IN ('active', 'completed', 'abandoned')),
			started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			completed_at TEXT,
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
		)
	`).run();

	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_quiz_sessions_admin_status
		ON japanese_quiz_sessions(admin_id, status)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_quiz_sessions_started_at
		ON japanese_quiz_sessions(started_at)
	`).run();

	await db.prepare(`
		CREATE TABLE IF NOT EXISTS japanese_quiz_attempts (
			id INTEGER PRIMARY KEY,
			session_id INTEGER NOT NULL,
			word_id INTEGER NOT NULL,
			example_id INTEGER,
			question_type TEXT NOT NULL
				CHECK (question_type IN ('reading', 'meaning_ko', 'sentence_blank')),
			answer_mode TEXT NOT NULL
				CHECK (answer_mode IN ('input', 'choice')),
			prompt_text TEXT NOT NULL,
			expected_answer TEXT NOT NULL,
			answer_text TEXT NOT NULL,
			is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
			answered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			FOREIGN KEY (session_id) REFERENCES japanese_quiz_sessions(id) ON DELETE CASCADE,
			FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE,
			FOREIGN KEY (example_id) REFERENCES japanese_word_examples(id) ON DELETE SET NULL
		)
	`).run();

	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_quiz_attempts_session_id
		ON japanese_quiz_attempts(session_id, answered_at)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_quiz_attempts_word_id
		ON japanese_quiz_attempts(word_id, answered_at)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_quiz_attempts_answered_at
		ON japanese_quiz_attempts(answered_at)
	`).run();
}
