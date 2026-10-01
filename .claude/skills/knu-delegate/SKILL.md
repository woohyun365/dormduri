---
name: knu-delegate
description: 이 저장소에서 bounded 작업을 KNU 역할(knu_explorer·knu_researcher·knu_executor·knu_executor_xhigh)에 위임할 때 native task를 등록하고 호출하는 절차입니다.
---

# KNU native 위임

작은 작업은 Lead가 직접 처리하고, 분리 가능한 bounded 작업만 위임합니다. 세부 규칙의 원본은
[Claude Code adapter의 Routine operation](../../../docs/development/agent-workflows/adapters/claude-code.md#routine-operation)입니다.

## 1. Spec 작성

아래 template을 scratchpad의 JSON 파일로 복사해 요청·역할·범위·acceptance·근거를 고칩니다. `sessionId`는 이 skill이 치환한 현재
session ID입니다. 새 세션이나 `--resume` 뒤에는 이 skill을 다시 호출해 새 ID를 받습니다. 이전 ID로 등록한 task는 PreToolUse가
다른 세션 task로 거부합니다.

```json
{
  "sessionId": "${CLAUDE_SESSION_ID}",
  "request": "package.json의 packageManager 값을 조사해줘.",
  "role": "knu_explorer",
  "profileId": "bounded-standard",
  "selectionBasisRef": "plan:example/delegate",
  "expectedResolvedModel": "claude-sonnet-5-5",
  "kind": "extract",
  "impactRisk": "low",
  "complexity": "bounded",
  "uncertainty": "resolved",
  "childValue": "independent-extraction",
  "owner": "explorer",
  "readScope": ["package.json"],
  "writeScope": [],
  "acceptance": ["packageManager 값을 원문 그대로 보고"],
  "reviewDisposition": {
    "required": false,
    "reason": "bounded extraction checked by the Parent against package.json"
  },
  "facts": [
    { "key": "source-bound", "sourceRef": "plan:example/delegate", "confidence": "high" },
    { "key": "fixed-input", "sourceRef": "plan:example/delegate", "confidence": "high" },
    { "key": "single-step", "sourceRef": "plan:example/delegate", "confidence": "high" },
    { "key": "output-schema", "sourceRef": "plan:example/delegate", "confidence": "high" },
    { "key": "acceptance", "sourceRef": "plan:example/delegate", "confidence": "high" },
    { "key": "independent-check", "sourceRef": "plan:example/delegate", "confidence": "high" }
  ],
  "prompt": "Read package.json only. Report the exact packageManager value."
}
```

- 역할·profile·모델 조합은 adapter의 routine 표에서 `관측` 행만 고릅니다. Effort는 역할 파일이 정하므로 역할로 고릅니다.

  | 작업               | 역할                 | Profile            | 모델·effort | 상태 |
  | ------------------ | -------------------- | ------------------ | ----------- | ---- |
  | 고정 입력 추출     | `knu_explorer`       | `bounded-standard` | Sonnet high | 관측 |
  | 공식 근거 조사     | `knu_researcher`     | `bounded-standard` | Sonnet high | 관측 |
  | bounded 구현       | `knu_executor`       | `bounded-standard` | Sonnet high | 관측 |
  | repository 읽기    | `knu_explorer`       | `bounded-standard` | Sonnet high | Q    |
  | 복잡한 구현        | `knu_executor`       | `complex-critical` | Opus high   | Q    |
  | impact `high` 구현 | `knu_executor_xhigh` | `complex-critical` | Opus xhigh  | Q    |

  Q 조합은 routine 위임에 쓰지 않습니다. 상태는 adapter의 routine 표가 원본입니다.

- 추출만 impact `low`·complexity `bounded`·uncertainty `resolved`에서 `reviewDisposition.required:false`를 쓸 수 있습니다.
- kind별 필수 fact, 빈 `readScope` 금지, `impactRisk` 하향 금지는
  [등록 거부 원인](../../../docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md#원인)을
  따릅니다. 요청 문장은 intake가 인식하는 동사로 씁니다.

## 2. 등록과 호출

- `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native prepare --spec <absolute-spec-path>`
- 출력의 `agentInput`을 **그대로** Agent 도구 입력으로 씁니다. Hook이 등록된 prompt를 주입합니다. 등록은 권한 승인이 아닙니다.
- Writer task가 실행되는 동안 Parent는 tracked·비ignored 파일을 수정하지 않습니다. File guard가 Edit·Write를 거부해도 우회하지
  않습니다.
- 완료 알림을 받으면 `/knu-settle`로 정산합니다. 독립 QA가 필요하면 `/knu-review`를 먼저 따릅니다.

## 3. 실패 복구

[Recovery](../../../docs/development/agent-workflows/adapters/claude-code.md#recovery)를 따릅니다. 같은 task는 다시 호출할 수 없고
재시도는 한 번입니다. Writer lease가 남으면 child 종료를 확인한 뒤
`pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native release --task <taskId> --ended`로 해제하고 새로 `prepare`합니다.
