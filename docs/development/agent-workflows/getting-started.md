# Coding agent와 작업 시작하기

이 문서는 이 저장소를 처음 접하는 개발자가 Codex, Claude Code 또는 다른 coding agent에 작업을 요청하는 방법을
설명합니다. 특정 skill 이름이나 과거 대화를 알 필요는 없습니다.

짧거나 모호한 요청은 [Request intake](./request-intake/README.md) 계약에 따라 요청한 결과, 수정 권한,
필요한 근거와 미확정 결정으로 나눕니다. 분석을 요청했다면 code를 수정하지 않고, 계획을 요청했다면
구현까지 자동으로 확장하지 않습니다.

## 공통 입력

좋은 요청은 다음 다섯 항목을 포함합니다.

- **목표**: 사용자가 얻어야 하는 결과
- **대상**: 화면, 도메인, 파일 또는 API 범위
- **근거**: 확인할 code, test, policy 또는 외부 공식 자료
- **완료 기준**: 기대 동작과 검증 명령
- **중단 조건**: 수정 금지 범위, credential·production·destructive 경계

## 새 작업

```text
AGENTS.md와 docs/development/agent-workflows/README.md를 먼저 읽어줘.
이 요청은 이전 세션을 이어받지 않는 새 작업이야.
목표: <원하는 결과>
대상: <도메인/파일/화면>
완료 기준: <테스트/동작/산출물>
제약: <수정 금지/외부 작업/검증 범위>
현재 branch와 working tree를 확인하고 관련 production code와 test를 근거로 구현·검증해줘.
```

## 중단된 작업 이어받기

```text
AGENTS.md를 읽고 <plan 경로 또는 task 이름> 작업을 이어서 진행해줘.
현재 요청, branch/HEAD, working tree, plan checkpoint를 순서대로 확인하고 commit·diff·test와 대조해줘.
완료 증거가 없는 항목은 완료로 가정하지 말고 현재 단계의 남은 작업만 구현·검증해줘.
session-continuity.md의 bounded 진단을 사용하되, 다른 작업의 pointer나 오래된 context를 실행 허가로 쓰지 마.
로컬 기억이 없으면 관련 code/contract와 PR/Issue에서 재구성하고, 중요한 결정이 없으면 질문이나 OQ로 남겨줘.
```

## 분석만 요청하기

```text
<대상>의 책임, 호출 흐름과 문제점을 분석해줘. 이번 요청에서는 파일을 수정하지 마.
사실은 file:line 또는 공식 URL로, 추론은 별도로 표시하고 권장안·대안·위험·confidence를 설명해줘.
```

## 구조 개선 계획 요청하기

```text
<대상>의 개선 지점을 현재 code/test/policy와 공식 근거로 분석하고 구현 계획을 작성해줘.
필요한 workflow를 자동 선택하고 Decision/OQ, dependency 순서, red test, acceptance, verification,
현재 결정할 수 없는 release 항목의 handoff를 포함해줘.
```

Architecture·feature·refactor 계획을 요청하면 agent는 [Plan authoring](./plan-authoring/README.md)의 core와
primary domain guide 하나를 먼저 선택하고, 보안/개인정보 또는 운영/배포 관점은 evidence가 요구할 때만
추가합니다. 계획 작성을 요청하지 않았다면 이 workflow를 이유로 plan artifact를 만들지 않습니다.

변경 범위가 여러 방향으로 갈린다면 agent는 임의로 고정하지 않고 질문, plan OQ 또는 future
release evidence handoff로 남깁니다.

## 승인된 계획 구현하기

```text
<plan>의 <단계>를 구현해줘.
선행 증거와 working tree를 확인하고, fresh dev에서 bounded branch를 생성한 뒤 작은 diff로 수정해줘.
targeted test와 필요한 정적 검증을 실행해줘.
변경 파일, 핵심 결정, 검증 결과와 남은 blocker를 보고해줘.
```

구현 branch와 PR 단위는 [Branch and PR strategy](../github/branch-and-pr-strategy.md)를 따릅니다. Agent가 이미 local
`dev`에서 task-owned uncommitted 파일을 발견하면 reset하지 않고 먼저 bounded branch를 생성합니다.

## 기술 동료처럼 협업하기

사람은 목표와 중요한 제품·비용·위험을 결정하고, Lead는 승인 범위의 기술 판단·구현·검증을 진행합니다.
별도 skill이나 팀 인원을 지정할 필요는 없습니다. [Owner–Lead collaboration](./owner-lead-collaboration.md)의 구조와 경계를
기본으로 따르며, 필요하면 아래처럼 조사 권한과 선택할 범위를 강조할 수 있습니다.

```text
<문제>를 먼저 조사해줘. 내가 제시한 <기술>은 확정 요구사항이 아니야.
유지안을 포함해 실제로 가능한 대안과 권장안·반론을 설명해줘. 이번에는 분석만 하고 구현하지 마.
```

```text
<승인된 범위>를 구현해줘. 명확한 기술 세부사항은 진행하고 중요한 제품·비용·위험 선택만 근거와 함께 알려줘.
Specialist가 유용하면 독립적인 범위만 맡기고, 막힌 작업이나 상충 결과는 Lead가 정리해서 보고해줘.
이미 승인한 방향을 다시 묻기보다 새 근거로 달라진 점을 설명해줘.
```

Agent가 필요한 선택을 물으면 해당 선택과 제약만 답하면 됩니다. 메시지마다 허락하거나 모든 기술 수단을 고를 필요는
없으며, 답하지 않은 중요한 선택을 Agent가 승인으로 간주하지도 않습니다.

## 결과 읽기

### 독립 QA 요청

```text
<변경/PR>을 docs/development/agent-workflows/qa.md 기준으로 검증해줘.
base/head와 dirty 변경을 고정하고, 현재 requirement/policy/public contract에서 acceptance를 도출해줘.
의미 있는 위험이 있으면 구현 대화를 상속하지 않는 독립 reviewer에 bounded packet을 전달해줘.
역할 이름만 바꾼 self-review를 독립 검증으로 기록하지 마. Read-only 검토와 write-producing test runner를 분리해줘.
직접 처리해도 충분한 변경은 이유와 targeted checks를 남기고, 필수 증거가 없으면 PASS 대신 gap을 설명해줘.
```

### 사용자 이익이 불확실한 변경 요청

```text
<화면/기능>의 <문제 가설>을 검토해줘. 현재 관찰 근거: <근거 또는 아직 없음>.
development-lifecycle.md에 따라 작은 usable change와 verification, 적절한 관찰 방법을 나눠 제안해줘.
내가 방향을 결정할 수 있게 keep/change/stop 기준과 미확정 질문을 설명해줘.
이번 요청에서는 구현·analytics 설치·사용자 조사·외부 publication을 하지 마.
```

[Lifecycle 지도](./development-lifecycle.md)에서 intent, 현재 acceptance, 다음 evidence owner를 확인할 수 있습니다.
오탈자 같은 작은 변경에도 새 세션·실험·Issue를 반드시 만드는 것은 아닙니다.

완료 근거는 agent의 역할명이나 “완료했습니다”라는 문장이 아니라 실제 변경 파일, git 상태, 실행한 테스트와 그
결과입니다. production credential, 외부 배포 또는 파괴적 작업이 필요하면 agent가 실행 전에 필요한 권한과 선택을
명시해야 합니다.
