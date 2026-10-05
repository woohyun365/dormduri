# platform/domain-context

Generic metadata primitive for domain context requirements.

## Public boundary

Product domains may use this helper to attach route metadata for domain context guards. The platform helper only provides generic metadata plumbing.

- `DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY`: shared metadata key.
- `RequireDomainContext`: attaches a copied list of requirements as Nest route/class metadata.
- `isDomainContextRequirement`: narrows a requirement by its `kind`; it does not read metadata or validate the full runtime shape.

## Directory responsibilities

- `domain-context.decorator.ts`: generic metadata key, metadata decorator, and kind-narrowing helper.
- `domain-context.decorator.spec.ts`: metadata behavior regression.
- `README.md`: generic boundary and product vocabulary ownership rules.

## Hard rules

- Do not define product requirement names here.
- Do not implement guard behavior here.
- Do not import Prisma, Nest guards, or product services here.
- Product contexts such as current-season participant, chat thread member, and active match participant stay in the owning domain.

## Architecture guard

- Platform/domain-context replaces old common/domain-context placement.
- Domain context route matrix specs live under `apps/api/test/architecture/domain-context`.
- Product domains own requirement literals and fail-closed behavior.
- Guards read metadata through Nest `Reflector` and own authorization and request-carrier population.
- `platform/http/domain-context-binding.spec.ts` exercises real Auth/ActiveMatch guards and decorators with fake dependencies,
  including participant mapping, rejection before service work, and sequential/interleaved request isolation.

## Where to change

- Generic metadata helper shape: `domain-context.decorator.ts`.
- Season participant context requirement: `season-participants/context`.
- Chat thread context requirement: `chat/context`.
- Match participant context requirement: matches context owner.
- Route inventory and matrix guard: `architecture/domain-context`.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/platform/domain-context \
  test/architecture/domain-context/domain-context-route-matrix.spec.ts
pnpm --dir apps/api exec eslint src/platform/domain-context
pnpm exec prettier --check apps/api/src/platform/domain-context/README.md
pnpm api:typecheck
git diff --check
```
