# General workflow Phase0 test evidence

이 디렉터리는 production runtime이나 등록된 adapter가 아닌 **테스트 전용** 자료입니다.

- `intake-cases.json`: 실제 `buildTaskEnvelope` / `discoverContextPack` 호출의 characterization.
  여섯 intent와 fresh/resume 요청 문구를 별도 축으로 유지합니다. API에 없는 session-mode 필드를 발명하지 않습니다.
  이 행렬은 host entry 실행·checkpoint 재개를 검증하지 않습니다. 각 기대값의 이유를 유지하고 별도 대조 요청과
  authority 변조 negative로 단순 action map 복사를 보완합니다.
- `graph-cases.json` / `proposed-graph-validator.mjs`: 제안된 graph 의미의 positive/negative oracle.
  canonical owner 유일성, required cycle과 reference backlink 차이, current orphan, host 조건,
  Analyze의 write 도달, 미지원 capability를 구분합니다. scoped/history edge는 공통 필수 경로가 아닙니다.
  **실제 문서 graph, 전체 문서 coverage, host capability의 관측 또는 runtime conformance 증거가 아닙니다.**
- `expected-red-probes.mjs`: 현재 production preflight를 수정 없이 임시 저장소에 복사해 재현합니다.
  Git은 실제 실행하며 optional OMX read만 stub으로 막습니다. 실제 checkout의 Git index/HEAD나 OMX state는
  변경하지 않습니다. 임시 Git baseline은 테스트가 만들고 종료 시 제거합니다.

정상 CI에서 발견되는 suite:

```sh
node --test scripts/ci/agent-workflow-general-baseline.test.mjs
```

현재 결함을 재현하는 명시적 expected-red 실행 (수정 전 exit 1이 예상됨):

```sh
node --test scripts/agents/fixtures/workflow-general-phase0/expected-red-probes.mjs
```

F01은 첫 unstaged 행의 선행 공백과 경로가 손실되는 실제 parser 결함입니다. `.plans` 두 probe는 새 root의
discovery와 safe-path admission이 actual preflight에 아직 없는 migration gap입니다. 후속 owner는 production
수정 후 이 assertion을 green 회귀로 승격해야 합니다. `skip`, `todo`, 실패 기대 wrapper로 결함을 숨기지 않습니다.
이 파일은 `*.test.mjs`가 아니며 repo-policy discovery에 포함하지 않습니다. 출력의 assertion diff와 diagnostic을
별도 실행 evidence로 보관하고 startup/permission 오류를 expected-red 성공으로 세지 않습니다.
