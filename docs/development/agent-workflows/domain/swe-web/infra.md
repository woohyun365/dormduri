# Domain/SWE/Web/infra

[Domain/SWE/Web pack](./README.md)의 infra layer입니다. 배포 구성과 실행 설정·secret 주입, CI 검사와 배포 권한, 관측 data의
경계, backup·restore와 DB 접속 안전, 용량·비용·공급망을 다룹니다. 하위 layer마다 상속, 결정 목록, 구현 지침(기준 항목 인용),
검증 기준(항목 id), 위험, binding 키를 둡니다.

## topology-runtime-config

`Domain/SWE/Web/infra/topology-runtime-config`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)

### 결정 목록

#### infra.topo.runtime-platform

- 수준: `architecture-style`
- 질문: app을 어디서 실행할까?
- 선택지:
  - 단일 host의 container compose: host 한 대에서 container 여러 개를 설정 파일 하나로 함께 띄운다. 운영 부담과 비용이 작지만 host가 멈추면 서비스 전체가 멈춘다
  - 관리형 container 서비스: provider가 container의 실행·재시작·확장을 맡는다. host 관리가 줄고 가용성이 높아지지만 비용과 provider 의존이 커진다
  - orchestration cluster: 여러 node에 container를 배치하고 확장하는 cluster를 운영한다. 큰 규모와 높은 가용성에 맞지만 운영 부담이 가장 크다. 현재 증거와 전환 trigger가 없으면 연결된 기준 항목 `web-infra-capacity-cost-supply-chain.md I2`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. 배포·network·secret·관측 경로를 모두 다시 구성한다
- 기본값: 단일 host container 또는 관리형 container 서비스. 운영 부담이 작고 지금 규모에 맞는다. 측정한 포화나 가용성 요구가 전환 trigger를 넘으면 다음 단계를 검토한다
- 확인 단서: `{{binding:repo-structure.infra-runtime}}`의 compose·배포 설정
- 기준 항목: [web-infra-topology-runtime-config.md I1](../../review-criteria/web-infra-topology-runtime-config.md#i1-현재목표-topology와-환경-차이-구분), [web-infra-capacity-cost-supply-chain.md I2](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i2-확장-도입-근거와-비용-가정-출처)

#### infra.topo.secret-injection

- 수준: `operational`
- 질문: secret을 runtime에 어떻게 넣을까?
- 선택지:
  - 배포 때 secret 저장소에서 주입: 배포 과정이 secret 저장소에서 값을 읽어 실행 환경에 넣는다. 값이 image·저장소에 남지 않고 교체와 접근 기록이 쉽지만 secret 저장소를 운영해야 한다
  - host의 환경 파일: host에 둔 환경 파일(공개 설정과 나누고 읽기 권한을 좁힘)에서 실행 환경으로 넣는다. 준비가 간단하지만 교체와 권한 관리를 사람이 하고 host마다 파일이 흩어진다
  - image·저장소에 포함: secret 값을 image나 저장소의 설정 파일에 넣는다. 배포가 가장 단순하지만 image·저장소를 볼 수 있는 모두가 값을 알고 바꾸려면 다시 build해야 한다. 연결된 기준 항목 `web-security-privacy-data-privacy-secret.md P4`이 결함으로 본다
- 먼저 정할 결정: `infra.topo.runtime-platform`
- 되돌림: `costly`. 주입 경로와 교체 절차를 다시 쓴다
- 기본값: secret 저장소에서 주입. 값이 image·저장소에 남지 않고 교체가 쉽다. secret 저장소가 없는 단일 host면 권한을 좁힌 환경 파일로 시작한다
- 확인 단서: `{{binding:repo-structure.infra-runtime}}`의 env 예시와 secret 주입 script
- 기준 항목: [web-infra-topology-runtime-config.md I2](../../review-criteria/web-infra-topology-runtime-config.md#i2-불변-artifact와-configsecret-주입-흐름), [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)

#### infra.topo.config-management

- 수준: `operational`
- 질문: 운영 설정의 원본을 어디에 둘까?
- 선택지:
  - 저장소의 선언형 설정·IaC: 운영 설정을 원하는 상태로 적은 저장소 파일(선언형 설정·IaC)로 두고 도구가 실제 값을 맞춘다. 변경이 리뷰되고 drift(실제 값과 원본의 차이)를 찾을 수 있지만 도구와 적용 절차를 익혀야 한다
  - provider console 수동 + 문서: provider 관리 화면에서 직접 바꾸고 값과 절차를 문서로 남긴다. 시작이 빠르지만 변경이 리뷰되지 않고 바뀐 이력을 사람이 기록해야 한다
  - 섞음: 일부 설정은 저장소, 일부는 console에서 관리한다. 도구가 지원하지 않는 설정도 다룰 수 있지만 설정마다 어느 쪽이 원본인지 정해야 한다. 같은 설정에 원본을 둘 두면 연결된 기준 항목 `web-infra-topology-runtime-config.md I5`이 결함으로 본다
- 먼저 정할 결정: `infra.topo.runtime-platform`
- 되돌림: `costly`. 설정을 옮기고 drift를 정리한다
- 기본값: 저장소의 선언형 설정. 변경이 리뷰되고 drift를 찾을 수 있다. provider가 선언형 도구를 지원하지 않는 설정만 console + 문서로 둔다
- 확인 단서: `{{binding:repo-structure.infra-runtime}}`의 선언형 설정, `{{binding:repo-structure.infra-scripts}}`의 적용·검증 script
- 기준 항목: [web-infra-topology-runtime-config.md I5](../../review-criteria/web-infra-topology-runtime-config.md#i5-선언형-configiac-owner와-drift)

### 구현 지침

- [web-infra-topology-runtime-config.md I1](../../review-criteria/web-infra-topology-runtime-config.md#i1-현재목표-topology와-환경-차이-구분)
- [web-infra-topology-runtime-config.md I2](../../review-criteria/web-infra-topology-runtime-config.md#i2-불변-artifact와-configsecret-주입-흐름)
- [web-infra-topology-runtime-config.md I3](../../review-criteria/web-infra-topology-runtime-config.md#i3-runtime-강화)
- [web-infra-topology-runtime-config.md I4](../../review-criteria/web-infra-topology-runtime-config.md#i4-networkidentity-최소-권한과-운영자-접근)
- [web-infra-topology-runtime-config.md I5](../../review-criteria/web-infra-topology-runtime-config.md#i5-선언형-configiac-owner와-drift)

### 검증 기준

- `web-infra-topology-runtime-config.md I1`
- `web-infra-topology-runtime-config.md I2`
- `web-infra-topology-runtime-config.md I3`
- `web-infra-topology-runtime-config.md I4`
- `web-infra-topology-runtime-config.md I5`

### 위험

- 현재와 목표를 섞은 구성 그림과 적지 않은 환경 차이(I1), 다시 쓰는 tag·환경마다 다시 하는 build·한 파일에 둔 공개 설정과 secret·production으로 넘어간 자리표시 값(I2), root 실행·전체를 쓸 수 있는 filesystem·종료 신호 무시(I3), 필요 없는 공개 port·넓은 권한·오래 사는 CI 자격 증명·회수 절차 없는 비상 접근(I4), 원본이 둘인 설정과 console에서 생긴 drift(I5), 저장소·image에 쓴 secret(상속한 data-privacy-secret P4)
- 비가역 선택: `infra.topo.runtime-platform`(`one-way`). `infra.topo.secret-injection`·`infra.topo.config-management`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다

### binding 키

- `{{binding:repo-structure.infra-runtime}}`: 배포·rehearsal 구성, provider 준비 checklist, infra 목록 manifest와 local 개발 compose의 위치
- `{{binding:repo-structure.infra-scripts}}`: infra 검증·compose 조합·artifact·rehearsal script의 위치

## ci-cd

`Domain/SWE/Web/infra/ci-cd`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

### 결정 목록

#### infra.ci.change-routing

- 수준: `code-pattern`
- 질문: CI가 어떤 검사를 돌릴지 어떻게 정할까?
- 선택지:
  - 바뀐 경로로 lane 선택 + 분류되지 않은 경로는 전체 실행: 바뀐 파일 경로로 필요한 검사 묶음(lane)만 돌리고, 규칙에 없는 경로가 바뀌면 전체 검사를 돌린다. 빠르면서 검사가 빠지지 않지만 분류 규칙을 관리해야 한다
  - 매번 전체: 변경과 상관없이 모든 검사를 돌린다. 규칙이 필요 없고 검사가 빠지지 않지만 저장소가 커지면 오래 걸린다
  - 사람이 수동 선택: 변경한 사람이 돌릴 검사를 고른다. 유연하지만 고르지 않은 검사가 빠진다. 연결된 기준 항목 `web-infra-ci-cd.md I1`이 결함으로 본다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 분류 규칙을 조정한다
- 기본값: 경로 기반 + 분류되지 않으면 전체. 빠르면서 검사가 빠지지 않는다. 저장소가 작아 전체 검사가 몇 분이면 매번 전체도 충분하다
- 확인 단서: `{{binding:repo-structure.ci-workflows}}`의 경로 분류
- 기준 항목: [web-infra-ci-cd.md I1](../../review-criteria/web-infra-ci-cd.md#i1-변경-경로-분류cachelane)

#### infra.ci.deploy-authority

- 수준: `policy`
- 질문: 운영 배포·적용을 누가 실행할까?
- 선택지:
  - 사람 승인 뒤 배포 전용 job: 검증과 다른 권한을 가진 배포 job이 사람의 승인을 받은 뒤 실행한다. 검증 권한과 배포 권한이 갈리고 기록이 남지만 승인을 기다리는 시간이 든다
  - 검증 job이 바로 배포: 검사를 통과하면 같은 job이 바로 배포한다. 가장 빠르지만 검증 단계가 운영 쓰기 권한을 갖고 되돌릴 수 없는 적용 전에 사람이 보지 않는다. 연결된 기준 항목 `web-infra-ci-cd.md I2`이 결함으로 본다
  - agent·개발자가 직접: CI 밖에서 개발자가 자기 권한으로 배포 명령을 실행하거나, agent가 준비한 배포를 사람이 승인해 실행한다. 절차가 가볍지만 실행 기록과 권한 범위가 사람마다 달라진다. agent가 사람 승인 없이 실행하면 연결된 기준 항목 `web-infra-ci-cd.md I2`이 결함으로 본다
- 먼저 정할 결정: `infra.topo.runtime-platform`, `ops.release.go-decision`
- 되돌림: `costly`. 권한·workflow·절차를 다시 구성한다
- 기본값: 사람 승인 뒤 배포 전용 job. 검증 권한과 배포 권한이 갈리고 되돌릴 수 없는 적용 전에 사람이 본다. 실제 배포 대상이 없으면 pipeline 대신 release handoff를 둔다
- 확인 단서: `{{binding:repo-structure.ci-workflows}}`의 job 권한·승인 설정
- 기준 항목: [web-infra-ci-cd.md I2](../../review-criteria/web-infra-ci-cd.md#i2-검증배포-권한-분리와-사람-승인-지점), [web-infra-ci-cd.md I3](../../review-criteria/web-infra-ci-cd.md#i3-target-없는-cd-금지와-owner-하나), [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

### 구현 지침

- [web-infra-ci-cd.md I1](../../review-criteria/web-infra-ci-cd.md#i1-변경-경로-분류cachelane)
- [web-infra-ci-cd.md I2](../../review-criteria/web-infra-ci-cd.md#i2-검증배포-권한-분리와-사람-승인-지점)
- [web-infra-ci-cd.md I3](../../review-criteria/web-infra-ci-cd.md#i3-target-없는-cd-금지와-owner-하나)

### 검증 기준

- `web-infra-ci-cd.md I1`
- `web-infra-ci-cd.md I2`
- `web-infra-ci-cd.md I3`

### 위험

- 어느 lane에도 걸리지 않아 빠지는 검사·입력 일부만 담은 cache key·권한과 동시성 설정 없는 workflow(I1), 배포 권한을 가진 검증 job·사람 승인 없이 운영에 적용하는 자동 경로나 agent·agent 환경에 상시 있는 운영 쓰기 자격 증명(I2), 대상 없는 배포 pipeline과 여러 곳에 복사한 절차(I3), 함께 도는 옛·새 app을 깨는 배포 순서와 되돌림 경로 없는 release(상속한 release-gate O2)
- 비가역 선택: 없음. `infra.ci.deploy-authority`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다
- 사람 승인 지점: 운영 배포·적용·삭제는 검증 job과 나뉜 배포 경로에서 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다. 정해진 주기로 운영에 적용하는 자동 경로는 그 실행 경로를 만들거나 바꿀 때 사람이 승인하고, 승인된 경로의 주기 실행은 실행 기록을 남긴다(I2). 되돌릴 수 없는 운영 적용(파괴적 schema 변경·data 삭제)은 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다(상속한 release-gate O2)

### binding 키

- `{{binding:repo-structure.ci-workflows}}`: CI workflow와 변경 분류·lane·제품 test 배치·계약 test·CI 성능 측정 script의 위치

## observability

`Domain/SWE/Web/infra/observability`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-security-privacy-data-privacy-secret.md P4](../../review-criteria/web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제)
- [web-operations-release-slo-signal.md O2](../../review-criteria/web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결)

### 결정 목록

#### infra.obs.stack

- 수준: `architecture-style`
- 질문: 관측 data(metric·log·trace·오류)를 어디에 모을까?
- 선택지:
  - 자체 운영 open-source stack: 수집기·저장소·dashboard를 직접 띄워 운영한다. data 위치와 비용을 통제하지만 upgrade·용량·장애 대응을 직접 해야 한다
  - 관리형 관측 서비스: provider가 수집·저장·dashboard를 운영한다. 운영 부담이 작지만 사용량에 따라 비용이 늘고 data가 provider에 저장된다
  - 혼합: 일부 신호는 직접 운영하는 곳에, 일부는 관리형 서비스에 모은다. 신호마다 맞는 곳을 고를 수 있지만 두 곳을 운영하고 경계를 양쪽에 정해야 한다
- 먼저 정할 결정: `infra.topo.runtime-platform`
- 되돌림: `costly`. 수집기·dashboard·alert를 다시 만든다
- 기본값: 수집·보존·접근 경계를 먼저 정하고, 운영 인력이 적으면 관리형, 비용·data 위치 제약이 크면 자체 운영. 도구가 아니라 경계가 결정을 이끈다
- 확인 단서: `{{binding:repo-structure.obs-config}}`의 수집·저장 설정
- 기준 항목: [web-infra-observability.md I1](../../review-criteria/web-infra-observability.md#i1-수집저장질의alertprivacy-경계)

#### infra.obs.retention-access

- 수준: `operational`
- 질문: 관측 data를 얼마나 보관하고 누가 볼까?
- 선택지:
  - 종류별 보존 기간 + 운영자만 접근: metric·log·trace마다 보존 기간을 정하고 운영자 권한이 있는 사람만 본다. 개인정보가 섞여도 기한 뒤 사라지고 아무나 보지 못하지만 종류마다 설정을 관리해야 한다
  - 도구 기본값 그대로: 관측 도구의 기본 보존 기간·접근 설정을 쓴다. 따로 설정할 것이 없지만 기본값이 무엇인지 확인해야 한다. 기본값에 보존 기간·접근 제한이 없으면 연결된 기준 항목 `web-infra-observability.md I1`이 결함으로 본다
  - 무기한: 관측 data를 지우지 않고 계속 쌓는다. 오래된 사고도 다시 볼 수 있지만 저장 비용이 늘고 섞인 개인정보가 계속 남는다. 연결된 기준 항목 `web-security-privacy-data-privacy-secret.md P3`이 결함으로 본다
- 먼저 정할 결정: `infra.obs.stack`, `sec.privacy.log-redaction`
- 되돌림: `easy`. 보존·권한 설정을 조정한다
- 기본값: 종류별 보존 기간 + 운영자만 접근. 개인정보가 섞여도 기한 뒤 사라지고 아무나 보지 못한다. 값은 정책이 소유한다
- 확인 단서: `{{binding:policy.operational-observability}}`, `{{binding:repo-structure.obs-config}}`의 보존 설정
- 기준 항목: [web-infra-observability.md I1](../../review-criteria/web-infra-observability.md#i1-수집저장질의alertprivacy-경계), [web-security-privacy-data-privacy-secret.md P3](../../review-criteria/web-security-privacy-data-privacy-secret.md#p3-보존-목적기한삭제비식별)

### 구현 지침

- [web-infra-observability.md I1](../../review-criteria/web-infra-observability.md#i1-수집저장질의alertprivacy-경계)
- [web-infra-observability.md I2](../../review-criteria/web-infra-observability.md#i2-관측-ui와-제품-운영-화면-분리)

### 검증 기준

- `web-infra-observability.md I1`
- `web-infra-observability.md I2`

### 위험

- 경계 없이 시작한 수집·관측 저장소에 들어간 개인정보·보존 기간과 접근 권한 없는 관측 data(I1), 관측 UI에서 하는 제품 운영 작업과 관측 저장소를 직접 읽는 운영 화면(I2), log·trace에 남은 token·개인정보(상속한 data-privacy-secret P4), 대응 행동·runbook 없는 alert(상속한 slo-signal O2)
- 비가역 선택: `infra.obs.stack`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

### binding 키

- `{{binding:repo-structure.obs-config}}`: 관측 수집·alert 설정과 그 script의 위치
- `{{binding:policy.operational-observability}}`: 운영 관측 정책 원본

## data-durability-recovery

`Domain/SWE/Web/infra/data-durability-recovery`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체
- [web-operations-release-release-gate.md O2](../../review-criteria/web-operations-release-release-gate.md#o2-rollout-순서호환-구간되돌림사람-승인)

### 결정 목록

#### infra.dr.backup-mode

- 수준: `operational`
- 질문: DB backup을 어떻게 할까?
- 선택지:
  - 관리형 자동 backup + 시점 복구: 관리형 DB의 자동 backup과 원하는 시점으로 되돌리는 기능을 쓴다. 잃는 data의 시간 범위가 짧고 운영 부담이 작지만 관리형 DB가 필요하고 비용이 든다
  - 주기 dump를 다른 저장소에: 정해진 주기로 DB 전체를 파일로 내보내 다른 저장소에 둔다. 어디서나 쓸 수 있지만 마지막 dump 뒤의 data를 잃을 수 있고 dump·보관·restore를 직접 운영해야 한다
  - backup 없음: backup을 두지 않는다. 비용과 운영 부담이 없지만 DB를 잃으면 data도 잃는다. 다시 만들 수 없는 data가 있으면 연결된 기준 항목 `web-infra-data-durability-recovery.md I1`이 결함으로 본다
- 먼저 정할 결정: `infra.topo.runtime-platform`
- 되돌림: `costly`. backup 경로·보관 비용·restore 절차가 바뀐다
- 기본값: 관리형 자동 backup + 시점 복구. 짧은 RPO(잃어도 되는 data의 시간 범위)를 운영 부담 없이 얻는다. 관리형 DB가 아니면 주기 dump를 다른 저장소에 두고 restore를 시험한다
- 확인 단서: `{{binding:repo-structure.db-ops}}`의 backup·restore script
- 기준 항목: [web-infra-data-durability-recovery.md I1](../../review-criteria/web-infra-data-durability-recovery.md#i1-restore-증거로-증명하는-backuprporto)

#### infra.dr.restore-drill

- 수준: `operational`
- 질문: restore를 얼마나 자주 시험할까?
- 선택지:
  - 정해진 주기와 큰 변경 전: 정해진 주기와 큰 schema 변경 전에 backup을 disposable DB로 되살려 본다. 사고 전에 복구할 수 있는지와 걸리는 시간을 알지만 시험 시간과 환경이 든다
  - 사고 때만: 실제로 data를 잃었을 때 처음 restore한다. 평소 비용이 없지만 그때서야 backup을 쓸 수 없다는 것을 알 수 있다. 연결된 기준 항목 `web-infra-data-durability-recovery.md I1`이 결함으로 본다
  - 시험하지 않음: backup 성공 기록만 확인한다. 가장 가볍지만 복구할 수 있는지 모른다. 연결된 기준 항목 `web-infra-data-durability-recovery.md I1`이 결함으로 본다
- 먼저 정할 결정: `infra.dr.backup-mode`
- 되돌림: `easy`. 주기를 조정한다
- 기본값: 정해진 주기와 큰 schema 변경 전. backup이 실제로 되살아나는지 사고 전에 안다
- 확인 단서: `{{binding:repo-structure.db-ops}}`의 restore drill script와 실행 기록
- 기준 항목: [web-infra-data-durability-recovery.md I1](../../review-criteria/web-infra-data-durability-recovery.md#i1-restore-증거로-증명하는-backuprporto), [web-infra-data-durability-recovery.md I2](../../review-criteria/web-infra-data-durability-recovery.md#i2-disposable-db와-운영-유사-endpoint-안전-gate)

### 구현 지침

- [web-infra-data-durability-recovery.md I1](../../review-criteria/web-infra-data-durability-recovery.md#i1-restore-증거로-증명하는-backuprporto)
- [web-infra-data-durability-recovery.md I2](../../review-criteria/web-infra-data-durability-recovery.md#i2-disposable-db와-운영-유사-endpoint-안전-gate)
- [web-infra-data-durability-recovery.md I3](../../review-criteria/web-infra-data-durability-recovery.md#i3-stateful-변경과-rollout-호환-구간)

### 검증 기준

- `web-infra-data-durability-recovery.md I1`
- `web-infra-data-durability-recovery.md I2`
- `web-infra-data-durability-recovery.md I3`

### 위험

- 다시 만들 수 없는 data의 backup 부재·restore 시험 없는 backup·목표 없는 backup(I1), 운영 유사 DB에 접속할 수 있는 시험 script와 masking 없는 운영 data 조회(I2), app 되돌림과 맞지 않는 stateful 변경과 연결 한도를 넘는 pool(I3), 함께 도는 옛·새 app을 깨는 배포 순서와 되돌림 경로 없는 release(상속한 release-gate O2)
- 비가역 선택: `infra.dr.backup-mode`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)
- 사람 승인 지점: 운영 DB에 쓰는 작업(restore로 덮어쓰기 포함)은 agent가 계획까지 만들고 사람이 승인한 뒤 실행한다. 정해진 주기로 운영 DB에 접속하는 작업(주기 backup 등)은 그 실행 경로와 접속 대상을 만들거나 바꿀 때 사람이 승인하고, 승인된 경로의 주기 실행은 실행 기록을 남긴다(I2). 되돌릴 수 없는 운영 적용(파괴적 schema 변경·data 삭제)은 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다(상속한 release-gate O2)

### binding 키

- `{{binding:repo-structure.db-ops}}`: DB 운영 script(migration 적용·grant 적용·restore 시험)의 위치
- `{{binding:repo-structure.db-migrations}}`: migration 파일의 위치

## capacity-cost-supply-chain

`Domain/SWE/Web/infra/capacity-cost-supply-chain`

### 상속

- [SWE 공통 기준](../../review-criteria/README.md#기준-문서) `swe` 전체. 이 하위 layer의 항목이 강화하는 SWE 항목은 기준 문서 머리말에 있습니다.

### 결정 목록

#### infra.cap.scale-trigger

- 수준: `operational`
- 질문: 언제 자원을 늘릴까?
- 선택지:
  - 관측한 포화 신호가 기준을 넘을 때: CPU·memory·pool 같은 포화 신호에 기준을 정하고 넘으면 늘린다. 늘린 이유와 효과를 측정으로 보이지만 기준과 alert를 먼저 만들어야 한다
  - 예상 traffic에 미리: 늘 것으로 예상되는 traffic에 맞춰 먼저 늘린다. 행사처럼 예고된 traffic에 대비하지만 예상이 틀리면 비용을 낭비한다. 날짜·출처 있는 가정 없이 늘리면 연결된 기준 항목 `web-infra-capacity-cost-supply-chain.md I2`이 결함으로 본다
  - 문제가 생긴 뒤: 느려지거나 멈춘 뒤에 늘린다. 미리 준비할 것이 없지만 그동안 사용자가 영향을 받는다
- 먼저 정할 결정: `ops.slo.objective`
- 되돌림: `easy`. 기준을 조정한다
- 기본값: 관측한 포화 신호 기준. 늘린 이유와 효과를 측정으로 보인다. 행사처럼 traffic이 예고되면 날짜·출처를 적은 가정으로 미리 늘린다
- 확인 단서: 포화 alert 규칙과 container 자원 한도 설정, `{{binding:policy.operational-observability}}`
- 기준 항목: [web-infra-capacity-cost-supply-chain.md I1](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i1-첫-포화-지점과-degradation-matrix), [web-infra-capacity-cost-supply-chain.md I2](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i2-확장-도입-근거와-비용-가정-출처)

#### infra.cap.update-automation

- 수준: `operational`
- 질문: dependency·image 갱신을 어떻게 할까?
- 선택지:
  - 자동 갱신 PR + 사람 merge: 도구가 새 version을 찾아 갱신 PR을 열고, CI를 통과한 PR을 사람이 merge한다. 갱신이 밀리지 않고 깨지는 갱신은 CI와 사람이 막지만 PR을 검토하는 시간이 든다
  - 자동 merge: 조건에 맞는 갱신 PR을 자동으로 merge한다. 사람 손이 가장 적게 들지만 깨지는 갱신이 들어올 수 있다. 검증 없이 merge하면 연결된 기준 항목 `web-infra-capacity-cost-supply-chain.md I3`이 결함으로 본다
  - 수동 주기 점검: 정해진 주기에 사람이 갱신할 것을 찾아 올린다. 도구가 필요 없지만 갱신이 밀리기 쉽다
- 먼저 정할 결정: 없음
- 되돌림: `easy`. 자동화 설정을 바꾼다
- 기본값: 자동 갱신 PR + 사람 merge. 갱신이 밀리지 않고 깨지는 갱신은 CI와 사람이 막는다. 값(주기·대기 기간)은 dependency 정책이 소유한다
- 확인 단서: `{{binding:policy.dependency-security}}`, `{{binding:repo-structure.supply-chain}}`의 갱신 설정
- 기준 항목: [web-infra-capacity-cost-supply-chain.md I3](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i3-공급망-갱신출처sbom취약점-정책), [web-infra-capacity-cost-supply-chain.md I4](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i4-upgradedeprecation-owner)

#### infra.cap.artifact-pin

- 수준: `code-pattern`
- 질문: image·CI action을 어떻게 고정할까?
- 선택지:
  - 내용 hash(digest)로 고정: 이름 대신 내용으로 계산한 hash로 가리킨다. 같은 이름에 다른 내용이 올라와도 바뀌지 않지만 사람이 읽기 어렵고 갱신 도구가 필요하다
  - version tag: 정한 version 이름으로 가리킨다. 읽기 쉽지만 같은 tag에 다른 내용이 다시 올라오면 모르고 따라간다
  - 최신(latest): 늘 최신 판을 가리킨다. 고정할 것이 없지만 언제 무엇이 바뀌었는지 모른다. 연결된 기준 항목 `web-infra-capacity-cost-supply-chain.md I3`이 결함으로 본다
- 먼저 정할 결정: `infra.cap.update-automation`
- 되돌림: `easy`. 참조를 교체한다
- 기본값: digest로 고정 + 자동 갱신 PR. 같은 이름에 다른 내용이 들어와도 바뀌지 않고 갱신은 PR로 보인다
- 확인 단서: `{{binding:repo-structure.supply-chain}}`의 image 목록, CI action 참조
- 기준 항목: [web-infra-capacity-cost-supply-chain.md I3](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i3-공급망-갱신출처sbom취약점-정책), [web-infra-topology-runtime-config.md I2](../../review-criteria/web-infra-topology-runtime-config.md#i2-불변-artifact와-configsecret-주입-흐름)

### 구현 지침

- [web-infra-capacity-cost-supply-chain.md I1](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i1-첫-포화-지점과-degradation-matrix)
- [web-infra-capacity-cost-supply-chain.md I2](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i2-확장-도입-근거와-비용-가정-출처)
- [web-infra-capacity-cost-supply-chain.md I3](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i3-공급망-갱신출처sbom취약점-정책)
- [web-infra-capacity-cost-supply-chain.md I4](../../review-criteria/web-infra-capacity-cost-supply-chain.md#i4-upgradedeprecation-owner)

### 검증 기준

- `web-infra-capacity-cost-supply-chain.md I1`
- `web-infra-capacity-cost-supply-chain.md I2`
- `web-infra-capacity-cost-supply-chain.md I3`
- `web-infra-capacity-cost-supply-chain.md I4`

### 위험

- 포화 지점과 신호 없이 바꾼 한도와 정하지 않은 장애 때 사용자 영향(I1), 증거·전환 trigger 없이 들인 확장 기술과 날짜·출처 없는 비용·traffic 가정(I2), owner·주기 없는 갱신·검증 없는 자동 merge·고정 없는 image·action·만료 없는 취약점 예외(I3), owner·호환성 test 없는 upgrade와 지난 지원 종료(I4)
- 비가역 선택: 없음

### binding 키

- `{{binding:repo-structure.supply-chain}}`: dependency·image 갱신 설정, 보안 신고 안내, dependency·보안 검사 script와 image 목록의 위치
- `{{binding:policy.dependency-security}}`: dependency 보안 정책 원본
- `{{binding:policy.operational-observability}}`: 운영 관측 정책 원본(포화 신호 기준)
