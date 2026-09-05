# song-project 진행상황

최종 갱신: 2026-09-05

이 파일은 여러 ChatGPT 대화/쓰레드에서 song-project 작업을 이어갈 때 사용하는 기준 진행상황이다. 새 작업을 시작할 때 이 파일과 최신 Git 상태를 먼저 확인한다.

## JLPT
- JLPT N1 오늘의 학습 데이터는 기간별 생성 완료.
- 신규 일일 데이터 자동 생성은 중지.
- 당일 데이터 품질 검증 중심으로 운영.
- 당일 신규 20단어는 일본어학습 공통 단어 구조(`japanese_words`, 품사 관계, 예문 관계)에 맞춰 중복 없이 등록용 데이터를 준비한다.
- 원격 D1은 자동으로 직접 변경하지 않는다.

## AP 콘텐츠
- AP 개념 A-01~A-68 사실/계산 검증 완료.
- B-07 Incident Response 오류는 `0070`으로 보정.
- `0071`: A-33~A-46 42문제 실전 4지선다화.
- `0072`: A-47~A-68 66문제 실전 4지선다화.
- `0073`: A-14~A-32 generic fallback 57문제 교체.
- `0074`: 2026-10-01~10-07 科目A 7일×10문제 분야 혼합 출제.
- `0075`: AP 일본어 시험 문체 정규화.
- `scripts/ap/validate-content.mjs`: 기존 AP 문제은행 자동 검증.

## AP 모의고사 기능

### DB / 시험 엔진 완료
- `0076_ap_mock_exam_foundation.sql`: 시험/문제/응시/답안 기본 테이블.
- `0077_ap_mock_exam_structured_written_answers.sql`: 科目B 장문/표/로그/구조화 답안 및 채점기준 저장 컬럼.
- 科目A/科目B 탭, 1/2/3회 목록, 미실시/진행중/실시완료, 점수/실시일 표시.
- 답안 자동저장, 150분 타이머, 재접속 복원.
- 科目A 자동채점.
- 科目B는 11문제 중 정확히 5문제 선택, Q1 정보보안 필수, 문제당 20점, 선택한 5문제만 합산해 100점.
- 科目B 부분점수 및 구조화 답안(`answer_json`) 지원.
- 결과에서 답안/정답·모범답안/상세해설/관련 개념 확인.

### 중복/품질 검증
- `(subject, exam_no)` UNIQUE.
- `(mock_exam_id, question_no)` UNIQUE.
- DB `fingerprint` GLOBAL UNIQUE.
- `(mock_exam_id, admin_id, attempt_no)` UNIQUE.
- 회차별 동시 `in_progress` 1개만 허용.
- source JSON의 수동 fingerprint 값은 신뢰하지 않는다.
- `scripts/ap/mock-exam-utils.mjs`가 일본어 문제 본문·장문 지문·로그·표·선택지·소문항을 NFKC 정규화한 뒤 SHA-256을 계산한다.
- validator와 DB builder가 같은 계산함수를 사용하므로 회차 간 동일/재사용 시나리오를 내용 기준으로 차단한다.
- `scripts/ap/validate-mock-exams.mjs`는 문제번호, 분야분포, 선택지, 배점, 필수문제, 소문항 key, 채점기준 합계까지 검증한다.

## 科目A 모의고사 1회 — ready
- 원본: `A-01-01.json` ~ `A-01-04.json`, Q1~Q80.
- 80문제 / 150분 / 전 문항 4지선다.
- T 50 / M 10 / S 20.
- 각 1.25점, 총 100점.
- 정답 위치 0/1/2/3 각각 20문제.
- Q51 CPM 정답 위치 오류 발견 후 수정 완료.
- 공개 기출 문장을 복사하지 않고 신규 작성.
- DB 등록용 파일은 `npm run ap:mock:a1:build`가 검증 후 `migrations/0078_ap_mock_exam_a01_questions.sql`로 생성한다.

## 科目B 모의고사 1회 — ready
원본은 문제별로 분리:
- `B-01-01.json`: 정보보안 — 필수, 인증로그/Password Spraying/MFA 사고대응
- `B-01-02.json`: 경영전략 — LTV/CAC, 해지율 개선
- `B-01-03.json`: 프로그래밍 — BFS 추적/계산량
- `B-01-04.json`: 시스템 아키텍처 — 세션 외부화, 캐시, DB 병목/이중화
- `B-01-05.json`: 네트워크 — /26, 최장일치 경로, FW 규칙
- `B-01-06.json`: 데이터베이스 — 복합 인덱스, 데드록/잠금 순서
- `B-01-07.json`: 임베디드 — 샘플링, 링버퍼, 주기태스크, Watchdog
- `B-01-08.json`: 정보시스템개발 — API 단계이행, 호환성, Contract Test, 멱등성/롤백
- `B-01-09.json`: 프로젝트관리 — CPM + EVM(SPI/CPI)
- `B-01-10.json`: 서비스관리 — SLA 가동률, 반복장애/문제관리
- `B-01-11.json`: 시스템감사 — 직무분장, 변경승인, 감사증거

검증 기준:
- 11문제 / 150분 / 5문제 선택.
- Q1 SECURITY만 mandatory.
- 11개 공식 출제 분야를 정확히 한 번씩 구성.
- 각 문제 20점, 4개 소문항×5점으로 채점기준 합계 20점.
- 실제 점수는 선택한 5문제만 합산하여 총 100점.
- Q1 공격유형이 모호하지 않도록 동일한 소수 비밀번호 후보를 다수 계정에 시도한다는 근거를 추가해 Password Spraying으로 정답 유일성 보강.
- 계산형(LTV, BFS 거리, subnet, sampling, CPM/EVM, availability) 재검산 완료.
- 공개 기출 문장은 복사하지 않고 공개된 시험 구조/난이도를 참고해 신규 작성.
- DB 등록용 파일은 `npm run ap:mock:b1:build`가 검증 후 `migrations/0079_ap_mock_exam_b01_questions.sql`로 생성한다.

## 적용 명령 흐름
- `npm run ap:validate`: 기존 AP 문제은행 + 모의고사 전체 검증.
- `npm run ap:mock:build`: A1/B1 전체 검증 후 0078/0079 SQL 생성.
- `npm run db:migrate:local`: 모의고사 검증/SQL 생성 후 로컬 D1 migration 적용.
- `npm run db:migrate:remote`: 모의고사 검증/SQL 생성 후 원격 D1 migration 적용.
- `npm run dev`는 `db:migrate:local`을 먼저 실행하므로 별도 A1/B1 등록 명령을 외울 필요가 없다.

## 다음 작업
1. 科目A 모의고사 2회 80문제 신규 제작.
2. A2는 A1 및 전체 기존 문제은행과 내용 fingerprint 중복 없이 구성.
3. A2 사실/계산/정답분포/분야분포 검증 후 ready.
4. 이후 科目B 2회 → 科目A 3회 → 科目B 3회 순서.

## 운영 원칙
- 기존 migration은 가능하면 수정하지 않고 후속 migration을 추가한다.
- Cloudflare D1 무료 row-read 한도를 고려해 전체 스캔/반복 SELECT·COUNT를 피한다.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN을 우선한다.
- 모의고사는 ready 전 구조·중복·정답·해설 검증을 통과해야 한다.
- 다른 회차에서 동일 문제/시나리오를 그대로 재사용하지 않는다.
- Git 실제 스키마/코드를 확인하기 전에는 테이블/컬럼을 추측하지 않는다.
