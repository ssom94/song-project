# 10. 화면 인벤토리 / 画面インベントリ

기준: 2026-08-30 UI 구성 단계. `UI 완료`는 화면 구조가 존재한다는 뜻이며 API/D1 영구저장 완료를 의미하지 않는다.

基準: 2026-08-30 UI構成段階。`UI完了`は画面構造が存在することを示し、API/D1永続化完了を意味しない。

## 공개 / 公開

| 상태 | Route | 화면 |
|---|---|---|
| ✅ UI 완료 | `/` | 홈 대시보드: 최근글 / D-Day / JLPT / 2029 목표 |
| ✅ UI 완료 | `/ja/posts/` | 일본어 게시글 목록 + 카테고리 게시판 |
| ✅ UI 완료 | `/ko/posts/` | 한국어 게시글 목록 + 카테고리 게시판 |
| ✅ UI 완료 | `/{lang}/posts/:slug` | 게시글 상세 + Markdown + 댓글 UI |
| ✅ UI 완료 | `/ja/japanese/` | 일본어 학습 메인 JA |
| ✅ UI 완료 | `/ko/japanese/` | 일본어 학습 메인 KO |
| ✅ UI 완료 | `/{lang}/japanese/words/` | 단어 목록/검색/필터 UI |
| ✅ UI 완료 | `/{lang}/japanese/quiz/` | 퀴즈 설정 UI |
| ✅ UI 완료 | `/{lang}/japanese/quiz/play/` | 퀴즈 플레이 UI |
| ✅ UI 완료 | `/{lang}/japanese/quiz/result/` | 결과/오답 UI |
| ✅ UI 완료 | `/{lang}/skill-sheet/` | 공개 스킬 요약 |
| ✅ UI 완료 | `/{lang}/career/` | 공개 경력 요약 |
| ✅ UI 완료 | `/protected/` | 접근코드 입력 |
| ✅ UI 완료 | `/protected/viewer/` | 보호 문서 페이지 뷰어 |

## 관리자 / 管理者

| 상태 | Route | 화면 |
|---|---|---|
| ✅ | `/admin/login/` | 로그인 |
| ✅ | `/admin/` | 관리자 대시보드 |
| ✅ UI 완료 | `/admin/goals/` | 목표·홈 대시보드 설정 |
| ✅ | `/admin/posts/` | 게시글 목록 |
| ✅ | `/admin/posts/new/` | 새 글 |
| ✅ | `/admin/posts/edit/` | 보기→수정 |
| ✅ | `/admin/posts/preview/` | 저장 전 미리보기 |
| ✅ UI 완료 | `/admin/comments/` | 댓글 관리/상태 필터 |
| ✅ | `/admin/categories/` | 카테고리 관리 |
| ✅ | `/admin/categories/tags/` | 태그 관리 |
| ✅ | `/admin/japanese/` | 일본어 단어 관리 |
| ✅ | `/admin/japanese/parts/` | 품사 관리 |
| ✅ UI 완료 | `/admin/japanese/categories/` | 학습분류 관리 |
| ✅ UI 완료 | `/admin/japanese/quiz/` | 퀴즈 설정 |
| ✅ UI 완료 | `/admin/japanese/quiz/play/` | 관리자 퀴즈 플레이 |
| ✅ UI 완료 | `/admin/japanese/quiz/result/` | 관리자 퀴즈 결과/오답 |
| ✅ UI 완료 | `/admin/documents/` | 보호 문서/버전 관리 |
| ✅ UI 완료 | `/admin/access-codes/` | 접근코드 발급/목록 |

## 다음 단계: 기능 연결 / 次段階: 機能接続

화면을 더 만드는 단계는 일단 종료하고 아래 순서로 실제 데이터를 연결한다.

1. **공개 일본어 Read API**
   - 등록 단어 수 / JLPT별 수 / 단어 목록
   - 품사/학습분류 필터
2. **퀴즈 엔진 + 이력 schema**
   - word → reading
   - word → Korean meaning
   - example blank → word
   - direct input / 4 choices
   - attempts / wrong-answer history / daily stats
3. **목표·대시보드 D1 persistence**
   - 자동/직접 목표
   - D-Day
   - 목표 status/progress/show/hide/order
4. **공개 홈 API 연결**
   - 일본어 통계
   - D-Day
   - 목표 진행률
5. **댓글 API**
   - visitor create/edit/delete with password hash
   - one-depth reply
   - admin moderation
6. **보호문서/접근코드 API + R2**
   - upload/version metadata
   - private preview authorization
   - code hash/session/revoke/expiry
7. **전체 테스트**
   - `seeds/test_data.sql`
   - `09_ui_test_cases_ko-ja.md`

## 화면 수정 우선순위 / UI修正優先順位

전체 테스트 전 사용자가 직접 보면서 수정할 때 추천 순서:

1. 공개 홈
2. 공개 게시글 목록/상세
3. 공개 일본어 학습 메인
4. 단어 목록
5. 퀴즈 설정/플레이/결과
6. Skill Sheet / Career History
7. 보호 문서 접근/뷰어
8. 관리자 목표 화면
9. 일본어 관리자 화면 묶음
10. 댓글/보호문서/접근코드 관리자
