# CI evidence

Monorepo CI 개선의 측정값과 근거 기록입니다. 현재 CI 동작은 owner 문서가 소유합니다.

- 경로별 표면·lane·formatting 검사 범위: [CI surface ownership](../../development/ci/ci-surface-ownership.md)
- Job graph, 예산, 설계 결정: [Monorepo CI architecture](../../architecture/platform/monorepo-ci.md)

| 문서                                                                          | 기록                                                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Monorepo CI restructuring evidence](./monorepo-ci-restructuring-evidence.md) | 전체 lane 실행에서 변경 분류·선택 실행·준비 1회화로 바꾼 첫 구조 개선과 hosted 성능 개선의 문제·원인·대안·전후 측정 |
| [CI change classification evidence](./ci-change-classification-evidence.md)   | 변경 분류 개선(분류 완전성, agent test 배치, formatting 검사 범위 등)의 문제·원인·대안·전후 측정                    |
| [Monorepo CI baseline](./monorepo-ci-baseline.md)                             | API·Web CI 측정 원장: denominator, run별 A/B 상세, 측정 epoch, cache·artifact inventory                             |
