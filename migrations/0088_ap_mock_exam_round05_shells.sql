-- 0088 AP mock exam round 5 shells
-- Prepare 科目A/B 第5回 before generated question migrations are applied.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO ap_mock_exams(
  subject, exam_no, title_ko, title_ja, duration_minutes,
  question_count_target, answer_count_target, loaded_question_count,
  total_score, passing_score, status
) VALUES
('A',5,'과목A 모의고사 5회','科目A 模擬試験 第5回',150,80,80,0,100,60,'draft'),
('B',5,'과목B 모의고사 5회','科目B 模擬試験 第5回',150,11,5,0,100,60,'draft');
