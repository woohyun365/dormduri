# Local artifacts

이 디렉터리는 계획 진행 증거와 저장소 script 출력의 공통 위치다. 특정 개발 도구·host의 설치 여부와 무관하며
production runtime에서는 사용하지 않는다. 내용은 Git에서 제외하고 이 README와 `.gitignore`만 추적한다.

```text
.artifacts/
├── plans/<umbrella Plan ID>/<bounded Plan ID>/<phase|YYYY-MM-DD>/  # 계획 진행용 script·log·json·diff·screenshot·review 입력
├── tools/<kind>/                                              # 저장소 script 기본 출력(build, infra, stress, ci-performance, claude-native …)
└── references/<source>/                                       # 디자인 등 외부에서 받은 참조 자료
```

## 배치 규칙

- **계획 문서와 증거를 나눈다.** `.plans/`에는 계획 문서(Markdown)만 둔다. `.plans/supporting/`도 부모 계획에 딸린
  상세·reference·하위 계획 문서만 소유한다. 계획을 진행하며 만든 script, log, JSON, diff, screenshot, review 입력은
  `plans/…` 아래에 둔다. `.plans` lifecycle은
  [Session continuity](../docs/development/agent-workflows/session-continuity.md)가 소유한다.
- **Plan ID 두 단.** 첫 단은 가장 위 active index(umbrella)의 Plan ID, 둘째 단은 증거를 소유한 bounded plan의
  Plan ID다. umbrella 자신의 증거는 `plans/<umbrella>/<umbrella>/`, umbrella가 없는 단독 계획은
  `plans/<Plan ID>/<Plan ID>/`에 둔다. 더 깊은 계획 계층은 bounded 단으로 평탄화하고 그 아래는 phase나 날짜로 나눈다.
- **script 출력.** repository script는 `scripts/artifacts/paths.mjs`의 `resolveArtifactPath()`로 `tools/<kind>/`에
  쓴다. `KNU_ARTIFACTS_DIR`은 이 `tools` 기본 위치를 대체하며, 각 command의 명시적 `--output`·전용 환경변수도
  사용할 수 있다.
- **CI.** GitHub Actions는 checkout 내부가 아니라 `${{ runner.temp }}`에 evidence를 생성한 뒤 Actions artifact로
  업로드한다.
- **secret 금지.** token, cookie, password, DB URL, webhook 등 secret 원문을 기록하지 않는다.
- **저장소 밖 보관.** 끝난 증거는 삭제하지 않고 저장소 상위의 `Archives/<repo>/`(이하 `<archive>`)로 옮긴다.
  `<archive>`는 `<archive>/plans/`, `<archive>/artifacts/`, `<archive>/local-docs/`, `<archive>/design-history/`, `<archive>/code/`, `<archive>/_meta/` 공통 폴더와 `README.md`
  색인 하나를 가진다. 추적 문서는 `<archive>/<폴더>/<topic>`처럼 개인 절대 경로 없이 가리킨다.

## 보존과 정리

**명령을 다시 실행할 수 있다는 것과 당시 관측값을 다시 얻을 수 있다는 것은 다르다.** 확장자,
파일 나이, 완료된 작업의 디렉터리라는 이유만으로 삭제 가능 여부를 결정하지 않는다.

| 분류                        | 예시와 보존 조건                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 현재 입력                   | 진행 중인 검증의 baseline, 승인된 결정의 유일한 근거. 현재 caller와 다음 작업의 인계가 해소되기 전 유지                               |
| 재생성 가능한 출력          | generator/version, source commit·입력과 실행 명령이 확인된 schema·report. 재생성 확인, 필요한 참조 인계와 정리 권한 확인 후 제거 가능 |
| 역사적 관측 원본            | provider job log, incident, 당시 CI 시간·메모리 측정, 시각적 비교 결과. 재실행은 새로운 관측이므로 필요한 원본을 별도 보존            |
| 민감하거나 판단 불가한 자료 | 계정 캡처, credential 의심 파일, 소유권·재생성 방법이 불명확한 출력. 자동 열람·복사·압축·삭제를 보류하고 별도 disposition 확인        |

작업별 manifest 또는 기존 evidence summary에 owner/용도, source commit·수집 시점·도구 버전, 분류,
현재 참조, 보존 종료 조건과 다음 조치를 기록한다. 재생성 가능 분류에는 실행 명령과 필요한 비밀값 없는 입력
설명이 필요하다. 버전·입력이 없으면 재생성 가능하다고 추측하지 않는다. 민감 자료는 값 대신 필요한 최소
식별 정보와 보류 이유만 기록하며, 이름 자체에 민감값이 있으면 이름도 공개하지 않는다.

현재 실행 packet은 필요 기간 동안 로컬에 두되, 다음 세션에 필요한 결정은 기존 docs/Issue에, 구현·검증 근거는
PR/test/CI에 연결한다. [Session continuity](../docs/development/agent-workflows/session-continuity.md#portable-handoff)의
인계 경로는 private archive나 ignored 파일의 존재를 전제하지 않는다. 역사 원본은 별도의 보존 책임을 가지며
장기 문서가 현재 실행 입력으로 요구해서는 안 된다.

외부 보관은 승인된 정확한 경로·파일 명세로만 수행한다. private 접근을 먼저 확인하고 copy → 파일 수·bytes·hash
및 복원 검사 → 원본 불변·참조 해소 재확인 → 해당 원본만 제거하는 순서로 이동한다. symlink, 경로 이탈, 충돌,
동시 writer 또는 불명확한 권한은 보류하며 덮어쓰지 않는다. 같은 디스크의 archive는 독립적인 장애 backup이 아니다.
로컬 locator는 접근 제한된 보관 위치와 manifest를 가리킬 수 있지만, 개인 절대경로나 secret을 docs/Issue에 게시하지 않는다.

정리는 일괄 purge나 runtime state 정리 권한이 아니다. 원본 보존이 필요한 작업에서 standalone 삭제를 대안으로
사용하지 않으며, 보류 목록을 남긴다. host runtime 소유 자료는 해당 runtime의 문서화된 lifecycle과 확인된
작업 소유권을 추가로 요구한다. CI 결과는 기존 `${{ runner.temp }}`·upload-artifact 및 workflow retention을 따른다.
