# Web legal

`apps/web/src/legal` owns product-facing legal document rendering for `/terms`, `/privacy`, and signup legal consent surfaces.

- `api/`: legal document fetch, validation, and UI mapping helpers.
- `components/`: accessible document layout, TOC, signup consent summary, document dialog, and unavailable states.
- `content/`: seed-synced fallback documents and user-facing legal copy. Public `/terms` and
  `/privacy` fallback bodies use formal article headings while signup consent summaries stay short
  and user-friendly.
- `types/`: Web-only view models derived from `@repo/shared/legal` contracts.

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
- Keep the public page header regression protected: the brand link shows the KNU logo, the
  secondary navigation action is `이전 화면으로`, and route metadata must not duplicate
  `| KNU 룸메`.

Release handoff:

- Production legal copy still needs release decisions for the dedicated privacy/support contact,
  production provider/entrustment table, and legal/privacy expert review evidence. Track those as
  GitHub issues rather than inline TODO copy so public text does not expose internal uncertainty.

Verification surface:

- `/terms` and `/privacy` route tests must keep public access, single `<h1>`, API-first rendering, seed-synced fallback rendering, user-facing version labels, mobile TOC placement, heading hierarchy, and `force-dynamic` behavior covered.
- Playwright smoke should keep unauthenticated `/terms` and `/privacy` fallback rendering, public document actions, and internal-copy negative assertions covered without requiring an API fixture.
- Signup legal tests must cover stale legal document ids, fallback ids, no full-body browser storage, and required consent separation from privacy-policy read evidence.
- Dialog tests should keep the minimum accessibility contract covered: `role="dialog"`, `aria-modal`, ESC/close-button dismissal, focus restoration, focus trap, and mobile scroll/touch-target classes.
