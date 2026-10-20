# Web infra observability criteria

[Review criteria](./README.md)의 `web-infra-observability` 기준입니다. 관측 data(metric·log·trace·오류)의 수집·저장·보존·접근·alert
설정과, 관측 dashboard와 제품 운영 화면의 책임을 더하거나 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-data-privacy-secret.md P4](./web-security-privacy-data-privacy-secret.md#p4-비밀값과-logtelemetry-정제), operations-release 항목
[web-operations-release-slo-signal.md O2](./web-operations-release-slo-signal.md#o2-운영-신호alertrunbook-연결)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 I1·I2 → [swe.md S4](./swe.md#s4-책임-경계와-결합도)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### I1. 수집·저장·질의·alert·privacy 경계

- 질문: 관측 data 종류마다 수집 범위·저장 위치·보존 기간·접근 권한·alert 경로를 정하고, 개인정보가 관측 저장소에 들어가지 않게 막았는가?
- 기본 severity: `medium`
- 적용 조건: 관측 수집·저장·보존·접근·alert 설정을 바꾸는 변경
- 결함 패턴: 도구부터 고르고 수집·보존·접근 경계를 정하지 않음, 개인정보가 관측 저장소에 들어감, 보존 기간·접근 권한이 없음
- PASS 근거: data 종류(metric·log·trace·오류)마다 수집 범위·저장 위치·보존 기간·접근 권한을 적은 표가 정책이나 owner 문서에 있고 설정 값(도구 기본값을 쓰면 확인한 그 값)과 같으며, 수집 경로에서 개인정보를 빼는 정제와 그 확인 test가 있다
- 지침: 도구를 고르기 전에 수집·저장·질의·alert·개인정보 경계를 정하고, 고른 도구가 그 경계를 지키게 설정한다. 보존 기간과 접근 권한을 data 종류마다 정하고, 도구 기본값을 쓰면 그 값을 확인해 적는다. 수집 단계에서 개인정보를 빼고 저장소마다 접근할 수 있는 사람을 좁힌다
- 피함: 수집·보존·접근 경계를 정하지 않고 수집을 시작하기, 개인정보를 관측 저장소에 보내기, 보존 기간·접근 권한 없이 쌓기

### I2. 관측 UI와 제품 운영 화면 분리

- 질문: 관측 UI는 상태를 보고 대응을 판단하는 데만 쓰고 제품 운영 작업(제재·data 수정)은 인가와 감사 기록이 있는 제품 운영 화면에서 하며, 제품 운영 화면은 관측 저장소를 직접 읽지 않는가?
- 기본 severity: `low`
- 적용 조건: 관측 dashboard·운영 화면의 책임을 바꾸는 변경
- 결함 패턴: 관측 UI로 제품 운영 작업(제재·data 수정)을 함, 제품 운영 화면이 관측 저장소를 직접 읽음
- PASS 근거: 관측 dashboard에 제품 data를 바꾸는 동작이 없고, 제품 운영 작업은 인가·감사 기록이 있는 운영 화면·API를 거치며, 운영 화면의 data 출처가 제품 저장소나 그 공개 contract다
- 지침: 관측 UI는 신호를 보고 대응을 판단하는 곳으로 두고, 제재·data 수정 같은 제품 운영 작업은 인가와 감사 기록을 가진 제품 운영 화면에 둔다. 운영 화면에 관측 정보가 필요하면 관측 저장소를 직접 읽지 않고 정해진 연결(링크나 요약 contract)로 받는다
- 피함: 관측 UI에서 제품 data 고치기, 운영 화면이 관측 저장소를 직접 읽기
