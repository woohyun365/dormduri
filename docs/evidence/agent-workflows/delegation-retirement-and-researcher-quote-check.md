# Delegation retirement and researcher quote check evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 위임 규칙의 owner가 아닙니다. 현재 역할과 routine 조합은
> [Claude Code adapter](../../development/agent-workflows/adapters/claude-code.md#routine-operation)와
> [Codex delegation](../../development/agent-workflows/adapters/codex-delegation.md#role-and-effort), 결정은
> [DA-023](../../development/agent-workflows/agentic-architecture-decisions.md#executor-retirement)과
> [DA-024](../../development/agent-workflows/agentic-architecture-decisions.md#researcher-quote-check)가 소유합니다.

이 문서는 두 host의 구현 child 경로(executor)를 지운 변경(2026-11-01, PR #805)과, 남은 읽기 역할 가운데 공식 근거 조사
(`knu_researcher`)를 짝 reviewer 대신 Parent 인용 대조로 정산하게 한 변경(2026-11-02, 작업 issue #809, 요청 issue #776)의 측정 기록입니다.
기준 commit은 `ed7dee26`(첫 변경 전), `88a9fe69`(첫 변경), `02653db9`(둘째 변경 전), `5d92db45`(둘째 변경의 code commit)입니다. Live 관측은
Claude Code 2.1.316, Parent 모델 Claude Opus 5.5에서 했습니다.

## 1. 문제와 관측

- 구현 위임의 쓴 기록이 적었습니다. Claude executor task는 8회(2026-09-28~10-05, kind `build`), Codex writer 등록은 2건(2026-10-09·10-10)이었고
  그 뒤 0회였습니다. 같은 checkout의 native registry 전체 837건 가운데 읽기 위임은 explorer 50(`extract` 38·`read` 12), researcher 22(모두
  `read`), 리뷰는 757건이었습니다(로컬 registry 기록 집계, 공개 재현 불가).
- Writer child 하나를 두려고 writer lease, writer 실행 중 Parent 쓰기 guard(두 host hook), writer subject 리뷰 분기, Codex build profile의
  필수 QA를 유지했습니다.
- 공식 근거 조사는 짝 reviewer가 있어야 등록됐습니다. Lead가 URL을 정한 조사(kind `extract`)는 `kind-role`로 거부됐고, 요청 문장에
  `배포`가 있으면 intake 위험 `high`가 `bounded-standard` 등록을 막았습니다. 제품 lane에서 같은 원인의 거부가 네 번 관찰됐고 한 번은
  Parent가 공식 가격 페이지를 직접 확인해 위임을 건너뛰었습니다.

## 2. 측정 방법과 재현 명령

- 첫 변경의 규모: 두 commit 사이 diff, 역할 파일 목록, 자주 읽는 문서의 글자 수.
- 등록 자격: 등록 없이 정책 함수(`evaluateClaudeProfileEligibility`)에 같은 8개 사례를 넣어 `02653db9` 전 판(`a14b860b`)과 `5d92db45`에서
  비교했습니다. 요청은 `배포 대상 Node 공식 문서의 지원 기간 근거를 분석해줘.`(intake `analyze`·위험 `high`)와 `AWS 공식 가격 페이지의
Lightsail 월 요금 근거를 조사해줘.`(위험 `low`)입니다.
- Live: 새 Claude 세션에서 researcher `extract`(Lead가 정한 URL) 1회, `배포`가 든 요청의 researcher `read` 1회, 등록 취소 1회를 등록·호출·정산했습니다.
  인용 원문은 Parent가 `curl`로 받은 raw HTML이고 WebFetch 요약이 아닙니다.
- 양성 대조: 독립 clone에서 정책·정산·대조 code를 하나씩 되돌리거나 넓혀 해당 test가 실패하는지 봤습니다(열여섯 변형).

```bash
# 첫 변경의 규모
git diff --shortstat ed7dee26 88a9fe69
git ls-tree --name-only ed7dee26 .claude/agents/ .codex/agents/
git ls-tree --name-only 88a9fe69 .claude/agents/ .codex/agents/
git show 88a9fe69:docs/development/agent-workflows/adapters/claude-code.md | wc -m

# 둘째 변경의 등록·정산(live 한 회)
pnpm -s claude:native prepare --spec <researcher spec.json>
pnpm -s claude:native settle --task <taskId>
curl -sL -A 'Mozilla/5.0' <url> -o <raw.html>
node scripts/agents/common/quote-check.mjs --task <taskId> --response <response.json> --select <select.json> --out <quote-check.json>
pnpm -s claude:native settle --task <taskId> --judgment <judgment.json>
pnpm -s claude:native release --task <taskId> --not-dispatched
```

## 3. Baseline

| 항목                                 | 값(`ed7dee26`·`02653db9`)                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| KNU 역할 파일                        | Claude 6(executor 둘 포함), Codex 10(executor 셋 포함)                                             |
| Researcher가 받는 kind               | `read`만. `extract`는 `kind-role`                                                                  |
| Researcher 독립 QA                   | 어느 profile이든 짝 reviewer(`complex-critical`, Opus xhigh) 필수                                  |
| `배포`가 든 요청의 researcher `read` | `bounded-standard` low·medium `risk-downgrade`, high `impact-risk`, `complex-critical` high만 통과 |
| 호출하지 않은 등록의 정리            | `release --ended`뿐(실행이 끝난 task를 닫는 경로)                                                  |

짝 reviewer의 비용은 이슈 #776 배경이 인용한 값(Opus 리뷰 회차마다 약 13분, 수만~36만 token)이고 이 측정에서 같은 조건으로 다시 재지
않았습니다.

## 4. 원인

- 구현 위임: writer child 하나를 안전하게 두는 장치(lease·guard·리뷰 분기·필수 QA)가 쓴 기록보다 컸고, Parent가 쓴 diff는 이미 독립 리뷰를
  받았습니다.
- 공식 근거 조사: 역할 단위로 QA를 정해 출처를 결정적으로 대조할 수 있는 인용 결과도 판단형 리뷰와 같은 비용을 냈습니다. `extract`를
  explorer에만 준 kind 표와, 요청 낱말 위험을 읽기 전용 조사에도 그대로 쓴 비교가 같은 원인의 거부를 만들었습니다.

## 5. 대안과 기각

| 결정            | 채택                                     | 기각과 이유                                                                                               |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 구현 child      | 철회, Parent가 구현                      | 유지(유지 비용), 구현 요청을 읽기 역할로 조용히 돌리기(거부 이유가 남지 않음)                             |
| Researcher kind | `read`·`extract` 모두 인용 대조          | `read`만(`extract`가 계속 `kind-role`), 지정 URL `extract`만(`readScope` URL 항목과 정산 URL 대조가 필요) |
| 대조 실패 주장  | evidence 후보에서 제외                   | 정산 거부                                                                                                 |
| 정산이 보는 것  | 대조 출력(task id·응답 digest·응답 주장) | 출력 경로만 기록(대조가 실행되지 않아도 끝남)                                                             |
| 위험 상한       | researcher medium                        | researcher low, 읽기 전용 child 전체 medium(explorer 결과는 인용 대조 대상이 아님)                        |
| 지정 URL 자리   | prompt, fact `sourceRef`는 근거 참조     | fact `sourceRef`에 URL 허용(입력 검증 완화)                                                               |

## 6. 개선별 전후 측정

### 첫 변경(executor 철회, `ed7dee26` → `88a9fe69`)

| 항목                            | 전                 | 후                                                                  |
| ------------------------------- | ------------------ | ------------------------------------------------------------------- |
| Diff                            | —                  | 64파일, +1,086 / −2,299줄                                           |
| KNU 역할 파일                   | Claude 6, Codex 10 | Claude 4, Codex 7(지운 파일 5)                                      |
| 지운 test                       | —                  | test 36개, assert 줄 179(executor·writer 하네스를 직접 고정한 것만) |
| `claude-code.md` 글자 수        | 13,194             | 12,766                                                              |
| `/knu-delegate`(Claude) 글자 수 | 5,666              | 5,162                                                               |

### 둘째 변경(researcher 인용 대조, 정책 함수 측정)

| 사례                                                     | `a14b860b`                    | `5d92db45`       |
| -------------------------------------------------------- | ----------------------------- | ---------------- |
| 배포 요청 researcher `read` `bounded-standard` medium    | `risk-downgrade`              | 통과             |
| 배포 요청 researcher `read` `bounded-standard` low       | `risk-downgrade`              | `risk-downgrade` |
| 배포 요청 researcher `read` `bounded-standard` high      | `impact-risk`                 | `impact-risk`    |
| 배포 요청 researcher `read` `complex-critical` high      | 통과                          | 통과             |
| 배포 요청 researcher `extract` `bounded-standard` medium | `risk-downgrade`, `kind-role` | 통과             |
| 가격 요청 researcher `extract` `bounded-standard` low    | `kind-role`                   | 통과             |
| 가격 요청 researcher `read` `bounded-standard` low       | 통과                          | 통과             |
| 배포 요청 explorer `read` `bounded-standard` medium      | `risk-downgrade`              | `risk-downgrade` |

### 둘째 변경(live, 2026-11-02, 각 1회)

| 관측                                                               | 결과                                                                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Researcher `extract`(AWS Lightsail 가격 페이지)                    | 등록 `bounded-standard`·`sonnet`, child `claude-sonnet-5-5`·effort high, `subagent_tokens` 20,119·`duration_ms` 22,452                               |
| 같은 task, 대조 출력 없는 정산                                     | 거부(`researcher without a linked reviewer requires a quote-check output`)                                                                           |
| 같은 task, 대조 뒤 정산                                            | 인용 3건 모두 `found`(raw 497,001 B), 정산 통과, 후보 3·제외 0                                                                                       |
| `배포`가 든 요청의 researcher `read`(intake `high`, task `medium`) | `risk-downgrade`·`impact-risk` 없이 등록, child `claude-sonnet-5-5`·high, `subagent_tokens` 20,941·`duration_ms` 17,610, 인용 3건 `found`, 정산 통과 |
| 호출하지 않은 등록의 `release --not-dispatched`                    | 취소(`dispatched:false`). 그 task 호출은 PreToolUse가 `task released before dispatch`로 거부, child 실행 없음                                        |
| Dispatch 기록이 있는 task의 같은 명령                              | 거부(exit 1, `--ended` 경로 안내)                                                                                                                    |

양성 대조 열여섯 변형은 모두 해당 test를 실패시켰습니다(정책 kind 표, QA 조건, 정산 gate 넷, 후보 거르기, 정규화, 위험 상한 둘, 취소 확인,
researcher 밖 task의 대조 출력 거부, 응답 파일 바뀜 보고, 판정 칸 형식 검사, CLI 입력 오류 exit 2, 인용 쪽 태그 보존).

## 7. 한계와 재측정 조건

- Live는 kind마다 1회라 분산을 모릅니다. 두 live 모두 선택한 인용이 원문에 있어 제외 사유가 남는 정산은 live에서 관측하지 않았고 test가 고정합니다.
- 두 child는 WebFetch 요약으로 읽었다고 스스로 밝혔고, 인용 6건은 raw 대조로 원문 그대로였습니다. 요약이 인용을 바꾸는 사례가 나오면 다시 잽니다.
- 같은 질문을 짝 reviewer 경로로 돌린 비용 비교는 하지 않았습니다. 위 baseline의 reviewer 비용은 다른 작업의 인용 값입니다.
- 대조는 출처만 보장하고 인용이 질문의 답인지는 Parent 판단입니다. 정산은 대조 출력의 `found`를 다시 계산하지 않고 raw 파일 sha를 기록합니다.
- 원문을 script로 그리는 페이지는 raw에 본문이 없어 `missing`이 됩니다. 반대로 raw의 `<script>`·`<style>` 안 text와 숨김 요소도 원문으로
  세므로 렌더되지 않는 text에만 있는 인용도 `found`가 될 수 있습니다. 태그 제거는 원문 쪽만 하므로 원문에 없는 `<…>` 조각이 든 인용은
  `found`가 아닙니다. Codex는 같은 규칙을 Lead 운영 규칙으로만 둡니다.
- 구현 위임의 쓴 기록은 native registry 기록만 셉니다(registry 밖 host 자체 위임은 세지 않음).
- 재측정 조건: researcher 역할의 도구·권한 변경, 인용 대조 거짓 양성·누락 관측, CLI의 alias 해석 변경, 구현 위임이 다시 필요해질 때.

## 8. Interview map

- "왜 구현 subagent를 없앴나?" → 1·4절의 쓴 기록과 유지 장치, 6절 첫 변경의 규모.
- "리뷰어 없이 위임하면 품질은?" → 인용 대조가 보장하는 것(출처)과 보장하지 않는 것(답의 적합성), 7절 한계.
- "위험 낱말을 무시하는가?" → 6절 정책 함수 표: researcher만 medium 상한, explorer는 그대로, high는 Lead 선택.
- "검증은 어떻게 했나?" → RED 먼저, 양성 대조 열여섯 변형, live 관측(거부·통과·취소 각 1회).
