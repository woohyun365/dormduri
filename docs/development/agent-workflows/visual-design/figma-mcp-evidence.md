# Figma MCP evidence and connection readiness

## Repository boundary

- Account와 OAuth: repository가 소유하거나 보장하지 않음
- Connection과 effective access: 사용하는 개발자·agent session마다 다시 확인
- Target file/frame: current visual request에서 사용자가 명시적으로 승인
- Repository credential: 저장하지 않음
- Recommended transport: official remote MCP `https://mcp.figma.com/mcp`
- Mutation boundary: provider 연결이나 read access만으로 Figma 또는 product mutation 권한을 얻지 않음

Figma Education account를 사용하는 경우에도 Education을 Professional/Organization tier로 추측하지 않습니다. 실제
작업 session의 `whoami`로 account identity, plan membership와 seat를 확인하고, 대상 file이 속한 plan의 effective
permission과 실제 read/write capability를 다시 확인합니다. 과거 session에서 성공한 OAuth와 seat evidence를 새 개발자나
clean environment의 현재 사실로 상속하지 않습니다.

## Why remote MCP

Figma는 remote MCP를 일반적인 권장 경로로 안내하며 desktop server보다 넓은 tool surface를 제공합니다. MCP는
frame, component, variable, asset와 Code Connect context를 agent에 전달하는 bridge입니다. 반환된 context는 current
repository component와 policy에 매핑해야 하며 production-ready code로 간주하지 않습니다.

## Future visual task flow

### 1. Prepare an owned source

- Education team 또는 개인 draft에서 사용할 Figma file을 정합니다.
- file owner와 edit/view permission을 확인합니다.
- implementation source로 승인할 frame URL과 node를 명시합니다.
- frame은 semantic layer/component name, Auto Layout과 variable 사용 여부를 확인합니다.

### 2. Confirm or register the official server

먼저 current client의 MCP 목록에서 official endpoint 등록 여부를 확인합니다. 등록되지 않은 환경에서만 다음 endpoint를
user-level configuration에 추가합니다.

```text
codex mcp add figma --url https://mcp.figma.com/mcp
```

Repository script, `.env`, `.env.example` 또는 tracked config에 token을 넣지 않습니다.

### 3. Reverify identity for the task

- 기존 OAuth가 유효하면 재로그인하지 않습니다.
- 인증이 만료되었을 때만 `codex mcp login figma` 또는 client가 제공하는 login flow를 사용합니다.
- Figma `whoami` tool 결과로 account email, plan membership와 seat를 확인합니다.
- Education verification 만료나 view-only downgrade가 없는지 확인합니다.

OAuth receipt, access token과 개인 account identifier는 repository artifact에 저장하지 않습니다. Evidence에는
`connected`, effective plan/seat category, reviewed date와 redacted file owner만 남깁니다.

### 4. Permission and read-only smoke

Approved frame에 대해서만 다음 read-only smoke를 수행합니다.

- identity/permission 확인
- frame/layout context 조회
- component와 variable definition 조회
- screenshot/rendered reference 조회
- asset download 경로와 repository asset policy 확인
- current code component와 Code Connect mapping 조회 가능성 확인

다른 Education project나 private file을 탐색하지 않습니다. Tool 결과에는 user-generated text나 asset이 포함될 수
있으므로 필요한 node/context만 요청하고 raw response를 장기 log에 저장하지 않습니다.

### 5. Effective rate-limit evidence

Figma MCP read tool limits는 plan과 seat에 따라 달라질 수 있습니다. Education account의 effective tier는 문서로
추측하지 않고 `whoami`, 실제 allowed file과 rate-limit response로 확인합니다.

- plan/seat category
- target file의 plan
- observed daily/per-minute boundary 또는 `Retry-After`
- batching/caching 가능성
- rate-limited fallback

Rate limit을 피하려고 다른 credential이나 account를 자동 전환하지 않습니다.

### 6. Separate mutations

다음 tool/action은 read-only smoke와 분리합니다.

- write-to-canvas
- create file/frame/component/variable
- asset upload
- Code Connect mapping add/send

사용자가 Figma mutation과 owner를 명시적으로 승인하기 전 실행하지 않습니다. 실행하는 경우 target file, expected
change와 rollback/undo evidence를 먼저 고정합니다.

### 7. Fail-open and disconnect

MCP unavailable, OAuth expired, permission denied 또는 rate limited이면 screenshot/manual reference, Storybook와 current
component inspection으로 fail-open합니다. Provider 장애 때문에 code lint/build/test를 실패시키지 않습니다.

연결 제거:

```text
codex mcp logout figma
codex mcp remove figma
```

제거 후 `codex mcp list`에서 absence를 확인하고 normal visual workflow smoke를 실행합니다.

## Provider task acceptance

- official endpoint와 OAuth만 사용합니다.
- current session의 `whoami`로 effective access를 확인합니다.
- repository에 credential이나 raw private payload가 남지 않습니다.
- disconnect와 provider failure 뒤 normal workflow가 동작합니다.

과거 local provider 설치 기록은 repository capability 보장이 아닙니다. Approved file/frame 조회, read-only context 품질,
rate limit과 write-to-canvas 가능성은 실제 FE visual 작업의 task-scoped gate입니다. 해당 작업에서는 승인한 target 외의
content를 요청하지 않고, write mutation은 별도 승인이 없으면 호출하지 않습니다.

## Official references

- MCP introduction: https://developers.figma.com/docs/figma-mcp-server/
- Codex remote setup: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
- Tools: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- Rate limits and access: https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
- File structure: https://developers.figma.com/docs/figma-mcp-server/structure-figma-file/
- Figma for Education: https://help.figma.com/hc/en-us/articles/360041061214-Figma-for-Education
