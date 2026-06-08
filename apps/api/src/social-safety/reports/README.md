# Report intake slice

`reports/`는 사용자 신고 접수 원장을 소유하는 독립 slice다. 이 slice는 intake-only이며, 운영자 decision, account sanction, participant visibility projection mutation은 후속 owner가 담당한다.

## Planned public surface

- `POST /api/reports`: target context, canonical report reason, optional block action, false report disclaimer를 받아 신고를 접수한다.

## Directory map

- `report.module.ts`: slice provider composition만 담당한다.
- `report.controller.ts`: route, auth actor, body parse만 담당한다.
- `application/report-intake.service.ts`: thin facade.
- `commands/`: report intake write use cases.
- `resolvers/`: report target context resolver.
- `policies/`: reason/risk/dedupe/payload privacy.
- `repositories/`: `ReportCase`/event persistence only.
- `retention/`: retention reference bridge. Retained vault disclosure internals import 금지.
- `notifications/`: reporter receipt/operator alert handoff. Raw report detail/body는 payload에 넣지 않는다.
- `presenters/`: receipt response allowlist.
- `errors/`: probing-safe user-facing error mapping.

## Hard rules

- Report intake는 participant `hiddenByAdminAt`, `hiddenReasonCode`, `deactivatedAt`를 직접 변경하지 않는다.
- Report intake는 account sanction/enforcement action을 만들지 않는다.
- Deleted/deidentified target report는 evidence-only/intake state로만 처리하고 RRPD raw payload를 복원하지 않는다.
- Decision/outcome/enforcement status/event는 #263/#264/#265 후속 owner가 확장한다.
