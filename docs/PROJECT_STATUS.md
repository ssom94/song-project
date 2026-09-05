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

### 기반/시험 엔진 완료
- `0076_ap_mock_exam_foundation.sql`
- 테이블: `ap_mock_exams`, `ap_mock_exam_questions`, `ap_mock_exam_attempts`, `ap_mock_exam_answers`.
- 科目A/科目B 상단 탭 및 1/2/3회 리스트 구현.
- 상태: 미실시 / 진행 중 / 실시완료.
- 점수/실시일/준비 문제수 표시.
- 시험 시작/재개/결과·해설 보기 구현.
- 답안 자동저장 및 `(attempt_id, question_id)` PK UPSERT로 중복 답안 방지.
- 서버 시작시간 기준 150분 타이머 및 재접속 남은시간 복원.
- 科目A 최종 제출 자동채점.
- 科目B 11문제 중 정확히 5문제 선택, 필수문제 포함 서버 검증, 부분점수 구조 구현.
- 완료 후 사용자 답안/정답·모범답안/해설/관련 개념 링크 조회.

### 중복 방지
- `(subject, exam_no)` UNIQUE.
- `(mock_exam_id, question_no)` UNIQUE.
- DB `fingerprint` GLOBAL UNIQUE.
- `(mock_exam_id, admin_id, attempt_no)` UNIQUE.
- 회차별 동시 `in_progress` 1개만 허용.
- source JSON에 적힌 fingerprint는 신뢰하지 않는다.
- validator와 DB builder 모두 일본어 문제 본문/지문/선택지를 NFKC 정규화한 뒤 SHA-256을 직접 계산한다.
- 따라서 수동 fingerprint 수정으로 중복 검증을 우회할 수 없다.

## 科目A 모의고사 1회

### 원본 완료
- `data/ap/mock-exams/A-01-01.json`: Q1~20
- `data/ap/mock-exams/A-01-02.json`: Q21~40
- `data/ap/mock-exams/A-01-03.json`: Q41~60
- `data/ap/mock-exams/A-01-04.json`: Q61~80
- 공개 기출 문장을 복사하지 않고 신규 문제로 작성.
- Q51 CPM 계산 정답 위치 오류 발견 후 수정 완료.

### 최종 구성
- 80문제 / 150분 / 4지선다 / 전 문항 응답.
- T(테크놀로지) 50문제.
- M(매니지먼트) 10문제.
- S(스트래티지) 20문제.
- 문제번호 Q1~Q80 연속.
- 각 문제 1.25점 = 총점 100점.
- 정답 위치 0/1/2/3 각각 정확히 20문제.
- manifest에서 A-01을 `ready`로 전환.

### 검증/DB 등록 자동화
- `scripts/ap/mock-exam-utils.mjs`: fingerprint 공통 계산 함수.
- `scripts/ap/normalize-mock-exams.mjs`: 필요 시 source fingerprint 정규화.
- `scripts/ap/validate-mock-exams.mjs`: 회차/파일/문제번호/선택지/총점/분야분포/정답분포/전 회차 내용중복 검증.
- `scripts/ap/build-mock-exam-migration.mjs`: 검증된 ready 회차를 D1 SQL로 변환. DB fingerprint는 항상 본문에서 새로 계산.
- `npm run ap:mock:a1:build` → 검증 후 `migrations/0077_ap_mock_exam_a01_questions.sql` 생성.
- `npm run db:migrate:local` / `npm run db:migrate:remote` 실행 시 A1 build가 먼저 자동 실행되므로 별도 등록 명령을 외울 필요 없음.
- `npm run dev`도 `db:migrate:local`을 통해 같은 순서를 사용.

## 다음 작업
1. 科目B 모의고사 1회 11문제 제작.
2. 실제 시험형 장문 지문/표/로그/자료를 포함해 정보보안 필수 + 선택 10분야 구성.
3. B1 전체 사실/모범답안/채점기준/부분점수 검증.
4. B1 ready → DB 등록 빌드 연결.
5. 이후 科目A 2회 → 科目B 2회 → A3 → B3 순서로 제작.

## 운영 원칙
- 기존 migration은 가능하면 수정하지 않고 후속 migration을 추가한다.
- Cloudflare D1 무료 row-read 한도를 고려해 전체 스캔/반복 SELECT·COUNT를 피한다.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN을 우선한다.
- 모의고사는 ready 전 구조·중복·정답·해설 검증을 통과해야 한다.
- 다른 회차에서 동일 문제를 그대로 재사용하지 않는다.
- Git 실제 스키마/코드를 확인하기 전에는 테이블/컬럼을 추측하지 않는다.
