# Review criteria

이 디렉터리는 독립 리뷰가 변경 유형별로 **무엇을 중요하게 보는가**를 저장소가 소유하는 기준 문서 모음입니다.
Severity 정의, gate, 리뷰 회차와 PASS 뒤 처분 같은 공통 규칙은 [QA workflow](../qa.md#review-criteria와-회차)가 소유하고,
이 디렉터리는 그 규칙이 적용할 기준 항목만 둡니다. Host별 실행(packet에 기준 문서를 싣는 방법)은 각
[host adapter](../adapters/README.md)가 정합니다.

## 기준 문서

| id                       | 문서                                                           | 적용하는 변경                                                 |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `documents`              | [Document review criteria](./documents.md)                     | tracked 문서·plan·evidence의 규칙·사실·근거 변경              |
| `agent-workflow-tooling` | [Agent workflow tooling criteria](./agent-workflow-tooling.md) | agent workflow script·검사·helper·skill·역할 파일의 동작 변경 |

- 변경 유형으로 고릅니다. 문서와 script를 함께 바꾸면 두 문서를 모두 고릅니다. 오탈자·포맷처럼 QA의 독립 리뷰 trigger가 없는
  변경에는 기준 문서를 고르지 않습니다.
- 계획 readiness 리뷰는 `documents`를 쓰고, readiness 자체의 판정 항목은
  [Plan authoring core의 promotion gate](../plan-authoring/core.md#7-implementation-readiness-promotion)가 소유합니다.
- 제품 영역(FE·BE·infra) 기준 문서는 영역 owner와 함께 이 형식으로 추가합니다. 그 전에는 영역 plan-authoring guide와
  [visual design review contract](../visual-design/design-review-and-acceptance.md) 같은 기존 owner 문서를 acceptance 근거로 씁니다.

## 항목 형식

문서마다 항목은 **8개 이하**입니다. 상한은 기준이 의례적 checklist로 길어지는 것을 막기 위한 값이며, 새 항목이 필요하면 가장
적게 걸린 항목을 합치거나 교체합니다. 각 항목은 `### <문자><번호>. <이름>` 제목과 아래 네 줄을 가집니다.

```text
- 질문: reviewer가 판정할 한 문장 질문
- 기본 severity: `critical` | `high` | `medium` | `low` (QA severity 정의)
- 적용 조건: 이 항목을 판정하는 변경의 범위
- 결함 패턴: 이 항목이 실제로 잡아야 했던 결함 유형의 요약
```

- 결함 패턴은 유형 요약입니다. Local 증거 경로, plan 파일명, 작업 단계 이름을 근거로 인용하지 않습니다.
- Reviewer는 적용 조건에 맞는 항목을 판정합니다. 미충족 항목은 항목 id(예: `documents.md D2`)를 적은 finding이 되고 기본
  severity에서 시작합니다. 다르게 매기면 finding에 이유를 적습니다. 충족한 항목은 finding이 아니라 acceptance coverage의 근거로 씁니다.
- 결정적 검사가 이미 판정하는 내용(Markdown link·anchor 해석 등)은 항목으로 두지 않습니다.

## 갱신

리뷰가 놓쳐 merge 뒤 발견된 결함과 Parent가 재현으로 기각한 finding은 기준 항목 갱신의 입력입니다. 갱신은 이 디렉터리의 문서
변경이며 다른 문서와 같은 독립 리뷰 규칙을 따릅니다. 문서 graph test가 항목 형식과 상한을 검사합니다.
