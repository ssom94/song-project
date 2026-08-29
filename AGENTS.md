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
├─ common.js           # admin session gate, user menu, logout, shared modal behavior
├─ i18n.js             # admin language switching + optional screen-scoped translation merging
├─ menu.js             # admin navigation rendering
├─ layout.js           # sidebar and responsive layout behavior
├─ login.js            # login page only
├─ posts-list.js       # post list loading, search, filters, view links
├─ post-categories.js  # shared category loading + searchable multi-tag selector for post create/view/edit
├─ post-editor.js      # shared post create/edit form behavior, validation, and taxonomy payloads
├─ post-edit.js        # existing post view/edit state, dirty tracking, update requests
├─ categories.js       # category list/create/edit/delete screen behavior
└─ tags.js             # tag list/create/edit/delete screen behavior
```

Current CSS structure follows the same principle under `public/assets/css/` and `public/assets/css/admin/`.

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
