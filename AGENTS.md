# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Frontend Structure Rules

Keep HTML, CSS, and JavaScript separated.

- Do not add inline `<style>` blocks or `style` attributes for normal page styling. Put styles in `public/assets/css/`.
- Do not add inline executable `<script>` blocks. Put JavaScript in `public/assets/js/` and load it with `src`.
- Put site-wide shared styles/scripts in common files and area-wide shared files in their area folder.
- Put screen-specific styles/scripts in files named for that screen or feature.
- Reuse shared behavior instead of copying the same JavaScript between HTML pages.
- Keep common admin translations in `public/assets/i18n/admin/{lang}.json`.
- For screen-specific translations, set `data-i18n-scope="<screen>"` on `<body>` and use `public/assets/i18n/admin/<screen>/{lang}.json`.

Current admin JavaScript structure:

```text
public/assets/js/admin/
├─ common.js                 # admin session gate, user menu, logout, shared modal behavior
├─ i18n.js                   # admin language switching + optional screen-scoped translation merging
├─ menu.js                   # admin navigation rendering
├─ layout.js                 # sidebar and responsive layout behavior
├─ login.js                  # login page only
├─ posts-list.js             # post list loading, search, filters, view links
├─ post-categories.js        # shared category loading + searchable multi-tag selector for post create/view/edit
├─ post-editor.js            # shared post create/edit form behavior, validation, and taxonomy payloads
├─ post-edit.js              # existing post view/edit state, dirty tracking, update requests
├─ post-preview-launcher.js  # sends the current unsaved editor state to the admin preview tab
├─ post-preview.js           # authenticated preview-tab renderer
├─ categories.js             # category list/create/edit/delete screen behavior
├─ tags.js                   # tag list/create/edit/delete screen behavior
├─ japanese.js               # Japanese word CRUD, duplicate checks, multiple meanings/parts, examples, list filters
├─ japanese-parts.js         # Japanese part-of-speech hierarchy create/edit/delete and usage checks
└─ dashboard-goals.js        # goal/dashboard UI preview; D1 persistence is a later integration step
```

Current admin routes:

```text
/admin/                         # dashboard
/admin/goals/                   # goals / dashboard settings
/admin/posts/                   # posts
/admin/posts/new/               # create post
/admin/posts/edit/              # view/edit post
/admin/posts/preview/           # authenticated preview
/admin/comments/                # comment moderation UI
/admin/categories/              # categories
/admin/categories/tags/         # tags
/admin/japanese/                # Japanese word management
/admin/japanese/parts/          # parts-of-speech management
/admin/japanese/categories/     # study category management
/admin/japanese/quiz/           # quiz setup
/admin/japanese/quiz/play/      # quiz play UI
/admin/japanese/quiz/result/    # quiz result / wrong answers UI
/admin/documents/               # protected document/version UI
/admin/access-codes/            # access-code UI
```

The Japanese learning schema in `0004_japanese_learning.sql` is designed so words and examples can power quizzes such as word-to-reading, word-to-Korean-meaning, and sentence-blank-to-word questions. A Japanese word is treated as one logical record: duplicate word creation is blocked, multiple Korean meanings are stored within that record, and the existing word/part junction supports multiple parts of speech with one primary part. `0009_japanese_parts_seed.sql` supplies the standard reusable part-of-speech hierarchy. Quiz attempt/history tables should be added separately when persistent quiz history is implemented.

Public frontend structure:

```text
public/assets/css/
├─ common.css
├─ markdown.css
├─ blog/
│  ├─ common.css
│  ├─ dashboard-shell.css       # shared public topbar/sidebar/responsive shell
│  ├─ home.css
│  ├─ posts.css
│  ├─ post-detail.css
│  └─ comments.css
├─ japanese/
│  └─ common.css                # public Japanese learning screens
└─ protected/
   └─ common.css                # skill/career/protected-access screens

public/assets/js/
├─ markdown.js
├─ blog/
│  ├─ dashboard-shell.js        # public sidebar/mobile/category behavior
│  ├─ home.js
│  ├─ posts-list.js
│  └─ post-detail.js
└─ japanese/
   └─ common.js                 # shared public Japanese-module sidebar boards
```

Current public routes:

```text
/                               # portfolio/blog/learning dashboard
/ja/posts/                      # JA post list
/ko/posts/                      # KO post list
/{lang}/posts/:slug             # dynamic post detail
/ja/japanese/                   # JA Japanese-learning dashboard
/ko/japanese/                   # KO Japanese-learning dashboard
/{lang}/japanese/words/         # word library UI
/{lang}/japanese/quiz/          # quiz setup UI
/{lang}/japanese/quiz/play/     # quiz play UI
/{lang}/japanese/quiz/result/   # quiz result / wrong-answer UI
/{lang}/skill-sheet/            # public skill summary
/{lang}/career/                 # public career summary
/protected/                     # access-code entry
```

Public APIs must never return draft/private posts or translations whose status is `pending`. Protected document originals/previews remain private and must only be served after authorization when the access API is implemented.

## Test data and test cases

- Reusable D1 test seed: `seeds/test_data.sql`
- Consolidated test cases: `document/1.blog-design/09_ui_test_cases_ko-ja.md`
- Reserved seed IDs start at `900000001`.
- The seed is designed for repeat execution with fixed IDs and `INSERT OR IGNORE`.
- Local seed command: `npx wrangler d1 execute song-project-db --local --file=./seeds/test_data.sql`
- Do not apply test seed to remote production data casually. Use `--remote` only during an intentional integration-test step.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
