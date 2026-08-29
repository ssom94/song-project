# 11. 기능 연결 계획 / 機能接続計画

UI 화면 구성 완료 후 실제 데이터와 기능을 연결하는 순서.

## Phase 1 — 공개 일본어 Read API

### API
- `GET /api/public/japanese/stats`
  - total words
  - JLPT counts
  - quiz/wrong stats when history exists
- `GET /api/public/japanese/words`
  - query: `q`, `jlpt`, `category`, `part`, `limit`, `cursor`
  - word / reading / meaning_ko / meaning_ja / JLPT / primary POS / categories / example
- `GET /api/public/japanese/taxonomy`
  - JLPT / parts of speech / study categories

### UI 연결
- `/{lang}/japanese/`
- `/{lang}/japanese/words/`
- 공개 홈 JLPT 카드

## Phase 2 — Quiz schema & engine

### 신규 테이블 후보
- `japanese_quiz_sessions`
- `japanese_quiz_attempts`
- `japanese_word_learning_stats`

### 저장 필드 핵심
- session settings JSON
- question_type: `reading | meaning_ko | sentence_blank`
- word_id / example_id
- answer_text
- normalized_answer
- is_correct
- answered_at
- wrong_count / correct_count / last_answered_at / last_wrong_at

### Quiz API 후보
- `POST /api/public/japanese/quiz/session`
- `GET /api/public/japanese/quiz/question?session=...`
- `POST /api/public/japanese/quiz/answer`
- `GET /api/public/japanese/quiz/result?session=...`

### 규칙
- sentence blank는 예문에 대상 단어가 실제 포함된 경우만 출제
- 4지선다 오답 선택지는 같은 JLPT/품사 우선
- 동일 세션에서 같은 단어 반복 최소화
- 오답 우선 모드는 wrong_count와 last_wrong_at 반영

## Phase 3 — Goal / dashboard persistence

### 신규 테이블 후보
- `dashboard_settings`
- `dashboard_goals`

### dashboard_settings
- jlpt_goal_mode: `auto | manual`
- jlpt_manual_target
- show_jlpt

### dashboard_goals
- id
- key / title
- target_date
- progress_percent
- status: `planned | progress | done`
- display_order
- is_visible
- goal_type
- target_count / completed_count (portfolio 등)

### API 후보
- Admin: `GET/PATCH /api/admin/dashboard`
- Public: `GET /api/public/dashboard`

## Phase 4 — Comments

### Public
- `GET /api/public/comments?post=...`
- `POST /api/public/comments`
- edit/delete password verification endpoint

### Admin
- `GET /api/admin/comments`
- `PATCH /api/admin/comments/:id/status`

### 정책
- public: `visible` only
- 1-depth reply UI
- plain text only
- visitor password hash required
- IP original encrypted / hash for moderation / masked only for UI

## Phase 5 — Protected documents / access code

### Admin
- document/version metadata
- original file upload to private R2
- conversion job state
- preview PNG metadata
- current version switching
- access code create/revoke/list

### Public
- access-code verify
- protected session cookie
- authorized current document metadata
- authorized private preview page delivery
- authorized original Excel download

### Security
- raw access code never stored
- raw session token never stored
- session expiry <= code expiry
- revoked code invalidates sessions immediately
- R2 stays private

## Phase 6 — AI translation / Japanese AI helper

- OpenAI API key only Worker Secret
- AI translation is admin write-time only
- visitor request must not call AI
- source update marks target translation pending/stale until regenerated/reviewed
- Japanese word suggestion remains draft until admin review

## Phase 7 — Integration test

1. migrations local apply
2. `npm run seed:test:local`
3. `npm run dev`
4. execute `09_ui_test_cases_ko-ja.md`
5. visual fixes PC → tablet → mobile
6. API/security negative tests
7. intentional remote seed/test only after local pass
8. remove/disable test data before production acceptance if needed

## 완료 정의 / 完了定義

- 화면: `10_screen_inventory_ko-ja.md` 전부 확인
- 기능: 위 Phase 1~6 연결
- 테스트: `09_ui_test_cases_ko-ja.md` Critical PASS
- 공개 보안: draft/private/pending/unauthorized R2 데이터 미노출
