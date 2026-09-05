-- 0077 AP mock exam structured written-answer support
-- Keeps Subject B scenarios/subquestions flexible before actual mock exam content is authored.
PRAGMA foreign_keys = ON;

ALTER TABLE ap_mock_exam_questions ADD COLUMN content_json TEXT;
ALTER TABLE ap_mock_exam_questions ADD COLUMN grading_schema_json TEXT;
ALTER TABLE ap_mock_exam_answers ADD COLUMN answer_json TEXT;
