# Web infra CI/CD criteria

[Review criteria](./README.md)의 `web-infra-ci-cd` 기준입니다. CI workflow·검사 lane·cache·변경 경로 분류, 배포·운영 적용을
실행하는 workflow·script·권한, 배포 pipeline·script·runbook을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 operations-release 항목
[web-operations-release-release-gate.md O2](./web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 I1 → [swe.md S6](./swe.md#s6-보호-test), I2 →
[swe.md S4](./swe.md#s4-책임-경계와-결합도), I3 → [swe.md S11](./swe.md#s11-응집도와-중복-trade-off)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### I1. 변경 경로 분류·cache·lane

- 질문: 바뀐 경로가 빠짐없이 검사에 걸리고(경로로 lane을 고르면 분류되지 않은 경로는 전체 검사로 보내고), cache key가 결과에 영향을 주는 입력을 모두 담으며, workflow마다 권한·동시 실행·산출물 보존 설정이 있는가?
- 기본 severity: `medium`
- 적용 조건: CI workflow·lane·cache·경로 분류를 바꾸는 변경
- 결함 패턴: 바뀐 경로가 어느 lane에도 걸리지 않아 검사가 빠짐, cache key가 입력을 다 담지 않아 낡은 결과를 재사용함, 권한·동시성·보존 설정이 빠짐
- PASS 근거: 경로로 lane을 고르면 분류 규칙과, 분류되지 않은 경로가 전체 검사로 간다는 test가 있고(매번 전체 검사를 돌리면 그 설정이 있고), cache key에 lockfile·도구 version·설정처럼 결과를 바꾸는 입력이 들어 있으며, workflow에 최소 권한·동시 실행 처리·산출물 보존 기간 설정이 있다
- 지침: 경로로 lane을 고르면 분류 규칙을 한 곳에 두고 분류되지 않은 경로는 전체 검사로 보낸다. 매번 전체 검사를 돌리면 분류 규칙 없이도 검사가 빠지지 않는다. cache key에는 결과를 바꾸는 입력을 모두 넣고, 산출물을 lane 사이에 다시 쓸 때도 같은 key를 쓴다. workflow마다 권한을 최소로 두고 동시 실행과 보존 기간을 정한다
- 피함: 사람이 검사 lane을 골라 돌리기, 입력 일부만 담은 cache key, 권한·동시성 설정 없는 workflow

### I2. 검증·배포 권한 분리와 사람 승인 지점

- 질문: 검증 job과 배포 job의 권한이 나뉘고, 운영 적용·삭제는 사람이 승인한 뒤에만 실행되며(정해진 주기로 도는 자동 경로는 그 경로를 만들거나 바꿀 때 승인), agent 환경에 운영 쓰기 자격 증명을 상시 두지 않는가?
- 기본 severity: `high`
- 적용 조건: 배포·운영 적용을 실행하는 workflow·script·권한을 바꾸는 변경
- 결함 패턴: 검증 job이 배포 권한을 가짐, 운영 적용·삭제를 사람 승인 없이 자동 경로나 agent가 실행함, agent 환경에 운영 쓰기 자격 증명이 있음
- PASS 근거: 검증 job에 배포·운영 쓰기 권한이 없고 배포 전용 job·경로에만 그 권한이 있으며, 운영 적용·삭제 단계 앞에 사람 승인 지점(승인 뒤에 실행되는 단계)이 있고 정해진 주기로 도는 자동 경로에는 그 경로의 승인 기록과 실행 기록이 있으며, agent가 쓰는 환경에 운영 쓰기 자격 증명이 상시 있지 않다
- 지침: 검증과 배포를 다른 job·권한으로 나눈다. 운영 적용·삭제는 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다. 정해진 주기로 운영에 적용하는 자동 경로는 그 실행 경로를 만들거나 바꿀 때 사람이 승인하고, 승인된 경로의 주기 실행은 실행 기록을 남긴다. 운영 쓰기 자격 증명은 배포 전용 경로와 승인 단계에만 두고 agent 환경에 상시 두지 않는다
- 피함: 검증 job에 배포 권한 주기, 사람 승인 없이 운영에 적용하는 자동 경로나 agent, agent 환경에 운영 쓰기 자격 증명을 상시 두기

### I3. target 없는 CD 금지와 owner 하나

- 질문: 배포 pipeline을 실제 배포 대상이 있을 때만 두고(대상이 없으면 release 준비 상태와 증거 handoff를 두고), 한 절차의 owner를 script·workflow·runbook 가운데 하나로 정해 다른 곳은 그것을 부르거나 가리키는가?
- 기본 severity: `low`
- 적용 조건: 배포 pipeline·script·runbook을 더하는 변경
- 결함 패턴: 실제 대상 없는 배포 pipeline, 같은 절차를 script·workflow·runbook에 중복함
- PASS 근거: 새 배포 pipeline에 실제 대상 환경과 그 증거가 있거나, 대상이 없으면 pipeline 대신 release handoff 문서가 있고, 같은 절차가 두 곳 이상에 복사돼 있지 않으며 다른 곳은 owner 하나를 호출하거나 링크한다
- 지침: 실제 배포 대상이 생기기 전에는 배포 pipeline을 만들지 않고 release 준비 상태와 증거 handoff를 둔다. script·workflow·runbook 가운데 절차의 owner를 하나로 정하고, 나머지는 그 owner를 부르거나 링크한다. 중복된 shell·설정은 지운다
- 피함: 대상 없는 배포 pipeline, 같은 절차를 script·workflow·runbook에 따로 쓰기
