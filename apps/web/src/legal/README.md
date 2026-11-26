# Web legal

`apps/web/src/legal` owns product-facing legal document rendering for `/terms`, `/privacy`, and signup legal consent surfaces.

- `api/`: public reading loaders (`legal-document.server.ts`), the last success store
  (`legal-last-success.store.ts`), response validation, and UI mapping helpers.
- `components/`: accessible document layout, TOC, the route view for each load state
  (`LegalDocumentRouteView.tsx`), signup consent summary, document dialog, and unavailable states.
- `content/`: user-facing legal screen copy only. The Web keeps no copy of a legal document body.
- `model/`: Web-only view models and load states derived from `@repo/shared/legal` contracts. Add
  `hooks/` or `fixtures/` only when a concrete runtime owner appears; do not create empty owner
  directories.
- `test-support/`: test-only legal documents built from the API legal seed
  (`apps/api/prisma/seed-data/reference/`). Tests, stories and the Playwright fixture read their
  legal text from here; production code may not import it (eslint `import/no-restricted-paths`).

Public reading:

- Each `/terms`·`/privacy` request asks the user API once (`/api/legal/documents/:kind/page`, 3 s
  timeout). The comparison table (`/versions/:versionKey/comparison`) and the revision notices
  (`/api/legal/revision-notices`) loaders work the same way for the screens that draw them.
- A contract response is the published version and is kept as the last success of that request (a
  file per endpoint, kind and version key, written as a temporary file then renamed in the same
  directory, `DORMDURI_LEGAL_LAST_SUCCESS_DIR`). The API answers from its database or from its
  in-memory versions; the Web does not tell them apart.
- An API `404 LEGAL_DOCUMENT_VERSION_NOT_FOUND` for a version address shows "no such version" and
  deletes that version's file. A malformed `?version=` shows the same without calling the API.
- Any other failure (no connection, timeout, error status, a body outside the contract) shows the
  kept file again after checking it with the shared schema, with the time it was checked; without
  a valid file the page says the document cannot be loaded. Each answer from a kept file, and each
  response the Web could not keep, writes one `web_legal_last_success` operational log line
  (endpoint, kind, version key, and the checked time or the file system error code of the failed
  write; no text, no reader).
- The Web never decides which version is in effect or scheduled; the API owns those rules.
- The kept files live in a runtime volume, so the store's paths carry Turbopack ignore comments:
  a dynamic path would make the build trace the whole project into the server output.
- A shown document carries a hidden source mark (`data-dormduri-legal-source`, `published` or
  `last-success`). The Web deploy smoke keeps a new Web only when both routes are marked
  `published` (`infra/deploy/user/ssm/deploy.sh`); a screen that replaces the route view keeps the
  mark.
- Signup needs the active bundle from the API: without it the consent step blocks signup and offers
  to load again. There is no Web copy of the version ids.

Rules:

- Do not import `apps/web/src/constants/legal/**` from `/terms` or `/privacy` routes.
- Signup consent must use active legal document ids for `terms`, `personal data collection/use consent`, `age notice`, and shown `privacy policy`.
- Treat privacy policy as a public notice/read evidence, not as a signup consent checkbox.
- Do not store full legal document bodies in browser storage. The last success files live on the
  Web server only and hold public documents only.
- Keep user-facing copy free of plan, issue, internal file-path wording, raw legal version ids, and internal state names.
- Render public version labels as user-friendly effective-date text, not raw ids such as
  `privacy-YYYY-MM-DD`.
- Keep the public page header regression protected: the brand link shows the service logo
  (`@/screens/ui/brand`), the secondary navigation action is `이전 화면으로`, and route metadata must
  not repeat the service name (the root title template adds `돔두리 | `).

Release handoff:

- Legal text changes go through the backoffice draft, approval and publication path
  (`docs/runbooks/legal-publication.md`); the seed holds the first versions only.
- Document id, version and effective-date rules belong to
  [legal-basis.md LB-R6](../../../../docs/policies/legal-basis.md).
- `__tests__/legal-document-source-sync.test.ts` checks the seed versions in effect and the first
  revision drafts: the inquiry email equals the Landing footer address, the overseas transfer and
  retention tables. It runs in the Web CI lane; the change classifier also runs that lane when
  only an API legal seed file changes (`WEB_TEST_API_SEED_FILES` in
  `scripts/ci/lanes/classify-changes.mjs`).

Verification surface:

- `/terms` and `/privacy` route tests must keep public access, single `<h1>`, the published and
  last-success rendering with the checked time, "cannot load" and "no such version" states, version
  addresses, user-facing version labels, mobile TOC placement, heading hierarchy, and
  `force-dynamic` behavior covered.
- Loader tests cover each failure kind, the 404 file deletion, malformed version keys without an
  API call, the timeout, an invalid kept file, and a write failure that still shows the published
  version.
- Playwright Web-only smoke (no API) renders `/terms` and `/privacy` from last success files the
  global setup writes from the seed (`e2e/support/legal-last-success-fixture.ts`), with public
  document actions and internal-copy negative assertions; `e2e/legal.fullstack.spec.ts` covers the
  published path against the seeded API.
- Signup legal tests must cover stale legal document ids, the blocked step without the bundle, no
  full-body browser storage, and required consent separation from privacy-policy read evidence.
- Dialog tests should keep the minimum accessibility contract covered: `role="dialog"`, `aria-modal`, ESC/close-button dismissal, focus restoration, focus trap, and mobile scroll/touch-target classes.
