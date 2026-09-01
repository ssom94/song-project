-- 0046_ap_practice_repair_20260901.sql
-- AP practice runtime repair + 2026-09-01 seed.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ap_daily_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  study_date TEXT NOT NULL,
  topic_id INTEGER,
  content_type TEXT NOT NULL CHECK (content_type IN ('concept','concept_question','subject_a_question','subject_b_scenario')),
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  title_ko TEXT,
  title_ja TEXT,
  payload_json TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(plan_id,study_date,content_type,sequence_no),
  FOREIGN KEY(plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ap_daily_contents_date ON ap_daily_contents(plan_id,study_date,content_type,sequence_no);

CREATE TABLE IF NOT EXISTS ap_question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL, plan_id INTEGER NOT NULL,
  study_date TEXT NOT NULL, question_key TEXT NOT NULL, question_type TEXT NOT NULL CHECK(question_type IN ('concept','subject_a','subject_b')),
  topic_id INTEGER, prompt TEXT NOT NULL, selected_answer TEXT, correct_answer TEXT,
  result TEXT NOT NULL CHECK(result IN ('correct','partial','wrong')),
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE, FOREIGN KEY(plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ap_question_attempts_history ON ap_question_attempts(admin_id,plan_id,study_date DESC,attempted_at DESC);

CREATE TABLE IF NOT EXISTS ap_wrong_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL, plan_id INTEGER NOT NULL,
  question_key TEXT NOT NULL, question_type TEXT NOT NULL CHECK(question_type IN ('concept','subject_a','subject_b')),
  study_date TEXT NOT NULL, topic_id INTEGER, prompt TEXT NOT NULL, options_json TEXT, selected_answer TEXT, correct_answer TEXT,
  explanation TEXT, wrong_count INTEGER NOT NULL DEFAULT 1 CHECK(wrong_count > 0), last_wrong_at TEXT NOT NULL, resolved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(admin_id,plan_id,question_key),
  FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE, FOREIGN KEY(plan_id) REFERENCES ap_study_plans(id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id) REFERENCES ap_study_topics(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ap_wrong_notes_open ON ap_wrong_notes(admin_id,plan_id,resolved_at,last_wrong_at DESC);

-- Seed the concept (including its check question).
INSERT OR IGNORE INTO ap_daily_contents(plan_id,study_date,topic_id,content_type,sequence_no,title_ko,title_ja,payload_json)
SELECT p.id,'2026-09-01',t.id,'concept',1,'계산량과 탐색 알고리즘','計算量と探索アルゴリズム',
'{"summary_ko":"알고리즘의 처리량이 입력 크기 n에 따라 어떻게 증가하는지 Big-O로 표현한다. 선형 탐색은 O(n), 정렬된 배열의 이분 탐색은 O(log n), 이중 반복은 보통 O(n²)이다.","summary_ja":"入力サイズnに対する処理量の増え方をBig-Oで表す。線形探索はO(n)、二分探索はO(log n)。","keywords":[{"term":"O(1)","meaning_ko":"입력 크기와 관계없이 일정"},{"term":"O(log n)","meaning_ko":"이분 탐색"},{"term":"O(n)","meaning_ko":"선형 탐색"},{"term":"O(n log n)","meaning_ko":"효율적인 비교 정렬"},{"term":"O(n²)","meaning_ko":"중첩 반복"}],"check":{"question":"昇順に整列済みの要素数1,024の配列を二分探索するとき、最悪の場合の比較回数として最も近いものはどれか。","choices":["10回","32回","512回","1,024回"],"answer":0,"explanation_ko":"2^10=1,024이므로 약 10회다."}}'
FROM ap_study_plans p LEFT JOIN ap_study_topics t ON t.topic_code='programming_algorithms';

-- Subject A 10 questions.
WITH q(seq,topic_code,payload) AS (VALUES
(1,'fundamentals_math','{"question":"2進数101101を10進数で表した値はどれか。","choices":["41","43","45","47"],"answer":2,"explanation_ko":"32+8+4+1=45."}'),
(2,'computer_architecture','{"question":"キャッシュのヒット率90%、キャッシュ10ns、主記憶100nsの平均アクセス時間はどれか。","choices":["19ns","20ns","90ns","100ns"],"answer":0,"explanation_ko":"0.9×10+0.1×100=19ns."}'),
(3,'operating_system','{"question":"仮想記憶で必要なページが主記憶上にないとき発生するものはどれか。","choices":["ページフォールト","デッドロック","スラッシングの終了","コンテキスト固定"],"answer":0,"explanation_ko":"페이지 폴트가 발생한다."}'),
(4,'database','{"question":"ACID特性のうち、トランザクション同士の不当な干渉を防ぐ性質はどれか。","choices":["Atomicity","Consistency","Isolation","Durability"],"answer":2,"explanation_ko":"Isolation은 격리성이다."}'),
(5,'network','{"question":"IPv4のサブネットマスク255.255.255.192でホスト部のビット数は幾つか。","choices":["2","4","6","8"],"answer":2,"explanation_ko":"/26이므로 6비트."}'),
(6,'security','{"question":"パスワードハッシュに利用者ごとのランダム値を加えるものはどれか。","choices":["ソルト","セッションID","ディジタル署名","公開鍵"],"answer":0,"explanation_ko":"솔트다."}'),
(7,'programming_algorithms','{"question":"要素数nの配列を1回走査して最大値を求める時間計算量はどれか。","choices":["O(1)","O(log n)","O(n)","O(n²)"],"answer":2,"explanation_ko":"모든 원소를 한 번 확인하므로 O(n)."}'),
(8,'project_management','{"question":"EVMでPV=100、EV=80、AC=90のCPIはどれか。","choices":["0.80","0.89","1.11","1.25"],"answer":1,"explanation_ko":"CPI=EV/AC≈0.89."}'),
(9,'business_strategy','{"question":"SWOT分析で企業内部の好ましい要因はどれか。","choices":["Strength","Weakness","Opportunity","Threat"],"answer":0,"explanation_ko":"Strength다."}'),
(10,'system_performance','{"question":"直列装置の稼働率が0.99と0.98のときシステム稼働率はどれか。","choices":["0.9702","0.9800","0.9850","0.9998"],"answer":0,"explanation_ko":"0.99×0.98=0.9702."}')
)
INSERT OR IGNORE INTO ap_daily_contents(plan_id,study_date,topic_id,content_type,sequence_no,title_ja,payload_json)
SELECT p.id,'2026-09-01',t.id,'subject_a_question',q.seq,'科目A',q.payload FROM ap_study_plans p CROSS JOIN q LEFT JOIN ap_study_topics t ON t.topic_code=q.topic_code;

INSERT OR IGNORE INTO ap_daily_contents(plan_id,study_date,topic_id,content_type,sequence_no,title_ko,title_ja,payload_json)
SELECT p.id,'2026-09-01',t.id,'subject_b_scenario',1,'너비 우선 탐색 최단거리','幅優先探索による最短距離',
'{"scenario":"頂点0から5までの無向グラフがある。隣接リストは0:[1,2], 1:[0,3,4], 2:[0,4], 3:[1,5], 4:[1,2,5], 5:[3,4]。各辺の長さは1。distの初期値は全要素-1。\nqueue <- empty queue\ndist[s] <- 0\nenqueue(queue,s)\nwhile queue is not empty\n v <- dequeue(queue)\n for each u in adjacency[v]\n  if dist[u] = [a]\n   dist[u] <- dist[v] + [b]\n   [c]\n  endif\n endfor\nendwhile","estimated_minutes":15,"questions":[{"question":"空欄[a]〜[c]に入る内容を書け。","answer":"[a] -1, [b] 1, [c] enqueue(queue, u)","explanation_ko":"미방문 정점을 갱신 후 큐에 넣는다."},{"question":"s=0のときdist[5]はいくつか。","answer":"3","explanation_ko":"최단 간선 수는 3."},{"question":"頂点数V、辺数Eの時間計算量を答えよ。","answer":"O(V+E)","explanation_ko":"각 정점과 간선을 상수 횟수 확인한다."}]}'
FROM ap_study_plans p LEFT JOIN ap_study_topics t ON t.topic_code='programming_algorithms';
