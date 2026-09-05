-- 0076 AP mock exam foundation
-- Page/attempt/result infrastructure first; actual mock-exam questions are added later.
-- Uniqueness constraints prevent duplicate rounds and duplicate questions.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ap_mock_exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL CHECK (subject IN ('A','B')),
  exam_no INTEGER NOT NULL CHECK (exam_no > 0),
  title_ko TEXT NOT NULL,
  title_ja TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  question_count_target INTEGER NOT NULL CHECK (question_count_target > 0),
  answer_count_target INTEGER NOT NULL CHECK (answer_count_target > 0),
  loaded_question_count INTEGER NOT NULL DEFAULT 0 CHECK (loaded_question_count >= 0),
  total_score INTEGER NOT NULL DEFAULT 100 CHECK (total_score > 0),
  passing_score INTEGER NOT NULL DEFAULT 60 CHECK (passing_score >= 0 AND passing_score <= total_score),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(subject, exam_no)
);

CREATE INDEX IF NOT EXISTS idx_ap_mock_exams_subject_status
ON ap_mock_exams(subject, status, exam_no);

CREATE TABLE IF NOT EXISTS ap_mock_exam_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mock_exam_id INTEGER NOT NULL,
  question_no INTEGER NOT NULL CHECK (question_no > 0),
  section_code TEXT,
  question_type TEXT NOT NULL CHECK (question_type IN ('choice4','written')),
  prompt_ko TEXT NOT NULL,
  prompt_ja TEXT NOT NULL,
  choices_ko_json TEXT,
  choices_ja_json TEXT,
  correct_choice INTEGER,
  model_answer_ko TEXT,
  model_answer_ja TEXT,
  explanation_ko TEXT NOT NULL,
  explanation_ja TEXT NOT NULL,
  max_score REAL NOT NULL CHECK (max_score > 0),
  is_mandatory INTEGER NOT NULL DEFAULT 0 CHECK (is_mandatory IN (0,1)),
  source_concept_code TEXT,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (mock_exam_id) REFERENCES ap_mock_exams(id) ON DELETE CASCADE,
  UNIQUE(mock_exam_id, question_no),
  UNIQUE(fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_ap_mock_exam_questions_exam_no
ON ap_mock_exam_questions(mock_exam_id, question_no);

CREATE INDEX IF NOT EXISTS idx_ap_mock_exam_questions_concept
ON ap_mock_exam_questions(source_concept_code, mock_exam_id);

CREATE TABLE IF NOT EXISTS ap_mock_exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mock_exam_id INTEGER NOT NULL,
  admin_id INTEGER NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','graded')),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  submitted_at TEXT,
  graded_at TEXT,
  score REAL,
  max_score REAL,
  answered_count INTEGER NOT NULL DEFAULT 0 CHECK (answered_count >= 0),
  selected_question_nos_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (mock_exam_id) REFERENCES ap_mock_exams(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  UNIQUE(mock_exam_id, admin_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_ap_mock_attempts_latest
ON ap_mock_exam_attempts(admin_id, mock_exam_id, attempt_no DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ap_mock_attempt_one_in_progress
ON ap_mock_exam_attempts(mock_exam_id, admin_id)
WHERE status='in_progress';

CREATE TABLE IF NOT EXISTS ap_mock_exam_answers (
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  selected_choice INTEGER,
  answer_text TEXT,
  result TEXT CHECK (result IN ('correct','partial','wrong')),
  awarded_score REAL,
  graded_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES ap_mock_exam_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES ap_mock_exam_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ap_mock_answers_question
ON ap_mock_exam_answers(question_id, attempt_id);

-- Prepare three empty rounds for each subject.
-- Actual questions are intentionally not inserted in this migration.
INSERT OR IGNORE INTO ap_mock_exams(
  subject, exam_no, title_ko, title_ja, duration_minutes,
  question_count_target, answer_count_target, loaded_question_count,
  total_score, passing_score, status
) VALUES
('A',1,'과목A 모의고사 1회','科目A 模擬試験 第1回',150,80,80,0,100,60,'draft'),
('A',2,'과목A 모의고사 2회','科目A 模擬試験 第2回',150,80,80,0,100,60,'draft'),
('A',3,'과목A 모의고사 3회','科目A 模擬試験 第3回',150,80,80,0,100,60,'draft'),
('B',1,'과목B 모의고사 1회','科目B 模擬試験 第1回',150,11,5,0,100,60,'draft'),
('B',2,'과목B 모의고사 2회','科目B 模擬試験 第2回',150,11,5,0,100,60,'draft'),
('B',3,'과목B 모의고사 3회','科目B 模擬試験 第3回',150,11,5,0,100,60,'draft');
