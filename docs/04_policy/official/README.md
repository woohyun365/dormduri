# 공식 정책 세트

이 폴더는 `docs/04_policy/*.md`를 최신 planning 결정 기준으로 다시 정리한 도메인별 정책 세트다.

- 기존 문서는 의사결정 누적 결과를 보존한다.
- 이 폴더는 충돌을 정리한 **정규화된 정책 뷰**를 제공한다.
- 같은 규칙은 한 문서만 최종 소유하도록 배치했다.

## 문서 구성

| 문서                                                                           | 도메인           | 최종 소유 규칙                                                                                           |
| ------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------- |
| [account-authentication.md](./account-authentication.md)                       | 계정/인증        | id 체계, 이메일 인증, 로그인, 세션, 비밀번호, 회원가입 기본 단계                                         |
| [access-eligibility.md](./access-eligibility.md)                               | 이용 자격        | 누가 가입/매칭 참여 가능한지, 건물 배정 입력 의미, 건물/캠퍼스 변경 원칙                                 |
| [season-lifecycle.md](./season-lifecycle.md)                                   | 시즌 운영        | 시즌 기간, 지원 건물, 시즌별 기능 on/off, 시즌 전환 데이터 처리                                          |
| [season-participation.md](./season-participation.md)                           | 시즌 참여        | 시즌 참여자 등록의 의미, `SeasonParticipantProfile` draft/final, registration 완료 조건, capability 용어 |
| [profile-model.md](./profile-model.md)                                         | 프로필 구조      | `UserDisplayIdentity`, `SeasonParticipantProfile`, profile history, 필드 레벨 노출                       |
| [matching-lifecycle.md](./matching-lifecycle.md)                               | 매칭 상태        | 호환도 계산, 신청/대화/확정 상태 전이, 북마크, 리스트 표현, 3인실 그룹 매칭                              |
| [chat-lifecycle.md](./chat-lifecycle.md)                                       | 채팅 상태        | 1:1 chat thread 생성/쓰기/read-only/archive, block/report/realtime/retention 경계                        |
| [roommate-searching.md](./roommate-searching.md)                               | 룸메이트 찾기 UX | 검색 scope, summary/detail/action capability, manifest/filter/sort/cursor 계약                           |
| [service-boundary.md](./service-boundary.md)                                   | 서비스 책임 범위 | 채팅 포함 범위, 시스템 보장 한계, 면책, 분쟁 시 서비스 역할                                              |
| [community-safety.md](./community-safety.md)                                   | 커뮤니티 안전    | 비속어/혐오 표현 필터, 개인정보 노출 가이드, 소수자 포용 원칙                                            |
| [incident-enforcement.md](./incident-enforcement.md)                           | 신고/제재 운영   | 신고 카테고리, 제재 사다리, 즉시 분리 트리거, 임시조치, 증거 판단, 고지 원칙                             |
| [support-communication.md](./support-communication.md)                         | 지원/문의        | support ticket, appeal, FAQ, email optional consent, support notification handoff                        |
| [runtime-observability-and-release.md](./runtime-observability-and-release.md) | 운영 관측/릴리즈 | 로그, 메트릭, 모니터링, stress test, release gate, 서버 스펙 선택 기준                                   |
| [notification-inbox.md](./notification-inbox.md)                               | 알림함           | in-app notification, writer/outbox, payload privacy, delivery channel 경계                               |
| [data-retention.md](./data-retention.md)                                       | 데이터 보유기간  | 데이터 분류별 보유기간, 파기 절차, 탈퇴 시 처리, 법적 근거                                               |
| [legal-basis.md](./legal-basis.md)                                             | 법적 근거        | 적용 법령 계층 구조, 서비스 행위별 법령 매핑, 접속기록 규율 대상 구분                                    |

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
14. **운영 관측, 로그, 메트릭, stress/release gate, 서버 스펙 선택 기준은 `runtime-observability-and-release.md`가 단독 소유한다.**

## 원문과의 대응

| 원문                   | 재구성 반영 위치                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `auth.md`              | `account-authentication.md`                                                                                            |
| `password.md`          | `account-authentication.md`                                                                                            |
| `nickname.md`          | `profile-model.md`                                                                                                     |
| `eligibility.md`       | `access-eligibility.md`, `season-lifecycle.md`                                                                         |
| `season-policy.md`     | `season-lifecycle.md`, `season-participation.md`                                                                       |
| `profile-lifestyle.md` | `profile-model.md`                                                                                                     |
| `profile-exposure.md`  | `roommate-searching.md`, `season-lifecycle.md`, `season-participation.md`, `matching-lifecycle.md`, `profile-model.md` |
| `matching.md`          | `matching-lifecycle.md`, `chat-lifecycle.md`                                                                           |
| `service-scope.md`     | `service-boundary.md`                                                                                                  |
| `content-filter.md`    | `community-safety.md`, `incident-enforcement.md`                                                                       |
| `inclusion.md`         | `community-safety.md`                                                                                                  |
| `service-scope.md`     | `service-boundary.md`, `incident-enforcement.md`                                                                       |

## 변경 이력 규칙

정책 문서를 수정할 때는 해당 문서 하단에 변경 이력을 추가한다.

| 열        | 내용                         |
| --------- | ---------------------------- |
| 날짜      | 변경일 (YYYY-MM-DD)          |
| 변경 내용 | 무엇이 바뀌었는지 한 줄 요약 |
| 관련 이슈 | 근거가 되는 이슈 번호 (#NNN) |

상세 결정 과정은 `docs/03_planning/` 문서에 기록하고, 변경 이력의 관련 이슈를 통해 추적한다.

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

| 날짜       | 변경 내용                                                                                                                                           | 관련 이슈                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-06-13 | 운영 관측·로그·부하 테스트 정책 문서를 official policy set에 추가하고 runtime observability/release gate/server spec owner 경계를 정리했다          | logging-stress-test-infrastructure-plan |
| 2026-06-08 | chat-lifecycle.md, support-communication.md, notification-inbox.md를 official policy set에 추가하고 chat/support/notification owner 경계를 정리했다 | #79 / #196 / #198 / #220                |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                 | #195                                    |
| 2026-05-25 | RRPD retained vault 관련 policy owner mapping을 추가하고, data-retention/legal/profile/matching/chat/incident/service-boundary의 책임 분리를 정리   | #195                                    |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 README의 기본 프로필/`LIMITED/FULL` 설명을 `SeasonParticipantProfile`과 capability 용어로 갱신                          | #195                                    |

## 사용 순서

Sprint 5 구현 이슈 생성 시에는 아래 순서로 읽는 것이 안전하다.

1. `account-authentication.md`
2. `access-eligibility.md`
3. `season-lifecycle.md`
4. `season-participation.md`
5. `profile-model.md`
6. `matching-lifecycle.md`
7. `chat-lifecycle.md`
8. `service-boundary.md`
9. `community-safety.md`
10. `incident-enforcement.md`
11. `support-communication.md`
12. `notification-inbox.md`
13. `runtime-observability-and-release.md`
14. `data-retention.md`
15. `legal-basis.md`
