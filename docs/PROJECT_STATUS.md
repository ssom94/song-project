# song-project 진행상황

최종 갱신: 2026-09-05

이 파일은 여러 ChatGPT 대화/쓰레드에서 song-project 작업을 이어갈 때 사용하는 기준 진행상황이다. 새 작업을 시작할 때 이 파일과 최신 Git 상태를 먼저 확인한다.

## 현재 상태 요약

### JLPT
- JLPT N1 오늘의 학습 데이터는 이미 기간별로 생성 완료.
- 신규 일일 데이터 자동 생성은 중지.
- 현재 자동화 방향: 당일 JLPT/AP 데이터 품질 검증.
- JLPT 당일 신규 20단어는 일본어학습 공통 단어 데이터 구조에 맞춰 함께 등록용 migration/seed를 준비하는 방식.
- 일본어학습 등록 시 `japanese_words`, 품사 관계, 예문 관계 등 실제 스키마에 맞추고 기존 단어+읽기 중복은 재사용.
- D1 원격 DB는 자동 변경하지 않고 Git에 반영용 SQL/seed를 준비.

### AP 콘텐츠
- AP 개념 라이브러리 A-01~A-68 개념 설명 검증 완료.
- B-07 Incident Response 사실 오류는 `migrations/0070_ap_content_validation_fixes.sql`로 보정 완료.
- 상세 검증 결과: `docs/ap-content-validation-2026-09-05.md`.
- `0071`: A-33~A-46 네트워크·보안 42문제 실전 4지선다화.
- `0072`: A-47~A-68 개발·관리·전략·회계·법무 66문제 실전 4지선다화.
- `0073`: A-14~A-32 generic fallback 57문제 교체.
- `0074`: 2026-10-01~10-07 科目A 날짜별 10문제 혼합 출제.
- `0075`: AP 일본어 시험 문체 정규화.
- `scripts/ap/validate-content.mjs`: AP 문제은행 구조/중복/정답/혼합출제 offline 검증.

## AP 모의고사 — 기반 구현 완료

### DB
`migrations/0076_ap_mock_exam_foundation.sql`

구현 테이블:
- `ap_mock_exams`: 科目A/科目B 회차 메타데이터
- `ap_mock_exam_questions`: 모의고사 문제
- `ap_mock_exam_attempts`: 회차별 응시 이력
- `ap_mock_exam_answers`: 문제별 답안/채점 결과

중복 방지:
- `(subject, exam_no)` UNIQUE
- `(mock_exam_id, question_no)` UNIQUE
- `fingerprint` GLOBAL UNIQUE: 서로 다른 모의고사 회차에도 동일 문제 재사용 방지
- `(mock_exam_id, admin_id, attempt_no)` UNIQUE
- 한 회차에서 동시에 하나의 `in_progress` 응시만 허용하는 partial UNIQUE index

초기 빈 회차:
- 科目A 1회 / 2회 / 3회
- 科目B 1회 / 2회 / 3회
- 모두 `draft`, 문제 0개 상태로 시작하며 문제 수가 기준에 맞기 전에는 시험 시작 불가

### API
`src/ap-mock-exams.ts`

구현:
- `GET /api/public/ap/mock-exams?subject=A|B`
  - 회차 목록, 미실시/진행중/실시완료, 점수, 실시일, 준비 문제수
- `GET /api/public/ap/mock-exams/detail?subject=A|B&no=N`
  - 회차 상세, 진행중 문제, 완료 후 사용자 답안/정답/모범답안/해설 조회 구조
- `POST /api/admin/ap/mock-exams/start`
  - 로그인 필요
  - 문제 수가 목표와 정확히 일치하고 exam status=`ready`인 경우만 시작
  - 중복 시작은 DB UNIQUE index로 차단하고 기존 진행중 attempt 재사용

라우팅은 `src/index-ap-wrapper.ts`에 반영 완료.

### 페이지
일본어/한국어 모두 구현:
- `/ja/study/ap/mock-exams/`
- `/ko/study/ap/mock-exams/`
- `/ja/study/ap/mock-exams/exam/`
- `/ko/study/ap/mock-exams/exam/`

목록 화면:
- 상단 科目A / 科目B 탭
- 모의고사 1회, 2회, 3회
- 상태: 미실시 / 진행 중 / 실시완료
- 실시 후 `취득점수 / 전체점수`
- 실시일
- 현재 준비된 문제수 / 목표 문제수
- 우측 모의고사 보기 / 계속 풀기 / 결과·해설 보기
- 문제 준비 전에는 버튼 비활성화

상세 화면:
- 제한시간 / 출제수 / 답변수 / 합격기준
- 미실시: 시험 안내 + 시험 시작
- 진행중: 문제 표시 구조
- 실시완료: 점수 + 내 답안 + 정답/모범답안 + 상세 해설 표시 구조

AP 학습 홈에도 모의고사 진입 카드를 추가 완료.

### 모의고사 문제 검증
`data/ap/mock-exams/manifest.json`
- 科目A/科目B 시험 규격과 1~3회 파일 상태 관리

`scripts/ap/validate-mock-exams.mjs`
- 같은 과목/회차 중복 금지
- 파일 중복 금지
- 문제번호 중복 금지
- 문제 본문+선택지를 정규화해 SHA-256 fingerprint 재계산
- 사용자가 임의 fingerprint를 적어 중복 검사를 우회하지 못하도록 실제 내용 기반으로 검증
- 전체 회차 사이 동일 문제 중복 금지
- 科目A ready 조건: 정확히 80문제, 전부 4지선다, 유일한 선택지, 정답 index 0~3, 총점 100
- 科目B ready 조건: 정확히 11문제, 기술식, 정보보안 필수문제 포함, 총점 100
- 한/일 문제·해설 필수

`npm run ap:validate`는 기존 AP 문제은행 검증 + 모의고사 검증을 모두 실행한다.

## 다음 AP 모의고사 작업

문제 제작 전에 시험 엔진을 마저 완성한다.

1. 진행중 답안 자동저장 API/UI
2. 제한시간 타이머와 재접속 시 남은 시간 복원
3. 科目A 80문제 답안 입력 + 최종 제출 + 자동채점
4. 科目B 11문제 중 5문제 선택 구조
5. 科目B 장문 지문/표/로그/소문항을 저장할 구조 보강
6. 科目B 부분점수 채점 구조
7. 결과 화면의 문제별 정오/점수/관련 AP 개념 링크
8. 전체 동작 검증 후 모의고사 科目A 1회 문제 80개 제작
9. A 1회 검증 완료 후 B 1회 → A 2회 → B 2회 순차 제작

## 운영 원칙
- 기존 migration을 가능하면 수정하지 않고 후속 보정 migration을 추가한다.
- Cloudflare D1 무료 row-read 한도를 고려해 전체 스캔/반복 SELECT/COUNT 검증을 피한다.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN, 범위 제한 검증을 우선한다.
- 모의고사 문제는 `ready` 전 offline 검증을 반드시 통과한다.
- 문제 중복은 문제번호뿐 아니라 실제 일본어 본문/선택지 기반 fingerprint로 전 회차 비교한다.
- Git의 실제 스키마/코드를 확인하기 전에는 테이블명·컬럼명을 추측하지 않는다.
- 여러 ChatGPT 쓰레드에서 작업할 때는 이 파일을 먼저 읽고 최신 Git과 대조한 뒤 이어서 작업한다.
