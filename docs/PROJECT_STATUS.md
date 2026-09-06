# song-project 진행상황

최종 갱신: 2026-09-06

이 파일은 여러 ChatGPT 대화/쓰레드에서 song-project 작업을 이어갈 때 사용하는 기준 진행상황이다. 새 작업을 시작할 때 이 파일과 최신 Git 상태를 먼저 확인한다.

## 운영 원칙
- Cloudflare Workers + D1 + R2 기반.
- D1 무료 row-read 한도를 고려해 전체 스캔, 날짜/문제별 반복 SELECT·COUNT·NOT EXISTS를 피한다.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN과 범위 제한 검증을 우선한다.
- 원격 D1은 ChatGPT가 직접 변경하지 않는다. 사용자의 Cloudflare 인증 환경에서 migration/deploy한다.
- 기존 migration은 가능하면 수정하지 않고 후속 migration을 추가한다.
- 모의고사는 `ready` 전 구조·중복·정답·해설 검증 통과가 필수이며 다른 회차의 동일 문제/시나리오를 그대로 재사용하지 않는다.

## 관리자 로그인 / 인증 — 해결
- workerd의 PBKDF2 210,000회 검증 경로 문제를 피하기 위해 신규/재설정 관리자 비밀번호 해시는 scrypt(`N=16384,r=8,p=1`)로 전환했다.
- `scripts/admin/reset-password.mjs`, `admin:diagnose-login`, `admin:unlock` 도구가 있다.
- 사용자가 운영 로그인 성공을 확인했다.

## 게시글 기능
### 카테고리 계층
- 공개 좌측 메뉴는 부모/자식 트리를 사용한다.
- 상위 카테고리 클릭 시 자신과 모든 하위 카테고리 글을 함께 조회한다.
- 하위 카테고리는 연결선/들여쓰기/우측 정렬로 구분한다.
- 관리자에서 지정한 preset/emoji/image 아이콘과 색상을 공개 메뉴에도 표시한다.
- 게시글 작성/수정은 leaf 카테고리만 허용한다.
- `0084_post_category_leaf_invariant.sql`: 기존 부모 직속 글을 첫 번째 leaf로 이동하고 부모 직접 할당을 DB trigger로 차단한다.

### 이미지 첨부
- 게시글 작성/수정에서 파일 선택, drag&drop, 클립보드 이미지 `Ctrl+V` 붙여넣기를 지원한다.
- PNG/JPEG/WebP, 파일당 최대 8MB.
- 관리자 업로드 `POST /api/admin/posts/image` → R2 `post-images/...` 저장.
- 공개 읽기 `GET /api/public/post-image?key=...`.
- D1에는 바이너리를 저장하지 않고 Markdown URL만 저장한다.

## JLPT
- JLPT N1 오늘의 학습 데이터는 기간별 생성 완료.
- 신규 일일 데이터 자동 생성은 중지하고 당일 데이터 품질 검증 중심으로 운영한다.
- 원격 D1은 자동으로 직접 변경하지 않는다.

## AP 기본 콘텐츠
- AP 개념 A-01~A-68 검증 완료.
- `0070`~`0075`: B-07 보정, 개념 문제 4지선다 보강, 2026-10-01~10-07 科目A 데이터, 일본어 시험 문체 정규화.
- `scripts/ap/validate-content.mjs`: 기존 AP 문제은행 검증.

## AP 모의고사 엔진
- `0076_ap_mock_exam_foundation.sql`: 시험/문제/응시/답안 기본 테이블.
- `0077_ap_mock_exam_structured_written_answers.sql`: 科目B 구조화 답안/채점기준.
- 科目A: 80문제, 150분, 총100점, 합격 60점.
- 科目B: 11문제 중 5문제 선택, Q1 정보보안 필수, 각 20점, 총100점.
- 답안 자동저장, 진행 중 재개, 서버 `started_at` 기준 150분 타이머, A 자동채점, B 부분점수/구조화답안 지원.
- 목록에 미실시/진행중/완료 및 풀이수/점수 표시.
- 실시일은 `Asia/Tokyo` 기준으로 표시한다.
- 사용자가 운영에서 A1 저장/뒤로가기/재개/진행률 동작을 확인했다.

## 자체 모의고사 ready 상태
### 科目A
- A1~A7 모두 80문제, T50/M10/S20.
- A1/A2/A4/A5/A6/A7 정답 위치 20/20/20/20, A3은 21/21/19/19.
- migrations: A1 `0078`, A2 `0080`, A3 `0082`, A4 `0086`, A5 `0089`, A6 `0092`, A7 `0095`.

### 科目B
- B1~B7 모두 11개 공식 분야 1문제씩, Q1 SECURITY 필수, 각 문제 20점/4소문항×5점.
- migrations: B1 `0079`, B2 `0081`, B3 `0083`, B4 `0087`, B5 `0090`, B6 `0093`, B7 `0096`.

### 4~7회차 shell
- `0085_ap_mock_exam_round04_shells.sql` → A4/B4.
- `0088_ap_mock_exam_round05_shells.sql` → A5/B5.
- `0091_ap_mock_exam_round06_shells.sql` → A6/B6.
- `0094_ap_mock_exam_round07_shells.sql` → A7/B7.
- `package.json`의 `ap:mock:build`는 A1~A7/B1~B7 총 14회차를 검증하고 question migration을 생성한다.

## 실제 AP 기출문제 — 최신 공개 5회 준비
사용자는 자체 모의고사 1~7회 다음부터 실제 제출된 공개 기출을 풀고, 자체 모의고사와 유형/문제방식이 비슷했는지 비교하기를 원한다.

### 등록한 회차
최신 공개 5회분을 최신순으로 `data/ap/past-exams/manifest.json`에 등록했다.
1. 令和7年度 秋期 — 2025-10-12
2. 令和7年度 春期 — 2025-04-20
3. 令和6年度 秋期 — 2024-10-13
4. 令和6年度 春期 — 2024-04-21
5. 令和5年度 秋期 — 2023-10-08

- 당시 명칭은 `午前`/`午後`이므로 UI에서 각각 `科目A相当（午前）` / `科目B相当（午後）`로 표시한다.
- 각 제목에는 연도·계절·실제 실시일을 표시한다.
- 기준 출처는 IPA 공식 과거문제 페이지이며 화면에 `IPA 공식 원문 / IPA公式原文` 링크를 표시한다.
- 현재 문제 본문은 아직 넣지 않았으며 A/B 각각 `awaiting-source`다. 빈 시험을 D1에 만들지 않는다.
- 사용자가 공식 IPA PDF를 대화에 제공하면 `data/ap/past-exams/sessions/<session>-A.json`, `...-B.json`으로 구조화한 뒤 `ready`로 전환한다.
- A는 80문제, B는 11문제가 모두 채워져야 `ready` 검증을 통과하도록 했다.

### 화면
- `/ko/study/ap/mock-exams/`, `/ja/study/ap/mock-exams/`에서 `자체 모의고사/オリジナル模擬試験`과 `실제 기출문제/実際の過去問`을 별도 섹션으로 표시한다.
- 기존 科目A/科目B 탭이 두 섹션에 함께 적용된다.
- 실제 기출은 현재 `공식 PDF 반영 대기 / 公式PDF取込待ち` 상태로 보인다.

### import / 비교 도구
- `data/ap/past-exams/README.md`: 실제 기출 import 규칙과 source attribution 정리.
- `scripts/ap/validate-past-exams.mjs`: 5개 세션, 실시일, IPA URL, A80/B11 목표, ready 파일의 실제 문항 수를 검증.
- `scripts/ap/compare-past-exams.mjs`: 자체 A1~A7/B1~B7를 baseline으로 만들고 실제 기출이 들어오면 지문 길이, 긴 지문 비율, 표/로그/코드/계산형 사용 비율 등을 비교한다. 실제 원문이 없을 때는 `pending-source`로 정상 종료한다.
- npm: `ap:past:validate`, `ap:past:compare`.
- 이번 실제기출 준비 작업에는 새 D1 migration이 없다.

## 최신 검증 상태
- `Verify AP Mock Exams` #87 PASS.
  - 브라우저 mock script 문법 PASS.
  - 실제 기출 5회 metadata validator PASS.
  - mock-vs-past comparison pipeline `pending-source` 정상 PASS.
  - A1~A7/B1~B7 총 14회차 validator PASS.
  - 전체 mock migration build PASS.
- 전체 `Verify` #1051 PASS.
  - TypeScript PASS.
  - Browser JavaScript syntax PASS.
  - Vitest PASS.
  - local D1 migrations PASS.
  - seeded catalog/study schema 검증 PASS.

## 적용 명령
### 이번 실제 기출 UI/metadata 준비만 반영
새 D1 migration이 없으므로:
```bash
cd ~/song-project
git pull
npm run deploy
```

### 운영 D1에 미적용된 자체 모의고사 회차가 있을 때
```bash
cd ~/song-project
git pull
npm run db:migrate:remote
npm run deploy
```

## 다음 작업
1. 사용자가 2025년 가을 IPA 공식 AP PDF(오전 문제/정답, 오후 문제/정답·가능하면 채점강평)를 대화에 업로드한다.
2. 2025 가을부터 실제 문제를 구조화하고 A80/B11 완전성 검증 후 실제 응시 데이터/migration을 만든다.
3. 같은 방식으로 2025 봄 → 2024 가을 → 2024 봄 → 2023 가을 순서로 5회분을 채운다.
4. 실제 기출 데이터가 준비되면 `ap:past:compare` 결과로 자체 모의고사 1~7회의 유형·길이·표/로그/코드/계산 비율 차이를 분석하고 이후 자체 문제 난이도를 보정한다.
5. 게시글 이미지 첨부 운영 스모크 테스트는 사용자가 원할 때 확인한다.
