# Dormitories API module architecture

이 문서는 `apps/api/src/dormitories`의 제품 책임 경계와 수정 위치를 빠르게 찾기 위한 server-side boundary map이다.

## Public boundary

외부 domain은 기숙사 public catalog/guide 조회와 시즌 참여용 selection catalog port만 사용한다.

- `DormitoriesModule`: dormitory catalog/guide query와 selection catalog adapter provider wiring을 제공한다.
- `DormitoriesService`: HTTP-facing public list/detail/guide facade다. season participant write 정책을 소유하지 않는다.
- `DORMITORY_SELECTION_CATALOG_PORT`: season-participants가 현재 season/dormitory operation snapshot 기준의 selectable dormitory를 조회하는 port다.

## Directory responsibilities

- `application/`: controller-facing facade. Public catalog/detail/guide query를 조합하되 season participation write rule을 넣지 않는다.
- `composition/`: `DormitoriesModule` provider/export grouping. Selection catalog port binding과 public module export surface를 module decorator에서 분리해 유지한다.
- `catalog/`: dormitory list/detail query, repository, response mapper.
- `guides/`: dormitory guide query와 guide response mapper.
- `selection-catalog/`: season participation에서 사용하는 selectable dormitory port, Prisma adapter, eligibility policy, mapper.
- `errors/`: dormitories user-facing error contract.
- `contracts/`: shared dormitory contract behavior regression spec. Shared package layout fitness는 architecture가 소유한다.

## Hard rules

- `dormitories` production code는 `season-participants`를 import하지 않는다.
- `season-participants`는 concrete `DormitoriesService`가 아니라 `DORMITORY_SELECTION_CATALOG_PORT`만 사용한다.
- selection-catalog adapter는 transaction client를 받을 수 있어야 한다.
- 기숙사 운영 여부, room selection date, campus/gender eligibility는 catalog/selection boundary에서 fail-closed로 유지한다.
- Web rendering/hook/page/component 작업은 이 module 범위가 아니다.

## Architecture guard

- Root production TypeScript file은 `dormitories.controller.ts`, `dormitories.module.ts`만 허용한다.
- Public facade는 `application/dormitories.service.ts`가 소유한다.
- `DormitoriesModule` provider/export list는 `composition/dormitories.providers.ts`, `composition/dormitories.exports.ts`가 소유한다.
- Error contract는 `errors/dormitories.errors.ts`가 소유한다.
- Shared contract behavior spec은 `contracts/dormitory-contract.spec.ts`가 소유한다.
- Architecture fitness는 `architecture/dormitories/dormitories-boundary.spec.ts`와 `architecture/contracts/layout/*`가 소유한다.

## Where to change

- HTTP route delegation: `dormitories.controller.ts`.
- List/detail read model: `catalog/`.
- Guide read model: `guides/`.
- Season participant selectable dormitory lookup: `selection-catalog/`.
- Module provider/export wiring: `composition/`.
- Shared response/schema contract: `packages/shared/src/dormitory/**` and `packages/shared/src/compat/dormitory-contract.ts`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/dormitories/dormitories-boundary.spec.ts \
  src/dormitories \
  src/season-participants/dormitory-selection
pnpm api:typecheck
git diff --check
```
