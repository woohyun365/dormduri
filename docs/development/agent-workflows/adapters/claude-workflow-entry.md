# Claude workflow entry

[Claude Code adapter](./claude-code.md)의 `## Loading and scope` 세부입니다. Routine 순서는 진입 문서가 소유하고, 이 문서는
`CLAUDE.md` 진입, preflight snapshot과 workflow entry 진단, native 진단의 경계를 소유합니다.

## Preflight와 workflow entry 세부

`CLAUDE.md`는 `@AGENTS.md`를 import하고 이 adapter로 연결합니다. 현재 요청에 필요한 guide만 읽습니다.
공통 instructions를 역할 파일마다 복제하거나 전체 docs를 startup context에 넣지 않습니다.

```sh
pnpm claude:preflight -- --mode fresh
pnpm claude:workflow -- --mode fresh --request '변경 내용을 설명해줘.'
pnpm claude:preflight -- --mode resume --plan .plans/example-plan.md
pnpm claude:workflow -- --mode resume --plan .plans/example-plan.md --request '이 계획을 분석해줘.'
```

`claude/session-preflight.mjs`는 raw Git 상태와 명시적으로 선택한 공통 `.plans` reader를 소비합니다. Fresh는 계획
목록·memory·Claude Home 설정·OMC state를 직접 탐색하지 않습니다. 오류/unknown을 clean으로 바꾸지 않습니다. 미추적 일반 파일은 내용 digest로 결합하며(파일당8MiB/총32MiB),
ignored 입력은 Git fingerprint 밖입니다. Native task가 명시한 ignored 파일은 별도 inventory로 결합하지만 ignored 디렉터리 전체를 자동 조사하지 않습니다. 리뷰 task는 예외로, helper가 reviewer read path 중 ignored read path 아래와 `.plans/`·`.artifacts/`·`.local-docs/` 아래 ignored 파일을 manifest로 결속하고 등록·정산·builder 완료에서 다시 대조합니다([same-host 독립 review](./claude-same-host-review.md)). Codex 전용 `codex:preflight`를 대신 호출하지 않습니다.
현재 설정·loaded roles·실제 permissions는 별도 관측이 필요하고 Git hash가 이를 인증하지 않습니다.
Git filter의 설정 key만 bounded 조회해 clean/process·fsmonitor를 해당 명령에서 비활성화합니다. Submodule gitlink는
미점검 nested 설정을 실행하지 않도록 worktree 조회 전에 차단합니다. Snapshot은 비원자적 local 진단이며 실제 index를 읽기만 하고,
HEAD tree를 읽은 저장소 밖 임시 index(끝나면 삭제)로 계산한 `claude-git-baseline/v4`의 length-framed raw status/HEAD index stage
records/HEAD binary diff/미추적 파일 digest를 SHA-256으로 결합합니다. 그래서 같은 내용이면 stage(`git add`·`git add -N`)와 무관하게
digest가 같습니다. 호출 환경의 `GIT_INDEX_FILE`은 따르지 않습니다.
Dirty `currentSnapshot.dirtyDiffDigest`는 `sha256:`을 붙인 실제 fingerprint와 일치해야 합니다.

`claude/workflow-entry.mjs`의 `prepareClaudeWorkflow`는 공통 intake/context/문서 경로·명시 direct assignment·계획
진단을 연결합니다. `validateClaudeWorkflowResults`는 같은 원본 입력에서 계약을 다시 계산하고 공통 lane/result/fan-in
및 독립 QA packet을 검사합니다. 여섯 intent와 fresh/resume는 별도 축이며 Analyze·Plan을 제품 수정 권한으로 바꾸지
않습니다. CLI는 진단용이고 API의 source/assignment/QA 입력을 자동 발명하지 않습니다. 정적 `valid`는 실제 작업·검증·
권한 완료가 아닙니다.
표시용 objective는 공통 sanitized summary를 재사용하고 원문을 출력하지 않습니다. 전체 요청의 `requestDigest`를 별도로
계산해 lane identity와 QA wrapper에 연결합니다. QA 입력의 `requestDigest`도 현재 값과 일치해야 하므로 요약 뒤의
요구 변경이나 redaction으로 서로 다른 요청이 같은 요약이 되어도 결과를 재사용하지 않습니다. Digest는 인증·암호화나
비밀의 안전한 저장을 보장하지 않습니다.

`claude:workflow --native`는 완전한 task 입력 없이 상태만 진단하는 명령이므로 실행하지 않습니다.
JS validator의 `dispatchAuthorized:false`는 host 권한을 발급하지 않는다는 뜻이며 `runtimeQualified:false`도 해당 실행의 전체 검증을 대신하지 않습니다. 모든 정상 native 사용을 영구 금지한다는 뜻이 아닙니다.
