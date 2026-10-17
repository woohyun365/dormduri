# Web operations-release release gate criteria

[Review criteria](./README.md)의 `web-operations-release-release-gate` 기준입니다. 배포 대상·release 절차·release 증거,
schema·data·설정 변경과 app 배포의 순서·되돌림·운영 적용 권한, 완료·준비 상태 보고를 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 O1 →
[swe.md S1](./swe.md#s1-요구사항intentinvariant-부합), O2 → [swe.md S5](./swe.md#s5-계약-호환성), O3 →
[swe.md S1](./swe.md#s1-요구사항intentinvariant-부합)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다. 이 문서의 항목을 상속하는 영역 문서는 그 문서 머리말에 적습니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### O1. release handoff와 증거 없는 GO 금지

- 질문: release가 배포할 artifact 식별자, 대상 owner, secret 목록 상태(값 제외), smoke·관측·되돌림 판단을 증거로 갖추고, 증거가 빠지면 NO-GO로 적는가?
- 기본 severity: `high`
- 적용 조건: 배포 대상·release 절차·release 증거를 더하거나 바꾸는 변경
- 결함 패턴: 배포할 artifact 식별자(commit·image digest) 없이 release를 주장함, 대상 owner·secret 목록 상태·smoke·관측·되돌림 판단 가운데 일부를 빠뜨림, 증거가 없는데 GO로 적음, secret 값을 handoff에 적음
- PASS 근거: release handoff에 바꿀 수 없는 artifact 식별자, 대상·환경 owner, 값 없는 secret 목록 상태, network·health·migration·provider smoke 결과, 관측·운영자 접근, 되돌림 판단이 있고 빠진 항목은 NO-GO로 적혀 있다
- 지침: release handoff는 바꿀 수 없는 artifact 식별자, 대상·환경 owner, secret 목록 상태(값 제외), smoke 결과, 관측·운영자 접근, 되돌림 판단과 알려진 위험을 적는다. 증거가 하나라도 빠지면 NO-GO로 적는다
- 피함: 식별자 없는 release, 증거 없는 GO, handoff에 secret 값 쓰기

### O2. rollout 순서·호환 구간·되돌림·사람 승인

- 질문: schema·data·설정 변경과 app 배포의 순서가 옛 app과 새 app이 함께 도는 구간에도 깨지지 않고, 되돌릴 artifact나 forward-fix 경계가 정해져 있으며, 되돌릴 수 없는 운영 적용은 사람이 승인하는가?
- 기본 severity: `high`
- 적용 조건: schema·data·설정 변경과 app 배포 순서, 되돌림 경로, 운영 적용 권한을 바꾸는 변경
- 결함 패턴: 옛 app과 새 app이 함께 도는 구간에 깨지는 schema·data 변경을 한 번에 배포함, 되돌릴 artifact·forward-fix 경계가 없음, 되돌릴 수 없는 운영 적용(파괴적 변경·삭제)을 agent나 자동 경로가 사람 승인 없이 실행함
- PASS 근거: 옛 app과 새 app이 함께 도는 배포면 변경 설명에 배포 순서와 호환 구간(먼저 넓히고 나중에 좁히는 단계)이 있고, 되돌릴 artifact 또는 forward-fix 경계가 있으며, 되돌릴 수 없는 적용 단계에 사람 승인 지점(승인 뒤에 실행되는 단계)이 있다
- 지침: 옛 app과 새 app이 함께 도는 배포면 schema·data 변경은 둘 다 동작하도록 먼저 넓히고, 새 app이 자리 잡은 뒤 좁힌다. release마다 되돌릴 artifact나 forward-fix로만 고칠 경계를 적는다. 되돌릴 수 없는 운영 적용은 agent가 계획·diff까지 만들고 사람이 승인한 뒤 실행한다
- 피함: 옛 app과 새 app이 함께 도는 배포에서 넓히기와 좁히기를 한 번에 하기, 되돌림 경로 없는 release, 사람 승인 없는 파괴적 적용

### O3. 완료 시계 구분과 provider 값 추측 금지

- 질문: local rehearsal·CI 통과와 대상 환경 release 성공, runtime capability와 production 활성화를 다른 완료로 보고하고, provider·대상 환경 값을 추측하지 않는가?
- 기본 severity: `medium`
- 적용 조건: 완료·준비 상태를 보고하거나 provider·대상 환경 값을 쓰는 변경
- 결함 패턴: local rehearsal 통과를 production 성공으로 적음, 계정·region·hostname·보존 기간·비용을 추측해 씀, runtime capability와 production 활성화를 같은 완료로 셈
- PASS 근거: 완료 보고가 저장소 구현·local·CI 증거와 대상 환경 증거를 나눠 적고, 대상 환경 값은 확인된 원천을 인용하거나 release 증거로 넘긴 기록이 있다
- 지침: 저장소 구현 완료, local·CI 통과, 대상 환경 release, production 활성화를 서로 다른 완료로 보고한다. 계정·region·hostname·보존 기간·비용 같은 대상 환경 값은 확인된 원천이 없으면 쓰지 않고 release 증거로 넘긴다
- 피함: rehearsal 통과를 운영 성공으로 쓰기, 추측한 provider 값, capability 구현을 활성화로 세기
