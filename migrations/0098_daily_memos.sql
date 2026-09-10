CREATE TABLE IF NOT EXISTS admin_daily_memos (
  admin_id INTEGER NOT NULL,
  memo_date TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (admin_id, memo_date),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
