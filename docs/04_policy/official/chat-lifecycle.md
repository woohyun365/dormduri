# 채팅 생명주기 정책

## 문서 범위

이 문서는 **2인실 기준**의 채팅 UI 진입, `ConversationThread` 생성 시점, 쓰기/읽기 권한, archive/신고, 내부 보관 원칙을 다룬다.

- 매칭 요청 상태 전이와 신청 제한은 [matching-lifecycle.md](./matching-lifecycle.md)에서 정의한다.
- 시즌 상태별 기능 on/off는 [season-lifecycle.md](./season-lifecycle.md)에서 정의한다.
- 시즌 참여자 등록과 공개/매칭/대화 전제는 [season-participation.md](./season-participation.md)에서 정의한다.
- 데이터 보관/탈퇴 시 비식별화는 [data-retention.md](./data-retention.md)에서 정의한다.
- 3인실 그룹 채팅의 상세 구조는 [group-matching-lifecycle.md](./group-matching-lifecycle.md)를 참조한다.

이 문서가 **2인실 채팅 thread lifecycle의 최종 소유 문서**다.

## 채팅방 구조

| 항목 | 정책 |
| ---- | ---- |
| `쪽지보내기` 의미 | 채팅방 실체 생성이 아니라 **채팅 UI 진입** |
| thread 생성 시점 | 첫 메시지 전송 시 `ConversationThread` 생성 |
| same pair cardinality | 같은 pair(A,B)는 동시에 **thread 1개**만 유지 |
| match request와의 관계 | thread와 `MatchRequest`는 독립 관계. 대화방 선행 조건 없이 매칭 신청 가능 |
| 채팅 UI 역할 | 채팅 UI는 **match request 생성 surface가 아님** |
| matched chat 생성 | 기존 thread가 있으면 ACTIVE 시점에 승격, 없으면 첫 post-match 메시지 전송 시 lazy 생성 |

### canonical 흐름

```text
쪽지보내기
  → 채팅 UI 진입
  → 첫 메시지 전송 시 ConversationThread 생성

MatchRequest 수락
  → ActiveMatch 생성
  → 기존 thread가 있으면 matched chat으로 승격
  → 기존 thread가 없으면 room을 즉시 만들지 않음
  → ACTIVE 이후 첫 메시지 전송 시 matched chat lazy 생성
```

## 쓰기/읽기 권한

| thread 유형 | `SEASON_OPEN` | `SEASON_MATCHING` | `SEASON_POST_MATCH` | 종료 기준 |
| ----------- | -------------------- | ----------------- | ------------------- | --------- |
| 일반/비매칭 thread | registration 완료(`REGISTERED + ASSIGNED + registeredAt + complete season profile + SEASON_REGISTRATION snapshot`) + 같은 건물/성별 전제에서만 채팅 UI 진입 및 쓰기 가능 | 내 기숙사 `roomSelectionDate` 전까지 쓰기 가능 | 읽기 전용 | `roomSelectionDate` |
| matched pair thread | 해당 없음 | ACTIVE 이후 쓰기 가능 | **계속 쓰기 가능** (`seasonEndDate` 전까지) | `seasonEndDate` |
| read-only / inactive thread | 읽기 가능 | 읽기 가능 | 읽기 가능 | close reason에 따름 |

### 해석 원칙

- 이 문서에서 대문자 `READ_ONLY`는 `ConversationThread.status`의 사용자-facing thread 상태다. 룸메이트 찾기 문서의 summary-only exposure나 match/result read context와 같은 계층이 아니다.
- `canSendMessage = false`는 현재 thread에 새 메시지를 쓸 수 없다는 action capability이며, thread 자체가 목록/상세에서 읽힐 수 있는지와 별도다.
- thread summary는 `sendMessageUnavailableReason`을 함께 내려, 기존 room UI가 열려 있지만 입력이 닫힌 경우 사용자-facing 문구를 만들 수 있게 한다. API는 reason enum만 제공하고 최종 문구는 제품/UI 문구 owner가 변환한다.
- 채팅 가능 여부는 roommate-search summary browse와 별개다. Summary card가 보이더라도 `actions.canStartChat`은 닫힐 수 있다.
- 기본적으로 **registration 완료(`REGISTERED + ASSIGNED + registeredAt + complete season profile + SEASON_REGISTRATION snapshot`) + 같은 건물 + 같은 성별/캠퍼스** 전제가 있어야 `쪽지보내기`로 채팅 UI에 진입하고 신규 대화를 연다.
- 미등록, registration candidate, selection-required, legacy `UNASSIGNED` 상태 사용자는 시즌 기간 등록 완료 target summary를 볼 수 있어도 새 채팅 UI 진입과 첫 메시지 전송은 모두 허용되지 않는다.
- 시즌 프로필(`SeasonParticipantProfile`) 기반 경로에서는 lifestyle/roommate condition에 null이 다시 생긴 상태를 허용하지 않는다. 따라서 chat eligibility가 열린 사용자는 season profile complete 상태여야 한다.
- 비매칭 thread는 `roomSelectionDate` 이후 read-only/archive로 전환된다.
- matched pair thread는 `ACTIVE` 이후 `SEASON_MATCHING`과 `SEASON_POST_MATCH` 동안 계속 write를 허용하고, `seasonEndDate` 당일 `23:59:59(KST)`까지 open을 유지한 뒤 다음 날 `00:00:00(KST)`부터 read-only로 전환된다.
- 상호 합의 해제로 `ACTIVE → UNMATCHED`가 되면, 기존 matched thread가 살아 있었다면 **matched context를 direct/non-matched thread로 되돌린다**. 이후 그 thread는 일반/비매칭 thread와 동일하게 `roomSelectionDate` cutoff를 따른다.
- 같은 해제 transaction에서 `ACTIVE_MATCH_CREATED` 때문에 `READ_ONLY`로 닫혔던 관련 direct thread는 현재 direct chat action 조건을 다시 평가한다. 양쪽이 현재 active match가 없고, registration/profile/snapshot/건물/성별/캠퍼스/운영 기숙사/visibility 조건을 만족하며 `roomSelectionDate` 전이면 `OPEN`으로 복구한다. 조건을 만족하지 않거나 `ARCHIVED`인 thread는 자동 복구하지 않는다.
- 지난 시즌 thread는 다음 시즌 current season의 `seasonOpenDate 00:00:00(KST)`가 되는 순간 archive되어 기본 채팅 목록에서 사라진다.
- 사용자-facing `archive`는 **보이기 방식**이며, 내부 보관 anchor와 동일 개념이 아니다.
- 별도 `채팅 보관함` 탭은 두지 않는다. 일반 목록/상세에서 상태 배지와 입력창 비활성화로 표현한다.

## 나가기와 재노출

| 이벤트 | 정책 |
| ------ | ---- |
| 한 명만 나감 | **archive되지 않아 사용자에게 아직 보이는 OPEN 또는 READ_ONLY thread 전체에서 허용**. thread 전체 종료가 아니라 member leave 상태만 기록하고, 나간 사용자 UI에서만 숨긴다 |
| 양쪽 모두 나감 | archive되지 않은 visible OPEN/READ_ONLY thread에서 양쪽 모두 leave가 되면 archive |
| 나간 뒤 새 메시지 수신 | **thread가 OPEN 상태일 때만** 다시 목록에 재노출 가능. 재노출 후에는 `leave` 이전 메시지가 아니라 `상대가 다시 보낸 첫 메시지`부터 본다 |
| ACTIVE 생성 | 다른 비매칭 thread는 read-only/archive |
| ACTIVE 해제 | matched thread는 direct/non-matched context로 되돌리고, `ACTIVE_MATCH_CREATED`로 닫혔던 관련 direct thread는 현재 eligible 조건을 만족할 때만 reopen |

leave는 차단이 아니라 **개별 사용자의 숨김/이탈 행위**다.

## 종료 사유와 가시성

### 분리 원칙

```text
close reason
≠
archive visibility
```

- `closeReason`: 왜 닫혔는가
- `visibilityState`: 목록에서 어떻게 보이는가
- `messageWriteAllowed`: 입력창 활성 여부
- current schema/user-facing lifecycle에서는 `CLOSED`를 제거하고, 접근 불가 보관 상태는 `ARCHIVED`로 본다. soft delete 성격의 `DELETED` / `deletedAt` 도입은 retention/de-identification 범위(`#148`)에서 다룬다.

### 주요 종료 사유

| reason | 의미 | 사용자 문구 |
| ------ | ---- | ----------- |
| `CHAT_CLOSED_BY_MATCH_COMPLETION` | **다른 매칭 완료로 인해 기존/비매칭 thread가 종료됨** | `다른 매칭이 완료되어 이 대화는 종료되었습니다.` |
| `CHAT_DISABLED_BY_BLOCK` | 차단으로 더 이상 이용 불가 | `이 대화는 더 이상 이용할 수 없습니다.` |
| `CHAT_CLOSED_BY_ADMIN` | 운영자 개입 종료 | `운영 정책에 따라 이 대화가 종료되었습니다.` |
| `CHAT_CLOSED_BY_SEASON_END` | 시즌 종료 또는 매칭 가능 기간 종료 후 닫힘 | `시즌 종료로 채팅이 비활성화되었습니다.` |
| `PARTICIPANT_WITHDRAWN` | 상대 또는 본인의 시즌 참여 철회로 비매칭 thread가 read-only 처리됨 | `시즌 참여 철회로 이 대화는 종료되었습니다.` |

### 주의

- **매칭 완료 자체는 matched pair thread의 종료 사유가 아니다.**
- matched pair thread는 `ACTIVE` 이후 **matched-active 상태로 유지**되며, `seasonEndDate`까지는 쓰기 가능하다. `seasonEndDate` 이후에는 read-only로 남고, 다음 시즌 current season이 열리면 archive되어 기본 채팅 목록에서는 보이지 않는다.
- leave 후 재노출은 기존 메시지 전체 복원과 같지 않다. 숨김 상태에서 다시 열린 경우, 사용자는 재노출을 유발한 **새 메시지 시점 이후 내역**부터 본다.

## 상태별 권한 matrix

이 matrix는 사용자-facing 채팅 목록/상세, 메시지 전송, read marker, realtime subscribe, replay, 신고/evidence 경계를 한곳에 고정한다. 구현은 이 표를 기준으로 fail-closed 해야 하며, realtime event나 replay 응답이 REST snapshot보다 더 강한 권한을 만들 수 없다.

| 상태 | 목록/상세 | 메시지 전송 | read marker | realtime subscribe | replay | 신고/evidence policy |
| ---- | --------- | ----------- | ----------- | ------------------ | ------ | -------------------- |
| direct `OPEN` + viewer `ACTIVE` + 현재 direct chat action eligible | 허용. 일반 목록/상세에 노출하고 입력 가능 상태를 내려준다 | 허용. `clientMessageId`, 본문 길이, 현재 registration/building/gender/campus/visibility 정책을 transaction에서 재검증한다 | 허용. monotonic marker만 허용한다 | 허용. 기존 visible thread의 active member인지 확인한다 | 허용. user별 recipient row와 7일 window 안에서만 복구한다 | 허용. 일반 신고/evidence 보존 정책 적용 |
| direct `OPEN`이지만 target/actionable 조건이 깨진 상태 | lifecycle owner가 먼저 `READ_ONLY`, `ARCHIVED`, tombstone 또는 send-denied 상태로 수렴해야 한다. `OPEN` 그대로 쓰기 가능하게 방치하지 않는다 | 거절 또는 수렴 후 거절. summary visibility는 쓰기 권한이 아니다 | 수렴 후 visible thread라면 허용, 숨김/archived면 거절 | 수렴 후 visible active member일 때만 허용 | replay는 과거 event 복구일 뿐 현재 쓰기 가능성의 authority가 아니다 | 상태 수렴 결과에 따른다 |
| direct `READ_ONLY` + viewer `ACTIVE` | 허용. 기존 대화 맥락과 종료 reason을 노출한다 | 거절. 입력창은 비활성화하고 `sendMessageUnavailableReason`을 내려준다 | 허용. 읽음 위치 동기화는 쓰기 권한과 별도다 | 허용. 읽기 동기화 목적의 subscribe는 가능하다 | 허용. 단 current snapshot과 충돌하면 REST snapshot이 우선한다 | 허용. read-only/inactive thread 신고 가능 |
| matched `OPEN` + viewer `ACTIVE` | 허용. ACTIVE match thread로 노출한다 | 허용. `seasonEndDate` 당일 23:59:59(KST)까지 쓰기 가능하다 | 허용 | 허용 | 허용 | 허용 |
| matched `READ_ONLY` + viewer `ACTIVE` | 허용. 시즌 종료 reason과 입력 비활성 상태를 노출한다 | 거절. `seasonEndDate` 이후 새 메시지 불가 | 허용 | 허용. 읽기/동기화 목적에 한정한다 | 허용 | 허용 |
| viewer memberState `LEFT` | 기본적으로 나간 사용자 목록/상세에서 숨긴다. `OPEN` thread에서 상대가 새 메시지를 보내 재노출될 때만 새 메시지 시점 이후로 다시 보인다 | 거절. LEFT 사용자는 새 메시지 전송으로 스스로 복귀하지 않는다 | 거절. hidden thread의 읽음 위치를 갱신하지 않는다 | 거절. 현재 visible active membership이 아니다 | 현재 hidden 상태를 깨지 않는다. 재노출 이후 recipient event만 새 visibility 기준으로 복구한다 | 숨김 상태에서는 신규 user-facing 신고 entry를 열지 않는다. 기존 신고/evidence 보존은 유지한다 |
| `ARCHIVED` | 일반 채팅 목록/상세/API subscribe에서 숨긴다. 사용자-facing 보관함도 두지 않는다 | 거절. 새 thread 정책을 다시 만족하지 않는 한 기존 archived thread에 쓰지 않는다 | 거절. not found/fail-closed 처리한다 | 거절. archived thread는 subscribe 대상이 아니다 | replay는 과거 recipient event 복구 채널일 뿐 현재 thread visibility authority가 아니다. current snapshot이 archived면 client는 hidden/resync로 수렴한다 | 신규 user-facing 신고 entry는 열지 않는다. 기존 신고, retention, 운영 evidence는 내부 보관 정책으로 유지한다 |
| retention tombstone body가 있는 visible thread | thread가 `OPEN` 또는 `READ_ONLY`로 여전히 보이는 경우에만 tombstone shell을 노출한다. 원문 body는 product path로 복원하지 않는다 | thread 상태와 현재 send policy를 따른다. tombstone 자체가 쓰기 권한을 만들지는 않는다 | thread 상태와 membership이 유효하면 허용한다 | thread 상태와 membership이 유효하면 허용한다 | tombstone event shell만 replay한다. retained original body, vault payload, internal audit data는 replay payload에 넣지 않는다 | 신고/분쟁/제재/수사 협조 evidence는 retained vault 승인·접근 로그·사유 기준으로만 조회한다 |

### archived thread visibility 원칙

- `ARCHIVED`는 일반 사용자-facing 보관함이 아니라 **목록/상세/API subscribe에서 숨겨지는 접근 불가 상태**다.
- `ARCHIVED` thread는 `getThreadDetail`, read marker, realtime subscribe에서 not found 또는 equivalent fail-closed 응답으로 처리한다.
- replay API는 과거 recipient event를 7일 window 안에서 복구하는 채널이며, archived thread를 다시 visible하게 만드는 authority가 아니다.
- archived 이후 retained body는 user-facing event shell/tombstone으로만 남기고, retained original body는 socket/replay/cache/log로 복원하지 않는다.

### actionable target과 realtime chat의 관계

- roommate-search summary card가 보이는 것과 채팅 쓰기 권한은 다르다. Summary visibility는 chat write permission이 아니다.
- `actions.canStartChat`은 첫 message materialization과 send permission의 gate다. 기존 thread가 있어도 현재 direct chat action precondition이 깨졌다면 send는 fail-closed로 닫힌다.
- realtime subscribe는 **이미 존재하고 현재 visible한 thread의 active membership**만 확인한다. subscribe는 새 채팅 action을 열거나 첫 메시지 materialization을 수행하지 않는다.
- realtime event와 replay는 동기화 보조 채널이다. client는 event만 보고 write/read authority를 확정하지 말고 REST snapshot과 domain policy 결과로 수렴해야 한다.

## 신고와 보호 조치

| 항목 | 정책 |
| ---- | ---- |
| 채팅 rate limit | 메시지 전송, realtime ticket 발급, gateway 연결/재연결은 인증/권한 정책과 별개로 abuse rate limit 대상이다 |
| 기본 방어선 | 인증/session guard, domain policy, rate limit, 차단, 신고, 나가기, 운영 로그 |
| 고위험 신고 | 즉시 보호 조치/비활성화 가능 |
| 일반 신고 | 관리자 판단 후 상태 변경 |
| read-only/inactive thread 신고 | 허용 |

채팅 메시지는 실시간 입력 차단보다 **사후 신고·제재 중심**으로 운영한다.

### Abuse 방어와 직접 호출 원칙

- 서비스는 "UI에서 호출했는가"를 보안 경계로 보지 않는다. 정상 사용자가 본인 access token으로 CLI/curl 같은 비공식 client에서 REST API를 직접 호출할 수는 있지만, 그 요청도 동일한 인증/session guard, domain policy, rate limit, 감사/운영 로그의 적용을 받아야 한다.
- access token이 없거나 위조/만료/로그아웃/삭제 계정/session mismatch 상태인 요청은 fail-closed로 거절한다.
- 메시지 전송 abuse는 최소한 사용자 단위, thread 또는 target pair 단위, 짧은 burst window 단위로 제한한다. `clientMessageId` idempotency는 retry 중복을 수렴시키는 장치이지 spam quota 대체물이 아니다.
- realtime ticket 발급은 access token을 realtime ticket으로 교환하는 민감 boundary이므로 사용자/IP 단위 rate limit을 둔다.
- Socket.IO gateway 연결/재연결은 CORS allowlist와 WebSocket `allowRequest` origin check만으로 충분하지 않다. 연결 단계에서는 Origin 정책과 ticket auth를 적용하고, 연결/재연결 빈도와 동시 socket 수를 명시적으로 제한한다.
- `@nestjs/throttler`의 HTTP 전역 guard가 gateway connection을 자동으로 보호한다고 가정하지 않는다. gateway/message handler throttling이 필요하면 WebSocket용 guard 또는 별도 limiter를 명시적으로 구현하고 테스트한다.
- first release의 single API node에서는 process-local limiter로 시작할 수 있지만, multi-node 전환 시에는 Redis-backed throttler, API Gateway/WAF, reverse proxy rate limit 등 분산 저장소/인프라 레벨 제한을 재검토한다.

## 실시간 전송과 동기화 정책

이 섹션은 Issue #198 실시간 채팅의 정책 baseline이다. 구현 세부는 `.omx/plans/chat-realtime-design-issue-198-plan.md`를 따르되, 사용자-facing 채팅 권한과 데이터 노출의 최종 정책 판단은 이 문서를 따른다.

### 권위(authority) 경계

- 채팅의 canonical source는 PostgreSQL에 저장된 thread/member/message 상태와 REST snapshot이다.
- Socket.IO realtime event는 상태 변화를 빠르게 알리는 **통지/동기화 채널**이며, 쓰기 권한·읽기 권한·보관 정책의 authority가 아니다.
- 메시지 전송, 나가기, read marker 갱신, lifecycle/retention mutation은 API transaction에서 정책을 검증한 뒤 저장한다.
- gateway 또는 dispatcher는 정책 상태를 직접 변경하지 않는다. Socket emit은 DB transaction 내부에서 직접 수행하지 않고, commit된 outbox event를 publish한다.
- client는 realtime event를 받더라도 REST snapshot/replay 결과와 충돌하면 REST snapshot을 우선해 수렴해야 한다.

### 연결 인증과 토큰 노출 금지

- browser는 장기 bearer token 또는 session secret을 Socket.IO handshake에 직접 노출하지 않는다.
- API는 현재 사용자 세션을 검증한 뒤 60초 TTL의 realtime ticket을 발급한다.
- gateway는 ticket 만료, session mismatch, scope mismatch, thread membership mismatch를 fail-closed로 거절한다.
- 허용 origin은 `CHAT_REALTIME_ALLOWED_ORIGINS` 환경값으로 관리한다. 실제 운영/preview origin 값 확정은 후속 운영 이슈(#253)에서 다루며, 이 문서는 env key와 fail-closed 원칙만 고정한다.
- Next.js BFF realtime ticket route와 Web socket 연결 구현은 Issue #249 범위이며, 이 정책 문서는 API/gateway가 지켜야 할 보안 경계를 정의한다.

### 메시지 쓰기 invariant

- 메시지 본문은 trim 이후 1자 이상, 1,000자 이하여야 한다.
- 새 메시지 전송 요청은 `clientMessageId`를 포함해야 하며, 같은 sender participant의 같은 `clientMessageId`는 같은 논리적 전송으로 본다.
- 중복 전송이 감지되면 같은 payload는 기존 메시지로 수렴하고, 다른 payload가 같은 `clientMessageId`를 재사용하면 새 메시지를 만들지 않고 충돌로 처리한다.
- 이 invariant는 REST command, shared contract, DB 제약 또는 transaction-level 검증, 회귀 테스트로 함께 보호한다.

### read marker 정책

- read marker는 **내 unread count와 내 device/session 간 읽음 위치 동기화**를 위한 사용자 자신의 상태다.
- 첫 release에서는 상대방에게 내 읽음 여부를 read receipt로 노출하지 않는다.
- read marker는 뒤로 이동하지 않는 monotonic marker로 저장한다.
- `READ_ONLY` thread에서도 읽기 위치 동기화는 허용할 수 있다. 단, thread membership과 visibility가 유효해야 한다.
- read marker realtime event는 상대방에게 "읽음" 표시를 제공하는 이벤트가 아니라, 해당 사용자 자신의 unread/read projection을 최신화하기 위한 이벤트다.

### outbox, replay, 재연결 수렴

- missed realtime event 복구는 transactional outbox와 user별 recipient row를 기반으로 하는 bounded high-watermark replay API를 사용한다.
- replay window는 기본 7일이다. cursor가 window 밖이거나 schema/version이 맞지 않으면 client는 `resync required` 응답 또는 이벤트를 받고 REST snapshot으로 수렴한다.
- replay event는 인증된 사용자에게 허용된 thread/member 범위만 반환해야 한다.
- Socket.IO의 중복·누락·재연결 상황은 정상 장애 모델로 보고, client는 event cursor와 REST snapshot을 함께 사용해 idempotent하게 수렴해야 한다.
- exact 운영 보관 기간 재점검, multi-node/Redis adapter 전환, managed realtime service 도입은 각각 후속 이슈(#252, #250, #251)에서 다룬다.

### 채팅방 생성 알림

- 첫 메시지 전송으로 새 `DIRECT` `ConversationThread`가 생성되면, recipient에게 `CHAT_THREAD_CREATED` 인앱 알림을 생성한다.
- 알림의 canonical source는 `UserNotification` read model이며, 실시간 `notification.created` event는 빠른 동기화 채널이다.
- 알림 read model과 notification outbox row는 첫 메시지 transaction 안에서 함께 생성한다. transaction rollback, send policy rejection, duplicate `clientMessageId` retry는 유령 알림 또는 중복 알림을 만들지 않아야 한다.
- sender 본인에게는 채팅방 생성 알림을 만들지 않는다.
- 알림 payload는 allowlist만 저장한다. `threadId`, `actorUserId`, `recipientUserId`, `kind`, `occurredAt` 같은 최소 식별자만 허용하고, message body, retained original body, vault payload, internal audit data, nickname/email/full identity를 저장하거나 realtime event/log로 노출하지 않는다.
- account deletion/de-identification 이후 알림 presenter는 저장 payload에서 full identity를 복원하지 않는다. 필요한 사용자-facing 문구는 현재 user/account 상태를 기준으로 계산하고, 삭제된 actor는 최소 표현으로 수렴한다.
- Push/email 알림은 MVP 범위가 아니다. 이번 범위는 authenticated REST 알림 목록/읽음 처리와 online user room으로 전달되는 in-app realtime event까지로 한정한다.

### retention tombstone event

- archive/retention으로 메시지 원문이 retained vault로 이동하면 product path에는 tombstone body와 `bodyState`, `tombstoneReason`, `tombstonedAt`, `bodyRetainedAt`, `bodyVersion` 같은 event shell만 남긴다.
- retention tombstone event도 outbox를 통해 공통 dispatcher가 publish한다.
- retained original body는 socket/realtime event, replay API, 일반 cache, 일반 log로 복원하거나 노출하지 않는다.
- tombstone event는 "원문을 지웠다"는 사용자-facing 상태 변화만 동기화하며, retained vault 접근 권한을 만들지 않는다.

## 기존 thread의 target 상태 변경

기존 direct thread write 가능 여부는 단순히 과거에 thread가 열렸는지만 보지 않는다. Counterpart가 season deregistration, account deletion/de-identification, hidden/deactivated 같은 이유로 더 이상 action target이 아니게 되면 lifecycle owner가 해당 thread를 read-only/archive/tombstone 중 정책 상태로 전환해야 한다.

Fail-closed 기준은 “기존 thread가 있더라도 지금 새 direct chat action을 열 수 있는 target인가”다. Active match pair가 아닌 direct thread는 현재 시점에 viewer와 target이 모두 registration complete, complete season profile, `SEASON_REGISTRATION` snapshot, 같은 dormitory/성별/캠퍼스, 운영 기숙사, `roomSelectionDate` 전, hidden/deactivated/deleted 아님 조건을 만족해야 쓰기 가능하다. 이 중 하나라도 깨지면 기존 thread는 사용자-facing read-only/archive/tombstone 상태 또는 send-denied 상태로 닫힌다. Active match pair는 matched thread lifecycle을 따르지만, account deletion/de-identification과 safety/visibility 제한은 matched detail/body disclosure보다 우선한다.

- season deregistration은 non-matched direct thread를 `PARTICIPANT_WITHDRAWN` reason으로 read-only 처리한다.
- account deletion/de-identification은 product path에서 상대 식별 정보와 full detail/body disclosure보다 tombstone/minimal result를 우선한다.
- hidden/deactivated counterpart에 대해서는 신규 thread 생성을 막고, 기존 direct thread는 운영/안전 정책에 따라 write를 닫는 fail-closed 상태로 전환한다.
- matched thread는 match lifecycle에 따라 `seasonEndDate` 전까지 유지될 수 있지만, deletion/de-identification은 matched partner detail/body disclosure보다 우선한다.

### ACTIVE 해제 후 eligible direct thread reopen

`ACTIVE_MATCH_CREATED`는 “당시 다른 active match가 생겼기 때문에 기존 direct thread 쓰기를 닫는다”는 상태 사유다. 이 사유가 사라지는 `ACTIVE → UNMATCHED` 시점에는 관련 direct thread를 무조건 닫힌 상태로 방치하지 않고, 현재 정책으로 다시 평가한다.

- reopen 대상은 해제된 active match의 두 participant 중 하나 이상과 연결된 `DIRECT`, `READ_ONLY`, `closedReason = ACTIVE_MATCH_CREATED`, `ARCHIVED` 아님 thread다.
- reopen은 같은 season 안에서만 수행한다. 지난 시즌 thread는 season-transition/archive 정책을 따른다.
- reopen 조건은 기존 direct chat action 조건과 동일하다. 양쪽 participant 모두 현재 active match가 없어야 하며, registration 완료, complete season profile, registration snapshot, 같은 운영 기숙사/성별/캠퍼스, `roomSelectionDate` 전, hidden/deactivated/deleted 아님 조건을 만족해야 한다.
- reopen 시 `status = OPEN`, `closedReason = null`, `closedAt = null`로 복구하고 `chat.thread.updated` outbox event를 남긴다.
- 조건을 만족하지 않는 thread는 `READ_ONLY` 상태를 유지한다. 사용자가 thread를 LEFT했다는 사실만으로 reopen 대상에서 제외하지는 않지만, LEFT 사용자는 상대가 새 메시지를 보내 재노출되기 전까지 목록/상세에서 숨김 상태를 유지한다.
- 양쪽 모두 LEFT하여 `ARCHIVED`된 thread는 reopen하지 않는다. 이후 새 direct action 조건을 만족하면 기존 archived thread를 살리지 않고 새 thread 생성 정책으로 수렴한다.
- reopen은 read path에서 lazy side effect로 수행하지 않는다. ActiveMatch 해제 command transaction에서 처리하고, missed event는 outbox/replay와 REST snapshot으로 수렴한다.

## 데이터 보관

### 사용자-facing 상태와 내부 보관의 분리

- 사용자-facing에서는 기존 결정대로 `read-only` / `archive`를 사용한다.
- 내부 보관 정책은 **채팅 전체 90일 파기**가 아니라, **archive 보존 + user-facing tombstone + RRPD retained vault + 2년 단위 identity-link review**를 따른다.

### 내부 보관 원칙

| 항목 | 정책 |
| ---- | ---- |
| 메시지 본문 | archive 전에는 대화 맥락 보존을 위해 user-facing 본문 유지. thread archive 후에는 원문을 encrypted retained body vault로 이동하고 `ConversationMessage.body`는 전체 tombstone 문구로 대체 |
| 계정 식별 정보 | 탈퇴 시 삭제 또는 비식별화. chat archive는 2년 단위 identity-link review로 active hold와 disposal 가능성을 재평가 |
| 표시명 | 필요 시 `탈퇴한 사용자`로 대체 |
| 접속/운영 로그 | 일반 채팅과 분리 보관 |
| 본문 내 개인정보/민감정보 | 자동 NLP/regex 부분 마스킹이 아니라 archive 단계의 전체 tombstone + 승인/로그/키 기반 복원으로 처리 |

서비스는 채팅 데이터를 모두 동일한 범주의 개인정보로 일괄 파기하지 않는다. 계정 식별 정보와 메시지 콘텐츠를 분리해 처리하고, 탈퇴 시에는 thread 전체 삭제보다 **식별 정보 제거/비식별화**를 우선한다. 탈퇴로 생성된 `THREAD_RETENTION` job은 thread가 사용자-facing `ARCHIVED` 상태가 될 때까지 대기하며, archive 이후 메시지 원문을 `RetainedVaultObject(target = CHAT_MESSAGE_BODY)`에 저장한 뒤 사용자에게는 tombstone body만 제공한다.

내부 retained identity 및 chat body retained vault 조회는 일반 운영자 자유 조회가 아니라 승인 사유·접근 로그·암호키 기반 disclosure 구조를 따른다. 구체 기준은 [data-retention.md](./data-retention.md)의 `RetainedIdentity restricted vault`와 `RetainedVaultObject restricted vault`를 따른다.

### Chat retained body disclosure 금지 경계

`ConversationMessage`는 user-facing event shell이다. `PLAIN` 상태에서만 평문 body를 가질 수 있고, archive/retention 이후에는 tombstone body, `bodyState`, `tombstoneReason`, `tombstonedAt`, `bodyRetainedAt`, `bodyVersion`만 product path로 제공한다.

`CHAT_MESSAGE_BODY` retained vault payload는 product application, 일반 채팅 목록/상세, socket/realtime event, cache로 복원하지 않는다. 신고·분쟁·제재·수사기관 협조 같은 운영 disclosure는 별도 owner에서 `accessedBy`, `accessReason`, `approvalReference`, `purpose`를 요구하고 접근 로그를 남긴다.

## 변경 이력

| 날짜 | 변경 내용 | 관련 이슈 |
| ---- | --------- | --------- |
| 2026-06-02 | Issue #198 Phase 6-1.6 / #257 기준으로 첫 direct 메시지 thread 생성 시 recipient 인앱 알림을 생성하는 정책, notification read model/outbox 원자성, 중복 방지, 민감 payload 금지 원칙을 추가했다 | #198 / #257 |
| 2026-06-01 | Issue #198 Phase 6-1.3 계획 기준으로 `ACTIVE_MATCH_CREATED` 때문에 read-only 처리된 direct thread를 active match 해제 시 현재 direct chat action 조건으로 재평가하고 eligible하면 reopen한다고 명시했다 | #198 |
| 2026-06-01 | Issue #198 Phase 6-1.0 기준으로 archived/read-only/left/matched/retention tombstone 상태별 list/detail, send, read marker, realtime subscribe, replay, 신고/evidence matrix를 추가하고, actionable target과 realtime subscribe의 권한 경계를 명시했다 | #198 |
| 2026-06-01 | Issue #198 Phase 5-1 기준으로 채팅 abuse 방어 원칙을 추가하고, UI-only를 보안 경계로 보지 않으며 메시지 전송/realtime ticket/gateway 연결에 명시적 rate limit을 둔다고 정리했다. multi-node 분산 rate limit/WAF 검토는 후속 이슈로 분리했다 | #198 / #255 |
| 2026-06-01 | Issue #198 Phase 0 기준으로 실시간 채팅의 authority 경계, 60초 realtime ticket, `clientMessageId` idempotency, 1,000자 본문 제한, read marker 비노출, outbox/replay 7일 window, tombstone event 노출 금지 정책을 추가했다 | #198 |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다 | #195 |
| 2026-05-27 | thread summary에 `sendMessageUnavailableReason`을 추가해 `canSendMessage=false`의 storage/action 실패 이유를 enum으로 전달하도록 정리했다 | #195 |
| 2026-05-27 | `READ_ONLY` thread status, `canSendMessage` action capability, roommate-search summary-only exposure/result-read context가 서로 다른 계층임을 명시 | #195 |
| 2026-05-26 | 기존 direct thread의 fail-closed 기준을 현재 direct chat action target precondition 재검증으로 명시하고, active match pair만 matched lifecycle 예외를 둔다고 정리 | #195 |
| 2026-05-26 | 기존 direct thread도 counterpart deregistration/deletion/hidden/deactivated 상태 변경을 lifecycle owner가 read-only/archive/tombstone 등 fail-closed 상태로 반영해야 한다고 명시 | #195 |
| 2026-05-25 | 채팅 메시지 본문 archive를 RRPD `RetainedVaultObject(target = CHAT_MESSAGE_BODY)`로 통합하고, product path 복원 금지와 2년 단위 identity-link review를 명시 | #195 |
| 2026-05-21 | chat eligibility에서 registration 전 `SELECTED` selection draft와 registration 완료 `ASSIGNED`를 구분하고, 새 채팅 action은 `registeredAt`과 `SEASON_REGISTRATION` snapshot이 있는 registration 완료 상태만 허용한다고 정리했다 | #195 |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 제한 공개 browse 표현을 summary capability로 정리하고, chat eligibility 전제를 registration 완료(`REGISTERED + ASSIGNED + complete season profile`)로 명확화했다. Legacy `UNASSIGNED`는 summary-only 가능성이 있어도 새 채팅 action은 닫힌다 | #195 |
| 2026-03-31 | 문서 신설. matching-lifecycle.md에서 채팅 관련 정책 분리. 2인방/3인방 구조, TTL 이원화(탐색 7일/확정 시즌 종료), 아카이브 조건 정의 | #65 |
| 2026-04-30 | 대화/매칭 분리 정책을 반영해 채팅 UI 진입과 thread lazy 생성, matched pair write 권한, read-only/archive, mixed 신고 처리, 무기한 보관+탈퇴 시 비식별화 원칙으로 전면 갱신 | #195 |
| 2026-05-03 | `SEASON_OPEN` canonical 용어와 시즌 참여자 등록 전제를 반영. 제한 공개 browse와 chat eligibility를 분리하고, `SEASON_POST_MATCH`에서는 신규 채팅 요청 불가 + 기존 matched thread read-only 정책을 명시 | #195 |
| 2026-05-05 | matched pair thread는 `SEASON_POST_MATCH`에서도 `seasonEndDate` 전까지 write를 유지하고, `seasonEndDate` 이후 read-only, 다음 시즌 current season 오픈 시 archive되는 사용자-facing 흐름으로 수정. leave/archive 규칙을 thread kind와 무관한 visible thread 일반 규칙으로 정밀화 | #198 |
| 2026-05-06 | 새 채팅 UI entry 자체를 `시즌 참여 등록 + 건물 배정 + 같은 건물 + 같은 성별/캠퍼스` 전제로 명시하고, `UNASSIGNED`는 browse만 유지하며 chat entry/send는 모두 불가함을 명확화. `seasonEndDate` / 다음 시즌 `seasonOpenDate`의 KST 경계 시각도 문서에 명시 | #198 |
| 2026-05-13 | 시즌 참여 철회로 비매칭 thread를 read-only 처리하는 `PARTICIPANT_WITHDRAWN` close reason과 사용자 문구를 추가 | #76 / #195 |
| 2026-05-06 | 상호 합의 매칭 취소 시 matched thread가 살아 있으면 direct/non-matched thread로 되돌리고, 이후 `roomSelectionDate` cutoff를 따르도록 매칭 해제와 채팅 lifecycle의 연결 규칙을 추가 | #195 |
| 2026-05-12 | chat eligibility 전제를 `시즌 참여 등록 + complete season profile + 건물 배정 + 같은 건물 + 같은 성별/캠퍼스`로 강화하고, season profile 경로에서는 lifestyle/roommate condition null 재도입을 허용하지 않는다고 명시 | #195 |
| 2026-05-14 | 채팅 본문은 기본 무기한 archive로 유지하되 계정 식별 정보와 분리하고, 2년 후 식별 연결 재검토 및 retained identity 제한 조회 원칙을 data-retention.md와 동기화 | #76 / #148 / #195 |
| 2026-05-14 | `THREAD_RETENTION` job이 archive 전 대기하고 archive 후 retained body vault + tombstone display로 전환되는 흐름을 명시 | #76 / #148 / #195 |

## 원문 소스

- `docs/04_policy/official/matching-lifecycle.md`
- `docs/04_policy/official/data-retention.md`
- `docs/04_policy/official/group-matching-lifecycle.md`
