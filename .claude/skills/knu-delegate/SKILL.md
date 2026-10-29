---
name: knu-delegate
description: 이 저장소에서 bounded 작업을 KNU 역할(knu_explorer·knu_explorer_xhigh·knu_researcher·knu_executor·knu_executor_xhigh)에 위임할 때 native task를 등록하고 호출하는 절차입니다.
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

  | 작업               | 역할                 | Profile              | 모델·effort | 상태 |
  | ------------------ | -------------------- | -------------------- | ----------- | ---- |
  | 고정 입력 추출     | `knu_explorer`       | `bounded-standard`   | Sonnet high | 관측 |
  | 고정 입력 추출     | `knu_explorer_xhigh` | `bounded-extraction` | Haiku xhigh | 관측 |
  | 공식 근거 조사     | `knu_researcher`     | `bounded-standard`   | Sonnet high | 관측 |
  | bounded 구현       | `knu_executor`       | `bounded-standard`   | Sonnet high | 관측 |
  | repository 읽기    | `knu_explorer`       | `bounded-standard`   | Sonnet high | 관측 |
  | 복잡한 구현        | `knu_executor`       | `complex-critical`   | Opus high   | 관측 |
  | impact `high` 구현 | `knu_executor_xhigh` | `complex-critical`   | Opus xhigh  | 관측 |

  상태는 adapter의 routine 표가 원본입니다. Adapter 표에서 Q인 조합은 routine 위임에 쓰지 않습니다.

- 추출만 impact `low`·complexity `bounded`·uncertainty `resolved`에서 `reviewDisposition.required:false`를 쓸 수 있습니다.
- kind별 필수 fact, 빈 `readScope` 금지, `impactRisk` 하향 금지는
  [등록 거부 원인](../../../docs/development/troubleshooting/tooling/claude-native-registration-and-review-rejections.md#원인)을
  따릅니다. 요청 문장은 intake가 인식하는 동사로 씁니다.

## 2. 등록과 호출

- `pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native prepare --spec <absolute-spec-path>`
- 출력의 `agentInput`을 **그대로** Agent 도구 입력으로 씁니다. Hook이 등록된 prompt를 주입합니다. 등록은 권한 승인이 아닙니다.
- 새 파일을 만드는 writer에게 stage를 시키지 않습니다. 리뷰 snapshot은 stage와 무관하고, 새 파일 검사는
  [`/knu-review` dispatch 전 단계 2](../knu-review/SKILL.md#dispatch-전-단계)(commit 먼저, commit 전이면 저장소 밖 clone)를 따릅니다.
- Writer task가 실행되는 동안 Parent는 tracked·비ignored 파일을 수정하지 않습니다. File guard가 Edit·Write를 거부해도 우회하지
  않습니다.
- 완료 알림을 받으면 `/knu-settle`로 정산합니다. 독립 QA가 필요하면 `/knu-review`를 먼저 따릅니다.

## 3. 실패 복구

[Recovery](../../../docs/development/agent-workflows/adapters/claude-code.md#recovery)를 따릅니다. 같은 task는 다시 호출할 수 없고
재시도는 한 번입니다. 실행·관측된 task는 `release`하지 않고 정산합니다. `release`한 task는 결속 재시도의 1차가 될 수
없습니다(`recovery-not-ran`). 관측 없이 Writer lease가 남으면 child 종료를 확인한 뒤
`pnpm -C "${CLAUDE_PROJECT_DIR}" -s claude:native release --task <taskId> --ended`로 해제하고 새로 `prepare`합니다.

재시도는 실패한 1차 task에 결속합니다.

1. 실패한 1차 task를 먼저 `/knu-settle`로 정산합니다. 실행·관측되지 않은 1차 task에는 결속할 수 없습니다. 1차 완료부터
   재시도 등록까지 working tree를 바꾸지 않습니다(편집, commit, child 변경 되돌리기). 바뀌면 `recovery-not-ran`입니다.
2. 1차 spec을 복사합니다. `request`·task 분류(`kind`·`impactRisk`·`complexity`·`uncertainty`·`childValue`)·`owner`·
   read/write 범위·`acceptance`·`reviewDisposition`·`facts`는 배열 순서까지 바꾸지 않습니다. Prompt에만 실패 근거를 보탭니다.
3. `recovery`에 1차 `taskId`와 원인을 채웁니다. 원인은 `result-error`·`omission`·`context-missing` 중 하나입니다.
4. Profile과 역할은 [상향 사다리](../../../docs/development/agent-workflows/adapters/claude-model-profiles.md#recovery-상향-사다리)로
   고릅니다. `result-error`·`omission`은 한 단계 올립니다. `context-missing`은 1차 task의 profile·역할을 그대로 씁니다.
5. `prepare`합니다. 재시도는 한 번뿐입니다. Registry는 이 밖의 재시도를 모두 거부합니다.

아래는 1단계 재시도(Sonnet high → Opus high)에서 위 template에 덮어쓸 필드만 보인 예입니다. 2단계는 `profileId`가 이미
`complex-critical`이므로 `role`만 `knu_executor_xhigh`로 바꿉니다. `bounded-extraction`(`knu_explorer_xhigh`, Haiku xhigh)의
1단계는 `profileId`를 `bounded-standard`로, `expectedResolvedModel`을 Sonnet ID로 바꾸고 `role`은 그대로 둡니다(Sonnet xhigh).

```json
{
  "profileId": "complex-critical",
  "expectedResolvedModel": "claude-opus-5-5",
  "recovery": { "of": "<failed first taskId>", "cause": "result-error" }
}
```

- 거부 사유와 기록은 [Recovery 결속](../../../docs/development/agent-workflows/adapters/claude-native-registry.md#recovery-결속)을
  따릅니다.
- 등록한 재시도가 실행되지 못해도 재시도 기회는 쓴 것입니다. 다른 재시도를 등록하지 않고 Owner와 다음 행동을 정합니다.
- `recovery` 없이 같은 사실을 다시 등록하면 재시도가 아니라 일반 등록입니다. 이름만 바꾼 새 task로 상한을 초기화하지 않습니다.
