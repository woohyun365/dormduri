# Roommate-search API module architecture

This document is the server-side boundary map for `apps/api/src/roommate-search`. It explains the product responsibility, public surface, and canonical change locations for roommate discovery/search work.

## Public boundary

External domain production code should not import roommate-search internals directly. The stable surface is limited to:

- `RoommateSearchModule`: roommate-search route and provider wiring.
- `GET /api/roommate-search`: authenticated roommate discovery/result-read summary list.
- `GET /api/roommate-search/manifest`: authenticated filter/scope manifest for the current viewer context.

`roommate-search` owns search/list orchestration, manifest, scope/filter validation, score sorting, cursor pagination, availability notices, and bookmark metadata composition. It does not own profile detail materialization, season profile draft writes, match score authority, social-safety relation authority, or Web rendering.

## Directory responsibilities

- `application/`: controller-facing facade. Keep orchestration thin and delegate query/policy/presenter work to the owning slices.
- `composition/`: provider/export grouping for `RoommateSearchModule`.
- `candidates/`: current-season candidate query shape and search candidate selection helpers.
- `scope/`: viewer/search scope policy and fail-closed preflight decisions.
- `manifest/`: filter manifest presentation and policy version output.
- `filters/`: query validation, discovery filter, and score threshold policy.
- `sorting/`: search result ordering policy.
- `pagination/`: cursor pagination and signed token codec.
- `presentation/`: search response and availability notice presenters.
- `integration/`: read-side composition that joins candidate, profile target, bookmark/block metadata, and presentation dependencies.
- `errors/`: user-facing roommate-search error contract.
- `contracts/`: module-local contract behavior specs or narrow public port surfaces only.
- `test-support/`: shared roommate-search fixtures only.

## Hard rules

- Keep `/api/roommate-search` and `/api/roommate-search/manifest` route behavior, response shape, and error code stable during structure refactors.
- Do not import profile detail internals directly. Use `profiles/contracts` public target reader surfaces for profile materialization.
- Do not make roommate-search the authority for bookmark/block relation rules. Social-safety owns those relations; search only consumes the minimal metadata needed for the visible result set.
- Do not leak block direction or raw social-safety metadata in user-facing search responses.
- Do not add Redis/cache/materialized search projection without operational evidence and an owning design decision.
- Do not add Web/BFF/rendering/hook/page/component behavior here.

## Architecture guard

Architecture specs own cross-cutting fitness rules:

- Root production TypeScript files are limited to `roommate-search.module.ts` and `roommate-search.controller.ts`.
- Roommate-search source files do not live under `profiles/` root.
- External production code should not import roommate-search slice internals unless a narrow public surface is explicitly exported.
- Bookmark/block table authority should be accessed through social-safety-owned read surfaces rather than ad hoc interpretation in search code.

## Query and cost boundaries

- Candidate discovery starts from `SeasonParticipant`, not `User`. Keep season, campus, gender, registration, dormitory, participant-status, and profile-completeness filters in the candidate query so the broad search set is reduced before profile/social-safety composition.
- Use `SeasonParticipant.campusCodeSnapshot` and `SeasonParticipant.genderSnapshot` for same-season cohort matching. The `User` relation is still selected/checked only for `deletedAt` because deleted/deidentified identity state is the fail-closed source of truth.
- Bookmark and block lookups must be bounded to the visible target subset after profile target materialization. Do not ask social-safety ports for hidden/deactivated/withdrawn/expired/deleted targets or unmaterialized raw candidate rows.
- Match score calculation authority remains in `matches/scoring`. Roommate-search may apply score sorting or `minScore` filtering only after visible summaries are materialized; it should not persist or cache score state here.
- Do not add broad indexes only because a query is read-heavy. Add or change a Prisma index only when the actual `where`/`orderBy` shape and production-like `EXPLAIN`, RDS IOPS/CPU, or Performance Insights evidence show that existing indexes are insufficient.
- Redis, materialized projection, or bounded score cache is a performance optimization, not a correctness source. Introduce it only with an owner, invalidation strategy, and measured candidate-count/latency threshold.

## Where to change roommate-search behavior

- HTTP route parsing and controller delegation: `roommate-search.controller.ts`.
- Controller-facing facade delegation: `application/roommate-search.service.ts`.
- Candidate query shape: `candidates/`.
- Scope and fail-closed preflight: `scope/`.
- Filter manifest output: `manifest/`.
- Query/filter/threshold validation: `filters/`.
- Sort order: `sorting/`.
- Cursor and signed token behavior: `pagination/`.
- Response and notice projection: `presentation/`.
- Read-side composition across profile/social-safety metadata: `integration/`.
- Profile target materialization: `apps/api/src/profiles/contracts` public reader surface.
- Bookmark/block relation authority: `apps/api/src/social-safety`.
- Match score authority: `apps/api/src/matches/scoring` and match score ports.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/roommate-search \
  test/integration/roommate-search.integration.spec.ts \
  test/integration/profile-match-score.integration.spec.ts \
  src/architecture/roommate-search/roommate-search-boundary.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
