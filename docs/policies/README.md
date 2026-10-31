# 공식 정책 세트

이 폴더는 제품과 운영의 현재 규칙을 도메인별로 정규화한 canonical policy set이다.

- 기존 문서는 의사결정 누적 결과를 보존한다.
- 이 폴더는 충돌을 정리한 **정규화된 정책 뷰**를 제공한다.
- 같은 규칙은 한 문서만 최종 소유하도록 배치했다.
- 아래 표의 종류는 제품(서비스 이용자와 제품 동작의 규칙), 운영(배포·관측·의존성 운영의 규칙), 혼합(두 성격이 한 문서에
  함께 있음)이다. 종류는 읽는 사람을 위한 분류이고 문서 위치와 규칙 id는 바꾸지 않는다.

## 문서 구성

| 문서                                                           | 도메인           | 종류 | 규칙 id 접두어 | 최종 소유 규칙                                                                                           |
| -------------------------------------------------------------- | ---------------- | ---- | -------------- | -------------------------------------------------------------------------------------------------------- |
| [account-authentication.md](./account-authentication.md)       | 계정/인증        | 혼합 | AU             | id 체계, 이메일 인증, 로그인, 세션, 비밀번호, 회원가입 기본 단계                                         |
| [access-eligibility.md](./access-eligibility.md)               | 이용 자격        | 제품 | AE             | 누가 가입/매칭 참여 가능한지, 건물 배정 입력 의미, 건물/캠퍼스 변경 원칙                                 |
| [season-lifecycle.md](./season-lifecycle.md)                   | 시즌 운영        | 제품 | SL             | 시즌 기간, 지원 건물, 시즌별 기능 on/off, 시즌 전환 데이터 처리                                          |
| [season-participation.md](./season-participation.md)           | 시즌 참여        | 제품 | SP             | 시즌 참여자 등록의 의미, `SeasonParticipantProfile` draft/final, registration 완료 조건, capability 용어 |
| [profile-model.md](./profile-model.md)                         | 프로필 구조      | 제품 | PM             | `UserDisplayIdentity`, `SeasonParticipantProfile`, profile history, 필드 레벨 노출                       |
| [matching-lifecycle.md](./matching-lifecycle.md)               | 매칭 상태        | 제품 | ML             | 2인(pair) 매칭 호환도, 신청/대화/확정 상태 전이, 북마크, 리스트 표현, group matching 비지원 경계         |
| [matching-algorithm.md](./matching-algorithm.md)               | 매칭 알고리즘    | 제품 | MA             | 호환도 점수 행렬, 정규화 공식, 관점별 점수와 예외 처리                                                   |
| [chat-lifecycle.md](./chat-lifecycle.md)                       | 채팅 상태        | 제품 | CH             | 1:1 chat thread 생성/쓰기/read-only/archive, block/report/realtime/retention 경계                        |
| [roommate-searching.md](./roommate-searching.md)               | 룸메이트 찾기 UX | 제품 | RS             | 검색 scope, summary/detail/action capability, manifest/filter/sort/cursor 계약                           |
| [service-boundary.md](./service-boundary.md)                   | 서비스 책임 범위 | 제품 | SB             | 채팅 포함 범위, 시스템 보장 한계, 면책, 분쟁 시 서비스 역할                                              |
| [community-safety.md](./community-safety.md)                   | 커뮤니티 안전    | 제품 | CS             | 비속어/혐오 표현 필터, 개인정보 노출 가이드, 소수자 포용 원칙                                            |
| [incident-enforcement.md](./incident-enforcement.md)           | 신고/제재 운영   | 제품 | IE             | 신고 카테고리, 제재 사다리, 즉시 분리 트리거, 임시조치, 증거 판단, 고지 원칙                             |
| [support-communication.md](./support-communication.md)         | 지원/문의        | 제품 | SC             | support ticket, appeal, FAQ, email optional consent, support notification handoff                        |
| [operational-observability.md](./operational-observability.md) | 운영 관측        | 운영 | OO             | 수집 목적, 로그·메트릭 개인정보, 접근, 보존, fail-open과 stress 실행 안전 경계                           |
| [production-runtime-safety.md](./production-runtime-safety.md) | Production 안전  | 운영 | PRS            | secret, DB, migration, ingress, health, rollback과 release blocker 불변 조건                             |
| [notification-inbox.md](./notification-inbox.md)               | 알림함           | 제품 | NI             | in-app notification, writer/outbox, payload privacy, delivery channel 경계                               |
| [data-retention.md](./data-retention.md)                       | 데이터 보유기간  | 제품 | DR             | 데이터 분류별 보유기간, 파기 절차, 탈퇴 시 처리, 법적 근거                                               |
| [legal-basis.md](./legal-basis.md)                             | 법적 근거        | 제품 | LB             | 적용 법령 계층 구조, 서비스 행위별 법령 매핑, 접속기록 규율 대상 구분                                    |
| [dependency-security.md](./dependency-security.md)             | Dependency 보안  | 운영 | DS             | 취약점 reachability, remediation, exception, dismissal과 release NO-GO                                   |

## 규칙 id와 인용

정책 규칙은 규칙 문장이나 표 행 앞에 `**<접두어>-R<번호>**` 형식의 id를 둡니다(예: `**DR-R3**`). 접두어는 위 표의 값이고
번호는 문서 안에서 늘기만 합니다. 아직 id가 없는 도메인은 그 도메인 동작을 바꾸는 첫 PR이 id를 붙이고, 그 PR은 정책 문서를
바꾸므로 PR 본문에 그 문서의 Owner 확인 줄을 둡니다.

인용은 파일 링크 + id입니다: `[data-retention.md DR-R3](./data-retention.md)`(경로는 인용하는 문서 기준이고, PR 본문
`Lifecycle` 절의 `인용 규칙`은 저장소 root 기준 `docs/policies/<문서>.md`). CI `Lifecycle gate`의 `W-CITE`는 인용한 id가 링크한
문서에 `**ID**`로 있는지와 접두어가 위 표의 값인지 확인합니다.

## 경로 → 정책 도메인 표

[`path-domains.json`](./path-domains.json)은 제품 경로가 어느 정책 도메인을 바꾸는지 정하는 표입니다. CI `Lifecycle gate`가
PR diff에 적용하며, 기술 layer 영역(FE·BFF·BE) 판정과는 다른 축입니다.

| 필드                | 내용                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `productRoots`      | 표를 적용하는 제품 경로                                                                                                     |
| `entries`           | `globs`에 맞는 경로의 `domains`(정책 문서 이름). 한 경로가 여러 행에 맞으면 도메인을 합치고, `except` glob은 그 행에서 뺀다 |
| `noDomain`          | 정책 도메인이 없는 제품 경로와 이유. 미분류 경고만 끈다                                                                     |
| `irreversiblePaths` | 되돌리기 어려운 경로와 근거 정책. trivial·bugfix·hotfix가 바꾸면 `W-IRREV` fail이다                                         |
| `confirmedBy`       | 표 전체의 Owner 확인(`status`·`date`·`basis` = 그 변경 작업의 GitHub issue 번호)                                            |

- glob은 `**`(여러 단계)와 `*`(한 단계)만 씁니다. 행과 `noDomain`에 모두 맞지 않는 제품 경로는 미분류 경고, 추적 파일에 하나도
  맞지 않는 glob은 stale 경고입니다.
- 이 파일을 바꾸는 PR은 변경 등급과 무관하게 `confirmedBy`를 그 PR의 Owner 확인으로 바꾸고 PR 본문에
  `Owner 확인: docs/policies/path-domains.json <날짜>` 줄을 둡니다(`L-CONFIRM`, override로 낮출 수 없음).

## 정리 원칙

1. **상태 전이와 리스트 표현은 `matching-lifecycle.md`가 단독 소유한다.**
2. **시즌별 기능 on/off는 `season-lifecycle.md`가 단독 소유한다.**
3. **chat thread lifecycle과 chat write/read capability는 `chat-lifecycle.md`가 단독 소유한다.**
4. **시즌 참여자 등록의 의미와 `SeasonParticipantProfile` draft/final/registration 관계는 `season-participation.md`가 단독 소유한다.**
5. **프로필 편집 가능 범위와 필드 구조는 `profile-model.md`가 단독 소유한다.**
6. **가입/매칭 자격은 `access-eligibility.md`가 단독 소유한다.**
7. **룸메이트 찾기 검색 scope와 필터/정렬 contract는 `roommate-searching.md`가 단독 소유한다.**
8. **콘텐츠 moderation과 자기표현/배제 기준은 `community-safety.md`가 단독 소유한다.**
9. **데이터 보유기간·파기 절차·법적 근거는 `data-retention.md`가 단독 소유한다.**
10. **적용 법령 계층 구조·서비스 행위별 법령 매핑은 `legal-basis.md`가 단독 소유한다.**
11. **신고 카테고리·제재 사다리·증거 판단·임시조치·고지 원칙은 `incident-enforcement.md`가 단독 소유한다.**
12. **support ticket, appeal, FAQ, 이메일 회신 동의는 `support-communication.md`가 단독 소유한다.**
13. **알림함, notification writer/outbox payload privacy, Push 제외 경계는 `notification-inbox.md`가 단독 소유한다.**
14. **운영 관측 수집 목적, 로그·메트릭 개인정보, 접근, 보존과 fail-open 규칙은 `operational-observability.md`가 단독 소유한다.**
15. **Production secret, DB, migration, ingress, health, rollback과 release blocker 불변 조건은 `production-runtime-safety.md`가 단독 소유한다.**
16. **Runtime topology와 관측 도구 선택은 `docs/architecture/platform/`, 지금 적용한 운영 환경의 설명과 실제 청구 비용은 `docs/deploy/`, release gate가 판정에 쓰는 target 입력과 실행 결과는 `infra/runbooks/`가 소유한다.**
17. **Dependency vulnerability triage, exception, dismissal과 release blocker는 `dependency-security.md`가 단독 소유한다.**

## 변경 이력 규칙

정책 문서를 수정할 때는 해당 문서 하단에 변경 이력을 추가한다.

| 열        | 내용                         |
| --------- | ---------------------------- |
| 날짜      | 변경일 (YYYY-MM-DD)          |
| 변경 내용 | 무엇이 바뀌었는지 한 줄 요약 |
| 관련 이슈 | 근거가 되는 이슈 번호 (#NNN) |

장기 유지할 상세 결정은 `docs/architecture/`의 owning domain에 기록하고, 작업 과정은 관련 이슈·PR과 변경 이력을 통해 추적한다.

## RRPD retained vault owner mapping

계정 삭제/비식별화 이후 복원 가능한 제한 보존 개인정보(RRPD)는 한 문서가 단독으로 모든 판단을 소유하지 않는다. 역할은 아래처럼 나눈다.

| 판단 영역                              | owner 문서                                            | 기준                                                        |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| 보존 기간·파기·vault/disposal          | `data-retention.md`                                   | RRPD target, hold, disposal, access log                     |
| 법적 근거·익명/가명 구분               | `legal-basis.md`                                      | 분리 보관, 안전조치, 처리방침 공개                          |
| user-facing profile/detail degrade     | `profile-model.md`, `roommate-searching.md`           | retained vault 복원 금지, summary/detail field set          |
| match history event fact/snapshot 분리 | `matching-lifecycle.md`                               | survivor summary 유지, deleted detail fail-closed           |
| chat body archive                      | `chat-lifecycle.md`                                   | `CHAT_MESSAGE_BODY` retained vault + tombstone              |
| 신고/제재 disclosure                   | `incident-enforcement.md`, `service-boundary.md`      | approval/access log, 운영 접근 제한                         |
| 지원 문의/이의 신청                    | `support-communication.md`, `incident-enforcement.md` | ticket/appeal intake, reply channel, support body 원문 경계 |
| 알림 payload                           | `notification-inbox.md`                               | pointer payload, raw report/support/RRPD payload 금지       |

## 문서 변경 이력

| 날짜       | 변경 내용                                                                                                                                                         | 관련 이슈                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 README의 기본 프로필/`LIMITED/FULL` 설명을 `SeasonParticipantProfile`과 capability 용어로 갱신                                        | #195                                    |
| 2026-05-25 | RRPD retained vault 관련 policy owner mapping을 추가하고, data-retention/legal/profile/matching/chat/incident/service-boundary의 책임 분리를 정리                 | #195                                    |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                               | #195                                    |
| 2026-06-08 | chat-lifecycle.md, support-communication.md, notification-inbox.md를 official policy set에 추가하고 chat/support/notification owner 경계를 정리했다               | #79 / #196 / #198 / #220                |
| 2026-06-13 | 운영 관측·로그·부하 테스트 정책 문서를 official policy set에 추가하고 runtime observability/release gate/server spec owner 경계를 정리했다                        | logging-stress-test-infrastructure-plan |
| 2026-06-17 | Production 배포 준비 정책을 official policy set에 추가하고 BE API/RDS release safety owner 경계를 정리했다.                                                       | production deployment readiness         |
| 2026-08-11 | 배포·관측 정책에서 topology, provider 가격, resource 값과 rehearsal 절차를 architecture/release owner로 분리했다.                                                 | documentation responsibility            |
| 2026-08-24 | Dependency vulnerability triage, exception, dismissal과 release blocker 정책을 추가했다.                                                                          | GitHub Security baseline                |
| 2026-10-17 | `matching-algorithm.md` 색인 행, 규칙 id 접두어 열, 규칙 id·인용 형식과 경로 → 정책 도메인 표(`path-domains.json`)를 추가했다                                     | #634                                    |
| 2026-10-24 | `사용 순서` 머리 문장에서 Sprint 5를 빼고 목록에 `matching-algorithm.md`·`roommate-searching.md`를 넣어 정책 문서 19개를 모두 담았다                              | #677                                    |
| 2026-10-31 | 문서 구성 표에 종류 칸(제품·운영·혼합)을 더하고, 정리 원칙 16에 지금 운영 환경·실제 비용(`docs/deploy/`)과 release target 입력(`infra/runbooks/`)의 소유를 나눴다 | #723                                    |

## 사용 순서

구현 이슈를 만들 때는 아래 순서로 읽는 것이 안전하다.

1. `account-authentication.md`
2. `access-eligibility.md`
3. `season-lifecycle.md`
4. `season-participation.md`
5. `profile-model.md`
6. `matching-lifecycle.md`
7. `matching-algorithm.md`
8. `roommate-searching.md`
9. `chat-lifecycle.md`
10. `service-boundary.md`
11. `community-safety.md`
12. `incident-enforcement.md`
13. `support-communication.md`
14. `notification-inbox.md`
15. `operational-observability.md`
16. `production-runtime-safety.md`
17. `data-retention.md`
18. `legal-basis.md`
19. `dependency-security.md`
