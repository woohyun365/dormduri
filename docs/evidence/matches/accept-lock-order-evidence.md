# Accept lock order evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 매칭 lock 규칙의 owner가 아닙니다. 현재 transaction·lock 불변 조건은
> [Matches module README](../../../apps/api/src/matches/README.md#transaction-and-concurrency-invariants), 매칭 상태 정책은
> [Matching lifecycle](../../policies/matching-lifecycle.md)이 소유합니다.

같은 참가자가 걸린 매칭 수락이 동시에 들어올 때 생긴 교착(deadlock)의 문제, 측정 방법, 원인, 대안, 수정 전후 측정을
기록합니다. 테스트 결과와 시간은 §2의 명령으로, 교착 횟수는 같은 구간의 PostgreSQL 서버 로그로 다시 산출합니다.

## 1. 문제와 관측

같은 사람이 받은 두 요청을 동시에 수락하는 통합 테스트는 통과하고 있었습니다. 테스트가 성공 1건, 실패 1건, 진행 중 매칭
1건만 확인했기 때문입니다. 같은 테스트를 실행하는 동안 PostgreSQL 로그에는 실행마다 `ERROR: deadlock detected`가
남았습니다.

- 단일 매칭 불변식은 지켜졌습니다. 진행 중 매칭은 항상 1건이고, 진 요청은 `CANCELLED_BY_SYSTEM_ACTIVE_MATCH`였습니다.
- 진 쪽 트랜잭션은 Prisma `P2010`(교착으로 실패한 raw query)으로 끝났습니다. 이 오류는 재시도 대상이 아니고
  `HttpException`도 아니어서 API 오류 매핑상 500 `INTERNAL_SERVER_ERROR`가 됩니다. 테스트는 service를 직접 호출하므로
  HTTP 응답이 아니라 `P2010`을 관측했습니다.
- 이긴 쪽도 PostgreSQL이 교착을 감지할 때까지(`deadlock_timeout` 기본값 1s) 기다린 뒤에야 끝났습니다.
- 서로 다른 두 수락자가 같은 참가자를 두고 엇갈려 수락하는 경우(A→B, C→A 요청에서 B와 A가 동시에 수락)도 같았습니다.

## 2. 측정 방법과 재현 명령

로컬 PostgreSQL 18 컨테이너에서 두 경쟁 수락 통합 테스트를 각 10회 실행했습니다. 테스트는 suite별 disposable schema를
사용합니다.

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 --reporter=verbose \
  test/integration/matches/matches.integration.spec.ts -t "accept에서도|엇갈린 accept"
```

- 테스트 시간: vitest verbose 출력의 case별 시간입니다. 요청 생성 2건과 동시 수락 2건, 결과 조회를 포함합니다.
- 교착 횟수: 측정 구간 동안 PostgreSQL 서버 로그의 `deadlock detected` 줄 수입니다.
- 수정 전 측정은 같은 test 파일에 수정 전 `match-request-acceptance.repository.ts`를 넣어 실행했습니다.

## 3. Baseline (`98d12dc4`, 2026-10-08)

| 지표                       | 값                      |
| -------------------------- | ----------------------- |
| 실행                       | 2 case × 10회 = 20      |
| 교착                       | 20 / 20                 |
| 진 쪽 결과                 | `P2010` (매핑상 500)    |
| case 시간 min–max (median) | 1,271–1,425ms (1,341ms) |

## 4. 원인

수락 트랜잭션이 요청 row lock을 참가자 advisory lock보다 먼저 잡았습니다.

1. `lockAndLoadAcceptableRequest`는 수락할 요청 row를 `FOR UPDATE`로 잠근 뒤 두 참가자의 advisory lock을 정렬 순서로
   잡았습니다.
2. 먼저 참가자 lock을 잡은 Tx1은 매칭을 만들고, `cancelOtherPendingRequestsAfterActiveMatch`로 같은 참가자의 다른 대기
   요청을 `UPDATE`합니다.
3. 그 대기 요청 row는 Tx2가 1단계에서 이미 잠갔고, Tx2는 그 row를 쥔 채 Tx1이 가진 참가자 lock을 기다립니다.
4. Tx1은 row를, Tx2는 참가자 lock을 기다려 순환이 생기고, PostgreSQL이 1s 뒤 Tx2를 끊었습니다.

독립 리뷰에서 같은 유형의 역전이 하나 더 확인됐습니다. 수락은 트랜잭션 시작 직후 시즌 전체의 기한 지난 대기 요청을
만료 처리(`expireDuePendingRequests`)한 뒤 참가자 lock을 기다렸습니다. 요청 생성은 참가자 lock을 먼저 잡고 같은 만료
처리를 하므로, 시즌 안에 기한 지난 대기 요청이 있으면 같은 순환이 생길 수 있습니다. 이 경우는 로컬에서 5회 모두
재현되지 않았지만, 같은 lock 순서 원칙으로 함께 막았습니다.

참가자 id를 정렬해 lock을 잡는 규칙은 advisory lock끼리의 교착은 막지만, 서로 다른 종류의 lock(row lock과 advisory
lock) 사이의 순서는 보장하지 않았습니다.

## 5. 대안과 기각

| 대안                                          | 판단 | 이유                                                                                             |
| --------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| 참가자 lock을 요청 row lock보다 먼저 잡음     | 채택 | 순환 자체가 사라집니다. 진 쪽은 직렬화 충돌 재시도 뒤 기존 상태 재확인에서 409로 끝납니다.       |
| 교착(`40P01`)을 재시도 대상에 추가            | 기각 | 응답은 409가 되지만 매 경합마다 1s 교착 감지 대기가 남습니다. 원인을 숨기는 방어선에 가깝습니다. |
| 다른 대기 요청 취소를 commit 뒤 비동기로 처리 | 기각 | 매칭 생성과 다른 요청 정리가 한 트랜잭션에 있어야 한다는 불변식을 깹니다.                        |

수정 뒤 수락 순서는 요청 사전 확인 → 참가자 lock → 만료 처리 → 요청 row lock → 다시 확인입니다. 수정 뒤에는
lock을 기다린 쪽이 이미 바뀐 요청 row를 잠글 때 PostgreSQL이 직렬화 충돌(40001)을 내고, 기존 재시도 경로가
트랜잭션을 다시 실행합니다. 다시 실행하면 요청이 이미 시스템 취소되어 409 `MATCH_REQUEST_NOT_PENDING`으로 끝납니다.

## 6. 수정 전후 측정 (2026-10-08)

| 지표                       | 수정 전                 | 수정 후                         |
| -------------------------- | ----------------------- | ------------------------------- |
| 교착                       | 20 / 20                 | 0 / 20                          |
| 진 쪽 결과                 | `P2010` (매핑상 500)    | 409 `MATCH_REQUEST_NOT_PENDING` |
| 테스트 결과                | 20 실패                 | 20 통과                         |
| case 시간 min–max (median) | 1,271–1,425ms (1,341ms) | 204–395ms (278ms)               |

회귀 보호:

- 같은 수락자 경쟁 수락 테스트가 진 쪽의 오류 코드를 단언합니다. 이전에는 실패 개수만 확인해 500도 통과했습니다.
- 엇갈린 수락(A→B, C→A에서 B와 A가 동시에 수락)과 두 수신자 동시 수락(A→B, A→C에서 B와 C가 동시에 수락) 통합
  테스트를 추가했습니다. 수정 전 코드에서는 경쟁 수락 테스트 세 개가 모두 교착으로 실패합니다. §6 측정값은 앞의 두
  테스트 기준입니다.
- 기한 지난 요청 수락 통합 테스트를 추가했습니다. 만료 처리가 참가자 lock 뒤로 옮겨지면서 이 경우의 응답이
  `MATCH_REQUEST_NOT_PENDING`에서 `MATCH_REQUEST_EXPIRED`로 바뀌었고, 테스트가 이 응답을 고정합니다.

## 7. 한계와 재측정 조건

- 로컬 단일 장비·단일 PostgreSQL에서 2건 경합만 측정했습니다. 운영 부하나 3건 이상 경합의 지연은 측정하지 않았습니다.
- case 시간에는 요청 생성과 결과 조회가 포함됩니다. 줄어든 시간은 교착 감지 대기(1s)와 대부분 일치하지만 수락 구간만 따로
  잰 값은 아닙니다.
- 수락 × 요청 생성의 만료 처리 경합은 재현하지 못했습니다(5회). lock 순서로 막았다는 판단은 코드 분석에 근거합니다.
- 여러 행을 한 번에 갱신하는 경로끼리(다른 요청 시스템 취소, 시즌 철회, 주기 정리)의 row lock 순서는 이번 범위에서
  측정하지 않았습니다.
- `deadlock_timeout`, lock 경로, 재시도 정책이 바뀌면 §2 명령으로 다시 측정합니다.

## 8. Interview map

- 테스트가 통과하는데 왜 문제였나: §1. 결과 개수만 단언하면 실패 방식(500·지연)이 숨습니다.
- id 정렬 lock인데 왜 교착이 났나: §4. 정렬은 같은 종류 lock 사이의 순서만 보장합니다.
- 왜 재시도 추가가 아니라 순서 변경인가: §5.
- 무엇이 아직 측정되지 않았나: §7.
