# BLOG DESIGN NOTE 01
## Cloudflare 기반 개인 블로그 / Cloudflareベース 個人ブログ

작성 기준일 / 作成基準日: 2026-08-29  
문서 버전 / 文書版: v3 - 다국어·이력·일본어 학습 모듈 반영

## 1. 프로젝트 목표 / プロジェクト目標

### 한국어
Cloudflare를 중심으로 장기간 운영할 개인 개발 블로그를 구축한다. 글 작성은 관리자 1명만 가능하며, 일반 방문자는 회원가입이나 로그인 없이 글을 읽고 비회원 댓글을 작성할 수 있다. 사이트 기본 언어는 일본어이며 상단 언어 선택으로 일본어/한국어 UI와 게시글 번역본을 전환한다. 추가로 JLPT 단어 등록, AI 보조 분석, 예문 관리, 필기 연습이 가능한 일본어 학습 모듈을 같은 서비스 안에 구성한다.

### 日本語
Cloudflareを中心に長期間運用できる個人開発ブログを構築する。記事作成は管理者1名のみとし、一般訪問者は会員登録やログインなしで記事閲覧と非会員コメント投稿ができる。サイトの既定言語は日本語とし、画面上部の言語選択で日本語/韓国語のUIと記事翻訳を切り替える。さらに、JLPT単語登録、AI補助分析、例文管理、手書き練習ができる日本語学習モジュールを同一サービス内に構成する。

## 2. 블로그 핵심 기능 / ブログ主要機能

- 관리자 1명만 로그인하고 게시글을 작성/수정/삭제한다.  
  管理者1名のみがログインし、記事の作成・編集・削除を行う。
- 방문자는 회원가입/로그인 없이 글을 읽고 비회원 댓글을 작성한다.  
  訪問者は会員登録・ログインなしで記事閲覧と非会員コメント投稿ができる。
- 게시글에는 제목, Markdown 본문, 요약, 대표 이미지, 계층형 카테고리, 복수 태그, 작성/수정/공개일, 조회수가 있다.  
  記事にはタイトル、Markdown本文、要約、アイキャッチ画像、階層カテゴリ、複数タグ、作成/更新/公開日時、閲覧数を持つ。
- 코드 블록, Syntax Highlight, 코드 주석, 복사 버튼, NOTE/TIP/WARNING 메모 블록을 지원한다.  
  コードブロック、シンタックスハイライト、コメント、コピー、NOTE/TIP/WARNING表示に対応する。
- 게시글/카테고리/태그는 Soft Delete를 기본으로 한다.  
  記事・カテゴリ・タグはSoft Deleteを基本とする。
- 게시글 변경은 revision으로, 주요 관리자 작업은 audit log로 남겨 과거 상태 확인과 복구가 가능하게 한다.  
  記事変更はrevision、主要管理操作はaudit logへ記録し、過去状態の確認・復元を可能にする。
- 댓글 작성자의 실제 IP는 저장하되 관리자에게만 표시한다.  
  コメント投稿者の接続元IPを保存し、管理者だけが確認できる。
- 동일 방문자의 동일 글 조회는 1시간 내 1회만 조회수로 계산한다.  
  同一訪問者・同一記事の閲覧は1時間以内1回のみカウントする。

## 3. 다국어 정책 / 多言語ポリシー

- 기본 언어: `ja`, 지원 언어: `ja`, `ko`, 향후 `en` 추가 가능 구조.  
  既定言語: `ja`、対応言語: `ja`, `ko`、将来 `en` を追加可能な構造。
- 상단 언어 선택으로 UI 문구와 게시글 번역본을 함께 전환한다.  
  画面上部の言語選択でUI文言と記事翻訳を同時に切り替える。
- 한국어 원문 작성 시 일본어 번역본, 일본어 원문 작성 시 한국어 번역본을 생성해 DB에 저장한다.  
  韓国語原文から日本語訳、日本語原文から韓国語訳を生成しDBへ保存する。
- 자동 번역 결과는 관리자가 수정/검토할 수 있으며 실시간 페이지 요청마다 번역하지 않는다.  
  自動翻訳結果は管理者が編集・レビューでき、ページ表示のたびに翻訳しない。
- 공개 URL은 `/{lang}/...` 형식을 사용하고 `/`는 일본어 홈으로 처리한다.  
  公開URLは `/{lang}/...` を使用し、`/` は日本語ホームを既定とする。

## 4. 관리자 화면 / 管理画面

```text
/admin
├─ /posts                 게시글 및 번역 관리 / 記事・翻訳管理
├─ /comments              댓글 및 IP 관리 / コメント・IP管理
├─ /categories            계층형 카테고리 / 階層カテゴリ
├─ /tags                  태그 / タグ
├─ /history               전체 변경 이력 / 変更履歴
└─ /japanese              일본어 학습 관리 / 日本語学習管理
   ├─ /words               단어 목록 / 単語一覧
   ├─ /words/new           단어 추가 / 単語追加
   ├─ /levels              JLPT 급수 / JLPTレベル
   ├─ /parts-of-speech     품사 / 品詞
   ├─ /categories          학습 분류 / 学習分類
   └─ /ai-review           AI 분석 검토 / AI分析レビュー
```

## 5. 공개 화면 / 公開画面

```text
/                       -> 일본어 홈 / 日本語ホーム
/ja/, /ko/              언어별 홈 / 言語別ホーム
/{lang}/posts            게시글 목록 / 記事一覧
/{lang}/posts/:slug      게시글 상세 + 댓글 / 記事詳細 + コメント
/{lang}/categories/:slug 카테고리별 글 / カテゴリ別記事
/{lang}/tags/:slug       태그별 글 / タグ別記事
/{lang}/search           검색 / 検索
/japanese                일본어 학습 홈 / 日本語学習ホーム
/japanese/words          단어 학습 / 単語学習
/japanese/words/:id      단어 상세 + 필기 / 単語詳細 + 手書き
```

## 6. 일본어 학습 모듈 요구사항 / 日本語学習モジュール要件

- JLPT 단어를 수동 또는 향후 CSV/Excel 방식으로 등록한다.  
  JLPT単語を手動、将来的にはCSV/Excelでも登録できるようにする。
- 단어, 히라가나 읽기, 한국어 뜻, 일본어 설명, 예문을 저장한다.  
  単語、ひらがな読み、韓国語意味、日本語説明、例文を保存する。
- JLPT N1~N5, 품사, 학습 분류를 관리자에서 선택/관리한다.  
  JLPT N1〜N5、品詞、学習分類を管理画面から選択・管理する。
- AI는 읽기, 한국어 뜻, 일본어 설명, 품사, JLPT 급수 후보, 분류 후보, 예문을 제안할 수 있다.  
  AIは読み、韓国語意味、日本語説明、品詞、JLPTレベル候補、分類候補、例文を提案できる。
- AI 결과는 즉시 확정 저장하지 않고 검토 후 적용한다.  
  AI結果は自動確定せず、レビュー後に適用する。
- 단어마다 여러 예문을 저장할 수 있다.  
  1単語に複数の例文を保存できる。
- 마우스/터치/펜으로 Canvas에 단어를 직접 쓰고 필기 결과를 저장한다.  
  マウス/タッチ/ペンでCanvasへ手書きし、その結果を保存する。
- 필기 좌표(stroke JSON)는 D1, 완성 PNG 이미지는 R2에 저장한다.  
  ストローク座標(JSON)はD1、完成PNGはR2へ保存する。
- 향후 획 재생, 이전 필기 비교, 정확도/획순 판정으로 확장 가능하게 한다.  
  将来、筆順再生、過去手書き比較、精度・筆順判定へ拡張可能な構造とする。

## 7. Cloudflare 시스템 구조 / Cloudflareシステム構成

- Cloudflare Workers: Frontend + API + 언어 라우팅
- Cloudflare D1: 블로그, 번역, 댓글, 학습 단어, 예문, AI 검토 데이터, 필기 좌표
- Cloudflare R2: 대표/본문 이미지 + 필기 PNG
- GitHub: 소스코드와 Markdown/PDF 설계 문서 버전 관리
- Cloudflare Builds: `main` push 자동 배포, `document/**`는 Build watch 제외

## 8. 데이터 모델 후보 / データモデル候補

### 블로그 / ブログ
`admins`, `posts`, `post_translations`, `post_revisions`, `categories`, `category_translations`, `tags`, `tag_translations`, `post_tags`, `comments`, `audit_logs`

### 일본어 학습 / 日本語学習
`japanese_words`, `japanese_word_examples`, `jlpt_levels`, `parts_of_speech`, `japanese_word_parts_of_speech`, `japanese_categories`, `japanese_word_categories`, `japanese_word_ai_drafts`, `japanese_handwriting_attempts`

향후 복습 기능이 필요하면 `japanese_word_progress`를 추가한다.  
将来復習機能が必要になれば `japanese_word_progress` を追加する。

## 9. 삭제·이력·백업 원칙 / 削除・履歴・バックアップ方針

- 중요 데이터는 Soft Delete를 우선한다.
- `post_revisions`: 게시글 버전 복구.
- `audit_logs`: 누가 무엇을 변경했는지 추적.
- revision/audit은 백업 자체가 아니며 D1/R2 전체 백업 정책을 별도로 구성한다.
- AI 제안과 적용 여부도 추적 가능하게 설계한다.

## 10. 개발 순서 / 開発順序

1. 요구사항 및 DB 설계 확정
2. D1 migration 작성
3. 관리자 인증
4. 다국어 UI/라우팅
5. 게시글/번역 CRUD
6. 카테고리/태그/이력/복구
7. R2 이미지
8. 공개 블로그/검색/댓글/조회수
9. 일본어 단어 CRUD + 분류 관리
10. AI 단어 분석/검토
11. 예문 관리
12. Canvas 필기 + D1 stroke/R2 PNG 저장
13. SEO, Turnstile, Rate Limit, 백업, 운영 문서

## 11. 문서 관리 / ドキュメント管理

```text
song-project/
└─ document/
   └─ 1.blog-design/
      ├─ 01_requirements_and_plan_ko-ja.md/pdf
      ├─ 02_database_design_ko-ja.md/pdf
      ├─ 03_japanese_learning_module_ko-ja.md/pdf
      └─ ...
```
