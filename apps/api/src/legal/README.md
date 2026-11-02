# Legal API module architecture

Legal 도메인의 server-side boundary map이다. 이 문서는 `apps/api/src/legal`의 공개 법적 문서 read model, active version 조회, signup 동의 저장 책임을 빠르게 파악하기 위한 orientation note다.

## Public boundary

- `LegalModule`: 공개 legal document HTTP API provider wiring을 제공한다. 외부 도메인에 repository/concrete provider를 export하지 않는다.
- `GET /api/legal/documents/:kind/active`: 특정 legal document kind의 최신 published/effective active version만 반환한다.
- `GET /api/legal/documents/active-bundle`: 회원가입에 필요한 4종 문서(`이용약관`, `개인정보 처리방침`, `개인정보 수집·이용 동의`, `만 14세 이상 확인`)를 한 번에 반환한다.
- signup legal acceptance persistence: auth signup transaction 안에서 active document id를 검증하고 `LegalAcceptanceRecord` 4건을 저장한다.
- 두 read route는 인증 없이 접근 가능해야 한다. 가입 전 사용자가 문서를 확인해야 하기 때문이다.

## Directory responsibilities

- `application/`: `LegalService` controller-facing facade. Query에만 위임한다.
- `queries/`: active legal document와 bundle 조회 정책을 소유한다. 4종 bundle이 불완전하면 partial success를 만들지 않는다.
- `commands/`: signup legal acceptance 검증/저장 helper를 소유한다. active document id가 stale이면 user 생성 전에 fail-closed 한다.
- `repositories/`: `LegalDocumentVersion` persistence owner. active 조회 조건과 ordering을 고정한다.
- `presenters/`: public response allowlist projection. DB internal field를 외부에 노출하지 않는다.
- `errors/`: user-facing legal error contract.
- `contracts/`: API/query/presenter behavior regression spec.

## Hard rules

- Legal public API는 unpublished, future effective, retired document를 노출하지 않는다.
- Public response에는 `publishedAt`, `retiredAt`, `createdAt` 같은 내부 운영 필드를 포함하지 않는다.
- Legal document body는 raw HTML이 아니라 typed section JSON으로만 제공한다.
- Signup acceptance 저장은 auth signup transaction에서 원자적으로 처리한다. Public read API는 user acceptance evidence를 조회하거나 노출하지 않는다.
- Public seed copy와 Web fallback copy는 같은 사용자-facing 문안을 유지한다. Raw version id, 내부 상태명, plan/file path는 public response body에 넣지 않는다.
- BackOffice legal editor, admin approval workflow, 기존 사용자 재동의 campaign은 현재 범위가 아니다.

## Release handoff

- Web 단계 처리자(서버·이메일 발송·도메인, Landing 방문 통계, 문의 이메일)와 국외 이전, 개인정보 보호책임자, 문의 이메일은 seed와 Web fallback 본문에 있다.
- 데이터베이스·파일 저장·관측 처리자는 아직 정하지 않았다. 정해지기 전에는 seed에 거짓 provider 확정값을 쓰지 않고, 정해지면 처리방침 제4조 표에 적는다. 법률·개인정보 전문가 검토 여부는 실제 사용자 공개 전에 GitHub issue로 정한다.
- 문서 id·version·시행일 규칙은 [legal-basis.md LB-R6](../../../../docs/policies/legal-basis.md)이 소유한다.
- seed와 Web fallback의 같음은 `apps/web/src/legal/__tests__/legal-document-source-sync.test.ts`가 지킨다. 이 test는 Web CI lane에서만 돌므로 seed를 바꾸면 같은 commit에서 fallback도 바꾼다.

## Where to change

- HTTP route parsing/delegation: `legal.controller.ts`.
- Controller-facing facade: `application/legal.service.ts`.
- Active document query behavior: `queries/legal-document.query.ts`.
- `LegalDocumentVersion` persistence shape: `repositories/legal-document.repository.ts`.
- Public response allowlist: `presenters/legal-document.presenter.ts`.
- User-facing error contract: `errors/legal.errors.ts` and auth stale acceptance failure in `auth/errors/auth-failures.ts`.
- Default legal document seed: `apps/api/prisma/seed-data/reference/legal-document-seed-data.js`.
- Persistence schema/migration SQL: `apps/api/prisma/schema.prisma` and the initial migration SQL.
- Signup acceptance transaction hook: `apps/api/src/auth/registration/signup.command.ts`.

## Route matrix

- Public legal document API:
  - `GET /api/legal/documents/active-bundle`
  - `GET /api/legal/documents/:kind/active`

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  test/architecture/api-contracts/legal-contract.spec.ts \
  test/operations/reference-data/legal-document-reference-data.spec.ts \
  src/legal/contracts/legal-public-api.spec.ts \
  src/legal/contracts/legal-acceptance-signup.spec.ts \
  src/legal/legal.controller.spec.ts \
  src/auth/registration/signup.command.spec.ts \
  test/architecture/security/auth-access-route-matrix.spec.ts \
  test/operations/database/migration-baseline.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed legal files without apps/api prefix>
git diff --check
```
