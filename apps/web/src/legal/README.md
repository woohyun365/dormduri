# Web legal

`apps/web/src/legal` owns product-facing legal document rendering for `/terms`, `/privacy`, and later signup legal consent surfaces.

- `api/`: legal document fetch, validation, and UI mapping helpers.
- `components/`: accessible document layout, TOC, and unavailable states.
- `content/`: seed-synced fallback documents and user-facing legal copy.
- `types/`: Web-only view models derived from `@repo/shared/legal` contracts.

Rules:

- Do not import `apps/web/src/constants/legal/**` from `/terms` or `/privacy` routes.
- Do not store full legal document bodies in browser storage.
- Keep user-facing copy free of plan, issue, or internal file-path wording.
