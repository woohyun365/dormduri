# Visual design workflow

이 디렉터리는 UI의 architecture contract가 아니라 **visual direction과 approved design evidence의 사용 경계**를
소유합니다. Next.js/React/BFF, accessibility contract, component owner, performance와 test planning은
[Frontend plan authoring](../plan-authoring/frontend.md)이 계속 소유합니다.

## When to read

- 새 page/surface의 aesthetic direction을 제안할 때
- 기존 UI의 look-and-feel, hierarchy, typography, composition을 크게 바꿀 때
- Figma frame/component/variable을 구현 evidence로 사용할 때
- visual audit 결과와 repository rule이 충돌할 때

작은 CSS 오류, 이미 승인된 token 적용, backend-only 작업에는 이 workflow를 로드하지 않습니다.

## Current capability baseline

| Surface                  | Current owner                             | 책임                                                       |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| product/policy semantics | `docs/policies/`, current contract/code   | 화면이 전달할 상태와 action 의미                           |
| FE architecture          | `plan-authoring/frontend.md`              | React/Next.js/BFF/component/a11y/performance/test boundary |
| completion evidence      | `qa.md`                                   | acceptance와 검증 판정                                     |
| visual iteration         | Storybook, production UI, `$visual-ralph` | state/viewport/reference 비교                              |
| design discovery         | native designer/vision role, `$design`    | task가 실제로 요구할 때의 visual/context discovery         |
| Figma evidence           | 이 workflow                               | authority, trigger, failure와 rollback                     |

현재 repository는 project-scoped Figma MCP를 추적하지 않습니다. User-level provider 연결은 repository dependency가
아니며 실제 승인된 Figma source가 있을 때만 선택적으로 사용합니다.

## Source hierarchy

1. latest user request와 명시적으로 승인된 visual reference
2. product policy, domain contract와 user-visible semantics
3. 승인된 Figma frame/component/variable evidence
4. current production UI, component/token과 Storybook state
5. tracked visual workflow와 채택된 review rule
6. untracked/historical design note

Root 또는 local workspace의 untracked `DESIGN.md` 같은 design note는 **non-canonical**입니다. 사용자 소유 파일을 자동
수정·stage·삭제하지 않고, 그 안의 표현이나 과거 constraint를 보존 조건으로 사용하지 않습니다. 유효한 visual
decision은 current evidence와 사용자 승인 후 tracked guide, token 또는 component contract로 별도 승격합니다.

## Core decisions

- Visual suggestion은 BFF·API·product policy 변경 권한을 부여하지 않습니다.
- Aesthetic direction이 불명확하면 1~3개 bounded alternative와 tradeoff를 먼저 제안합니다.
- 사용자가 구현을 승인하기 전 ideation이나 Figma evidence를 production mutation 권한으로 해석하지 않습니다.
- Figma MCP는 design-to-code finalizer가 아니라 structured evidence bridge입니다.
- Provider가 없어도 current code, Storybook, screenshot과 native review로 fail-open합니다.
- Product package와 lockfile에는 Figma 연결용 dependency를 임의로 추가하지 않습니다.

상세 계약:

- [VisualBrief](./visual-brief.md)
- [Figma MCP evidence](./figma-mcp-evidence.md)

## Recommended flow

```text
request and repository evidence
  → VisualBrief
  → optional native visual ideation or approved Figma context
  → user-approved direction/reference
  → existing production owner implementation
  → responsive/accessibility/composition review
  → Storybook + responsive/a11y + code verification
  → leader decision and durable promotion when justified
```

## Non-goals

- visual skill이 product policy나 architecture를 결정하지 않습니다.
- screenshot similarity만으로 accessibility나 behavior correctness를 판정하지 않습니다.
- Figma account, token, OAuth receipt 또는 private file content를 repository에 저장하지 않습니다.
