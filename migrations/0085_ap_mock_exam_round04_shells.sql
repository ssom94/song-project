-- 0085 AP mock exam round 4 shells
-- Prepare 科目A/B 第4回 before generated question migrations are applied.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO ap_mock_exams(
  subject, exam_no, title_ko, title_ja, duration_minutes,
  question_count_target, answer_count_target, loaded_question_count,
  total_score, passing_score, status
) VALUES
('A',4,'과목A 모의고사 4회','科目A 模擬試験 第4回',150,80,80,0,100,60,'draft'),
('B',4,'과목B 모의고사 4회','科目B 模擬試験 第4回',150,11,5,0,100,60,'draft');
