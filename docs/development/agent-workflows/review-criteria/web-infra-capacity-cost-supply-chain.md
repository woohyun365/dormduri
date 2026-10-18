# Web infra capacity, cost, and supply chain criteria

[Review criteria](./README.md)의 `web-infra-capacity-cost-supply-chain` 기준입니다. 자원 한도·용량 가정·장애 때 동작, 확장
기술·구성과 비용 가정, dependency·image 갱신 자동화·취약점 정책·CI action 출처, runtime·DB·image·action·provider version의
upgrade와 지원 종료 대응을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 I1·I2 →
[swe.md S8](./swe.md#s8-측정-근거-있는-성능), I3·I4 → [swe.md S7](./swe.md#s7-dependency-도입과-version-의존-동작)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### I1. 첫 포화 지점과 degradation matrix

- 질문: 자원 한도(CPU·memory·disk·pool·network·quota)를 바꿀 때 먼저 포화되는 지점과 그것을 보여 주는 관측 신호를 근거로 삼고(예고된 traffic에 미리 늘리면 날짜·출처를 적은 traffic 가정도 함께), host·provider·DB·관측이 멈출 때 사용자가 겪는 동작을 표(degradation matrix)로 정했는가?
- 기본 severity: `medium`
- 적용 조건: 자원 한도·용량 가정·장애 때 동작을 바꾸는 변경
- 결함 패턴: 첫 포화 지점과 관측 신호 없이 한도를 바꿈, host·provider·관측 장애 때 사용자 영향이 정해지지 않음
- PASS 근거: 한도 변경 설명에 첫 포화 지점과 그 신호(측정값·alert)가 있고(예고된 traffic에 미리 늘리면 날짜·출처를 적은 가정도 있고), 장애 종류마다 사용자 영향과 저하 동작을 적은 표가 있다
- 지침: CPU·memory·disk·inode·pool·network·quota 가운데 먼저 포화되는 지점과 그 관측 신호를 찾고, 한도는 그 신호를 근거로 바꾼다. 행사처럼 traffic이 예고되면 날짜·출처를 적은 가정으로 미리 늘릴 수 있다. 단일 host·provider 장애와 DB·관측 장애 때의 사용자 영향과 저하 동작을 표로 만든다
- 피함: 포화 지점과 신호 없이 한도 바꾸기, 장애 때 사용자 영향을 정하지 않기

### I2. 확장 도입 근거와 비용 가정 출처

- 질문: 분산 cache·orchestration·다중 region 같은 확장 기술·구성을 현재 증거(측정한 포화나 가용성 요구)와 전환 trigger가 있을 때만 들이고, 비용·traffic 가정에 날짜·출처를 적었는가?
- 기본 severity: `low`
- 적용 조건: 확장 기술·구성(분산 cache·orchestration·다중 region 등)이나 비용 가정을 더하는 변경
- 결함 패턴: 현재 증거·전환 trigger 없이 확장 기술을 들임, 비용·traffic 가정에 날짜·출처가 없음
- PASS 근거: 확장 도입 설명에 그 근거가 된 측정값이나 가용성 요구와 전환 trigger가 있고, 비용·traffic 가정마다 날짜와 출처(가격표·측정·계약)가 있다
- 지침: 확장 기술·구성은 측정한 포화나 가용성 요구가 미리 정한 전환 trigger를 넘을 때 들인다. 비용과 traffic 예상은 날짜·출처·가정을 함께 적고, 출처가 없는 값은 가정으로 표시한다
- 피함: 증거 없이 앞으로의 규모를 위해 확장 기술 들이기, 날짜·출처 없는 비용·traffic 숫자

### I3. 공급망 갱신·출처·SBOM·취약점 정책

- 질문: dependency·image 갱신에 owner와 주기(자동 갱신 PR이나 정해진 수동 점검)가 있고, 갱신을 자동 merge하면 CI 검증을 통과한 것만 merge되며, image·CI action을 version이나 digest로 고정하고, 출처·구성 목록(SBOM)과 취약점 예외의 근거·만료가 있는가?
- 기본 severity: `medium`
- 적용 조건: dependency·image 갱신 자동화, 취약점 정책, CI action 출처를 바꾸는 변경
- 결함 패턴: 갱신 owner·주기가 없음, 검증·검토 없이 갱신을 자동 merge함, version·digest 고정 없는 image·action, 만료·근거 없는 취약점 예외
- PASS 근거: 갱신 설정이나 점검 절차에 owner와 주기가 있고, 자동 merge 규칙이 있으면 필수 CI 검사 통과를 조건으로 하며, image·action 참조가 version이나 digest를 담고, image·action의 출처와 구성 목록을 확인할 수 있으며, 취약점 예외마다 근거와 만료일이 있다
- 지침: 갱신은 owner와 주기를 정해 자동 갱신 PR로 받거나 정해진 주기에 점검한다. 자동 merge는 CI 검증을 통과한 갱신에만 쓰고, 주기·대기 기간 같은 값은 dependency 정책을 따른다. image·CI action은 version이나 digest로 고정하고, 내용이 바뀌지 않아야 하면 digest를 쓴다. 출처와 구성 목록(SBOM)을 남기고, 취약점 예외는 근거와 만료를 함께 둔다
- 피함: owner·주기 없는 갱신, 검증 없이 자동 merge하기, latest처럼 고정 없는 image·action 참조, 만료 없는 취약점 예외

### I4. upgrade·deprecation owner

- 질문: runtime·DB·image·action·provider version을 올릴 때 owner·호환성 test·rollout 창이 있고, 지원 종료 일정과 그때 할 일(trigger)을 적었는가?
- 기본 severity: `low`
- 적용 조건: runtime·DB·image·action·provider version을 올리거나 지원 종료에 대응하는 변경
- 결함 패턴: upgrade owner·호환성 test·rollout 창이 없음, 지원 종료 trigger를 적지 않음
- PASS 근거: upgrade 설명에 owner와 호환성 test 결과, 적용 창(언제 어떤 순서로 바꾸는지)이 있고(자동 갱신 PR로 올리는 version이면 갱신 설정의 owner·필수 CI 검사·대기 기간), 쓰는 version의 지원 종료 일정과 대응 trigger가 owner 문서에 있다
- 지침: version마다 upgrade owner를 정하고 호환성 test와 rollout 창을 둔다. 자동 갱신 PR로 올리는 version은 갱신 설정의 owner·CI 검사·대기 기간을 그 owner·호환성 test·적용 창으로 쓸 수 있다. 지원 종료 일정과 그 전에 할 일을 trigger로 적어 둔다
- 피함: owner 없이 version 올리기, 지원 종료가 지나서야 대응하기
