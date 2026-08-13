# Coding agent와 작업 시작하기

이 문서는 이 저장소를 처음 접하는 개발자가 Codex, Claude Code 또는 다른 coding agent에 작업을 요청하는 방법을
설명합니다. 특정 skill 이름이나 과거 대화를 알 필요는 없습니다.

짧거나 모호한 요청은 [Request intake](./request-intake/README.md) 계약에 따라 요청한 결과, 수정 권한,
필요한 근거와 미확정 결정으로 나눉니다. 분석을 요청했다면 code를 수정하지 않고, 계획을 요청했다면
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
선행 증거를 확인하고 작은 diff로 수정한 뒤 targeted test와 필요한 정적 검증을 실행해줘.
변경 파일, 핵심 결정, 검증 결과와 남은 blocker를 보고해줘.
```

## 결과 읽기

완료 근거는 agent의 역할명이나 “완료했습니다”라는 문장이 아니라 실제 변경 파일, git 상태, 실행한 테스트와 그
결과입니다. production credential, 외부 배포 또는 파괴적 작업이 필요하면 agent가 실행 전에 필요한 권한과 선택을
명시해야 합니다.
