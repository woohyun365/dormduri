# Workspace layout manifest

작업 공간 root(계획 문서, 계획 진행 증거, script 출력, host·overlay runtime state, 제품 문서)의 위치와 성격은 manifest
두 파일이 값으로 가진다. 이 문서는 필드 의미와 그 값을 쓰는 검사·생성만 설명한다. 각 root의 배치·lifecycle 규칙 원본은
manifest의 `ruleOwner`가 가리키는 문서(`.artifacts/README.md`, [Session continuity](./session-continuity.md), `.gitignore` 등)가
그대로 소유한다.

- [core 기본 manifest](../../../scripts/artifacts/workspace-layout.core.json)(`htc-workspace-layout-core/v1`): consumer
  저장소의 logical root와 기본 경로, 보존 어휘, 생성 주체 어휘, 작업 종류 layout, 저장소 모드와 추적 범위 guard 상한,
  추적 plan의 checkpoint 규칙. 이 저장소 이름은 넣지 않는다.
- [KNU binding](../../../scripts/artifacts/workspace-layout.knu.json)(`htc-workspace-layout-binding/v1`): core logical
  root를 이 저장소의 지금 이름에 대응시키고, 이 저장소에만 있는 root, tools kind, guard 입력을 더한다.

[`scripts/artifacts/workspace-layout.mjs`](../../../scripts/artifacts/workspace-layout.mjs)가 두 파일을 읽고 검증한다. module을
import할 때는 읽지 않고 값을 쓰는 함수 안에서 읽는다. hook 처리기가 이 module을 간접 import하므로, manifest가 없거나
깨져도 hook 경로에 JSON 읽기 실패가 생기지 않게 하려는 것이다.

## root 필드

| 필드                | 의미                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | root 식별자. 다른 필드·검사는 경로 대신 이 값으로 root를 찾는다                                                                |
| `core`              | binding에서, 대응하는 core logical root의 `id`                                                                                 |
| `path`              | 저장소 상대 POSIX 경로(`directory` 또는 `file`)                                                                                |
| `purpose`           | 그 root에 두는 것                                                                                                              |
| `ruleOwner`         | 배치·lifecycle 규칙을 소유한 추적 문서나 파일                                                                                  |
| `tracking`          | `tracked` 또는 `ignored`. `.gitignore`와 같아야 한다(guard가 대조)                                                             |
| `trackedFiles`      | ignored root 안에서 추적하는 파일(root 상대 경로)                                                                              |
| `trackedFilesOwner` | 추적 예외 목록을 `.gitignore`만 아는 root. override 대상에서 빠진다                                                            |
| `marker`            | overlay가 위치를 찾는 추적 표식 파일                                                                                           |
| `creator`           | 만드는 주체: `core-scaffold`, `host-adapter`, `overlay`, `human`, `repository-script`                                          |
| `children`          | 허용 하위 구조: `markdown-only`, `declared-plan-id`(첫 단이 계획에 선언된 Plan ID), `tool-kinds`, `{ names }`(첫 단 이름 목록) |
| `retention`         | 보존 분류(아래). 추적 root에는 두지 않는다(Git 이력이 보존한다)                                                                |
| `copy`              | 다른 checkout·worktree로 복사: `allowed`, `forbidden`, `unspecified`                                                           |
| `archive`           | 저장소 밖 보관 위치의 공통 폴더 이름(binding `archive.folders`)                                                                |
| `reviewInput`       | 리뷰 입력 결속 대상 root                                                                                                       |
| `nestedState`       | 하위 디렉터리에 생기면 시작 위치 오류로 보는 runtime state root(한 segment 경로)                                               |
| `overridable`       | `KNU_ARTIFACTS_DIR`이 대체하는 root                                                                                            |
| `modes`             | core에서, 그 tracked root가 있는 저장소 모드(`repositoryModes`). 없으면 모든 모드                                              |
| `ignorable`         | core에서, setup이 ignore로 바꿀 수 있는 tracked root                                                                           |
| `limits`            | core에서, 그 root 아래 추적 파일의 크기 상한: `fileBytes`(파일당), `totalBytes`(합계)                                          |
| `indexReadme`       | core에서, scaffold가 없을 때만 색인 README를 만드는 tracked 디렉터리                                                           |

## 보존

- `retention.class`는 `.artifacts/README.md` "보존과 정리" 표의 네 분류다: `current-input`(현재 입력),
  `regenerable-output`(재생성 가능한 출력), `historical-observation`(역사적 관측 원본),
  `sensitive-or-undetermined`(민감하거나 판단 불가한 자료).
- `retention.until`은 기계가 판정할 수 있는 종료 조건이다. `plan-closed`는 그 Plan ID의 계획이 terminal이나 archived로
  읽히는 것, `task-settled`는 host adapter가 그 task의 수락 표식을 남긴 것이다. 판정할 조건이 없는 root·kind에는 두지
  않는다. 파일 나이 조건은 없다.
- 재생성 가능 분류는 caller code가 generator·입력·실행 명령을 기록하는 것을 확인한 kind에만 둔다. 확인하지 못하면
  민감하거나 판단 불가한 자료다.
- 어휘를 바꾸면 schema id의 version을 올린다.

## tools kind

`toolKinds`는 `resolveArtifactPath()`가 첫 segment로 받는 kind마다 `retention`과 `overridable`을 둔다. 목록은 닫지
않는다. manifest에 없는 kind는 override를 따른다.

## 작업 종류

core의 `workKinds`는 계획 증거 phase 디렉터리(`<umbrella>/<bounded>/<phase|YYYY-MM-DD>/[<topic>/]`) 아래에 작업 종류마다
만들 디렉터리를 정한다. `id`, `purpose`, `directories`(phase 디렉터리 상대 template, 비면 phase 디렉터리 자체)이고,
template의 `{name}`은 `workNames`의 입력이다. `workNames`는 입력 이름마다 한 디렉터리 이름의 문법(앞뒤를 고정한
정규식)을 두며 `phase`·`topic`은 반드시 있다.

[`scaffold.mjs`](../../../scripts/artifacts/scaffold.mjs)(`pnpm scaffold -- <kind> --umbrella <Plan ID> --plan <Plan ID>
--phase <phase> [--topic <topic>] [--<입력> <값>…]`)가 binding root `artifact-plans` 아래에 이 디렉터리를 만든다. 계획
증거의 위치는 이 manifest root가 정한다. `resolveArtifactPath()`는 script 출력 위치(`tools/<kind>/`)만 계산하므로 scaffold는
그것을 쓰지 않는다.

- 디렉터리만 만들고 파일은 쓰지 않는다. 있으면 누락분만 만든다. 같은 입력이면 같은 경로를 만들고, 출력은 이번 실행에서
  만든 디렉터리 목록(`created`)만 첫 실행과 다르다. 그 뒤 실행의 출력은 같다.
- umbrella는 계획 문서 header에 선언된 Plan ID여야 하고(guard `undeclared-plan-id`와 같은 규칙) bounded는 Plan ID
  문법을 따른다. `workNames` 문법은 새로 만드는 디렉터리에만 적용하고 이미 있는 디렉터리의 역사 이름은 받는다.
- 모든 검사가 끝난 뒤에 만든다. 절대 경로, 경로 구분자(`/`·`\`와 Windows 드라이브 `:`), `.`·`..`, symlink를 지나는 경로,
  디렉터리가 아닌 기존 항목, 그 root를 ignore하지 않는 `.gitignore`는 거부한다.
- `--check`는 `.gitignore`와 맞지 않는 manifest ignored root를 layout guard와 같은 판정(`gitignore-mismatch`)으로
  보고하고 exit 1이다. `.gitignore`는 고치지 않는다.

## Consumer workspace

core `trackedScope.workspace` root(`.htc`)는 consumer 저장소의 workflow 상태 단일 root다. 추적은 default-deny이고 그 아래
tracked root(`.gitignore`, `config.json`, `baselines/`, `plans/`, vendored 모드의 `vendor/`)와 ignored root의 `trackedFiles`
(`.htc/artifacts/README.md`)만 추적한다. `plans`는 기본 추적이고 setup이 ignore로 바꿀 수 있다(`ignorable`). 이 저장소는 binding이
지금 이름을 대응시키고 `.htc`를 쓰지 않는다.

`pnpm scaffold -- consumer --mode <managed|vendored> [--plans tracked|ignored] --root <저장소>`가 core 값으로 consumer 저장소에
다음을 만든다. 이 저장소를 가리키면 거부한다.

- `.htc/.gitignore`: `/*` 뒤에 manifest 순서로 그 모드의 tracked root와 ignored root의 `trackedFiles`를 다시 연다. managed에는
  `!/vendor/`가 없고 `--plans ignored`는 `!/plans/`를 뺀다. 파일이 있고 규칙이 다르면 덮지 않고 거부한다.
- `indexReadme` 디렉터리(`docs/product/`, `docs/policies/`, `docs/architecture/`)의 `README.md`: 없을 때만 목적 제목, 같은
  규칙은 한 문서만 소유한다는 문장, 문서·상태·소유 규칙 색인 표를 만든다. 있으면 그대로 둔다.
- 경로가 symlink를 지나면 거부하고, 모든 검사가 끝난 뒤에 쓴다. 같은 입력이면 같은 결과이고 출력은 `created`·`kept`만 첫
  실행과 다르다. `config.json`(필드 schema `htc-config/v1`)과 `.htc/artifacts/README.md`는 만들지 않는다.

## Override

`KNU_ARTIFACTS_DIR`이 설정된 호출에서만 [`paths.mjs`](../../../scripts/artifacts/paths.mjs)가 manifest를 읽는다. hook
caller는 env `{}`를 넘기므로 읽지 않는다.

- `overridable: false`인 host runtime kind는 override가 있어도 checkout 안 기본 위치에 쓴다. 그 기록은 그 checkout에
  묶이고 리뷰 연결 판정이 그 위치를 읽는다.
- 저장소 밖을 가리키는 override는 허용한다(CI의 `runner.temp` 등).
- 저장소 안을 가리키는 override는 ignored root의 엄격한 하위만 허용한다. 그 root의 `trackedFiles`, `trackedFilesOwner`가
  있는 root, `markdown-only` root, root 자신과 저장소 root는 거부한다. 거부 메시지는 허용 root를 manifest 값으로 보여 준다.

## Layout guard

`pnpm check:fast`가 [`workspace-layout-check.mjs`](../../../scripts/git/workspace-layout-check.mjs)를 돌린다. 탐지만 하고
옮기거나 지우지 않는다. 아래 추적 범위 guard도 같은 실행에서 돈다.

| kind                      | 판정                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `nested-runtime-state`    | `nestedState` root 이름이 저장소 root 밖 하위 디렉터리에 생김                                                                                   |
| `retired-root`            | binding `retiredRoots`의 옛 top-level 이름(한 segment)                                                                                          |
| `outside-manifest-root`   | top-level 이름이 manifest root·표식, 추적 top-level 이름, `guardExclusions` 어디에도 없음. 추적 top-level 디렉터리 안의 중첩 항목은 보지 않는다 |
| `plans-non-markdown`      | `markdown-only` root 안의 Markdown 밖 파일                                                                                                      |
| `artifacts-unknown-child` | `{ names }` root의 첫 단에 목록·`trackedFiles` 밖 이름                                                                                          |
| `undeclared-plan-id`      | `declared-plan-id` root의 첫 단 이름이 계획 문서 header에 선언된 Plan ID가 아님                                                                 |
| `gitignore-mismatch`      | root의 `tracking`, `trackedFiles`, `marker`가 `git check-ignore --no-index` 결과와 다름                                                         |

`guardExclusions`는 추적 `.gitignore`의 비agent 규칙 중 top-level에 생길 수 있는 것이고 top-level 이름에만 적용한다
(manifest root 아래의 하위 규칙에는 적용하지 않아 `.DS_Store`도 보고한다). 경로가 추적 top-level
디렉터리 안으로 고정된 규칙은 넣지 않는다. test가 `.gitignore`와 이 목록을 양쪽으로 대조한다.

## 추적 범위 guard

[`tracked-scope.mjs`](../../../scripts/git/tracked-scope.mjs)가 index(stage된 내용)를 읽는다. layout guard가 함께 돌리고
`tracked scope: <파일 수> files, <bytes> bytes` 용량 줄을 출력한다. CI 보장은 repo-policy suite의 test가 이 저장소 index에
guard를 돌리는 것이다(새 workflow 단계 없음).

- 범위: core workspace root 아래 root, binding에서는 그에 대응하는 root와 core 대응이 없는 이 저장소 root, 그 root들의
  `marker`. 제품 문서 root는 보지 않는다.
- allowlist: ignored root의 `trackedFiles`, `marker`, tracked root 아래 추적 파일. `trackedFilesOwner` root의 추적 파일은
  `.gitignore`가 정하므로 강제 추적만 본다.
- 상한을 올리는 변경은 manifest PR로 리뷰한다.

| kind                      | 판정                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tracked-forced`          | 범위 안 추적 파일을 `.gitignore`가 ignore하거나(`git add -f`) ignored root의 `trackedFiles` 밖에 있음                  |
| `tracked-too-large`       | 가장 가까운 root의 `limits.fileBytes`, 없으면 core `trackedScope.fileBytes`(128 KiB)를 넘음. `vendor`는 파일당 256 KiB |
| `tracked-total-too-large` | root 아래 allowlist 합계가 `limits.totalBytes`(`vendor` 4 MiB)를 넘음                                                  |
| `tracked-binary`          | NUL byte가 있음                                                                                                        |
| `tracked-secret`          | 고정 pattern(private key, AWS·GitHub·Slack·Google·API key, URL 안 자격 증명)에 맞음. 값은 출력하지 않는다              |
| `checkpoint-*`            | tracked `plans` root 아래 Markdown이 아래 checkpoint 규칙을 어김                                                       |

### Checkpoint

core `checkpoint`는 consumer 추적 plan(`.htc/plans`)의 `## Checkpoint` 절 규칙이다. 이 저장소의 계획 root는 ignored라 대상이
아니다. [Plan authoring core](./plan-authoring/core.md#12-checkpoint-and-final-report) 12절의 세션 인계 checkpoint와 다른, plan
문서의 절 규칙이다.

- 항목은 실제 날짜만 담은 `- YYYY-MM-DD` bullet과 그 아래 `  - <필드>: <내용>` 줄이다. 필수 필드는 `상태`·`다음 행동`, 선택
  필드는 `결정`·`근거`(artifacts 링크)·`blocker`이고 이름은 manifest 값이다.
- 필드 하나의 줄 수는 필드 줄과 더 들여 쓴 이어지는 줄마다 렌더링 글자 수(링크 대상 `](…)`, `**`, backtick 제외)를
  `lineWidth`(100)로 나눠 올림한 합이고 `maxLines`(2) 이하다.
- kind는 `checkpoint-unknown-field`, `checkpoint-missing-field`, `checkpoint-field-too-long`, `checkpoint-malformed`(날짜가
  아닌 항목 bullet, 이름 없는 필드 줄, 한 항목에서 반복된 필드, 그 밖의 줄)다. 절은 다음 `#`·`##` heading에서 끝나고 fenced
  code 안의 heading은 절로 읽지 않는다.
- Status 줄, 일반 목록 항목 길이, context 분리는 guard 밖이다.

## 일치 test

[`workspace-layout.test.mjs`](../../../scripts/artifacts/workspace-layout.test.mjs)가 root 이름을 literal로 가진 code를
manifest에 묶는다.

- 이름 있는 상수: plan-store `PLAN_ROOT`, `paths.mjs` 기본 위치, Codex hook 기록·registry 위치, 리뷰 입력 결속 root
  목록, CI 분류기의 작업 공간 목록, Codex context 경로의 root가 manifest 값과 같아야 한다.
- root literal scan: 대상은 추적 `.mjs`·`.js`·`.ts`·`.cjs`·`.sh`·`.py`·`.json`·`.toml` 파일이다(`apps/`·`packages/`,
  test, fixture, manifest 제외). 찾는 이름은 `.plans`, `.artifacts`, `.local-docs`, `.codex/state`, `.omc`, `.omx` 여섯이고,
  이 이름이 들어간 줄마다 literal이 manifest root 경로와 같고 binding `rootLiteralAllowlist`에 (파일, 줄 내용) 그대로 있어야
  한다. 줄 전체 주석, 속성 접근(`value.name`, `value?.name`)과 spread identifier는 literal이 아니고, escape한 regex 안의
  root 이름은 literal이다. 그 밖 manifest root(`.claude`, `omx_wiki`, 제품 문서 root)는 scan하지 않는다. CI 분류기에 있는
  것만 이름 있는 상수 test가 본다.
- 허용 목록 항목은 `file`, `text`(앞뒤 공백을 뺀 줄), `count`(같은 줄이 여러 번일 때), `category`, `transition`(그 literal을
  manifest 읽기로 바꿀 단계, 단계를 소유한 계획은 `rootLiteralTransitionPlan`)이다. 새 literal, 바뀐 줄, root 이름 변경은
  목록을 함께 고치지 않으면 실패한다.
