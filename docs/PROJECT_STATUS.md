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
- 계산형(2의 보수, CPU, 캐시, RAID5, subnet, 기대손실, 압축전송, 표본화, CPM/EVM, SLA, ROI, BEP, NPV, 감가상각, 재고회전율 등) 재검산.
- Q49 압축률 표현의 모호성 제거 완료.
- `npm run ap:mock:a2:build` → `migrations/0080_ap_mock_exam_a02_questions.sql`.

## 科目B 모의고사 2회 — ready
원본: `B-02-01.json`~`B-02-11.json`.
- Q1 SECURITY: CI 빌드로그 API 토큰 노출, 토큰 폐기/로테이션, 시크릿 마스킹.
- Q2 STRATEGY: 신규 서비스 공헌이익, 손익분기점, 투자회수 판단.
- Q3 PROGRAMMING: 다익스트라 최단경로 및 음수 간선 조건.
- Q4 ARCHITECTURE: 피크 처리량, 메시지큐, DB 이중화.
- Q5 NETWORK: VPN MTU, DF, PMTUD, ICMP 차단 분석.
- Q6 DATABASE: 정규화, 갱신 이상, REPEATABLE READ.
- Q7 EMBEDDED: 12비트 ADC, 외부 인터럽트, 100ms 주기, PWM 듀티비.
- Q8 SYSTEM_DEV: 500만건 데이터이관, 시간 계산, 건수/해시 검증, 롤백.
- Q9 PROJECT_MGMT: 위험 EMV 및 컨틴전시 예비비.
- Q10 SERVICE_MGMT: RTO/RPO, 복구시간, 데이터손실, 리스토어 시험. 일본어/한국어의 증분백업 용어를 `増分バックアップ / 증분 백업`으로 통일 완료.
- Q11 AUDIT: B1의 변경관리 감사와 겹치던 초안을 폐기하고, 외부위탁 특권ID·퇴사자 계정·공용ID 추적성 감사 시나리오로 교체.
- 계산형 재검산, manifest `ready`.
- `npm run ap:mock:b2:build` → `migrations/0081_ap_mock_exam_b02_questions.sql`.

## 科目A 모의고사 3회 — ready
- `A-03-01.json`~`A-03-04.json`, Q1~Q80.
- 80문제 / 150분 / T50·M10·S20 / 각 1.25점 / 총100점.
- 정답 위치는 Q1부터 ①②③④ 순환 방식으로 설계하여 0/1/2/3 각각 20문제.
- A1/A2의 문장을 그대로 재사용하지 않고 자료구조·OS·DB·네트워크·보안·분산/API·PM·서비스관리·전략/재무/법무를 새로운 상황과 수치로 구성.
- 계산형 재검산: 조건부확률, 재귀, 이분탐색, LRU, CPU 실행시간, Amdahl, 캐시 set수, 직렬가용성, /27 host수, 순환복잡도, 표본화, PERT, CPI, SLA 허용중단시간, 시장점유율, 공헌이익, BEP, ROI, NPV, 정액법 감가상각, 재고회전율, 유동비율.
- manifest에서 A-03 `ready` 전환.
- `npm run ap:mock:a3:build` → `migrations/0082_ap_mock_exam_a03_questions.sql`.

## 적용 명령 흐름
- `npm run ap:validate`: 기존 AP 문제은행 + 전체 모의고사 검증.
- `npm run ap:mock:build`: A1/B1/A2/B2/A3를 한 번에 중복/구조 검증 후 0078~0082 SQL 생성.
- `npm run db:migrate:local`: 검증/SQL 생성 성공 후 로컬 D1 migration 적용.
- `npm run db:migrate:remote`: 검증/SQL 생성 성공 후 원격 D1 migration 적용.
- `npm run dev`: `db:migrate:local` 선행.
- 검증 실패 시 migration 생성/DB 적용 흐름 중단.

## 다음 작업
1. 科目B 모의고사 3회 11문제 신규 제작.
2. B3는 B1/B2와 시나리오·자료·계산유형을 중복하지 않도록 구성.
3. B3 사실/모범답안/부분점수/분야분포 검증 후 ready.
4. 마지막으로 A1~A3/B1~B3 총 6회차 전체 중복·정답·표현·DB 빌드 검증.

## 운영 원칙
- 기존 migration은 가능하면 수정하지 않고 후속 migration 추가.
- Cloudflare D1 무료 row-read 한도를 고려해 전체 스캔/반복 SELECT·COUNT 회피.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN 우선.
- 모의고사는 ready 전 구조·중복·정답·해설 검증 통과 필수.
- 다른 회차에서 동일 문제/시나리오 그대로 재사용 금지.
- Git 실제 스키마/코드를 확인하기 전 테이블/컬럼 추측 금지.
