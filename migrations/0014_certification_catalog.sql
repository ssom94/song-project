-- 0014_certification_catalog.sql
-- 자격증/시험 정보 카탈로그 및 일정/출제범위

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL,
    category TEXT NOT NULL,
    title_ja TEXT NOT NULL,
    title_ko TEXT NOT NULL,
    subtitle_ja TEXT,
    subtitle_ko TEXT,
    provider_ja TEXT NOT NULL,
    provider_ko TEXT NOT NULL,
    summary_ja TEXT NOT NULL,
    summary_ko TEXT NOT NULL,
    exam_mode_ja TEXT NOT NULL,
    exam_mode_ko TEXT NOT NULL,
    fee_ja TEXT NOT NULL,
    fee_ko TEXT NOT NULL,
    duration_ja TEXT,
    duration_ko TEXT,
    questions_ja TEXT,
    questions_ko TEXT,
    pass_ja TEXT,
    pass_ko TEXT,
    official_url TEXT NOT NULL,
    guide_url TEXT,
    accent_key TEXT NOT NULL DEFAULT 'blue',
    source_checked_at TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS certification_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certification_id INTEGER NOT NULL,
    sequence_no INTEGER NOT NULL,
    label_ja TEXT NOT NULL,
    label_ko TEXT NOT NULL,
    application_ja TEXT,
    application_ko TEXT,
    exam_ja TEXT NOT NULL,
    exam_ko TEXT NOT NULL,
    result_ja TEXT,
    result_ko TEXT,
    note_ja TEXT,
    note_ko TEXT,
    date_start TEXT,
    date_end TEXT,
    is_announced INTEGER NOT NULL DEFAULT 1 CHECK (is_announced IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE,
    UNIQUE (certification_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS certification_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certification_id INTEGER NOT NULL,
    topic_type TEXT NOT NULL CHECK (topic_type IN ('format', 'domain', 'concept', 'study')),
    title_ja TEXT NOT NULL,
    title_ko TEXT NOT NULL,
    description_ja TEXT,
    description_ko TEXT,
    meta_ja TEXT,
    meta_ko TEXT,
    weight_percent INTEGER CHECK (weight_percent IS NULL OR (weight_percent >= 0 AND weight_percent <= 100)),
    display_order INTEGER NOT NULL DEFAULT 100,
    FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_certifications_display
    ON certifications(is_active, display_order, id);
CREATE INDEX IF NOT EXISTS idx_certification_schedules_cert
    ON certification_schedules(certification_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_certification_topics_cert
    ON certification_topics(certification_id, topic_type, display_order);

INSERT OR IGNORE INTO certifications (
    slug, code, category, title_ja, title_ko, subtitle_ja, subtitle_ko,
    provider_ja, provider_ko, summary_ja, summary_ko,
    exam_mode_ja, exam_mode_ko, fee_ja, fee_ko, duration_ja, duration_ko,
    questions_ja, questions_ko, pass_ja, pass_ko,
    official_url, guide_url, accent_key, source_checked_at, display_order
) VALUES
('jlpt-n1', 'N1', 'language', '日本語能力試験 N1', 'JLPT N1', 'Japanese-Language Proficiency Test', '일본어능력시험 최고 레벨',
 '日本国際教育支援協会 / 国際交流基金', '일본국제교육지원협회 / 국제교류기금',
 '高度な日本語の語彙・文法・読解・聴解力を総合的に測る試験。', '고급 일본어의 어휘·문법·독해·청해 능력을 종합적으로 평가하는 시험.',
 '会場・筆記式', '시험장·지필식', '7,500円', '7,500엔', '110分 + 55分', '110분 + 55분',
 '言語知識・読解 / 聴解', '언어지식·독해 / 청해', '総合100/180以上 + 各区分19/60以上', '총점 100/180 이상 + 각 영역 19/60 이상',
 'https://info.jees-jlpt.jp/', 'https://www.jlpt.jp/guideline/testsections.html', 'rose', '2026-08-30', 10),

('ap', 'AP', 'it', '応用情報技術者試験', '응용정보기술자시험 AP', 'Applied Information Technology Engineer Examination', '일본 정보처리기술자 국가시험',
 'IPA 独立行政法人 情報処理推進機構', 'IPA 정보처리추진기구',
 '技術・マネジメント・ストラテジを横断し、応用レベルのIT知識と記述力を問う国家試験。', '기술·매니지먼트·전략을 아우르는 응용 수준의 IT 지식과 서술 능력을 평가하는 국가시험.',
 'CBT（会場）', 'CBT(시험장)', '7,500円', '7,500엔', '科目A 150分 / 科目B 150分', '과목 A 150분 / 과목 B 150분',
 'A: 80問 / B: 11問中5問', 'A: 80문제 / B: 11문제 중 5문제', '各科目60%以上が目安', '각 과목 60% 이상 기준',
 'https://www.ipa.go.jp/shiken/kubun/ap.html', 'https://www.ipa.go.jp/shiken/syllabus/gaiyou.html', 'blue', '2026-08-30', 20),

('fp3', 'FP3', 'finance', '3級FP技能検定', 'FP 3급 기능검정', 'Financial Planning Skills Test Grade 3', '파이낸셜 플래닝 입문 국가검정',
 '日本FP協会', '일본FP협회',
 'ライフプラン、保険、金融資産、税、不動産、相続の基礎を横断的に学ぶCBT試験。', '라이프플랜·보험·금융자산·세금·부동산·상속의 기초를 폭넓게 다루는 CBT 시험.',
 'CBT（随時予約）', 'CBT(상시 예약)', '学科+実技 8,000円', '학과+실기 8,000엔', '学科90分 / 実技60分', '학과 90분 / 실기 60분',
 '学科60問 / 実技20問', '학과 60문제 / 실기 20문제', '学科36/60以上・実技60/100以上', '학과 36/60 이상·실기 60/100 이상',
 'https://www.jafp.or.jp/exam/', 'https://www.jafp.or.jp/exam/outline/', 'green', '2026-08-30', 30),

('fp2', 'FP2', 'finance', '2級FP技能検定', 'FP 2급 기능검정', 'Financial Planning Skills Test Grade 2', '파이낸셜 플래닝 실무형 국가검정',
 '日本FP協会', '일본FP협회',
 'FP3級より実務的な計算・判断を含み、個人向け資産設計の知識を総合的に問うCBT試験。', 'FP 3급보다 실무적인 계산·판단을 포함해 개인 자산설계 지식을 종합적으로 평가하는 CBT 시험.',
 'CBT（随時予約）', 'CBT(상시 예약)', '学科+実技 11,700円', '학과+실기 11,700엔', '学科120分 / 実技90分', '학과 120분 / 실기 90분',
 '学科60問 / 実技40問', '학과 60문제 / 실기 40문제', '学科36/60以上・実技60/100以上', '학과 36/60 이상·실기 60/100 이상',
 'https://www.jafp.or.jp/exam/', 'https://www.jafp.or.jp/exam/outline/', 'teal', '2026-08-30', 40),

('aws-saa', 'SAA-C03', 'cloud', 'AWS Solutions Architect - Associate', 'AWS Solutions Architect - Associate', 'AWS Certified Solutions Architect - Associate', 'AWS 클라우드 아키텍처 Associate 자격',
 'Amazon Web Services', 'Amazon Web Services',
 'AWS上で安全性・可用性・性能・コストを考慮したアーキテクチャ設計力を検証する認定試験。', 'AWS에서 보안·가용성·성능·비용을 고려한 아키텍처 설계 능력을 검증하는 자격시험.',
 'Pearson VUE / オンライン監督', 'Pearson VUE / 온라인 감독', '150 USD', '150 USD', '130分', '130분',
 '65問（択一・複数選択）', '65문제(단일·복수 선택)', '720 / 1,000', '720 / 1,000',
 'https://aws.amazon.com/jp/certification/certified-solutions-architect-associate/', 'https://docs.aws.amazon.com/ja_jp/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html', 'orange', '2026-08-30', 50);

-- JLPT N1 schedules
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced)
SELECT id, 1, '2026年第2回', '2026년 제2회', '2026/08/24 ～ 09/07 17:00', '2026/08/24 ~ 09/07 17:00', '2026/12/06（日） N1開始 09:10', '2026/12/06(일) N1 시작 09:10', NULL, NULL, '国内受験。47都道府県で実施予定。', '일본 국내 응시. 47개 도도부현 실시 예정.', '2026-12-06', '2026-12-06', 1 FROM certifications WHERE slug='jlpt-n1';
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, note_ja, note_ko, is_announced)
SELECT id, 2, '2027年第1回', '2027년 제1회', '未発表', '미발표', '公式日程 未発表', '공식 일정 미발표', '推定日ではなく公式発表後に更新します。', '추정 날짜를 사용하지 않고 공식 발표 후 갱신합니다.', 0 FROM certifications WHERE slug='jlpt-n1';

-- AP schedules
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced)
SELECT id, 1, '2026年度 前期', '2026년도 전기', '2026/10/06 10:00 ～ 11/07 17:00', '2026/10/06 10:00 ~ 11/07 17:00', '科目A 10/28～11/10 · 科目B 11/24～12/06', '과목 A 10/28~11/10 · 과목 B 11/24~12/06', '2027年2月頃予定', '2027년 2월경 예정', '科目A・Bは別期間で受験。', '과목 A·B는 서로 다른 기간에 응시.', '2026-10-28', '2026-12-06', 1 FROM certifications WHERE slug='ap';
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced)
SELECT id, 2, '2026年度 後期', '2026년도 후기', '2027/01/27 ～ 02/16', '2027/01/27 ~ 02/16', '科目A 02/06～02/19 · 科目B 03/03～03/15', '과목 A 02/06~02/19 · 과목 B 03/03~03/15', '2027年6月頃予定', '2027년 6월경 예정', 'CBT会場から日時を選択。', 'CBT 시험장에서 날짜·시간 선택.', '2027-02-06', '2027-03-15', 1 FROM certifications WHERE slug='ap';

-- FP schedules: current window + next two windows. Same windows for 2/3 grade.
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced)
SELECT id, 1, '2026年8月', '2026년 8월', '随時受付', '상시 접수', '2026/08/01 ～ 08/31', '2026/08/01 ~ 08/31', '2026/09/15', '2026/09/15', 'テストセンターの空席から選択。', '테스트센터 빈 좌석에서 선택.', '2026-08-01', '2026-08-31', 1 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced)
SELECT id, 2, '2026年9月', '2026년 9월', '随時受付', '상시 접수', '2026/09/01 ～ 09/30', '2026/09/01 ~ 09/30', '2026/10/16', '2026/10/16', 'テストセンターの空席から選択。', '테스트센터 빈 좌석에서 선택.', '2026-09-01', '2026-09-30', 1 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, result_ja, result_ko, note_ja, note_ko, date_start, date_end, is_announced)
SELECT id, 3, '2026年10月', '2026년 10월', '随時受付', '상시 접수', '2026/10/01 ～ 10/31', '2026/10/01 ~ 10/31', '2026/11/17', '2026/11/17', 'テストセンターの空席から選択。', '테스트센터 빈 좌석에서 선택.', '2026-10-01', '2026-10-31', 1 FROM certifications WHERE slug IN ('fp2','fp3');

-- AWS schedule
INSERT OR IGNORE INTO certification_schedules (certification_id, sequence_no, label_ja, label_ko, application_ja, application_ko, exam_ja, exam_ko, note_ja, note_ko, is_announced)
SELECT id, 1, '随時予約', '상시 예약', 'Pearson VUEで予約', 'Pearson VUE에서 예약', '空席のある日時から選択', '예약 가능한 날짜·시간에서 선택', 'テストセンターまたはオンライン監督付き試験。', '테스트센터 또는 온라인 감독 시험.', 1 FROM certifications WHERE slug='aws-saa';

-- JLPT formats / domains / study concepts
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','言語知識・読解','언어지식·독해','文字・語彙・文法と読解を一続きの試験時間で解答。','문자·어휘·문법과 독해를 한 시험시간 안에서 풀이.','110分','110분',10 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','聴解','청해','課題理解、ポイント理解、概要理解、即時応答、統合理解。','과제 이해, 포인트 이해, 개요 이해, 즉시응답, 통합 이해.','55分','55분',20 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','文字・語彙','문자·어휘','漢字の読み、文脈に合う語彙、言い換え、用法を確認。','한자 읽기, 문맥에 맞는 어휘, 유의표현, 용법을 확인.',10 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','文法','문법','文の組み立て、文章の流れ、自然な接続を重視。','문장 구성, 글의 흐름, 자연스러운 연결을 중점적으로 학습.',20 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','読解','독해','短文から長文、主張・理由・情報検索まで幅広く対応。','단문부터 장문, 주장·이유·정보검색까지 폭넓게 대응.',30 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','聴解','청해','会話の目的、要点、話者の意図、統合情報を聞き取る。','대화 목적, 핵심, 화자의 의도, 통합 정보를 듣고 판단.',40 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','語彙は文脈で覚える','어휘는 문맥으로 암기','単語単体ではなく例文・類義語・使い分けまでセットで復習。','단어만 외우지 말고 예문·유의어·쓰임 차이까지 묶어서 복습.',10 FROM certifications WHERE slug='jlpt-n1';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','長文は設問先読み','장문은 질문 먼저 확인','何を探す文章かを把握してから本文を読む練習が有効。','무엇을 찾아야 하는 글인지 확인한 뒤 본문을 읽는 연습이 유효.',20 FROM certifications WHERE slug='jlpt-n1';

-- AP formats / domains / study
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','科目A','과목 A','四肢択一。テクノロジ・マネジメント・ストラテジを横断。','4지선다. 테크놀로지·매니지먼트·전략 영역을 폭넓게 출제.','150分 · 80問','150분 · 80문제',10 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','科目B','과목 B','記述式。11問から5問を選択して解答。','서술형. 11문제 중 5문제를 선택해 답안 작성.','150分 · 5問解答','150분 · 5문제 답안',20 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','テクノロジ','테크놀로지','アルゴリズム、OS、DB、ネットワーク、セキュリティ、開発技術。','알고리즘, OS, DB, 네트워크, 보안, 개발기술.',10 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','マネジメント','매니지먼트','プロジェクト、サービス、システム監査。','프로젝트, 서비스, 시스템 감사.',20 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','ストラテジ','전략','経営戦略、システム戦略、企業活動、法務。','경영전략, 시스템전략, 기업활동, 법무.',30 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','データベース','데이터베이스','正規化、SQL、トランザクション、障害回復、分散DB。','정규화, SQL, 트랜잭션, 장애복구, 분산 DB.',10 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','ネットワーク','네트워크','TCP/IP、ルーティング、DNS、HTTP、性能・可用性。','TCP/IP, 라우팅, DNS, HTTP, 성능·가용성.',20 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','セキュリティ','보안','暗号、認証、脆弱性、攻撃手法、リスク管理。','암호, 인증, 취약점, 공격기법, 리스크 관리.',30 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','アルゴリズム・プログラミング','알고리즘·프로그래밍','計算量、データ構造、擬似言語、処理追跡。','계산복잡도, 자료구조, 의사코드, 처리 흐름 추적.',40 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','科目Aで基礎を固める','과목 A로 기초 고정','過去問を分野別に回し、誤答理由まで記録。','기출을 분야별로 반복하고 오답 이유까지 기록.',10 FROM certifications WHERE slug='ap';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','科目Bは選択分野を早めに固定','과목 B 선택 분야 조기 확정','得意分野を中心に文章から根拠を抜き出す練習を行う。','강한 분야를 중심으로 지문에서 근거를 뽑는 연습을 진행.',20 FROM certifications WHERE slug='ap';

-- FP common domains
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','ライフプランニングと資金計画','라이프플래닝과 자금계획','社会保険、年金、教育・住宅資金、ローン。','사회보험, 연금, 교육·주택자금, 대출.',10 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','リスク管理','리스크 관리','生命保険・損害保険・第三分野保険。','생명보험·손해보험·제3보험.',20 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','金融資産運用','금융자산운용','預貯金、債券、株式、投資信託、ポートフォリオ。','예적금, 채권, 주식, 투자신탁, 포트폴리오.',30 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','タックスプランニング','택스플래닝','所得税を中心とした税額計算と各種控除。','소득세 중심의 세액 계산과 각종 공제.',40 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','不動産','부동산','取引、法令、税金、評価、活用。','거래, 법령, 세금, 평가, 활용.',50 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'domain','相続・事業承継','상속·사업승계','相続税、贈与税、財産評価、遺産分割。','상속세, 증여세, 재산평가, 유산분할.',60 FROM certifications WHERE slug IN ('fp2','fp3');

INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','学科試験','학과시험','6分野から幅広く出題。','6개 분야에서 폭넓게 출제.','90分 · 60問','90분 · 60문제',10 FROM certifications WHERE slug='fp3';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','実技試験','실기시험','資産設計提案業務を想定した実践問題。','자산설계 제안 업무를 가정한 실전 문제.','60分 · 20問','60분 · 20문제',20 FROM certifications WHERE slug='fp3';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','学科試験','학과시험','3級より深い制度理解と計算を要求。','3급보다 깊은 제도 이해와 계산이 필요.','120分 · 60問','120분 · 60문제',10 FROM certifications WHERE slug='fp2';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','実技試験','실기시험','多肢選択と記述を含む資産設計提案業務。','객관식과 서술을 포함한 자산설계 제안 업무.','90分 · 40問','90분 · 40문제',20 FROM certifications WHERE slug='fp2';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','6分野を均等に一周','6개 분야를 균등하게 1회전','最初は細部より全体像を作り、その後に計算問題を反復。','처음에는 세부보다 전체 틀을 만들고 이후 계산문제를 반복.',10 FROM certifications WHERE slug IN ('fp2','fp3');
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','法令基準日に注意','법령 기준일 확인','税率・控除・制度改正は受検回の法令基準日で整理。','세율·공제·제도개정은 해당 시험의 법령 기준일로 정리.',20 FROM certifications WHERE slug IN ('fp2','fp3');

-- AWS formats / weighted domains / study
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','択一選択','단일 선택','1つの正答と複数の誤答候補から選択。','정답 1개와 여러 오답 보기 중 선택.','65問に含まれる','65문제에 포함',10 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, meta_ja, meta_ko, display_order)
SELECT id,'format','複数選択','복수 선택','5つ以上の選択肢から2つ以上の正答を選ぶ形式。','5개 이상의 보기에서 2개 이상의 정답을 선택.','採点50問 + 非採点15問','채점 50문제 + 비채점 15문제',20 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, weight_percent, display_order)
SELECT id,'domain','セキュアなアーキテクチャの設計','보안 아키텍처 설계','IAM、暗号化、ネットワーク境界、データ保護。','IAM, 암호화, 네트워크 경계, 데이터 보호.',30,10 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, weight_percent, display_order)
SELECT id,'domain','レジリエントなアーキテクチャの設計','복원력 있는 아키텍처 설계','Multi-AZ、疎結合、Auto Scaling、バックアップと復旧。','Multi-AZ, 느슨한 결합, Auto Scaling, 백업·복구.',26,20 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, weight_percent, display_order)
SELECT id,'domain','高パフォーマンスなアーキテクチャの設計','고성능 아키텍처 설계','Compute、Storage、Database、Networkの性能選択。','컴퓨팅, 스토리지, DB, 네트워크의 성능 선택.',24,30 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, weight_percent, display_order)
SELECT id,'domain','コストを最適化したアーキテクチャの設計','비용 최적화 아키텍처 설계','料金モデル、ストレージ階層、適切なサービス選定。','요금모델, 스토리지 계층, 적절한 서비스 선택.',20,40 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','Compute','컴퓨팅','EC2、Lambda、Auto Scaling、ELB、コンテナの使い分け。','EC2, Lambda, Auto Scaling, ELB, 컨테이너 선택 기준.',10 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','Storage','스토리지','S3、EBS、EFS、Storage Class、ライフサイクル。','S3, EBS, EFS, Storage Class, 수명주기.',20 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','Database','데이터베이스','RDS/Aurora、DynamoDB、ElastiCacheの選択。','RDS/Aurora, DynamoDB, ElastiCache 선택.',30 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'concept','Network & Security','네트워크·보안','VPC、Subnet、Route、SG/NACL、CloudFront、Route 53、IAM/KMS。','VPC, Subnet, Route, SG/NACL, CloudFront, Route 53, IAM/KMS.',40 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','サービス名ではなく選定理由','서비스명이 아니라 선택 이유','要件を見て、なぜそのサービス・構成が最適かを説明できるようにする。','요구사항을 보고 왜 그 서비스·구성이 최적인지 설명할 수 있게 학습.',10 FROM certifications WHERE slug='aws-saa';
INSERT INTO certification_topics (certification_id, topic_type, title_ja, title_ko, description_ja, description_ko, display_order)
SELECT id,'study','可用性・性能・コストを比較','가용성·성능·비용 비교','似たサービスの違いを表で整理してシナリオ問題に慣れる。','비슷한 서비스의 차이를 표로 정리하고 시나리오 문제에 익숙해지기.',20 FROM certifications WHERE slug='aws-saa';
