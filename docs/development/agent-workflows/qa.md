# QA workflow

QA는 구현 역할이 아니라 완료 기준을 만들고, 변경의 안전성과 결과의 충족 여부를 검증하는 역할입니다.
사용자가 구현이나 테스트 보강까지 명시한 경우에만 제품 코드를 수정합니다.

공통 source priority, 사실·추론 구분과 handoff schema는 [Agent execution contract](./agent-execution-contract.md)를
따릅니다. 정책이 모호하거나 충돌하면 구현 결함과 구분해 정책 결정이 필요한 항목으로 보고합니다.

## Three verification questions

1. **Acceptance derivation**: 완료라고 판단하려면 무엇을 충족해야 하는가?
2. **Code review**: 이 변경을 머지해도 회귀·배선·계약 위험이 없는가?
3. **Acceptance verification**: 구현 결과가 정의한 조건을 실제로 만족하는가?

세 질문은 서로 대체하지 않습니다. 코드가 깔끔해도 요구사항을 만족하지 못할 수 있고, 테스트가 통과해도 잘못된
mock이나 assertion으로 false positive가 생길 수 있습니다.

## Review evidence

- finding은 심각도 순으로 문제 위치, 영향, 재현되는 사용자·시나리오를 적습니다.
- 테스트는 mock 정확성, false positive 가능성, 실제 계약을 보호하는 assertion인지 확인합니다.
- finding이 없으면 잔여 위험과 검증하지 못한 범위를 명시합니다.

## Verification strategy

위험과 변경 범위에 맞는 가장 작은 검증부터 실행합니다.

1. 변경 동작을 직접 보호하는 targeted test
2. 변경 파일 lint와 typecheck
3. 영향 범위 build 또는 integration test
4. 사용자 흐름에 필요한 Storybook, e2e, manual smoke

필요한 환경이나 권한이 없어 판정할 수 없을 때만 `BLOCKED`로 둡니다. 현재 단계에서 충분한 근거가 있으면
`PASS` 또는 `FAIL`을 판정하고, 더 큰 환경에서 확인할 항목은 별도 검증 공백으로 남깁니다.

## Output

1. findings 또는 acceptance 결과
2. 사용한 근거와 검증 명령
3. 변경·브랜치 범위
4. 잔여 위험과 검증 공백

검증 결과를 별도 파일로 남기는 것은 장기 추적 가치가 있거나 사용자가 요청한 경우로 제한합니다.
