# Dependency supported-line epochs

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 dependency 규칙의 owner가 아닙니다. version-update owner와 catalog·lockfile 경계는
> [Dependency automation architecture](../../architecture/platform/dependency-automation.md), 승인·PR 절차는
> [Dependency update operations](../../development/github/dependency-updates.md)가 소유합니다. 각 epoch가 CI 측정 표본을 어떻게
> 나누는지는 [Monorepo CI baseline](../ci/monorepo-ci-baseline.md#active-post-native-measurement-epoch)에 둡니다.

지원선 갱신과 보안 정합화를 dependency epoch 단위로 기록합니다. Epoch마다 함께 바꾼 package와 그 이유, 남긴 version과 그
이유, 검증 경계를 적습니다. Epoch의 dependency input은 CI 측정 fingerprint를 바꾸므로, 서로 다른 epoch의 CI 표본은 한
cohort로 합치지 않습니다.

## Web supported-line security epoch

Web framework, browser test, and visual runtime dependencies changed together because they share one Next standalone artifact and
one Web CI owner. The frozen graph uses Next/eslint-config-next `16.3.4`, React/DOM `19.2.8`, Sentry `10.73.0`, Tailwind
`4.3.3`, Playwright `1.63.0`, Jest DOM `7.0.1`, Lucide `1.41.0`, and Motion `13.2.0`.

The supported Next parent naturally resolves Sharp `0.35.4` and baseline-browser-mapping `2.11.18`; no new security override was
added. Full/prod audit no longer reports a Web-owned critical or high advisory. Remaining Multer and JS-YAML advisories keep their
separate API/tooling owners and are not attributed to this cohort.

Local compatibility evidence passed 221 Web test files / 1,232 tests, the production build, Storybook build, Sentry artifact check,
and the full Playwright surface with 26 passed / 2 intentionally project-skipped cases. Sentry `10.73.0` also made two ownership boundaries explicit: Next build configuration
imports `withSentryConfig` from the provider's config export, while operational-boundary jsdom tests mock the provider and leave SDK
behavior to Sentry-owned tests. A stale `.next` instrumentation failure disappeared after a clean-cache rebuild and is documented in
the Turbopack dependency migration troubleshooting guide.

Lucide `1.41.0` is pinned in the initial lock resolution because the newer `1.42.0` had not crossed the repository's three-day
release-age gate at the freeze. Later compatible 1.x updates return to Renovate ownership rather than extending this migration.

## API runtime, persistence, build, and Multer security epoch

The API artifact moves Joi `18.2.8`, Prisma-owned MySQL2 `3.24.3`, SWC core `1.16.2`, and unplugin-swc `1.5.11` as separately
reviewable commits inside one API rollback boundary. That broad freeze retained AWS clients at `3.1126.0`, but a later review found
that intermediate `3.1127.0` had already crossed the three-day gate even though nominal-latest `3.1128.0` had not. The provider pair
therefore receives its own correction epoch instead of being hidden inside the broader API cohort. NestJS remains on the supported
11.2 line; NestJS 12 is a separate Issue-backed NO-GO.

NestJS 11.2.3 still pins vulnerable Multer `2.2.0`, so the workspace applies exact parent-scoped
`@nestjs/platform-express>multer: 2.3.0`. The selector does not create a broad root override. Strict peers, HTTP/e2e behavior,
production artifact reachability, and the deterministic security graph protect that temporary parent-boundary patch. The resulting
production dependency audit has no high or critical advisory. The remaining full-audit JS-YAML advisory is development tooling
owned by the following repository-tooling migration and is not attributed to the API production graph.

Local evidence covers runtime-config/provider contracts, Prisma generate/validate/status, integration/e2e, SWC native load,
production compile and real watch-change recompilation, full API unit/stress partitions, frozen install, strict peers, and audit.
The active measurement epoch starts only after these dependency inputs are frozen, so Web and API dependency samples cannot be
combined into a misleading performance cohort.

The first remote run showed one environment-specific regression that local behavior checks did not expose: the Web static step's
ESLint process reached Node's default old-space ceiling near 2 GiB after the Next/eslint-config-next graph update. The workflow gives
only that static step a 4 GiB old-space ceiling and preserves the same lint command and rule set; it does not reduce lint scope or
raise the memory limit job-wide. The correction and its regression contract are documented in the troubleshooting owner.

## AWS SDK intermediate release-age reconciliation epoch

Secrets Manager and SES v2 move together from `3.1126.0` to `3.1127.0`. Both packages were published on 2026-09-04 around 18:55 UTC,
require Node `>=20.0.0`, and had crossed the repository's three-day gate before this epoch started. The official AWS SDK comparison
contains no owned service-model change for either client, and the canonical lock diff changes only the two package identities while
preserving their AWS/Smithy transitive graph.

This epoch closes a selection bug in which the too-new nominal latest `3.1128.0` caused the already eligible intermediate release to
be overlooked. Release-age selection must evaluate every candidate between current and latest, not treat an ineligible latest release
as a reason to retain an older eligible version. Provider fakes, runtime-config/health, API checks, frozen install, peers, and audits
remain the acceptance boundary; real AWS credentials and provider smoke remain release-owned evidence.

## Repository tooling and final security reconciliation epoch

The final repository-owned dependency cohort updates `lint-staged` from `17.4.1` to `17.5.0` after the release crossed the
three-day age gate. Its acceptance is behavioral rather than version-only: partial staged snapshots preserve unstaged hunks, task
failure propagates, unrelated files stay outside the index, and Shared/API/Web lint consumers continue to load their effective
configuration. TypeScript-ESLint `8.70.0` remains on the same compatible ESLint 9 / TypeScript 6 line, but it was still inside the
release-age window at the freeze and therefore stays with normal Renovate ownership instead of bypassing policy.

The same cohort repairs the last current full-audit finding by allowing `js-yaml` to resolve naturally from `4.3.1` to `4.3.2`.
`@eslint/eslintrc@3.3.6` and `cosmiconfig@8.3.6` already declare compatible ranges, so no direct dependency or root override is
introduced. The deterministic security fixture rejects the vulnerable lock entry and requires the patched one, while lint loading,
Nest CLI/SWC build, and the production audit prove the tooling-only boundary. Shared Zod remains current at `4.5.4`; its evidence is
an explicit no-op version decision plus Shared build/lint/typecheck/tests and downstream API/Web compatibility, not an invented source
change.

This evidence map supports later engineering review and portfolio discussion:

| Question                                     | Evidence-backed answer                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why not update every detected package?       | Release age, domain ownership, and major compatibility are independent gates; current-but-ineligible or Issue-owned candidates are not bundled for a clean dashboard.       |
| Why no JS-YAML override?                     | Both owning parents accept the patched version, so natural resolution is smaller, easier to remove, and avoids creating a new repository authority.                         |
| How is a no-op dependency decision verified? | Current registry metadata is paired with owner-consumer build, lint, typecheck, tests, and downstream contracts rather than a meaningless manifest edit.                    |
| What remains after this cohort?              | TypeScript 7, ESLint 10, NestJS 12, and Node 26 remain explicit Issue-backed transitions; post-freeze compatible patches return to normal Renovate ownership.               |
| What proves security completion?             | Frozen graph, exact parent resolution, full and production audits, deterministic vulnerable-version rejection, and selected product/tooling CI—not provider counters alone. |
