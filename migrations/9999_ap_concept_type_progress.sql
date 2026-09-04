CREATE TABLE IF NOT EXISTS ap_concept_type_progress (
  admin_id INTEGER NOT NULL,
  problem_type_id INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id, problem_type_id),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_type_id) REFERENCES ap_concept_problem_types(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ap_concept_type_progress_admin
  ON ap_concept_type_progress(admin_id, problem_type_id);
