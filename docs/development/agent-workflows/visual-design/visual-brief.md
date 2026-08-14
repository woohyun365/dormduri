# VisualBrief contract

VisualBrief는 한 UI 작업의 방향을 정리하는 task-scoped artifact입니다. Repository 전체의 design manifesto가 아니며,
사용자 승인이나 implementation authority를 자동 생성하지 않습니다.

## Required sections

### Target and user job

- target route, component 또는 surface
- primary user와 완료하려는 일
- 현재 season/auth/policy context
- requested output: analysis, direction proposal, plan, implementation 또는 review

### Evidence and current problem

- inspected production files와 Storybook states
- viewport·content·interaction에서 관찰된 문제
- fact, inference, preference와 unknown 구분
- approved reference/Figma link가 없으면 `no approved reference`로 명시

### Must-preserve semantics

- product policy와 contract가 요구하는 state/action
- privacy, safety, accessibility와 disclosure boundary
- 유지할 component behavior와 test contract
- visual 변경으로 함께 바꾸면 안 되는 BFF/API/persistence 책임

### Visual direction candidates

- 1~3개 bounded direction
- 각 direction의 typography, color, composition, density, shape/elevation, imagery와 motion intent
- 제품·사용자 맥락과 연결되는 rationale
- 모바일/데스크톱의 정보 hierarchy
- 비용, novelty, maintainability와 accessibility tradeoff

한 방향을 임의로 definitive source로 만들지 않습니다. 기존 visual language와 다른 방향도 제안할 수 있지만 user goal과
product semantics로 정당화합니다.

### Component and token boundary

- 재사용 가능한 current component/token
- surface-local로 유지할 presentation
- semantics/interaction/state contract가 같을 때만 고려할 shared component
- 새 font, asset, package 또는 design-system layer가 필요하면 별도 dependency/OQ

### Responsive and accessibility

- 320px, 390px, tablet landscape와 desktop
- zoom/reflow, long copy, empty/loading/error/action states
- keyboard order, visible focus, modal focus restore와 screen-reader status
- contrast, touch target, safe area와 reduced motion

### Mutation authority

다음 중 하나를 기록합니다.

- `analyze-only`: evidence와 recommendation만 반환
- `propose-visual-direction`: candidate와 tradeoff만 반환
- `produce-plan`: implementation plan만 생성
- `implement-approved-direction`: 승인된 범위만 수정
- `review-only`: diff나 screenshot의 finding만 반환

VisualBrief는 BFF·API·product policy 변경 권한을 부여하지 않습니다. Aesthetic direction이 정해지지 않았거나 reference가
승인되지 않았다면 사용자 승인 전 production implementation 권한을 부여하지 않습니다.

### Verification

- production route와 Storybook story/state
- viewport, seed/content와 screenshot command
- keyboard/focus/reduced-motion checks
- component interaction and contract tests
- lint/type/build checks
- approved reference가 있으면 visual verdict와 remaining difference

## VisualAuditFinding

Visual review 결과는 다음 구조로 leader에게 반환합니다.

```text
file:line
category: visual | accessibility | interaction | performance | composition
severity: blocker | high | medium | low
observed evidence:
applicable repository rule:
suggested repair:
confidence:
false-positive risk:
requires product/architecture decision: yes | no
```

Review output을 그대로 acceptance로 사용하지 않습니다. Leader가 current code, framework version, product policy와
검증 가능성을 확인한 뒤 finding을 채택하거나 기각합니다.

## Durable promotion

다음 조건을 모두 충족할 때만 task-scoped 결정이 tracked design-system 책임으로 승격됩니다.

- 둘 이상의 production surface 또는 반복 작업에서 재사용됩니다.
- 사용자와 product semantics가 승인되었습니다.
- token/component owner가 명확합니다.
- responsive, accessibility와 behavior evidence가 있습니다.
- historical local note가 아니라 current code/test와 일치합니다.

조건을 충족하지 않으면 VisualBrief와 screenshot은 local task evidence로 종료합니다.
