# Privacy API helper architecture

이 문서는 `apps/api/src/privacy`의 privacy/deidentification helper 책임 경계와 수정 위치를 빠르게 찾기 위한 server-side boundary map이다. Privacy는 사용자-facing read model에서 삭제, 비식별, 보존 상태를 안전하게 표현하는 pure policy/helper owner다.

## Public boundary

제품 domain read model은 privacy helper를 직접 import할 수 있다. 이 surface는 DB write나 transport를 소유하지 않고, 이미 조회된 상태를 product display policy로 변환한다.

- `deidentification/`: deleted/deidentified user display fallback과 tombstone label policy.
- Privacy helper는 profile, match, chat, social-safety read model에서 동일한 사용자 표시 정책을 재사용하게 한다.

## Directory responsibilities

- `deidentification/README.md`: deidentified display helper의 세부 책임과 금지 경계.
- `deidentification/deidentified-display.policy.ts`: 삭제/비식별 사용자 이름과 tombstone label resolver.
- `README.md`: privacy helper public boundary와 consumer 규칙.

## Hard rules

- Privacy helper는 Nest provider, Prisma client, controller, module을 소유하지 않는다.
- Retained identity vault, RRPD disclosure, account deletion transaction은 privacy helper가 직접 읽거나 쓰지 않는다.
- User-facing read model은 retained payload를 복원하지 않는다.
- Deleted/deidentified display label은 domain별로 복제하지 않고 privacy helper를 사용한다.
- Consumer domain은 profile/match/chat/report 정책을 privacy helper로 이전하지 않는다. Privacy는 display fallback만 제공한다.

## Architecture guard

- Retained/vault internals는 product read path에서 직접 import하지 않는다.
- Social-safety/support/report response는 retained payload, hidden reason detail, deleted identity raw value를 노출하지 않는다.
- Product read models는 privacy helper를 통해 deleted/deidentified display fallback을 공유한다.

## Where to change privacy behavior

- Deleted/deidentified display label: `deidentification/deidentified-display.policy.ts`.
- Profile read display fallback consumption: profile read model owner.
- Match/chat/social-safety display fallback consumption: owning domain read model.
- Account deletion and retained identity disposal: users account-deletion/retention and retention owner.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/profiles \
  src/social-safety \
  src/users/account-deletion
pnpm exec prettier --check apps/api/src/privacy/README.md apps/api/src/privacy/deidentification/README.md
pnpm api:typecheck
git diff --check
```
