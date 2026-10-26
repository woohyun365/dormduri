# Workspace layout manifest

작업 공간 root(계획 문서, 계획 진행 증거, script 출력, host·overlay runtime state, 제품 문서)의 위치와 성격은 manifest
두 파일이 값으로 가진다. 이 문서는 필드 의미와 그 값을 쓰는 검사만 설명한다. 각 root의 배치·lifecycle 규칙 원본은
manifest의 `ruleOwner`가 가리키는 문서(`.artifacts/README.md`, [Session continuity](./session-continuity.md), `.gitignore` 등)가
그대로 소유한다.

- [core 기본 manifest](../../../scripts/artifacts/workspace-layout.core.json)(`htc-workspace-layout-core/v1`): consumer
  저장소의 logical root와 기본 경로, 보존 어휘, 생성 주체 어휘. 이 저장소 이름은 넣지 않는다.
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
| `nestedState`       | 하위 디렉터리에 생기면 시작 위치 오류로 보는 runtime state root                                                                |
| `overridable`       | `KNU_ARTIFACTS_DIR`이 대체하는 root                                                                                            |

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
옮기거나 지우지 않는다.

| kind                      | 판정                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `nested-runtime-state`    | `nestedState` root 이름이 저장소 root 밖 하위 디렉터리에 생김                                                                                   |
| `retired-root`            | binding `retiredRoots`의 옛 top-level 이름                                                                                                      |
| `outside-manifest-root`   | top-level 이름이 manifest root·표식, 추적 top-level 이름, `guardExclusions` 어디에도 없음. 추적 top-level 디렉터리 안의 중첩 항목은 보지 않는다 |
| `plans-non-markdown`      | `markdown-only` root 안의 Markdown 밖 파일                                                                                                      |
| `artifacts-unknown-child` | `{ names }` root의 첫 단에 목록·`trackedFiles` 밖 이름                                                                                          |
| `undeclared-plan-id`      | `declared-plan-id` root의 첫 단 이름이 계획 문서 header에 선언된 Plan ID가 아님                                                                 |
| `gitignore-mismatch`      | root의 `tracking`, `trackedFiles`, `marker`가 `git check-ignore --no-index` 결과와 다름                                                         |

`guardExclusions`는 추적 `.gitignore`의 비agent 규칙 중 top-level에 생길 수 있는 것이다. 경로가 추적 top-level
디렉터리 안으로 고정된 규칙은 넣지 않는다. test가 `.gitignore`와 이 목록을 양쪽으로 대조한다.

## 일치 test

[`workspace-layout.test.mjs`](../../../scripts/artifacts/workspace-layout.test.mjs)가 root 이름을 literal로 가진 code를
manifest에 묶는다.

- 이름 있는 상수: plan-store `PLAN_ROOT`, `paths.mjs` 기본 위치, Codex hook 기록·registry 위치, 리뷰 입력 결속 root
  목록, CI 분류기의 작업 공간 목록, Codex context 경로의 root가 manifest 값과 같아야 한다.
- root literal scan: 추적 script·설정(`apps/`·`packages/`, test, fixture, manifest 제외)에서 root 이름이 들어간 줄마다
  literal이 manifest root 경로와 같고 binding `rootLiteralAllowlist`에 (파일, 줄 내용) 그대로 있어야 한다. 줄 전체 주석,
  속성 접근(`value.name`, `value?.name`)과 spread identifier는 literal이 아니고, escape한 regex 안의 root 이름은 literal이다.
- 허용 목록 항목은 `file`, `text`(앞뒤 공백을 뺀 줄), `count`(같은 줄이 여러 번일 때), `category`, `transition`(그 literal을
  manifest 읽기로 바꿀 단계, 단계를 소유한 계획은 `rootLiteralTransitionPlan`)이다. 새 literal, 바뀐 줄, root 이름 변경은
  목록을 함께 고치지 않으면 실패한다.
