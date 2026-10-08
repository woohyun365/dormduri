# Matches evidence

매칭 요청·확정·해제 흐름의 동시성과 정합성 개선 근거 기록입니다. 현재 규칙과 동작은 owner 문서가 소유합니다.

- 매칭 상태 정책: [Matching lifecycle](../../policies/matching-lifecycle.md)
- Transaction·lock 불변 조건과 책임 경계: [Matches module README](../../../apps/api/src/matches/README.md)

| 문서                                                          | 기록                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Accept lock order evidence](./accept-lock-order-evidence.md) | 동시 수락의 lock 순서 역전으로 생긴 교착, 원인, 대안, 수정 전후 측정 |
