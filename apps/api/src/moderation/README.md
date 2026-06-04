# Moderation API module architecture

이 문서는 `apps/api/src/moderation` 내부 책임 경계, public surface, directory ownership, 수정 위치를 빠르게 찾기 위한 server-side moderation boundary map이다. Moderation은 여러 제품 domain이 사용하는 business capability이며, neutral `common` 또는 `platform` utility가 아니다.

## Public boundary

외부 domain production code는 moderation persistence/policy internals를 직접 재구현하지 않는다. 필요한 surface는 아래로 제한한다.

- `ModerationModule`: moderation provider wiring을 제공하는 non-global module이다. 필요한 domain module이 명시 import한다.
- `ModerationService`: nickname/intro/match request note 같은 public text surface 검증 entrypoint다.
- `PublicTextSurface`: moderation 대상 surface vocabulary다. 새 public text surface를 추가할 때는 policy/test/service caller를 함께 갱신한다.

## Directory responsibilities

- `moderation.module.ts`: `PrismaModule` explicit import, repository/service provider wiring, `ModerationService` export owner. `@Global()`을 사용하지 않는다.
- `moderation.service.ts`: caller-facing moderation orchestration, active term lookup, short TTL cache, surface별 validation result mapping.
- `moderation.repository.ts`: Prisma-backed active moderation term query owner. Text normalization/policy 판단을 소유하지 않는다.
- `text-moderation.policy.ts`: pure moderation policy helper. NFKC/lowercase/punctuation-symbol-whitespace removal normalization, exact/includes match, user-facing error message selection을 소유한다.
- `moderation.defaults.ts`: seed/default term source. Runtime DB term query와 혼동하지 않는다.
- `*.spec.ts`: repository/service/pure policy behavior regression guard.

## Hard rules

- Moderation은 `common/` 또는 `platform/`으로 되돌리지 않는다. 제품 public text policy이므로 top-level business capability로 유지한다.
- `ModerationModule`은 non-global module이다. Auth/users/matches 등 caller module은 explicit import로 dependency를 드러낸다.
- User-facing error message를 refactor만으로 변경하지 않는다.
- Text normalization/matching policy는 pure helper로 유지하고 Nest provider/Prisma client를 import하지 않는다.
- Repository는 DB 조회만 담당하고, surface별 policy 판단이나 error message를 소유하지 않는다.
- Short TTL cache는 best-effort optimization이다. Moderation term source-of-truth는 Postgres active terms다.
- Redis/cache 도입은 observed bottleneck 또는 multi-instance cache consistency 요구가 생길 때 별도 issue로 다룬다.
- Raw user text를 불필요하게 로그에 남기지 않는다.

## Architecture guard

Moderation boundary는 `apps/api/src/architecture/common-boundary.spec.ts`와 `apps/api/src/architecture/module-boundary.spec.ts`가 고정한다.

- `common/moderation`은 재생성하지 않는다.
- `ModerationModule`은 `@Global()`을 사용하지 않는다.
- `ModerationService`만 public module export surface로 둔다.
- Affected caller modules는 `ModerationModule`을 explicit import한다.
- Platform은 moderation을 import하지 않는다.

## Where to change moderation behavior

- Public text surface union, normalization, exact/includes matching, error message: `text-moderation.policy.ts`.
- Caller-facing validation flow and cache TTL behavior: `moderation.service.ts`.
- Active term DB query and selected columns: `moderation.repository.ts`.
- Default/seed term source: `moderation.defaults.ts` and seed pipeline.
- Module import/export boundary: `moderation.module.ts` plus caller module imports.
- Nickname policy integration: users/auth signup validation caller tests.
- Intro/match request note integration: profiles/matches caller tests.
- Redis/distributed cache or admin term management: not this module README's default path; create a follow-up design/issue first.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/moderation \
  src/auth/registration/auth-signup-validation.service.spec.ts \
  src/users/users.service.spec.ts \
  src/users/user-deletion-owner.spec.ts \
  src/matches/matches.service.spec.ts \
  src/architecture/common-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
