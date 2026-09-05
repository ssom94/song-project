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
- 科目A/科目B 탭, 1/2/3회 목록, 미실시/진행중/실시완료 표시.
- 답안은 `(attempt_id, question_id)` PK 기반 UPSERT로 문제 한 개를 풀 때마다 자동저장.
- 진행 중 브라우저를 닫아도 같은 `in_progress` 응시기록에서 이어서 풀 수 있음.
- 150분 타이머는 서버 `started_at` 기준이며 재접속 시 남은시간 복원.
- 科目A 최종 제출 자동채점.
- 科目B는 11문제 중 정확히 5문제 선택, Q1 정보보안 필수, 문제당 20점, 선택한 5문제 합산 100점.
- 科目B 부분점수 및 구조화 답안(`answer_json`) 지원.
- 결과에서 답안/정답·모범답안/상세해설/관련 개념 확인.

### 모의고사 목록 진행률/결과 표시
- 목록은 추가 전체스캔 없이 기존 `attempt.answeredCount`, `score` 사용.
- 미실시: `80 / - (-)`.
- 진행 중: `80 / 23문제 풀이 중` / `80 / 23問解答済み`.
- 科目A 완료: `80 / 61정답 (76.25점)` 형식.
- 科目B 완료: 부분점수 구조 때문에 `11 / 5문제 채점 (72점)` 형식.
- 진행 중 버튼: `계속 풀기 / 続きから`; 완료 버튼: `결과·해설 보기 / 結果・解説を見る`.
- 목록 전용 스크립트: `public/assets/js/study/ap-mock-exams-list.js`.

### 제출/자동저장 통합 보강
- 통합 흐름 점검 중, 서술형 답안을 입력한 직후 500ms debounce가 끝나기 전에 최종 제출하면 마지막 입력이 서버에 반영되지 않을 수 있는 경계조건을 발견.
- `public/assets/js/study/ap-mock-exams-submit-guard.js`를 추가하여 일반 최종 제출 직전에 현재 화면의 모든 서술형 답안을 서버에 한 번 더 동기화한 후 제출하도록 보강.
- 科目B 구조화 답안의 모든 소문항을 지운 경우 `{"q1":"","q2":""...}` 문자열이 답변 존재로 오인될 수 있는 문제를 UI 경로에서 방지. 전체 값이 공백이면 `answerJson: null`로 정규화해 기존 답안 행이 삭제되고 선택 해제로 처리되게 함.
- 제한시간 종료에 의한 `force=true` 자동 제출은 서버가 만료 후 답안 저장을 거부하므로 추가 flush 없이 즉시 제출하도록 분리.
- 가드는 한국어/일본어 모의고사 상세 페이지에서 기존 `ap-mock-exams.js`보다 먼저 로드됨.
- 科目A 선택지는 change 시 즉시 저장되므로 별도 flush 대상이 아님.

### 중복/품질 검증
- `(subject, exam_no)` UNIQUE.
- `(mock_exam_id, question_no)` UNIQUE.
- DB `fingerprint` GLOBAL UNIQUE.
- `(mock_exam_id, admin_id, attempt_no)` UNIQUE.
- 회차별 동시 `in_progress` 1개만 허용.
- source JSON의 수동 fingerprint 값은 신뢰하지 않음.
- `scripts/ap/mock-exam-utils.mjs`가 일본어 문제 본문·장문 지문·로그·표·선택지·소문항을 NFKC 정규화 후 SHA-256 계산.
- validator와 DB builder가 같은 계산함수를 사용하므로 회차 간 동일/재사용 문제와 시나리오를 내용 기준으로 차단.
- `scripts/ap/validate-mock-exams.mjs`는 문제번호, 분야분포, 선택지, 배점, 필수문제, 소문항 key, 채점기준 합계까지 검증.

## 科目A 모의고사 1회 — ready
- `A-01-01.json`~`A-01-04.json`, Q1~Q80.
- 80문제 / 150분 / T50·M10·S20 / 각 1.25점 / 총100점.
- 정답 위치 0/1/2/3 각각 20문제.
- Q51 CPM 정답 위치 오류 수정 완료.
- `npm run ap:mock:a1:build` → `migrations/0078_ap_mock_exam_a01_questions.sql`.

## 科目B 모의고사 1회 — ready
- `B-01-01.json`~`B-01-11.json`.
- 11개 공식 분야를 한 번씩 구성, Q1 SECURITY 필수, 5문제 선택.
- 각 문제 20점, 4개 소문항×5점.
- Password Spraying 문제 정답 유일성 보강 및 계산형 재검산 완료.
- `npm run ap:mock:b1:build` → `migrations/0079_ap_mock_exam_b01_questions.sql`.

## 科目A 모의고사 2회 — ready
- `A-02-01.json`~`A-02-04.json`, Q1~Q80.
- 80문제 / 150분 / T50·M10·S20 / 각 1.25점 / 총100점.
- 정답 위치 0/1/2/3 각각 20문제로 설계.
- A1 문제 문장을 그대로 재사용하지 않고 상황·수치·보기까지 신규 작성.
- 계산형 재검산 및 Q49 압축률 표현 모호성 제거 완료.
- `npm run ap:mock:a2:build` → `migrations/0080_ap_mock_exam_a02_questions.sql`.

## 科目B 모의고사 2회 — ready
- `B-02-01.json`~`B-02-11.json`.
- Q1 SECURITY: CI 빌드로그 API 토큰 노출.
- Q2 STRATEGY: 공헌이익·손익분기점.
- Q3 PROGRAMMING: 다익스트라 최단경로.
- Q4 ARCHITECTURE: 처리량·메시지큐·DB 이중화.
- Q5 NETWORK: VPN MTU·PMTUD.
- Q6 DATABASE: 정규화·REPEATABLE READ.
- Q7 EMBEDDED: ADC·인터럽트·PWM.
- Q8 SYSTEM_DEV: 대량 데이터이관 검증·롤백.
- Q9 PROJECT_MGMT: 위험 EMV.
- Q10 SERVICE_MGMT: RTO/RPO, `増分バックアップ / 증분 백업` 용어 통일 완료.
- Q11 AUDIT: 외부위탁 특권ID·퇴사자 계정·공용ID 추적성 감사로 B1과 중복 제거.
- `npm run ap:mock:b2:build` → `migrations/0081_ap_mock_exam_b02_questions.sql`.

## 科目A 모의고사 3회 — ready
- `A-03-01.json`~`A-03-04.json`, Q1~Q80.
- 80문제 / 150분 / T50·M10·S20 / 각 1.25점 / 총100점.
- 실제 정답 위치 분포는 0/1/2/3 = `21/21/19/19`; 각 보기 차이가 최대 2문제인 근접 균등 분포로 검증값을 확정.
- A1/A2 문장을 그대로 재사용하지 않고 새로운 상황과 수치로 구성.
- 계산형 전수 재검산 완료.
- `npm run ap:mock:a3:build` → `migrations/0082_ap_mock_exam_a03_questions.sql`.

## 科目B 모의고사 3회 — ready
- `B-03-01.json`~`B-03-11.json`.
- Q1 SECURITY: SSRF를 통한 클라우드 메타데이터 접근과 임시 자격정보 유출 — 필수.
- Q2 STRATEGY: EC 구매 퍼널 전환율 및 개선시책 비교.
- Q3 PROGRAMMING: 동적계획법(DP) 최소비용 계산.
- Q4 ARCHITECTURE: 마이크로서비스 재시도, Idempotency Key, 지수 백오프, Circuit Breaker.
- Q5 NETWORK: DNS TTL·캐시·장애전환. DNS 비의존 자동전환 답안을 글로벌 로드밸런서로 명확화.
- Q6 DATABASE: 비동기 복제지연과 read-after-write 일관성.
- Q7 EMBEDDED: Duty Cycle, 평균소비전류, 배터리 동작시간, Sleep/Timer Interrupt.
- Q8 SYSTEM_DEV: Canary Release, Feature Flag, 오류율 기반 전개판단.
- Q9 PROJECT_MGMT: PERT 3점 추정 — 기대 8일, 표준편차 2일.
- Q10 SERVICE_MGMT: SLO/Error Budget — 43.2분, 약65% 소비, 15.2분 잔여.
- Q11 AUDIT: 매출 일일배치 건수·금액 대사 및 장기 미처리 예외 감사.
- B1/B2의 시나리오를 그대로 재사용하지 않도록 신규 작성.
- 각 문제 20점, 4개 소문항×5점, Q1 SECURITY만 mandatory.
- `npm run ap:mock:b3:build` → `migrations/0083_ap_mock_exam_b03_questions.sql`.

## 최종 검증 상태
- 기존 전체 GitHub Actions `Verify` run #905에서 6회차 구축 기준 PASS 확인.
- 통합 저장 보강 및 전용 CI 추가 후 `Verify AP Mock Exams` run #1 PASS.
  - `ap-mock-exams-list.js`, `ap-mock-exams-submit-guard.js`, `ap-mock-exams.js` browser syntax PASS.
  - A1~A3/B1~B3 6회차 validator PASS.
  - `npm run ap:mock:build` PASS.
  - `0078`~`0083` 생성 파일 존재 검증 PASS.
- 같은 최신 커밋 기준 기존 전체 `Verify` run #910도 PASS.
  - TypeScript check PASS.
  - Browser JavaScript syntax check PASS.
  - Vitest PASS.
  - 로컬 D1 migration PASS.
  - seeded catalog/study schema 검증 PASS.
- 따라서 현재 Git 기준으로 모의고사 콘텐츠 6회차, migration 생성, 로컬 D1 적용, 주요 브라우저 스크립트 문법 및 제출 전 답안 동기화 보강까지 CI에서 통과한 상태.

## 적용 명령 흐름
- `npm run ap:validate`: 기존 AP 문제은행 + A1~A3/B1~B3 전체 모의고사 검증.
- `npm run ap:mock:build`: 6회차 전체 중복/구조 검증 후 `0078`~`0083` SQL 생성.
- `npm run db:migrate:local`: 검증/SQL 생성 성공 후 로컬 D1 migration 적용.
- `npm run db:migrate:remote`: 검증/SQL 생성 성공 후 원격 D1 migration 적용.
- `npm run dev`: `db:migrate:local` 선행.
- 검증 실패 시 migration 생성/DB 적용 흐름 중단.

## 다음 작업
1. 사용자 Cloudflare 인증 환경에서 `git pull` 후 `npm run db:migrate:remote`로 `0076`~`0083` 미적용 migration을 원격 D1에 반영.
2. 필요 시 `npm run deploy`로 최신 Worker/static assets 배포.
3. 실제 서버에서 목록 → 시험 시작 → 1문제 저장 → 새로고침/재접속 → 계속 풀기 → 제출 → 결과/해설까지 스모크 테스트.
4. 科目A 목록의 `전체문제 / 정답 수 (점수)`와 科目B의 5문제 선택/Q1 필수/부분점수 표시를 실제 서버에서 최종 확인.
5. 이상 없으면 AP 모의고사 기능을 완료 처리.

## 운영 원칙
- 기존 migration은 가능하면 수정하지 않고 후속 migration 추가.
- Cloudflare D1 무료 row-read 한도를 고려해 전체 스캔/반복 SELECT·COUNT 회피.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN 우선.
- 모의고사는 ready 전 구조·중복·정답·해설 검증 통과 필수.
- 다른 회차에서 동일 문제/시나리오 그대로 재사용 금지.
- Git 실제 스키마/코드를 확인하기 전 테이블/컬럼 추측 금지.
