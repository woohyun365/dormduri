# Plan references

계획 안의 절·OQ·Phase 참조와 상대 링크를 기계로 확인할 수 있게 쓰는 문법입니다.
[Plan reference check](../../../../scripts/agents/common/plan-reference-check.mjs)가 이 문법으로 판정하고,
[Core의 readiness gate](./core.md#7-implementation-readiness-promotion)가 그 결과를 승격 조건으로 씁니다.

## 같은 문서 참조

- `§N`, `§N.M`: 이 문서의 번호 있는 제목(`## N. 제목`, `### N.M 제목`, 끝 글자를 붙인 `8.1a`)과 정확히 같아야 합니다.
  `§N.M`이 없을 때 `§N`으로 대신 해석하지 않습니다.
- `OQ-<ID>`: 이 문서가 줄 머리(목록 항목, 제목, 표 첫 칸, 들여쓰지 않은 줄; 취소선·굵게 표시 허용)에 정의한 OQ입니다.
  들여쓴 이어진 줄의 머리에 있는 OQ는 정의가 아니라 참조입니다. 같은 OQ를 다른 줄 머리에 다시 쓰면 중복 정의이므로
  갱신·처분 줄은 OQ를 줄 머리에 두지 않습니다(`- 처분: OQ-2 …`).
- `Phase <ID>`: 이 문서의 Phase 정의 제목(`### <ID> — 제목`, `### <ID>: 제목`, 제목 없는 `### <ID>`, `### Phase <ID> …`)입니다.
  `## V9 notes`처럼 ID 뒤에 구분 기호 없이 낱말이 오는 제목은 정의가 아닙니다. ID는 글자와 숫자를 함께 가집니다(`V1c`, `P1`,
  `CI-4`). ID가 글자와 숫자를 함께 갖지 않는 `Phase evidence`·`Phase 1`과 앞에 `Phase`가
  없는 대문자 code(D3, E5, W1)는 참조로 검사하지 않습니다.

## 다른 문서 참조

참조 바로 앞(공백 한 칸까지)에 대상을 둡니다. OQ·Phase 참조도 같은 형식입니다.

| 형식                   | 예                                   | 대상                                                                             |
| ---------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `[이름](상대 경로) §N` | `[H4](../h4-plan.md) §6`             | 링크 대상(이 문서 기준 상대 경로, `#anchor`는 무시)                              |
| `` `경로.md` §N ``     | `` `AGENTS.md` §5 ``                 | 저장소 root 기준 경로, 없으면 이 문서 기준 경로. 둘 다 없으면 root 기준으로 판정 |
| `<Plan ID> §N`         | `verification-loop-architecture §11` | `.plans` 아래 계획 중 그 `Plan ID:` 값을 가진 문서. 없으면 `unresolved-target`   |

- 대상이 계획이 아니어도 그 문서의 번호 있는 제목에서 찾습니다(`` `AGENTS.md` §5 ``).
- 참조 바로 앞의 하이픈 있는 낱말(`OQ-…`와 문장 끝 낱말 제외)은 Plan ID로 읽습니다. 그 Plan ID의 계획이 없으면 같은 문서로
  해석하지 않고 `unresolved-target`입니다. 계획 별칭(`H4-L2`)은 Plan ID가 아니므로 링크나 경로로 씁니다.
- 파일과 링크는 경로의 모든 segment가 대소문자까지 같을 때만 있다고 봅니다(macOS와 Linux 결과가 같음).
- `§9~§16`처럼 이어 쓴 두 번째 참조 앞에는 대상이 없으므로 같은 문서로 해석됩니다. 다른 문서의 범위는 참조마다 대상을
  붙입니다.
- 대상 표지 없이 다른 문서의 절을 가리킨 `§N`이 이 문서의 같은 번호 절과 겹치면 이 문서로 해석됩니다. 기계는 의도를 알 수
  없으므로(known limit) 다른 문서를 가리킬 때는 대상을 붙입니다.

## 판정

```sh
node scripts/agents/common/plan-reference-check.mjs [--root <repo>] [--report-only] [--json] <plan md...>
```

- 위반: 해석되지 않는 참조(`unresolved`), 대상 파일이 없고 ignore되지도 않은 참조(`unresolved-target`), 같은 절 번호나
  OQ의 중복 정의(`duplicate-definition`), 깨진 상대 링크·anchor(같은 문서 `#anchor` 포함, `broken-link`).
- 대상이 ignored 경로라 지금 없으면 위반이 아니라 `targetUnavailable` 건수로 세고, 항목마다 `unavailable-target`(참조)·
  `unavailable-link`(링크)로 출력합니다(JSON은 `unavailable`). 이 목록은 PASS가 아니므로 항목마다 확인합니다. 계획은 ignored `.plans` 아래에
  있으므로 없는 계획을 가리키는 상대 링크와 `.plans` 아래를 가리키는 root 기준 backtick 경로는 오타인지 다른 사람의
  local 파일인지 구별하지 못하고 이 건수로 셉니다(known limit). Backtick 경로가 root와 문서 기준 모두에 없으면 root 기준으로
  판정하므로, ignored가 아닌 경로의 오타(`` `core.md` §7 ``)는 `unresolved-target`입니다.
- Fenced code와 inline code 안은 검사하지 않습니다.
- Exit 0은 위반 없음, 1은 위반, 2는 입력 오류입니다. `--report-only`는 건수를 내고 exit 0입니다. 이 문법 전부터 있던
  계획에 씁니다.
