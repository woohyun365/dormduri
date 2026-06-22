# Legal API module architecture

Legal 도메인의 server-side boundary map이다. 이 문서는 `apps/api/src/legal`의 공개 법적 문서 read model, active version 조회, signup 동의 저장 전 단계의 책임을 빠르게 파악하기 위한 orientation note다.

## Public boundary

- `LegalModule`: 공개 legal document HTTP API provider wiring을 제공한다. 외부 도메인에 repository/concrete provider를 export하지 않는다.
- `GET /api/legal/documents/:kind/active`: 특정 legal document kind의 최신 published/effective active version만 반환한다.
- `GET /api/legal/documents/active-bundle`: 회원가입에 필요한 4종 문서(`이용약관`, `개인정보 처리방침`, `개인정보 수집·이용 동의`, `만 14세 이상 확인`)를 한 번에 반환한다.
- 두 route는 인증 없이 접근 가능해야 한다. 가입 전 사용자가 문서를 확인해야 하기 때문이다.

## Directory responsibilities

- `application/`: `LegalService` controller-facing facade. Query에만 위임한다.
- `queries/`: active legal document와 bundle 조회 정책을 소유한다. 4종 bundle이 불완전하면 partial success를 만들지 않는다.
- `repositories/`: `LegalDocumentVersion` persistence owner. active 조회 조건과 ordering을 고정한다.
- `presenters/`: public response allowlist projection. DB internal field를 외부에 노출하지 않는다.
- `errors/`: user-facing legal error contract.
- `contracts/`: API/query/presenter behavior regression spec.

## Hard rules

- Legal public API는 unpublished, future effective, retired document를 노출하지 않는다.
- Public response에는 `publishedAt`, `retiredAt`, `createdAt` 같은 내부 운영 필드를 포함하지 않는다.
- Legal document body는 raw HTML이 아니라 typed section JSON으로만 제공한다.
- Signup acceptance 저장은 auth signup transaction에서 원자적으로 처리해야 하며, 이 read API가 user acceptance evidence를 직접 저장하지 않는다.
- BackOffice legal editor나 admin approval workflow는 이 모듈의 현재 public read path 범위가 아니다.

## Where to change

- HTTP route parsing/delegation: `legal.controller.ts`.
- Controller-facing facade: `application/legal.service.ts`.
- Active document query behavior: `queries/legal-document.query.ts`.
- `LegalDocumentVersion` persistence shape: `repositories/legal-document.repository.ts`.
- Public response allowlist: `presenters/legal-document.presenter.ts`.
- User-facing error contract: `errors/legal.errors.ts`.
- Default legal document seed: `apps/api/prisma/seed-data/reference/legal-document-seed-data.js`.
- Persistence schema/migration SQL: `apps/api/prisma/schema.prisma` and the initial migration SQL.

## Route matrix

- Public legal document API:
  - `GET /api/legal/documents/active-bundle`
  - `GET /api/legal/documents/:kind/active`

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/architecture/api-contracts/legal-contract.spec.ts \
  src/architecture/reference-data/legal-document-reference-data.spec.ts \
  src/legal/contracts/legal-public-api.spec.ts \
  src/legal/legal.controller.spec.ts \
  src/architecture/security/auth-access-route-matrix.spec.ts \
  src/platform/database/migration-baseline.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed legal files without apps/api prefix>
git diff --check
```
