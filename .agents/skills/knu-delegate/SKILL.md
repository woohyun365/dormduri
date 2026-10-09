---
name: knu-delegate
description: 이 저장소에서 Codex Parent가 bounded 작업을 KNU 역할(knu_explorer·knu_researcher·knu_executor 계열)에 위임할 때 spec에서 dispatch를 만들고 등록해 spawn하는 절차입니다. Child 역할에서는 쓰지 않습니다.
---

# KNU 위임

작은 작업이나 shell로 충분한 작업은 Parent가 직접 합니다. 위임 판단과 model 선택 규칙의 원본은
[Routine task-model operation](../../../docs/development/agent-workflows/adapters/codex.md#routine-task-model-operation)과
[Model recommendation](../../../docs/development/agent-workflows/adapters/codex-delegation.md#model-recommendation)입니다.

## 1. Spec 작성

현재 source를 읽은 뒤 아래 형식의 JSON을 저장소 밖 임시 경로나 `.artifacts/` 아래에 씁니다. Lane field는
[Candidate schema](../../../docs/development/agent-workflows/adapters/codex-delegation.md#candidate-schema)와 같고, `pass2Evidence`
대신 `evidence`를 씁니다. ID와 digest는 CLI가 계산하므로 손으로 쓰지 않습니다.

```json
{
  "request": "법적 근거 test를 추가해줘.",
  "mode": "fresh",
  "repositoryEvidence": [{ "path": "docs/policies/legal-basis.md", "kind": "policy" }],
  "dispatchToken": "<4-12자 소문자·숫자, dispatch마다 새로>",
  "lanes": [
    {
      "id": "legal-test",
      "domain": "legal-policy",
      "taskKind": "implementation",
      "priority": "medium",
      "impactRisk": "low",
      "objective": "…",
      "question": "…",
      "allowedEvidence": ["repo", "test"],
      "allowedTools": ["repository-read", "workspace-edit", "test-runner"],
      "readScope": ["docs/policies"],
      "writeOwnership": ["apps/web/src/legal/example.test.ts"],
      "dependencies": [],
      "expectedOutputFields": ["changedFiles", "behavior"],
      "verification": ["…"],
      "benefit": { "kind": "latency", "rationale": "…" },
      "delivery": {
        "snapshot": "<현재 HEAD와 working tree 요약>",
        "evidencePointers": ["docs/policies/legal-basis.md"],
        "findings": ["…"],
        "failures": []
      },
      "evidence": {
        "sources": [{ "path": "docs/policies/legal-basis.md", "locator": "…" }],
        "facts": [
          { "statement": "…", "sources": [0], "confidence": "high", "verifies": ["acceptance"] }
        ],
        "claims": [
          { "predicateId": "M-01", "outcome": "confirmed", "facts": [0], "rationale": "…" }
        ],
        "gaps": [],
        "confidence": "high"
      }
    }
  ]
}
```

- `repositoryEvidence[].kind`는 `changed-file`·`policy`·`architecture`·`owner-readme`·`contract`·`route`·`controller`·`bff`·
  `test`·`external-source` 중 하나입니다(`scripts/agents/common/domain-guide-registry.mjs`).
- `sources[].path`는 `repositoryEvidence`가 context pack에 넣은 경로여야 합니다. Digest는 CLI가 현재 파일 bytes로 계산합니다.
- `facts[].sources`와 `claims[].facts`는 같은 lane 안의 index입니다.
- `verifies`는 그 fact가 확인하는 검증 key입니다. 읽기는 `acceptance`·`independentCheck`, 구현은 `acceptance`·`regression`·
  `astraQa`, 고정 입력 추출은 여기에 `fixedInput`·`outputSchema`·`singleStep`을 더합니다. 실제 source 근거가 있는 fact에만 붙입니다.
- `claims`는 [Reasoning effort routing](../../../docs/development/agent-workflows/adapters/codex.md#reasoning-effort-routing)의
  계층 판정을 predicate로 적습니다. Medium은 `M-01`부터 `M-15`까지 모두 confirmed로 적을 때만 성립합니다. Mandatory signal은
  `X-01`부터 `X-10`까지 또는 domain predicate 이름(`BE-01-concurrency-transaction` 등)이고, 같은 fact를 여러 composite category로
  세지 않습니다. 숫자 predicate ID별 정의는 아직 없습니다(#608). Rationale에 판정 근거를 적습니다. Confirmed claim이 하나도 없는 lane은 위임 단계에서 보류됩니다.
- `delivery`는 fresh child가 받는 scoped packet입니다. Candidate model lane은 이것이 없으면 보류됩니다.
- `modelRequest`를 생략하면 CLI가 Pass 2 결과와 `verifies` 태그에 맞는
  [후보 profile](../../../docs/development/agent-workflows/adapters/codex-model-profiles.md#quality-gated-model-advice)을
  `purpose: routine`으로 채우고, 맞는 profile이 없으면 생략해 Astra 배정으로 둡니다. `false`는 Astra를 고정하고, `{ "profileId", "purpose" }`는 Parent의 명시 요청입니다.

## 2. Dispatch 생성과 등록

1. `pnpm -s codex:delegate -- lanes --spec <spec> --out <delegation.json>`을 실행합니다. 출력 `lanes`에서 lane마다
   `modelRequest`(`default`·`omitted`·`explicit`·`astra`), 역할·effort·model과 보류 사유(`deferred`)를 확인합니다.
   `deferred.stage`가 `delegation`이면 그 lane의 route·선택 사유(`reasons`), `dispatch`면 dispatch 사유와 `gaps`입니다.
   보류된 lane은 사유를 고치거나 Parent가 직접 합니다.
2. `pnpm -s codex:register -- --dispatch <delegation.json>`으로 등록합니다. 출력의 `digest`는 수락 때 대조하므로 기록합니다.
3. 출력의 `spawnArguments`를 바꾸지 않고 spawn 도구에 그대로 넘깁니다. 메시지에는 delegation 파일의 그 dispatch `contract`
   (objective, 범위, acceptance, stop·handoff 조건)를 담습니다. 등록이 없거나 인자가 다르면 hook이 spawn을 거부합니다
   ([등록·수락](../../../docs/development/agent-workflows/adapters/codex-native-registry.md#subagent-hook-guardrail과-완료-관측)).
4. Child 완료 뒤 `$knu-settle`로 정산하고, 독립 QA가 필요하면 `$knu-review`를 씁니다.

후보 자격은 routing이, 호출 시점의 (역할, model) 쌍은 hook이 확인합니다. 이 skill의 출력은 업무 권한 승인이 아닙니다.
