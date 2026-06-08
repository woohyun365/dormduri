# Report intake slice

`reports/`는 사용자 신고 접수 원장을 소유하는 독립 slice다. 이 slice는 intake-only이며, 운영자 review outcome, account sanction, participant visibility projection mutation은 dedicated review/enforcement/projection owners가 담당한다.

## Public boundary

- `POST /api/reports`: target context, canonical report reason, optional block action, false report disclaimer를 받아 신고를 접수한다.
- Create response는 접수 상태 `RECEIVED`만 반환한다. `UNDER_REVIEW`/`RESOLVED`는 review workflow와 notification status update owner가 소유한다.

## Target matrix

| targetType       | 의미                                                                                         | 대표 시나리오                                      |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `PROFILE`        | 현재 시즌에서 reporter가 볼 수 있는 상대 profile/user pointer를 신고한다.                    | 허위 profile, 부적절한 자기소개, 생활패턴 mismatch |
| `MATCH_REQUEST`  | reporter가 당사자인 match request pointer를 신고한다.                                        | 매칭 요청 과정의 괴롭힘/차별/위협 신고             |
| `CHAT_THREAD`    | reporter가 active member인 OPEN/READ_ONLY thread pointer를 신고한다.                         | 특정 대화방 전체의 반복 괴롭힘/위협 신고           |
| `CHAT_MESSAGE`   | reporter가 볼 수 있는 thread의 message pointer를 신고한다. Raw body는 제외.                  | 특정 메시지의 개인정보 노출/성희롱/위협 신고       |
| `SUPPORT_TICKET` | report intake API에서는 지원하지 않는다. Support escalation은 support/review owner가 다룬다. | 운영/지원 응대 escalation 또는 support review 감사 |

## Directory map

- `report.module.ts`: slice provider composition만 담당한다.
- `report.controller.ts`: route, auth actor, body parse만 담당한다.
- `application/report-intake.service.ts`: HTTP-facing thin facade.
- `commands/`: report intake write orchestration. Report success와 optional block result를 분리한다.
- `resolvers/`: report target context resolver. Chat/message body나 retained payload를 읽지 않고 pointer만 snapshot한다.
- `policies/`: risk/dedupe/payload/privacy/optional action/attachment/profile feedback pure policy.
- `repositories/`: `ReportCase`/`ReportCaseEvent` persistence only.
- `retention/`: retention reference bridge. Retained vault disclosure internals import 금지.
- `notifications/`: reporter receipt notification handoff. Raw report detail/body는 payload에 넣지 않는다.
- `presenters/`: receipt response allowlist.
- `contracts/`: report shared/API contract regression spec. Root social-safety contract spec에 report assertion을 남기지 않는다.
- `errors/`: probing-safe user-facing error mapping.

`queries/`는 report intake slice에 두지 않는다. Reporter-facing report history와 운영자 queue/detail/status/review read model은 BackOffice/API operations owner가 `admin/`, `operations/`, 또는 dedicated backoffice prefix에서 소유한다.

## Hard rules

- Report intake는 participant `hiddenByAdminAt`, `hiddenReasonCode`, `deactivatedAt`를 직접 변경하지 않는다.
- Report intake는 account sanction/enforcement action을 만들지 않는다.
- Deleted/deidentified target report는 evidence-only/intake state로만 처리하고 RRPD raw payload를 복원하지 않는다.
- Optional block 실패 또는 active match block reject는 report 접수를 rollback하지 않고 `optionalActionResult`와 event로만 기록한다.
- `FALSE_PROFILE` lifestyle/profile mismatch는 feedback/prompt candidate event만 기록한다. Notification delivery는 notification owner가 수행한다.
- Review outcome/enforcement status/event는 dedicated review/enforcement/projection owners가 확장한다.

## Where to change

- API shape/response allowlist: `packages/shared/src/social-safety/report.ts` + `presenters/`.
- Report contract regression: `contracts/report-contract.spec.ts`.
- Target pointer resolution: `resolvers/report-target-context.resolver.ts`.
- Risk/profile-feedback/attachment policy: `policies/`.
- Reporter receipt notification handoff: `notifications/`.
