# Web legal

`apps/web/src/legal` owns product-facing legal document rendering for `/terms`, `/privacy`, and signup legal consent surfaces.

- `api/`: legal document fetch, validation, and UI mapping helpers.
- `components/`: accessible document layout, TOC, signup consent summary, document dialog, and unavailable states.
- `content/`: seed-synced fallback documents and user-facing legal copy. Public `/terms` and
  `/privacy` fallback bodies use formal article headings while signup consent summaries stay short
  and user-friendly. `content/legal-fallback-documents.ts` is the fallback document source.
- `model/`: Web-only view models derived from `@repo/shared/legal` contracts. Add `hooks/` or
  `fixtures/` only when a concrete runtime owner appears; do not create empty owner directories.

Rules:

- Do not import `apps/web/src/constants/legal/**` from `/terms` or `/privacy` routes.
- Signup consent must use active legal document ids for `terms`, `personal data collection/use consent`, `age notice`, and shown `privacy policy`.
- Treat privacy policy as a public notice/read evidence, not as a signup consent checkbox.
- Do not store full legal document bodies in browser storage.
- Keep user-facing copy free of plan, issue, internal file-path wording, raw legal version ids, and internal state names.
- Render public version labels as user-friendly effective-date text, not raw ids such as
  `privacy-YYYY-MM-DD`.
- Keep Web fallback legal bodies in sync with the API legal seed source when changing public
  `/terms` or `/privacy` copy.
- Keep the public page header regression protected: the brand link shows the service logo
  (`@/screens/ui/brand`), the secondary navigation action is `이전 화면으로`, and route metadata must
  not repeat the service name (the root title template adds `돔두리 | `).

Release handoff:

- The fallback bodies name the Web-stage processors (server, email sending and domain; Landing visit
  analytics; inquiry email), the overseas transfer table, the privacy officer and the inquiry email.
  Database, file storage and observability processors are not chosen yet; add them to privacy
  article 4 when they are. Whether a legal/privacy expert reviews the copy before the real user
  release is tracked as a GitHub issue rather than inline TODO copy.
- Document id, version and effective-date rules belong to
  [legal-basis.md LB-R6](../../../../docs/policies/legal-basis.md).
- `__tests__/legal-document-source-sync.test.ts` keeps the fallback equal to the API seed and the
  inquiry email equal to the Landing footer address. It runs only in the Web CI lane, so change the
  seed and the fallback in the same commit.

Verification surface:

- `/terms` and `/privacy` route tests must keep public access, single `<h1>`, API-first rendering, seed-synced fallback rendering, user-facing version labels, mobile TOC placement, heading hierarchy, and `force-dynamic` behavior covered.
- Playwright smoke should keep unauthenticated `/terms` and `/privacy` fallback rendering, public document actions, and internal-copy negative assertions covered without requiring an API fixture.
- Signup legal tests must cover stale legal document ids, fallback ids, no full-body browser storage, and required consent separation from privacy-policy read evidence.
- Dialog tests should keep the minimum accessibility contract covered: `role="dialog"`, `aria-modal`, ESC/close-button dismissal, focus restoration, focus trap, and mobile scroll/touch-target classes.
