# Claude Haiku extraction routine cohort evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 routine 채택 규칙의 owner가 아닙니다. 현재 routine 조합은
> [Claude Code adapter](../../development/agent-workflows/adapters/claude-code.md#routine-operation), 역할·profile·상향 사다리는
> [Claude model profiles](../../development/agent-workflows/adapters/claude-model-profiles.md), 채택 결정은
> [DA-022](../../development/agent-workflows/agentic-architecture-decisions.md#claude-extraction-routine)가 소유합니다.

이 문서는 Claude의 고정 입력 추출에 Haiku 5.5 xhigh 경로를 routine으로 들일 수 있는지 2026-10-22에 잰 기록입니다. 지금 routine인
Sonnet 5.5 high 경로를 같은 task로 함께 돌렸습니다. 측정 기준 commit은 `175b582e`, Claude Code는 2.1.306, Parent 모델은 Claude Opus 5.5입니다.
판정 규칙은 실행 전에 고정했고, 규칙으로 계산한 판정과 저장소 owner의 채택 결정을 함께 적습니다.

## 1. 문제와 관측

- 고정 입력 단일 추출(kind `extract`)의 routine 경로는 `knu_explorer`·`bounded-standard`(Sonnet 5.5, 역할 effort high) 하나였습니다.
  Haiku 5.5 경로(`knu_explorer_xhigh`·`bounded-extraction`, 역할 effort xhigh)는 routine 표에서 Q였습니다.
- Haiku 경로의 live 근거는 1건이었습니다. 세션 effort high와 다른 역할 effort xhigh가 child에 적용되고 registry 대조를 통과했으며, 고정 입력
  1건의 oracle과 일치했습니다. 동작 확인이지 품질 근거는 아니었습니다.
- Codex의 같은 일(Luna `extract`)은 사전 고정 task·executable oracle·독립 QA로 채택했습니다(DA-017 표: "고정 source의 query 변환 8개:
  executable oracle 8/8·독립 QA PASS"). DA-017 기록으로는 그 8이 child 하나가 처리한 변환 8개로 읽힙니다(추론). 이 측정은 경로당 child 8개
  (task마다 child 하나)라 표본 단위가 다릅니다.
- 질문: Luna와 같은 개수(8)의 사전 고정 task, task별 executable oracle, 독립 QA로 Haiku 경로를 routine 채택 후보로 볼 수 있는가.

## 2. 측정 방법과 재현 명령

### 표본

실행 전에 task·입력·정답(oracle)·오답 출력(fault)을 고정했습니다. 합성 4 task와, 실제 routine 추출 이력을 본뜬 저장소 파일 고정 사본
4 task입니다. 사본은 commit `12479582`의 파일을 `git show`로 읽어 만들었습니다.

| Task | 범주                      | 입력                                                       | 묻는 것                                                         | 함정                                                       | fault                             |
| ---- | ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| T1   | 합성: 비슷한 id           | service 목록(56행)                                         | 다섯 id의 owner·port                                            | 자릿수·0이 다른 비슷한 id 다섯                             | 다른 id의 record를 답함           |
| T2   | 합성: filter·순서         | inventory CSV(40행)                                        | region·status·port 조건을 만족하는 id(파일 순서)와 개수(정답 4) | 비슷한 region 이름·대소문자, 비활성 행, port 경계값        | 비슷한 region 행을 셈             |
| T3   | 합성: 중첩 JSON 타입      | 설정 JSON                                                  | 여덟 경로의 값(number·string·boolean·null, `0`)                 | 같은 이름의 다른 경로, 0-based index                       | `false`를 문자열 `"false"`로      |
| T4   | 합성: 없는 record         | record 목록                                                | 다섯 record의 found·owner·port                                  | 주석에만 있는 record, field 순서가 다른 record             | 없는 record를 지어낸 값으로 found |
| T5   | 사본: 설정 값             | `package.json`                                             | `packageManager`, `engines.node`, script 두 개                  | `&&`·`<`가 든 명령 문자열                                  | script를 첫 명령에서 자름         |
| T6   | 사본: 큰 파일의 줄 값     | `scripts/agents/claude/native-session.mjs`(2,457줄)        | 전체 줄 수와 네 줄의 원문(앞 공백 포함)                         | 기본 Read 한도 2,000줄을 넘는 두 줄                        | 줄 수가 하나 모자람               |
| T7   | 사본: 표 → JSON           | `docs/development/agent-workflows/adapters/claude-code.md` | routine 표 9행의 role·profile·alias·effort·task·status          | 같은 역할·profile의 두 행, `—(미지원)`·`대체됨(등록 거부)` | 첫 행 상태를 다른 값으로          |
| T8   | 사본: 여러 파일 존재 여부 | `docs/development/agent-workflows/`의 문서 넷              | heading 다섯 줄이 각 파일에 정확히 있는지(20칸)                 | 다른 heading의 접두인 heading                              | 접두 일치를 있음으로              |

- 실행 전 검사: oracle 자기 일치 8/8, fault 거부 8/8, 다른 방법(다른 parser·줄 scan)으로 계산한 정답 교차 일치 8/8. Task 요청 문장 8개는
  intake에서 모두 `analyze`·low로 분류됐고, 두 경로의 spec은 모두 등록 자격 검사를 통과했습니다.

### 비교 구성

| 경로   | 역할                 | Profile              | Alias    | 기대 모델 ID        | 역할 effort |
| ------ | -------------------- | -------------------- | -------- | ------------------- | ----------- |
| Haiku  | `knu_explorer_xhigh` | `bounded-extraction` | `haiku`  | `claude-haiku-5-5`  | xhigh       |
| Sonnet | `knu_explorer`       | `bounded-standard`   | `sonnet` | `claude-sonnet-5-5` | high        |

- 두 경로의 spec은 사실 묶음(요청·kind·risk·read scope·acceptance·facts)이 같고 역할·profile·기대 모델 ID만 다릅니다. Effort도 다르므로 이
  비교는 모델만의 비교가 아니라 두 추출 경로의 비교입니다.
- 순서: T1→T8, 홀수 task는 Haiku 먼저·짝수 task는 Sonnet 먼저, 한 번에 child 하나(background). Task마다 경로당 1회, 모두 16 run입니다.

### 채점과 판정 규칙

- 품질: registry 완료 기록의 응답 text를 정규화 없이 꺼내(응답 digest 대조) 정답 JSON과 deep-equal로 비교합니다.
- 관측 대조: 정산이 기록한 해석 모델·child effort·관측 오류와 child transcript의 assistant 행 model·effort.
- 효율(판정에 쓰지 않음): 완료 알림의 `duration_ms`·`subagent_tokens`·`tool_uses`와 child transcript의 message별 usage 합(input·cache
  creation·cache read·output).
- 판정 규칙(실행 전 고정): Haiku 1차 oracle 8/8, Haiku 관측 대조(`claude-haiku-5-5`·xhigh) 통과, 사후 독립 QA PASS면 `채택 후보`, 하나라도
  미달이면 `보류 권장`입니다. Sonnet은 같은 task의 기준선이고, 두 경로가 모두 틀린 task는 task 결함 후보로 기록합니다.
- Recovery: Haiku 1차가 정답과 다를 때만 `result-error`로 상향 사다리 1단을 한 번 관측하고 품질 점수는 1차 결과로 셉니다.

### 재현 명령

```bash
# run마다: 같은 사실 묶음의 spec을 경로별로 등록하고, Agent 호출의 완료 알림 뒤 관측을 정산한 다음 판정한다
pnpm -s claude:native prepare --spec <spec.json>
pnpm -s claude:native settle --task <taskId>
pnpm -s claude:native settle --task <taskId> --judgment <judgment.json>

# 저장소 사본 4 task의 입력
git show 12479582:package.json
git show 12479582:scripts/agents/claude/native-session.mjs
git show 12479582:docs/development/agent-workflows/adapters/claude-code.md
for f in orchestration session-continuity qa agent-execution-contract; do
  git show "12479582:docs/development/agent-workflows/$f.md"
done
```

합성 4 task의 입력·정답·fault, 사본 task의 정답, cohort 도구(spec 생성·자격 검사·응답 추출·oracle 비교·지표 수집·판정 계산), run별 registry
기록과 transcript는 공개하지 않는 로컬 기록입니다. 사본 4 task의 입력은 위 명령으로 다시 만들 수 있고, 정답은 그 입력에서 다시 계산할 수
있습니다. 합성 task는 이 문서만으로 다시 만들 수 없습니다.

## 3. Baseline

| 항목                             | 측정 전                                                     |
| -------------------------------- | ----------------------------------------------------------- |
| Routine 표 Haiku 추출 행         | Q, 관측 ID `claude-haiku-5-5`(CLI 2.1.296, alias 해석 관측) |
| Routine 표 Sonnet 추출 행        | 관측, `claude-sonnet-5-5`(CLI 2.1.286)                      |
| Haiku 경로의 live 근거           | 1건(역할 effort 적용·registry 대조, oracle 일치)            |
| Haiku 경로의 사전 고정 품질 근거 | 없음                                                        |
| 같은 task의 비교 기준선          | 이 측정의 Sonnet 경로(지금 routine)                         |

## 4. 원인

- Haiku 행이 Q였던 이유는 동작 문제가 아니라 품질 근거가 없었기 때문입니다. Exact ID 능력표·기대 ID·역할 범위는 이미 들어갔고 live 1건의
  effort 대조도 통과했습니다.
- Adapter의 채택 규칙에서 live 증거는 필요조건일 뿐이고, Q 행을 routine으로 바꾸는 것은 표를 갱신하는 별도 채택 결정입니다. 그래서
  Luna와 같은 형태의 사전 고정 cohort를 만들고 판정 규칙을 실행 전에 고정했습니다.

## 5. 대안과 기각

실행 전(저장소 owner가 측정 설계를 고를 때):

| 결정        | 고른 것                                              | 기각한 것                                                                                     |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Cohort 크기 | 8 task × 경로 1회(Luna 채택과 같은 개수)             | 8 task × 경로 2회, 12 task × 1회, 4 task × 2회                                                |
| Task 구성   | 합성 4(함정별) + 실제 추출 이력을 본뜬 저장소 사본 4 | 합성 8, 저장소 사본 8                                                                         |
| 판정 규칙   | 품질 gate, 효율은 기록                               | 품질 gate + 효율 조건, 비열등 판정                                                            |
| Recovery    | 자연 실패 때만 관측                                  | 자연 실패가 없을 때 controlled fault 1건(registry에 실제와 다른 실패 판정이 남음), 관측 안 함 |

실행 뒤(저장소 owner의 판정):

| 대안                                     | 결과                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 채택                                     | 고름. 규칙 계산 판정이 `채택 후보`                                                              |
| 보류(Sonnet high만 routine 유지)         | 기각. 품질 gate를 충족했고, 시간·token은 실행 전에 판정 입력에서 뺐음                           |
| 두 행 모두 routine, Lead가 task마다 고름 | 고름. 가장 작은 변경이고 이 근거 범위 안. 이 표본에 Haiku 경로가 더 빠르거나 싸다는 근거는 없음 |
| Haiku 기본·Sonnet 대체 문장 추가         | 기각                                                                                            |
| Sonnet 추출 행 미사용                    | 기각. Sonnet 경로도 같은 cohort에서 8/8                                                         |

## 6. 개선별 전후 측정

### 품질과 관측 대조

| 경로   | 1차 oracle 일치 | 관측 대조(해석 모델·transcript model·effort) | 정산 관측 오류 | 판정 정산 |
| ------ | --------------: | -------------------------------------------- | -------------- | --------- |
| Haiku  |             8/8 | 8/8 `claude-haiku-5-5`·xhigh                 | 8 run 모두 0   | 8/8 valid |
| Sonnet |             8/8 | 8/8 `claude-sonnet-5-5`·high                 | 8 run 모두 0   | 8/8 valid |

- 두 경로가 모두 틀린 task 0, Haiku 1차 불일치 0이라 재시도 0입니다. CLI 2.1.306에서 alias 해석(`haiku` → `claude-haiku-5-5`,
  `sonnet` → `claude-sonnet-5-5`)을 16 run에서 관측했습니다.
- 규칙 계산 판정: `채택 후보`. Owner는 Haiku 경로를 routine으로 채택하고 Sonnet 추출 행도 그대로 routine으로 두었습니다.

### 효율(판정에 쓰지 않음)

| 경로   | oracle 일치 | 독립 QA | `duration_ms` p50 | `duration_ms`가 더 긴 task | `subagent_tokens` p50 | `tool_uses` p50 | transcript 합 p50 |
| ------ | ----------: | ------- | ----------------: | -------------------------: | --------------------: | --------------: | ----------------: |
| Haiku  |         8/8 | PASS    |          10,867.5 |                        8/8 |              20,645.5 |               2 |            40,265 |
| Sonnet |         8/8 | PASS    |             7,534 |                        0/8 |                18,623 |               2 |            35,170 |

Task별 값입니다(oracle은 두 경로 모두 8 task 일치, 독립 QA PASS).

| Task | Haiku `duration_ms` | Sonnet `duration_ms` | Haiku `subagent_tokens` | Sonnet `subagent_tokens` | Haiku `tool_uses` | Sonnet `tool_uses` | Haiku transcript 합 | Sonnet transcript 합 |
| ---- | ------------------: | -------------------: | ----------------------: | -----------------------: | ----------------: | -----------------: | ------------------: | -------------------: |
| T1   |               8,599 |                6,231 |                  19,420 |                   18,681 |                 2 |                  2 |              34,795 |               34,770 |
| T2   |              12,997 |                7,398 |                  19,579 |                   18,105 |                 3 |                  2 |              54,562 |               34,040 |
| T3   |               8,738 |                7,670 |                  18,313 |                   17,640 |                 2 |                  2 |              33,797 |               33,776 |
| T4   |               8,305 |                6,914 |                  18,226 |                   17,641 |                 2 |                  2 |              33,798 |               33,740 |
| T5   |               7,310 |                6,200 |                  21,712 |                   21,378 |                 2 |                  2 |              37,535 |               37,464 |
| T6   |              27,003 |               22,458 |                  70,533 |                   66,988 |                 4 |                  5 |             154,578 |              206,029 |
| T7   |              13,015 |                8,783 |                  29,084 |                   27,182 |                 2 |                  2 |              42,995 |               42,917 |
| T8   |              17,236 |               12,576 |                  54,804 |                   18,565 |                 6 |                  5 |             124,757 |               35,570 |

- p50만 게시합니다(n=8). p95는 표본 8/10이라 게시하지 않습니다.
- Task당 1회이고 두 경로는 effort가 다르며 시간은 API 지연·시각 영향을 받으므로, 시간 차이를 원인이나 크기로 일반화하지 않습니다.
- `subagent_tokens`(완료 알림)와 transcript 합은 정의가 달라 섞지 않습니다. 비용(USD)은 계산하지 않았습니다.

### 독립 QA

- Reviewer는 Claude Opus 5.5·xhigh이고 기준은 자동 선택한 `documents`(8항목)입니다. QA 대상은 고정 cohort, run별 출력·oracle 기록·지표, 판정
  계산, 이 기록의 초안이었습니다.
- 1회차 FAIL(finding 4): 지표 표에 QA 칸이 없고 시간 비교를 표 밖 문장으로 보고함(medium), DA-017 요약이 원문의 표본 단위와 다름, 첫 등록
  때의 의존성 자동 설치와 첫 run의 수동 단계 기록 누락, Parent 모델·CLI 버전의 run 단위 근거 부재(low 셋). 넷 모두 고쳤고 판정 수치(oracle·
  관측·p50)는 바뀌지 않았습니다.
- 2회차 PASS(finding 0).

### 전후

| Routine 표 행                                         | 측정 전                            | 측정 뒤                           |
| ----------------------------------------------------- | ---------------------------------- | --------------------------------- |
| `knu_explorer_xhigh`·`bounded-extraction`·Haiku xhigh | Q, `claude-haiku-5-5`(2.1.296)     | 관측, `claude-haiku-5-5`(2.1.306) |
| `knu_explorer`·`bounded-standard`·Sonnet high(추출)   | 관측, `claude-sonnet-5-5`(2.1.286) | 그대로                            |

## 7. 한계와 재측정 조건

- Recovery 1단(`knu_explorer_xhigh`·`bounded-standard`·Sonnet xhigh)은 live 미관측입니다. Haiku 1차 자연 실패가 없었습니다. 운영 중 첫 결속
  재시도가 그 조합의 첫 관측입니다.
- 경로당 8 task × 1회라 분산을 모릅니다. p95가 없습니다.
- 두 경로의 effort가 다릅니다(xhigh 대 high). 품질·시간 차이를 모델만의 차이로 가르지 못합니다.
- 시간은 순차 실행·교대 순서로 순서 영향을 줄였을 뿐 API 지연과 시각 영향을 받습니다.
- 완료 알림 `subagent_tokens`의 정의는 문서에 없습니다(host 보고값을 기계적으로 추출).
- 저장소 사본은 `12479582` 판으로 고정했습니다. 채택 범위는 고정 입력 단일 추출(kind `extract`)뿐입니다.
- Oracle 비교는 Parent가 고정 도구로 실행했고 독립 QA는 model-mediated입니다.
- 다른 CLI 버전·Parent family의 alias 해석은 이 표본 밖입니다.
- 실행 편차: 한 run의 Agent 호출에 background 옵션을 덧붙였습니다(모든 run이 background로 실행됐고 등록 prompt·역할·모델은 같음). 첫 등록
  때 pnpm이 의존성 2개를 자동으로 연결하고 root `prepare` script를 실행했습니다(ignored 경로뿐, tracked 변경 0, 첫 child 시작 전). 첫 run은
  run helper를 만들기 전이라 단계를 손으로 실행했고, 독립 QA runner가 그 spec·출력·oracle 판정을 기록 재실행과 대조했습니다.
- 재측정 조건: CLI 버전이나 Haiku·Sonnet 모델 ID가 바뀔 때, 역할 effort나 profile·사다리를 바꿀 때, 추출 밖 작업 유형으로 넓힐 때.

## 8. Interview evidence map

| 질문                                       | 답할 곳                      |
| ------------------------------------------ | ---------------------------- |
| 새 모델을 routine에 들이는 근거는 무엇인가 | 1절, 2절 판정 규칙, 6절 품질 |
| 판정 규칙을 결과를 보고 바꾸지 않았는가    | 2절 판정 규칙(실행 전 고정)  |
| Haiku가 더 빠르거나 싼가                   | 6절 효율, 7절 한계           |
| 무엇을 증명하지 못했는가                   | 7절                          |
