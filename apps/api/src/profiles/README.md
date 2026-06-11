# Profiles API module architecture

This document is the server-side boundary map for `apps/api/src/profiles`. It explains the product responsibility, public surface, and canonical change locations for profile detail/read projection work.

## Public boundary

External domain production code should not import profile detail internals directly. The stable surface is limited to:

- `ProfilesModule`: profile detail route and provider wiring.
- `GET /api/profiles/:targetUserId`: public profile detail read. The route validates the viewer context and the search entry context before returning full detail or a tombstone shell.
- Profile public target reader port: the narrow read surface used by result-read/search consumers when a domain needs profile target materialization without depending on profile internals.

`profiles` owns profile detail/read projection. It does not own roommate-search summary/list orchestration, season profile draft writes, account identity writes, match scoring authority, social-safety relations, or Web rendering.

## Directory responsibilities

The product boundary is:

- `application/`: controller-facing facade. Public read surfaces live under `contracts/`.
- `composition/`: provider/export grouping for `ProfilesModule`.
- `details/`: `GET /api/profiles/:targetUserId` use case, detail entry token verification wrapper, latest policy recheck, and tombstone fallback.
- `targets/`: public profile viewer context, target materialization, and block visibility read seam.
- `mappers/`: public profile presenter and lifestyle read projection mapper.
- `errors/`: user-facing profile error contract.
- `contracts/`: stable API-local public surfaces for profile readers, detail-entry token helpers, and presenter helpers. Shared package layout fitness is owned by architecture specs.

`roommate-search` is a separate product boundary. Search summary list, manifest, scope, filters, sorting, cursor pagination, availability notice, bookmark metadata composition, and search response presentation belong in a top-level `roommate-search/` module rather than in `profiles/`.

## Hard rules

- `profiles` does not handle `SeasonParticipantProfile` writes. Current season profile draft/write/registration completeness stays in `season-participants`.
- `profiles` does not handle `UserDisplayIdentity` or `UserAcademicIdentity`. Account identity stays in `users`.
- `profiles` does not handle roommate-search summary/search. Search discovery and post-match cohort review belong to `roommate-search`.
- Profile detail entry token is context proof, not authorization by itself. Detail reads must re-check latest public target policy at request time.
- Full detail unavailability after a valid summary entry can degrade to a tombstone shell. Direct/probing access without valid context fails closed.
- Do not restore retained vault payload for user-facing profile detail. Restricted recovery belongs to the retention/disclosure boundary.
- Do not introduce root compatibility re-export paths for shared profile or roommate-search contracts.
- Do not add Web/BFF/rendering/hook/page/component behavior here.
- Do not add Redis/cache/materialized search projection from this module without operational evidence and the owning follow-up decision.

## Architecture guard

Architecture specs own cross-cutting fitness rules:

- root production files allow only `profiles.module.ts` and `profiles.controller.ts`;
- root legacy responsibility-suffix production files are not part of the final product layout;
- external production code consumes profile public ports/surfaces instead of `details/`, `targets/`, or `mappers/` internals;
- shared profile and roommate-search contract source-of-truth layout is guarded by architecture specs.

## Where to change profile behavior

- HTTP route parsing and controller delegation: `profiles.controller.ts`.
- Controller-facing facade delegation: `application/profiles.service.ts`.
- Detail token verification, latest policy recheck, and tombstone decision: `details/`.
- Viewer/target materialization and profile target read port implementation: `targets/`.
- Public profile response mapping and lifestyle projection: `mappers/`.
- User-facing profile errors: `errors/`.
- Roommate-search summary/search behavior: `apps/api/src/roommate-search`.
- Season profile draft/write/registration completeness: `apps/api/src/season-participants`.
- Account display/academic identity: `apps/api/src/users`.
- Match score authority: `apps/api/src/matches/scoring` and match score ports.
- Bookmark/block relation authority: `apps/api/src/social-safety`.
- Policy source of truth: `docs/04_policy/official/profile-model.md`, `docs/04_policy/official/roommate-searching.md`, and `docs/04_policy/official/season-participation.md`.
- Shared API contract source of truth: `packages/shared` profile and roommate-search contract surfaces.

## Useful verification

For README/policy-only changes:

```bash
pnpm exec prettier --check apps/api/src/profiles/README.md
git diff --check
```

For profile/roommate-search refactors, add the relevant targeted checks:

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/profiles/profiles-boundary.spec.ts \
  src/architecture/roommate-search/roommate-search-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts \
  src/architecture/contracts/layout/shared-contract-source-of-truth-layout.spec.ts \
  src/profiles \
  src/roommate-search \
  test/integration/roommate-search.integration.spec.ts \
  test/integration/profile-match-score.integration.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint src/profiles src/roommate-search
git diff --check
```
