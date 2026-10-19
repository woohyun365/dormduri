# 트러블슈팅: Claude native 등록·독립 리뷰 결과가 거부됨

**상태**: Current
**마지막 검증 환경**: Claude Code CLI 2.1.289, `pnpm claude:native prepare/register/review/settle/complete`
**현재 owner**: [Claude Code adapter](../../agent-workflows/adapters/claude-code.md)

## 증상

- `pnpm claude:native register --input <JSON file>`가 거부됩니다. 일반 사유 뒤에 model policy 사유(`profile:`)와
  입력 필드(`input:`)가 붙습니다.

  ```text
  workflow not ready: strict-native-dispatch-not-qualified; profile: invalid-input; input: binding-lifetime-exceeds-30m
  workflow not ready: strict-native-dispatch-not-qualified; profile: invalid-input; input: unsafe-reference:nativeRequest.task.facts[0].sourceRef
  workflow not ready: strict-native-dispatch-not-qualified; profile: risk-downgrade
  ```

- `pnpm claude:native prepare --spec <JSON file>`는 같은 입력 필드 사유를 register 전에 `invalid prepare spec:`으로 보여 줍니다.
  Policy 판정 사유(`risk-downgrade` 등)는 register와 같은 형식으로 나옵니다.

  ```text
  invalid prepare spec: selection-basis-required
  invalid prepare spec: binding-lifetime-exceeds-30m
  invalid prepare spec: fact-confidence-not-high:source-bound
  invalid prepare spec: review-snapshot-stale: rebuild the review for the current source
  invalid prepare spec: review-input-stale: .plans/<plan>.md
  invalid prepare spec: review-input-manifest-missing
  ```

- Reviewer 등록(`prepare`·`register --input`)이 prompt 기록 대조로 거부됩니다.

  ```text
  review-prompt-changed: the prompt differs from the one review built; register the reviewerSpec prompt unchanged
  review-prompt-unbound: no prompt record for review <reviewId>; build the reviewer with review
  ```

- 역할·effort·QA 조건으로 등록이 거부됩니다.

  ```text
  workflow not ready: strict-native-dispatch-not-qualified; profile: effort-tier
  invalid-role-effort: knu_explorer must declare effort medium|high|xhigh
  independent QA required for this profile
  ```

- `settle --task <taskId>`가 exit 1이고 `observationErrors`에 `effort-transcript-pending`, `effort-transcript-foreign`,
  `effort-transcript-too-large`, `effort-unobserved`, `effort-mismatch` 중 하나가 있습니다. `completion.json`의 `valid`는 `true`일 수 있습니다.
- 공통 workflow가 요청을 `intent: unknown`으로 분류해 등록이 진행되지 않습니다.
- 독립 reviewer가 PASS를 반환했는데 완료 판정이 거부됩니다.

  ```text
  PASS requires a complete result with no blocking finding or evidence gap.
  read-only reviewer cannot be the packet runner
  review commandsActuallyRun differs from the bound runner records
  ```

- `review`가 회차·직전 결과·기준 문서·1회차 그룹 입력, `--basis`나 ignored 리뷰 입력을 거부합니다.

  ```text
  invalid review request: review-round-required: a positive integer
  invalid review request: previous-result-required-after-round-1
  invalid review request: previous-result-only-after-round-1
  invalid review request: previous-result-unreadable: <path>
  invalid review request: previous-result-invalid: a review result JSON with verdict and findings
  invalid review request: previous-result-invalid: <result path> is not a review result JSON with verdict and findings
  invalid review request: previous-result-invalid: adjudication record <kind> <id>
  invalid review request: criteria-invalid: no docs/development/agent-workflows/review-criteria/<id>.md
  invalid review request: criteria-invalid: none cannot be combined with criteria ids
  invalid review request: review-input-too-large: 2400 files > 2000; give narrower read paths
  invalid review request: review-input-path-case: .Plans differs from the stored name; use its exact case
  invalid review request: composition-round-1-only
  invalid review request: reviewers-invalid: 2 or 3
  invalid review request: composition-e3-criteria-required: give --criteria
  invalid review request: unsafe-reference:selectionBasisRef
  ```

- `review --parent-subject`가 subject의 경로나 `requirementSections`를 거부하거나, 출력 `warnings`에
  `request-implementation-marker`가 나옵니다.

  ```text
  invalid parentSubject: local-state-path:.omc/notepad.md
  invalid parentSubject: requirement-heading-missing: .plans/<plan>.md § <heading>
  invalid parentSubject: requirement-heading-duplicate: .plans/<plan>.md § <heading>
  invalid parentSubject: requirement-path-unreadable: .plans/<plan>.md
  invalid parentSubject: requirement-path-in-paths: .plans/<plan>.md
  invalid parentSubject: requirementSections-invalid: [{"path": "<plan path>", "headings": ["<heading text>", ...]}]
  ```

- 1회차 그룹의 PASS 구성원을 연결한 builder 완료가 `review-adjudication-required`, `review-group-mismatch`,
  `review-group-duplicate-member`, `review-group-unreadable-member`, `review-adjudication-invalid`,
  `review-adjudication-result-mismatch`, `review-not-run-not-rejectable`, `review-gap-not-rejectable`,
  `review-blocking-not-rejected`, `review-rejection-unbound` 중 하나와 기존 `FAIL review receipt`·`delivered non-PASS review`
  사유로 거부됩니다.

- Reviewer의 `settle --task` `observationErrors`나 그 reviewer를 연결한 builder 완료에 `review-input-changed:<path>`,
  `review-input-manifest-changed`, `review-input-manifest-missing`, `review-input-manifest-invalid` 중 하나가 있습니다. 그룹
  구성원이면 사유 뒤에 구성원 task id가 괄호로 붙습니다.
- Parent reviewer의 `settle --task` `observationErrors`에 `review-requirements-changed`가 있습니다.
- Read-only subject(쓰기 범위 없음)를 review하려는데 다음 중 하나로 거부됩니다.

  ```text
  subject response artifact does not match the settled response
  read-only subject review needs its response artifact
  writer subject response is not review input
  records[<n>]: RED record needs purpose "red" and an integer expectedExit from 1 to 255
  ```

- `settle --task <reviewerTaskId> --judgment <file>`이 `parent-adjudication: this reviewer has no native subject`로 거부됩니다.
- reviewer PASS를 연결해 builder를 완료하려는데 다음 중 하나로 거부됩니다.

  ```text
  subject has an unsettled or released review attempt: <taskId>
  subject has a review dispatch not observed by hooks: <taskId>
  review dispatch check unavailable: <reason>
  subject has a review whose child transcript changed after settlement: <taskId>
  unreadable native task: <taskId>
  ```

## 원인

- `nativeRequest.issuedAt`부터 `expiresAt`까지는 최대 30분입니다. 넘으면 model policy가 `invalid-input`으로 거부하고,
  입력 필드 사유는 `binding-lifetime-exceeds-30m`입니다.
- 선택 근거(`selectionBasisRef`)와 fact `sourceRef`는 영문자·숫자로 시작하고 `#`·`//`·`.`·`..` 경로 조각을 쓸 수 없습니다.
  숨김 디렉터리 경로처럼 `.`으로 시작하는 참조는 `unsafe-reference:<field>`입니다.
- Task의 `impactRisk`가 intake가 판정한 요청 risk보다 낮으면 `risk-downgrade`입니다.
- Task `readScope`가 빈 배열이면 model policy가 `invalid-input`으로 거부합니다. 쓰기 task도 읽을 경로를 하나 이상 적습니다.
- Task `facts`에는 kind별 필수 fact가 모두 있어야 하며, 빠지면 `required-facts`입니다. 필수 fact는 model policy 기준으로 다음과
  같습니다.

  | kind      | 필수 fact                                                                                             |
  | --------- | ----------------------------------------------------------------------------------------------------- |
  | `extract` | `source-bound`, `fixed-input`, `single-step`, `output-schema`, `acceptance`, `independent-check`      |
  | `read`    | `source-bound`, `bounded-scope`, `acceptance`, `oracle`, `independent-qa`                             |
  | `build`   | `source-bound`, `bounded-scope`, `acceptance`, `oracle`, `independent-qa`, `regression`, `one-writer` |
  | `review`  | `source-bound`, `bounded-scope`, `acceptance`, `oracle`, `independent-qa`, `fresh-context`            |

- Effort는 역할 파일의 `effort`가 정합니다. 등록은 그 값(`medium`·`high`·`xhigh`)을 기대값으로 기록하고, 없거나 다른 값이면
  `invalid-role-effort`입니다. Model policy는 impact `high` build에 `complex-critical`의 `knu_executor_xhigh`만 허용하고,
  `knu_executor_xhigh`는 `complex-critical` build에서만 허용합니다. `knu_explorer_xhigh`는 `bounded-extraction`과 거기서 결속한
  1단계 재시도(`bounded-standard`)에서만 허용합니다. 어긋나면 `effort-tier`입니다. `bounded-extraction`은 `knu_explorer_xhigh`만
  받아 `knu_explorer`는 `role`이고, `knu_explorer_xhigh`는 kind `extract`만 받아 그 밖은 `kind-role`입니다.
- 추출(kind `extract`)은 impact `low`·complexity `bounded`·uncertainty `resolved`일 때만 독립 QA 없이 등록됩니다. 어느 profile이든
  그 밖의 추출과 다른 kind는 `reviewDisposition.required:true`나 연결된 review가 없으면 `independent QA required for this profile`입니다.
- Effort 판정은 `completion.json`에 고정하지 않고 `settle`·`complete`가 관측할 때마다 child transcript의 assistant 행 `effort`로
  합니다. Foreground 완료는 PostToolUse가 기록한 child transcript 위치를, background 완료는 정산한 transcript를 읽습니다.
  - `effort-transcript-pending`: transcript가 없거나 마지막 행이 미완성이거나 assistant 행이 아직 없습니다. Host가 transcript를
    비동기로 기록하므로 완료 직후에 나올 수 있습니다. Task 수명(`expiresAt`)이 지나도 그대로면 effort 미지원 모델을 포함해
    `effort-unobserved`가 됩니다. 판정은 기록되지 않고 관측마다 다시 계산되므로, 그 뒤 transcript가 나타나 오류가 사라져도
    한 번 수명 만료 판정을 받은 task의 결과는 쓰지 않습니다.
  - `effort-transcript-foreign`: 경로·세션·child·prompt·모델이 등록과 맞지 않습니다.
  - `effort-transcript-too-large`: child transcript가 한도(`CHILD_TRANSCRIPT_BYTE_LIMIT`, 32 MiB)를 넘습니다. 한도는 메모리
    보호이며, 그 아래에서는 크기와 관계없이 모든 행을 검사합니다.
  - `effort-unobserved`: assistant 행에 `effort`가 없습니다. 이미 기록된 행은 바뀌지 않습니다.
  - `effort-mismatch`: 관측 effort가 역할 파일의 기대값과 다릅니다. 모델 능력표 `CLAUDE_MODEL_CAPABILITIES`가 effort 미지원으로
    둔 기대 모델(exact ID)만 transcript를
    읽은 뒤의 `effort-unobserved`와 이 사유를 판정하지 않고 관측값만 남깁니다.
- 공통 intake가 모든 한국어 조사 표현을 읽기 intent로 분류하지는 않습니다. `조사해줘`·문장 끝 `조사`는 `analyze`지만
  `살펴봐줘`·`확인해줘`, `원인` 없이 쓴 `파악해줘`처럼 인식하지 않는 표현은 `unknown`으로 남습니다.
- 공통 PASS 규칙은 `notRun`·`knownGaps`·coverage gap이 하나라도 있으면 PASS를 거부합니다. 읽기 전용 reviewer에게 검증 명령을
  실행하지 말라고 하면서 실행 결과 칸을 비우게 하면, 실행하지 않은 검증이 `notRun`으로 들어가 PASS가 거부됩니다.
- 읽기 전용 reviewer는 packet의 runner(`authority.runnerOwner`)가 될 수 없습니다.
- Helper가 만든 review는 결과 template(runner 기록 포함)을 등록 prompt에 결속합니다. Reviewer 결과의 `commandsActuallyRun`이
  그 기록과 하나라도 다르면(추가·삭제·변경) 정산을 거부합니다.
- `parent-adjudication` reviewer는 native subject가 없어 `settle --judgment`로 정산할 수 없습니다.
- Read-only subject의 응답은 helper가 `subject-response.txt`에 한 번 쓰고 reviewer 등록 때 정산된 응답과 대조합니다. 파일을 고치면
  거부됩니다. Writer subject의 응답은 builder 추론이라 read path에 넣을 수 없습니다. 다른 native task 기록은 대소문자를 바꾼 경로,
  symlink, `.artifacts` 아래에서 연결된 디렉터리, Parent subject 경로로도 `native task evidence is not review input`으로
  거부됩니다. `.artifacts` 밖 디렉터리 안의 symlink와 hard link는 탐지하지 않으므로 native 기록을 연결해 두지 않습니다.
- 리뷰 회차 입력: `--round`는 양의 정수이고, 2회차부터 `--previous-result`가 필요하며 1회차에는 줄 수 없습니다. 직전 결과는
  root 안의 일반 파일로 native task 기록이 아니며, verdict·findings가 있는 result JSON이거나 1회차 그룹의 `review-adjudication/v1`
  처분 기록입니다. 처분 기록이면 기록이 가리키는 result마다 같은 조건을 보고, 기록 자체가 validator 규칙을 어기면
  `previous-result-invalid: adjudication record <kind> <id>`입니다. `--criteria`는 `review-criteria/` 아래 있는 기준 문서 id 목록이거나
  `none` 하나입니다. `none`은 기준 문서 없이 리뷰하는 비교 측정(교정·baseline) 전용 값이고 필수 리뷰에는 쓰지 않습니다.
- Ignored 리뷰 입력: review snapshot은 tracked·비ignored 파일만 결속합니다. 그래서 helper는 reviewer read path 중 ignored read path
  아래 파일과 기록 위치(`.plans/`·`.artifacts/`·`.local-docs/`) 아래 ignored 파일(runner 출력, 2회차 직전 결과 포함)의 digest를
  `.artifacts/tools/claude-review-packets/<reviewId>.inputs.json`에 쓰고 prompt 마지막 줄 `KNU_REVIEW_INPUTS_FILE:<path> <sha256>`로
  결속합니다. `prepare`·`settle`·builder 완료가 reviewer의 read 범위에서 대상을 다시 계산해 대조합니다.
  - `review-input-stale: <path>`(등록)·`review-input-changed:<path>`(정산): 그 파일이 생기거나 사라지거나 바뀌었습니다.
  - `review-input-manifest-changed`: manifest 파일이 prompt의 digest와 다릅니다.
  - `review-input-manifest-missing`: 대상 ignored 입력이 있는데 prompt에 줄이 없습니다. Lead가 줄을 지운 spec, 줄을 쓰기 전 helper로
    만든 reviewer, `register --input` 직접 등록이 해당합니다. Native subject review는 runner 출력이 늘 대상이라 이전 helper로 만든
    reviewer를 지금 정산하거나 builder에 연결하면 이 사유가 먼저 나옵니다.
  - `review-input-manifest-invalid`: 줄 형식이 틀리거나, 경로가 helper 디렉터리 밖이거나, manifest를 읽을 수 없거나 JSON이 아닙니다.
  - `review-input-too-large`: 대상이 2,000개, 파일 하나가 8 MiB, 합계가 32 MiB를 넘습니다.
  - `review-input-path-case`: read path가 저장된 이름과 대소문자만 다릅니다. 대소문자를 무시하는 파일 시스템은 그 경로로 파일을 읽어 주지만
    Git은 아무것도 내지 않아 결속이 비게 되므로 거부합니다.
  - 그 밖의 비ignored 디렉터리 안 ignored 파일(package 의존성·build 산출물), symlink가 가리키는 파일의 내용(링크 문자열만 결속),
    runner가 실행된 시점의 입력은 결속하지 않습니다.
- Reviewer prompt 기록: `review`는 reviewer마다 prompt의 sha256을 `.artifacts/tools/claude-review-packets/<reviewId>.prompt.json`에
  한 번 쓰고, registry는 모든 `knu_reviewer` 등록에서 그 기록과 prompt를 대조합니다. Review id는 native subject면 packet id
  `review-<reviewId>`, Parent subject면 prompt의 `KNU_REVIEW_PACKET_FILE:` 경로에서 얻습니다.
  - `review-prompt-changed`: 등록한 prompt가 `review`가 만든 prompt와 한 글자라도 다릅니다. Spec의 prompt를 손으로 고쳤거나 다른
    구성원의 기록과 섞인 것입니다.
  - `review-prompt-unbound`: 기록이 없거나 review id를 얻을 수 없습니다. Prompt에서 packet 파일 줄을 지웠거나, 기록 파일을 지웠거나,
    `review` 없이 만든 prompt를 직접 등록한 것입니다.
- Parent subject 입력: `paths`의 `.omc/`·`.omx/`·`.codex/state/`·`.claude/projects/` 아래 경로, Home(`~`) 경로, 절대 경로는 host·세션
  상태라 `local-state-path:<path>`로 거부합니다. 추적 `.claude/` 설정·skill·역할 파일은 해당하지 않습니다. `request`에 완료형 구현
  서술 문장(`고쳤다`·`구현했다` 등)이 있으면 `request-implementation-marker` 경고와 packet `evidence.environment`의 문장 수만 남고
  리뷰는 진행됩니다. 걸린 문장은 packet `objective`(request 요약)에 그대로 남습니다.
- `requirementSections`: plan의 지정 절만 `<reviewId>.requirements.md`로 잘라 reviewer read path에 넣습니다. Heading은 `#`를 뺀
  정확한 문자열이며 code fence 안 줄은 heading이 아닙니다. 없으면 `requirement-heading-missing`, 두 번 이상이면
  `requirement-heading-duplicate`, root 안의 일반 파일이 아니면 `requirement-path-unreadable`, 형식이 `[{path, headings}]`가 아니면
  `requirementSections-invalid`, `paths`가 그 plan이나 그 위 디렉터리를 가리키면 `requirement-path-in-paths`입니다. 정산은 등록한 prompt나
  read 범위가 추출을 가리킬 때 추출이 prompt 기록의 digest와 다르거나 기록이 없으면 `review-requirements-changed`입니다.
- RED 기록은 `purpose:"red"`와 1~255의 `expectedExit`를 함께 가져야 합니다. 실패한 프로세스 exit는 이 범위뿐이므로 한쪽만 있거나
  다른 값이면 거부합니다.
- builder 연결은 같은 subject를 검토한 **모든** reviewer의 결과를 확인합니다. 아직 결과가 기록되지 않은 reviewer(`unsettled`),
  hook이 기록하지 않은 reviewer 호출(hook 장애 중 재호출 등), 읽을 수 없는 세션 transcript, 정산 뒤 재개된 reviewer, 손상된 task 기록은
  FAIL을 숨길 수 있으므로 PASS 연결을 막습니다. 다른 checkout에서 복사된 기록(task.json의 `root`가 이 checkout과 다른 절대 경로 문자열)은 이
  subject를 가리키지 않으면 이 subject의 리뷰일 수 없어 건너뜁니다. 비었거나 깨졌거나 `root`가 없거나 절대 경로가 아닌 기록, symlink, 이 subject를 가리키는 복사본은
  `unreadable native task`로 막습니다.
- 1회차 그룹의 non-PASS 구성원은 Parent의 `review-adjudication/v1` 처분 기록이
  [builder 완료와 1회차 그룹](../../agent-workflows/adapters/claude-same-host-review.md#builder-완료와-1회차-그룹)의 조건을 모두
  만족할 때만 완료를 막지 않습니다. 그룹 밖 reviewer(PASS 포함), 같은 번호로 다시 보낸 구성원, 그룹 줄이 없는 단일 reviewer의
  FAIL은 처분 기록으로 마감하지 않습니다.

## 해결

- 등록 입력은 `pnpm claude:native prepare --spec <JSON file>`로 조립합니다. Spec은 Lead가 고른 role·profile·선택 근거·
  scope·acceptance·QA disposition·facts만 담고, helper는 수명(기본 15분, 최대 30분)·도구 목록·ID를 채워 register합니다.
  출력의 `dispatchAuthorized:false`는 host 권한이 아니라는 뜻입니다. 만료되면 새로 prepare합니다.
- 참조는 `plan:<Plan ID>/<절>`·`owner-request:<ID>`처럼 영문자로 시작하는 형식을 씁니다.
- `risk-downgrade`는 요청 risk를 낮추지 말고 task `impactRisk`를 요청 risk 이상으로 올리거나 요청을 나눕니다.
- `required-facts`·빈 `readScope`의 `invalid-input`은 원인 절의 kind별 필수 fact와 `readScope` 규칙대로 spec을 고칩니다.
- `effort-tier`는 high-risk build를 `knu_executor_xhigh`·`complex-critical`로 다시 prepare합니다. `knu_explorer_xhigh`의
  `effort-tier`는 Haiku 추출이면 `bounded-extraction`으로, Sonnet 추출·읽기면 `knu_explorer`로 다시 prepare합니다. Effort 변형은
  Opus build(`knu_executor_xhigh`)와 추출(`knu_explorer_xhigh`)에만 있습니다. `invalid-role-effort`는 역할 파일을 고치고 새 세션에서 관측한 뒤 위임합니다.
- `independent QA required for this profile`은 task 사실을 바꾸지 말고 `reviewDisposition.required:true`로 두고 review를 연결합니다.
- `effort-transcript-pending`은 잠시 뒤 `settle --task`를 다시 실행합니다. 나머지 effort 사유(`effort-transcript-too-large` 포함)는
  그 결과를 쓰지 않고 새 task로 다시 위임합니다. `effort-transcript-too-large`는 task를 나눠 다시 위임하고 transcript를 손으로
  추출해 정산하지 않습니다. 수명이 지난 뒤의 `effort-unobserved`도 결과를 쓰지 않습니다. `effort-mismatch`는 역할 파일의 effort를 무시하는 설정이 있는지 먼저 확인합니다(`CLAUDE_CODE_EFFORT_LEVEL`
  환경변수, effort 상한 설정, 역할 파일을 바꾼 뒤 재시작하지 않은 세션).
- 요청 문장은 분석·검토처럼 intake가 인식하는 동사로 씁니다. 분류를 우회하려고 intent를 직접 조작하지 않습니다.
- 검증 명령은 Parent(runner)가 실행하고 `pnpm claude:native review`로 packet을 만듭니다. `review --subject <taskId>`만 실행하면
  이번 회차의 `snapshotDigest`와 `logHeader`가 나옵니다. Runner는 `logHeader`를 검증 로그 첫 줄에 두고, 각 기록을
  `{command, exit, environment, observedResult, outputPaths, sourceDigest}`로 남깁니다(`sourceDigest`는 그 digest,
  `outputPaths`는 `.artifacts/` 아래). 이어서 `--runner-evidence <file> --basis <ref> --reviewer-model <model ID>`를 더하면
  packet·reviewer prompt·결과 template·reviewer spec이 나옵니다. 결과 template의 `commandsActuallyRun`은 runner 기록에서만
  채워지고 builder의 응답·추론은 packet에 들어가지 않습니다. Reviewer는 자신이 실행했다고 주장하지 않으며, 실행하지 않은 검증을
  PASS로 바꾸지 않습니다. 다른 회차의 digest나 추가 필드가 있는 기록은 거부됩니다.
- 수정 전 실패(RED)는 exit를 뒤집지 말고 `purpose:"red"`·`expectedExit`로 기록합니다. 기대와 같은 exit만 known failure에서
  빠지고, 다른 exit(0 포함)는 known failure로 남아 PASS를 막습니다.
- Read-only subject는 `review --subject <taskId>`로 그대로 review합니다. 응답을 Parent가 파일로 옮겨 `--parent-subject`로
  우회하지 않습니다. `subject response artifact does not match`는 artifact가 바뀐 것입니다. 손으로 고치지 말고 파일을 지운 뒤
  `review`를 다시 실행하면 정산된 응답으로 다시 씁니다.
- Parent가 직접 작성한 변경은 native subject task가 없습니다. `review --parent-subject <file> --session <session_id>`는 `settlement:"parent-adjudication"`을
  표시하고 QA가 필요한 일반 review task spec을 만듭니다. 이 reviewer는 `complete`로 PASS 정산되지 않습니다. Parent가
  reviewer의 `settle --task` 출력에서 `observationErrors`가 비었는지(effort 사유 포함)와 모델·변경 경로, finding 재현으로
  판정하고, `finalSnapshot`의 digest가 review `logHeader`의 digest와 같은지 확인합니다. `completion.json`의 `valid`만으로는
  판정하지 않습니다. Review를 만든 뒤 source가 바뀌면 `prepare`가 `review-snapshot-stale`로 거부합니다.
- Parent review의 settle `observationErrors`에 `review-packet-unread`가 있으면 reviewer가 prompt의 packet 파일을 성공적으로
  읽지 않은 것입니다. `review-packet-changed`는 packet 파일이 prompt의 digest와 다른 것입니다. `review-packet-missing`은 Parent reviewer spec의
  prompt에서 packet 파일 줄이 빠진 것입니다. 그런 prompt는 지금 등록부터 `review-prompt-unbound`로 거부되므로, Helper가 packet 파일 줄을 쓰기 전 버전으로 등록한 Parent reviewer를 지금 정산할 때 나옵니다. 세 사유 모두 결과를 쓰지 말고 파일을
  고치지 않은 채 `review`를 다시 실행해 새 reviewer로 재리뷰합니다. `review-requirements-changed`(requirement 추출이나 그 prompt 기록이
  바뀌거나 사라짐)도 같습니다.
- `review-prompt-changed`·`review-prompt-unbound`는 prompt나 기록을 고쳐 맞추지 않습니다. `review` 출력의 `reviewerSpec`(그룹이면
  구성원 각자의 spec)을 그대로 `prepare`하고, 바꿀 것이 있으면 `review`를 다시 만듭니다.
- `local-state-path`는 그 경로를 `paths`에서 빼고 리뷰 대상인 추적 파일만 줍니다. `request-implementation-marker` 경고는 `request`를
  요구사항 문장(사용자 요청·issue·plan acceptance)으로 고쳐 `review`를 다시 실행합니다. `requirement-heading-*`는 plan의 heading을
  `#`를 뺀 그대로 적거나, 같은 heading이 두 번 있으면 plan heading을 고유하게 만든 뒤 다시 실행합니다. `requirement-path-in-paths`는 그
  plan이나 디렉터리를 `paths`에서 빼고 판정 원본 절은 `requirementSections`로만 줍니다.
- `commandsActuallyRun` 불일치는 reviewer가 runner 기록을 바꾼 것입니다. 결과를 고치지 말고 새 reviewer로 다시 review합니다.
- `parent-adjudication` 거부는 정상입니다. `settle --task <reviewerTaskId>`로 관측만 정산하고 아래 Parent 판정 절차를 따릅니다.
- `unsettled`는 해당 reviewer의 완료 알림을 기다려 정산한 뒤 다시 연결합니다. 결과 없이 release했다면 되돌릴 수 없습니다.
- `unreadable native task`의 기록이 다른 checkout(지운 linked worktree 등)에서 복사된 것이면(task.json의 `root`가 이 checkout과 다른 경로) 그
  디렉터리를 저장소 밖 보관 절차로 `<archive>/artifacts/` 아래에 옮깁니다. `.artifacts/plans/`는 리뷰 입력 위치이고 리뷰 입력 검사는 옮긴
  native 기록을 알아보지 못하므로 그곳에 두지 않습니다. Worktree 증거를 가져올 때 runtime 기록을 가져오지 않는 규칙과 보관 절차는
  [Local artifacts](../../../../.artifacts/README.md#배치-규칙)입니다. 이 checkout의 기록이면 아래와 같습니다.
- 나머지 builder 연결 거부는 기존 결과를 신뢰할 수 없다는 뜻입니다. 기록을 고치거나 지우지 말고, hook을 확인한 뒤 새 builder task와
  새 review로 해소합니다.
- FAIL은 review 완료입니다. Finding을 판정하고 수정한 뒤 새 builder task와 새 review로 해소합니다. 다른 reviewer의 PASS를
  연결해 FAIL을 덮을 수 없습니다. 예외는 1회차 그룹에서 Parent가 재현해 기각한 non-PASS 구성원뿐입니다.
- 회차 입력 거부: `--round <N>`을 줍니다. 2회차부터는 직전 회차 result 파일이나 처분 기록을 `--previous-result`로 주고,
  1회차에는 빼고 `--criteria`의 빈 목록·중복·없는 id와 `none`을 다른 id와 섞은 목록을 고칩니다. 처분 기록이 가리키는 result 파일을 고쳐 맞추지 말고 기록의 경로를
  고칩니다.
- `review-input-*`는 입력을 되돌려 맞추지 않습니다. 그 reviewer 결과를 쓰지 말고 `review`를 다시 만들어 새 reviewer로 재리뷰합니다.
  이전 helper로 만든 reviewer의 `review-input-manifest-missing`도 같습니다. 재발을 막으려면 `review` 생성부터 그 reviewer 정산과
  연결 builder 완료까지 리뷰 입력인 ignored 경로를 바꾸지 않고, 정산 뒤 쓰는 result·처분 기록·재현 로그는 리뷰 read path 밖에
  둡니다. `review-input-too-large`는 read path를 좁히고, `review-input-path-case`는 read path를 저장된 대소문자로 고칩니다.
- 1회차 그룹 입력 거부: 구성은 1회차에만, 인원은 2·3명, `--composition`과 `--reviewers`는 함께, `e3`는 `--criteria`와 함께 줍니다.
  `e3`는 기준 항목을 나누므로 `--criteria none`과 함께 쓸 수 없습니다(`composition-e3-criteria-required`).
  `criteria-items-too-few`는 고른 기준 문서의 항목이 인원보다 적은 것이므로 인원을 줄이거나 `e2`를 씁니다.
  `unsafe-reference:selectionBasisRef`는 `--basis`를 `plan:<Plan ID>/<절>`처럼 영문자로 시작하는 형식으로 고칩니다.
- `review-adjudication-required`·`review-adjudication-invalid`·`review-adjudication-result-mismatch`는 처분 기록을 고칩니다. 기록은
  round 1이고, 결과를 전달한 구성원을 모두 `reviews`에 두며, 각 `resultPath`는 전달된 result를 그대로 저장한 파일입니다. Result
  파일을 고쳐 맞추지 않습니다.
- `review-adjudication-invalid: duplicate-result-id`는 구성원이 `m<i>-` id 접두 지시를 어겨 두 result에 같은 finding id가 있는
  것입니다. 기록이나 result를 고쳐 풀 수 없으므로 native 경로는 새 builder task와 새 review로 갑니다. Parent 경로는 구성원마다
  기록을 하나씩 쓰고(구성원 사이 `duplicateOf` 없음) 그 사실을 처분 요약에 적습니다.
- `review-blocking-not-rejected`는 기각하지 않은 blocking finding이 남은 것이고, `review-rejection-unbound`는 기각 근거가 같은
  snapshot의 재현 로그가 아닌 것입니다. 재현 실행을 첫 줄이 builder snapshot의 `logHeader`인 `.artifacts/` 로그로 남기고 `reason`에
  backtick 경로로 적습니다. 리뷰 전 runner 출력은 다른 경로 표기나 같은 bytes의 사본으로도 근거가 되지 않습니다. 재현되면 기각하지 말고 수정한 뒤 새 builder task로 갑니다.
- `review-gap-not-rejectable`·`review-not-run-not-rejectable`·`review-group-mismatch`·`review-group-duplicate-member`·
  `review-group-unreadable-member`(결과가 JSON result가 아니거나 receipt를 읽을 수 없는 non-PASS 구성원)는 처분으로 풀 수 없습니다. 새 builder task와 새 review로 해소합니다.

## 복구 등록 거부

실패한 task를 다시 위임하는 등록은 spec의 `recovery: {of: <첫 taskId>, cause}`로만 합니다. 이 절은 그 등록의 거부 사유를
다룹니다. Registry는 workflow를 준비하기 전에 복구 결속을 판정합니다. 그래서 `recovery-*` 사유는 `workflow not ready:` 없이
그대로 나옵니다. 형식 오류만 helper가 다른 spec 오류와 함께 `invalid prepare spec:`으로 보여 줍니다.

```text
recovery-cause: quota
recovery-not-bound: task facts differ from the first task
invalid prepare spec: recovery-format: {of: <first taskId>, cause}
```

복구 사유를 고친 뒤에도 일반 등록 사유(`workflow not ready: ...`)가 나올 수 있습니다. 거부된 등록은 아무것도 쓰지 않습니다.

- `cause`는 `result-error`, `omission`, `context-missing` 중 하나입니다.
- `result-error`와 `omission`은 사다리를 한 단계 올립니다. `context-missing`은 같은 profile과 role로 다시 등록하고(0단계)
  prompt에만 맥락을 더할 수 있습니다.
- 1단계는 `bounded-standard` + role R(Sonnet high)에서 `complex-critical` + 같은 R(Opus high)로 올립니다. R은 `knu_explorer`,
  `knu_researcher`, `knu_executor`입니다. 추출은 `bounded-extraction` + `knu_explorer_xhigh`(Haiku xhigh)에서 `bounded-standard` +
  같은 역할(Sonnet xhigh)로 올리는 1단계도 있습니다(kind `extract`).
- 2단계는 `complex-critical`의 `knu_executor`(Opus high)에서 `complex-critical`의 `knu_executor_xhigh`(Opus xhigh)로 올립니다.
  build에만 씁니다.
- 1·2단계 retry만 `critical-signal` 요건을 면제받습니다. 다른 admission 검사는 모든 등록에 그대로 적용됩니다.
- 같은 session과 같은 사실의 retry는 한 번만 등록됩니다.

### 사유와 다음 행동

사유는 아래 순서로 판정하고 처음 걸린 하나만 보고합니다. 위 사유를 고쳐도 아래 사유가 다시 나올 수 있습니다.

1. `recovery-cause`
   - 원인: `cause`가 위 세 값이 아닙니다. `register --input`에서는 문자열이 아닌 `cause`도 이 사유입니다. `prepare`에서는
     helper가 문자열이 아닌 `cause`를 먼저 `recovery-format`으로 거부합니다. `cause`나 `of`가 없으면 `recovery-format`입니다.
   - 다음 행동: spec을 고칩니다. 실패가 결과 오류인지, 누락인지, 맥락 부족인지 사실대로 고릅니다.
2. `recovery-not-bound`
   - 원인: `of`의 첫 task가 없거나, 다른 session의 task이거나, 첫 task와 사실이 다릅니다. 비교하는 사실은 request, `kind`,
     `impactRisk`, `complexity`, `uncertainty`, `childValue`, `owner`, `readScope`, `writeScope`, `acceptance`,
     `reviewDisposition`, `facts`입니다. 배열은 순서까지 같아야 합니다.
   - 다음 행동: spec을 고칩니다. `of`를 현재 session의 첫 `taskId`로 맞추고 위 사실을 첫 task와 같게 둡니다. 사실을 바꿔야 하면
     그것은 복구가 아니므로 `recovery` 없이 일반 등록으로 하고, 이름만 바꿔 상한을 초기화하지 않습니다.
3. `recovery-chain`
   - 원인: 첫 task가 이미 bound retry입니다. Retry의 retry는 없습니다.
   - 다음 행동: 멈추고 Owner에게 묻습니다.
4. `recovery-step`
   - 원인: 요청한 profile·role이 첫 task에서 올라가는 사다리 단계와 다릅니다. 단계를 건너뛰거나 그대로 두는 경우와
     `context-missing`인데 profile이나 role을 바꾼 경우가 해당합니다. `result-error`·`omission`은 올릴 단계가 없는 첫 task에서도
     이 사유입니다. `knu_reviewer`, `knu_executor_xhigh`, `bounded-standard`의
     `knu_explorer_xhigh`(결속 재시도), `complex-critical`의 `knu_explorer`·`knu_researcher`, build가 아닌 `complex-critical`의
     `knu_executor`에는 올릴 단계가 없습니다.
   - 다음 행동: 사다리 단계에 맞춰 spec의 profile·role을 고칩니다. 올릴 단계가 없으면 멈추고 Owner에게 묻습니다.
5. `recovery-not-ran`
   - 원인: 첫 task의 실행 관측이 유효하지 않습니다. `attempt.json`이나 `completion.json`이 없거나, 저장된 관측이 유효하지
     않거나, 지금 관측에 오류가 있거나, 관측 effort가 역할 effort와 다릅니다. 모델 능력표가 effort 미지원으로 둔 exact ID만 effort
     검사에서 제외됩니다. 괄호 안에
     관측 오류가 붙습니다. 첫 task 완료 뒤 working tree를 바꾸면(편집, commit, child 변경 되돌리기) 관측 오류가 생겨 이
     사유가 됩니다.
   - 다음 행동: 첫 task 완료부터 retry 등록까지 working tree를 바꾸지 않습니다. 첫 task를 먼저 정산합니다. 완료 알림 뒤 `settle --task <첫 taskId>`를 실행하고 `observationErrors`를 읽습니다.
     `effort-transcript-pending`이면 잠시 뒤 다시 정산합니다. 정산 뒤에도 오류가 남으면 첫 task는 복구 대상이 아닙니다. 위
     해결 절의 사유별 절차를 따르고 Owner에게 묻습니다. Dispatch 없이 release한 task도 실행되지 않았으므로 복구 대상이 아닙니다. 실행·관측된 task라도 `release`하면 무효로 표시되어
     이 사유가 됩니다. 관측된 1차 task는 `release`하지 말고 정산합니다.
6. `recovery-accepted`
   - 원인: 첫 task의 `accepted.json`이 있습니다. 유효한 `complete`가 이미 결과를 채택했습니다.
   - 다음 행동: retry하지 않고 채택된 결과를 씁니다. 더 바꿀 것이 있으면 새 요청으로 다룹니다.
7. `recovery-used`
   - 원인: 이 session과 사실의 marker가 이미 있어 한 번뿐인 retry를 썼습니다. 같은 사실의 첫 task가 둘이어도 retry는 하나를
     공유합니다. 대체된(superseded) 첫 task는 `recovery-step` 다음에 바로 이 사유로 보고합니다. Retry가 그 뒤 파일을 바꿔도 같습니다.
   - 다음 행동: 멈추고 Owner에게 묻습니다. 새 이름으로 다시 등록하지 않습니다.

### 형식 오류와 hook 거부

- `recovery-format`: `recovery`가 `of`·`cause` 두 키의 객체가 아니거나 `of`가 task ID 형식이 아닙니다. `cause`나 `of`가 빠진
  경우도 여기에 속합니다. `prepare`에서는 helper가 문자열이 아닌 `cause`까지 `invalid prepare spec: recovery-format: ...`으로
  거부합니다. `register --input`의 최상위 `recovery`는 registry가 같은 이름으로 거부하지만, 문자열이 아닌 `cause`는
  `recovery-cause`로 보고합니다. Spec을 고칩니다.
- `recovery-unregistered`: 등록 입력의 `nativeRequest.task.recovery`를 registry가 쓰지 않았습니다. 직접 적은 값은 registry가
  묶은 값과 같지 않으면 거부됩니다. 그 필드를 지우고 spec의 `recovery`로 `prepare --spec`을 다시 실행합니다.
- PreToolUse의 `recovery binding mismatch` 거부: 첫 task의 `recovery.json`이 이 retry를 가리키지 않습니다. 기록이 지워졌거나
  바뀐 것입니다. 이 retry는 등록될 때 이미 marker를 썼으므로 다시 등록해도 `recovery-used`입니다. 기록을 고치거나 지우지 말고
  아래 절처럼 Owner에게 넘깁니다.

### 등록된 retry가 실행되지 않은 경우

retry가 등록된 뒤에 실행되지 않아도 한 번뿐인 retry는 이미 썼습니다. 결속 만료, 입력 파일 변경, 오래된 workflow, 주입 실패로
task가 이미 시도된 상태가 이에 해당합니다. 첫 task는 이미 대체되어 더 완료할 수 없습니다. 다른 retry를 등록하지 말고 Owner에게
넘깁니다.

### 기록과 상한

- 유효한 `complete`는 `accepted.json`을 씁니다.
- Bound retry는 다른 등록 검사가 모두 통과한 뒤에만 다음 순서로 씁니다. 먼저 `.artifacts/tools/claude-native/recovery/<sessionId>/<fact digest>.json`
  marker를, 그다음 첫 task의 `recovery.json`을, 그다음 retry의 `task.json`을 쓰고 마지막으로 첫 task를 대체됨으로
  표시합니다(`observation-error.json`의 `superseded-by-recovery`).
- Registry는 bound retry의 상한만 강제합니다. `recovery` 없이 같은 사실로 다시 등록하면 일반 admission을 받고 면제는 없습니다.
  그 상한은 [orchestration.md](../../agent-workflows/orchestration.md)의 "이름만 바꾼 새 task로 상한을 초기화하지 않습니다"를
  따르는 Lead 운영 규칙입니다.
- 실패한 Agent 호출(PostToolUseFailure)은 확인된 model이 없습니다. 관측에 `effective-model-mismatch`가 남으므로 retry에 묶을 수
  없고 등록은 `recovery-not-ran`으로 거부됩니다. 다음 행동은 Lead와 Owner가 원인을 보고 정합니다.

## 검증

```bash
node --test scripts/ci/agents/claude/claude-native-session.test.mjs scripts/ci/agents/claude/claude-native-session-evidence.test.mjs scripts/ci/agents/claude/claude-native-task-helper.test.mjs scripts/ci/agents/claude/claude-subagent-model-routing.test.mjs scripts/ci/agents/common/cross-model-handoff-contract.test.mjs
```

`registration names the concrete policy reason`과 `claude-native-task-helper.test.mjs`의 prepare·review·Parent-authored 테스트가
등록 사유 표시, runner 기록 형식, `parent-adjudication` 경로를 고정하고, `a helper-built review cannot add, drop or change
runner records`가 runner 기록 결속을 고정합니다.
`read-only reviewer cites runner-owned checks`, `reviewer registration rejects the reviewer as runner`,
`a reviewer FAIL receipt cannot be bypassed` 테스트가 위 규칙을 고정합니다. 1회차 그룹은 `a group FAIL rejected with a bound
reproduction log`, `only the members of one first-round group`, `a first-round composition builds one frozen review per member`
테스트가 고정합니다. 회차 입력과 ignored 리뷰 입력은 `a review names its round`, `round 2 takes an adjudication record`,
`a review binds the bounded ignored inputs`, `a changed, added, deleted or relinked ignored input`,
`a missing, misplaced, unreadable or other manifest`, `a read path in another case than its stored name`,
`builder completion judges the manifest of every delivered group member`
테스트가 고정합니다. Effort·QA 규칙은
`high-risk builds require the xhigh executor`, `extract QA exemption keeps the low, bounded, resolved range`,
`the capability table lists effortless exact IDs`, `a Haiku ID with effort support is held to the role effort`,
`a Haiku first task with effort support binds a retry only after running at the role effort`,
`bounded-extraction takes only the xhigh explorer`, `the xhigh explorer works in bounded-standard only as a bound extraction retry`,
`the xhigh explorer never takes a repository read`, `a bound extraction retry climbs to bounded-standard in the same role`,
`registration binds the role effort`, `foreground effort matches, mismatches or stays unobserved`,
`a foreground transcript written after PostToolUse is pending`, `a Parent-judged reviewer whose effort differs`,
`a child transcript over the limit is refused` 테스트가 고정합니다. Read-only subject와 RED 기록은
`a read-only subject is reviewed from its bound response`, `a changed response artifact is refused`,
`other native task evidence never enters a review read path`, `a RED record passes only at its declared expected exit`
테스트가 고정합니다. Builder 연결 거부는 `hook-less retry`,
`each reviewer session transcript`, `settled sibling review resumed`, `foreground-completed reviewer cannot be resumed`,
`a task copied from another checkout blocks a linked builder only when it may be its review` 테스트가 고정합니다. Reviewer
prompt 기록과 Parent subject 입력은 `registration refuses a reviewer prompt that is not the one review recorded`,
`a native reviewer registers only with the prompt its review recorded`, `each first-round group member registers only with its own recorded prompt`,
`a Parent subject path into local state is refused`, `a request that narrates the implementation warns`,
`requirementSections hands the reviewer only the named plan sections`, `requirementSections refuses a missing or repeated heading`,
`a Parent subject path naming the extracted plan or a directory above it is refused`,
`a requirement extract changed after the review` 테스트가 고정합니다.

## 참고

- [독립 review disposition](../../agent-workflows/qa.md)
- [Claude Code adapter의 same-host 독립 review](../../agent-workflows/adapters/claude-same-host-review.md)
