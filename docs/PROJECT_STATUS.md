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
- 운영 로그인 실패 원인은 비밀번호 오입력이 아니라 Cloudflare workerd에서 PBKDF2 210,000회 검증 경로가 실패한 것이었다.
- 신규/재설정 관리자 비밀번호 해시는 scrypt(`N=16384,r=8,p=1`)로 전환했다.
- `scripts/admin/reset-password.mjs`, `admin:diagnose-login`, `admin:unlock` 도구가 있다.
- 사용자가 실제 운영 로그인 성공을 확인했으므로 인증 문제는 해결 상태다.

## 게시글 기능
### 카테고리 계층
- 공개 좌측 메뉴는 실제 부모/자식 트리를 사용한다.
- 상위 카테고리를 누르면 자신과 모든 하위 카테고리의 글을 함께 조회한다.
- 하위 카테고리는 들여쓰기/연결선/우측 정렬로 구분한다.
- 관리자에서 지정한 preset/emoji/image 아이콘과 색상을 공개 메뉴에도 표시한다.
- 게시글 작성/수정 시 자식이 있는 상위 카테고리는 선택 불가이며 실제 글은 leaf 카테고리에만 저장한다.
- `0084_post_category_leaf_invariant.sql`: 기존 부모 직속 글을 첫 번째 leaf로 이동하고 이후 부모 직접 할당을 DB trigger로 차단한다.

### 이미지 첨부
- 게시글 작성/수정에서 이미지 파일 선택, drag&drop, 클립보드 이미지 `Ctrl+V` 붙여넣기를 지원한다.
- PNG/JPEG/WebP, 파일당 최대 8MB.
- 관리자 업로드 `POST /api/admin/posts/image` → R2 `post-images/...` 저장.
- 공개 읽기 `GET /api/public/post-image?key=...`.
- D1에는 바이너리를 저장하지 않고 Markdown URL만 저장한다.
- 공용 Markdown renderer가 이미지를 표시하며 모바일 폭을 넘지 않도록 처리한다.

## JLPT
- JLPT N1 오늘의 학습 데이터는 기간별 생성 완료.
- 신규 일일 데이터 자동 생성은 중지하고 당일 데이터 품질 검증 중심으로 운영한다.
- 원격 D1은 자동으로 직접 변경하지 않는다.

## AP 기본 콘텐츠
- AP 개념 A-01~A-68 검증 완료.
- `0070`: B-07 Incident Response 보정.
- `0071`~`0073`: 기존 AP 개념 문제 실전 4지선다 보강.
- `0074`: 2026-10-01~10-07 科目A 7일×10문제.
- `0075`: AP 일본어 시험 문체 정규화.
- `scripts/ap/validate-content.mjs`: 기존 AP 문제은행 검증.

## AP 모의고사 엔진
- `0076_ap_mock_exam_foundation.sql`: 시험/문제/응시/답안 기본 테이블.
- `0077_ap_mock_exam_structured_written_answers.sql`: 科目B 구조화 답안/채점기준.
- 科目A: 80문제, 150분, 전 문항 답변, 총100점, 합격 60점.
- 科目B: 11문제 중 5문제 선택, Q1 정보보안 필수, 각 20점, 총100점.
- 답안 자동저장, 진행 중 재개, 서버 `started_at` 기준 150분 타이머, A 자동채점, B 부분점수/구조화답안 지원.
- 목록에 미실시/진행중/완료 및 풀이수/점수 표시.
- 실시일은 UTC 문자열 절단이 아니라 `Asia/Tokyo` 기준 `startedAt` 날짜로 표시한다.
- 사용자가 운영에서 A1 한 문제 저장 후 뒤로가기/재개/진행률 표시가 정상임을 확인했다.

## 모의고사 검증 규칙
- `(subject, exam_no)`, `(mock_exam_id, question_no)`, global fingerprint 등 중복 방지 제약이 있다.
- source JSON의 임의 fingerprint를 신뢰하지 않고 `mock-exam-utils.mjs`가 일본어 본문·지문·표·로그·선택지·소문항을 정규화한 뒤 SHA-256을 계산한다.
- `validate-mock-exams.mjs`가 문항 수, 번호, 분야분포, 선택지, 점수, B 필수 Q1, 구조화 소문항, grading schema 합계, 회차 간 중복을 검증한다.

## 科目A ready 회차
- A1: `A-01-01.json`~`A-01-04.json`, 80문제, T50/M10/S20, 정답 위치 20/20/20/20 → `0078`.
- A2: `A-02-01.json`~`A-02-04.json`, 80문제, T50/M10/S20, 정답 위치 20/20/20/20 → `0080`.
- A3: `A-03-01.json`~`A-03-04.json`, 80문제, T50/M10/S20, 정답 위치 21/21/19/19 → `0082`.
- A4: `A-04-01.json`~`A-04-04.json`, 80문제, T50/M10/S20, 정답 위치 20/20/20/20 → generated `0086`.
- A5: `A-05-01.json`~`A-05-04.json`, 80문제, T50/M10/S20, 정답 위치 20/20/20/20 → generated `0089`.
- A6: `A-06-01.json`~`A-06-04.json`, 80문제, T50/M10/S20, 정답 위치 20/20/20/20 → generated `0092`.

## 科目B ready 회차
- B1~B5: 각 11개 공식 분야 1문제씩, Q1 SECURITY 필수, 각 문제 20점/4소문항×5점. Generated migrations는 B1 `0079`, B2 `0081`, B3 `0083`, B4 `0087`, B5 `0090`.
- B6: `B-06-01.json`~`B-06-11.json`, 동일 규칙으로 ready.
  - Q1 SECURITY: OAuth Authorization Code Interception, PKCE(S256), 안전한 redirect, 토큰 폐기.
  - Q2 STRATEGY: 병목설비 제품믹스/분당 공헌이익.
  - Q3 PROGRAMMING: Union-Find, cycle detection, amortized `O(α(n))`.
  - Q4 ARCHITECTURE: Transactional Outbox, dual-write, idempotency.
  - Q5 NETWORK: L2 loop, broadcast storm, RSTP, Root Bridge.
  - Q6 DATABASE: 대규모 access log, `(tenant_id, occurred_at)` 복합 인덱스와 월별 range partition.
  - Q7 EMBEDDED: RTOS CPU utilization, priority inversion/inheritance, Watchdog.
  - Q8 SYSTEM_DEV: 상태전이 테스트, SHIPPED→CANCELLED 결함, RTM.
  - Q9 PROJECT_MGMT: Resource Conflict/Leveling, 9일→13일 일정.
  - Q10 SERVICE_MGMT: Change Failure Rate 4%, Standard/Emergency Change, rollback plan.
  - Q11 AUDIT: CI/CD 자기승인 SoD 문제, branch protection, 변조 곤란 로그, 예외율 20%.
- B6 generated migration: `0093_ap_mock_exam_b06_questions.sql`.

## 4~6회차 DB 연결
- `0085_ap_mock_exam_round04_shells.sql` → A4/B4 master.
- `0086`, `0087` → A4/B4 generated questions.
- `0088_ap_mock_exam_round05_shells.sql` → A5/B5 master.
- `0089`, `0090` → A5/B5 generated questions.
- `0091_ap_mock_exam_round06_shells.sql` → A6/B6 master.
- `0092`, `0093` → A6/B6 generated questions.
- `package.json`의 `ap:mock:build`는 현재 A1~A6/B1~B6 총 12회차를 검증하고 모든 question migration을 생성한다.

## 최신 검증 상태
- `Verify AP Mock Exams` #62 PASS.
  - A1~A6/B1~B6 총 12회차 validator PASS.
  - browser mock scripts syntax PASS.
  - 전체 mock migration build PASS.
  - `0091` 및 generated `0092`/`0093` 존재 검증 PASS.
- 전체 `Verify` #1019 PASS.
  - TypeScript PASS.
  - Browser JavaScript syntax PASS.
  - Vitest PASS.
  - `0091`→`0092`→`0093`을 포함한 local D1 migration PASS.
  - seeded catalog/study schema 검증 PASS.
- 따라서 현재 Git 기준으로 AP 모의고사 A1~A6/B1~B6 총 12회차가 source·중복/구조 validator·migration 생성·local D1 적용까지 통과한 상태다.

## 적용 명령
원격에 아직 반영하지 않은 회차가 있으면 사용자 Cloudflare 인증 환경에서:
```bash
cd ~/song-project
git pull
npm run db:migrate:remote
npm run deploy
```
`db:migrate:remote`는 먼저 `ap:mock:build`를 수행하므로 source 검증 실패 시 DB 적용까지 진행되지 않는다.

## 다음 작업
1. 운영 D1에 미적용된 4~6회차를 `git pull` → `npm run db:migrate:remote` → `npm run deploy`로 반영.
2. 운영 목록에서 科目A/科目B 第6回까지 노출되는지 간단 스모크 테스트.
3. 다음 콘텐츠 작업은 科目A/科目B 7회차 제작.
4. 게시글 이미지 첨부 운영 스모크 테스트는 사용자가 원할 때 별도 확인.
