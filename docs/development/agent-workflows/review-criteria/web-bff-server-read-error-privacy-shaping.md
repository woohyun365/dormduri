# Web BFF server read, error, and privacy shaping criteria

[Review criteria](./README.md)의 `web-bff-server-read-error-privacy-shaping` 기준입니다. Server render 중 data 읽기,
upstream 오류 번역, browser로 보내는 응답의 형태를 바꾸는 변경에 적용합니다.

이 문서를 고르면 [`swe`](./swe.md)와 상속하는 security-privacy 항목
[web-security-privacy-data-privacy-secret.md P1](./web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)도
함께 고릅니다. 이 문서의 항목은 상속 항목보다 좁은 조건을 더 봅니다. 강화 관계는 B1·B2 → [swe.md S3](./swe.md#s3-정확성과-오류-경로), B3 →
[swe.md S5](./swe.md#s5-계약-호환성)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### B1. server read 경로

- 질문: server render 중 data 읽기가 upstream을 직접 읽고 부수효과가 없으며, 사용자별 data가 공유 cache에 섞이지 않는가?
- 기본 severity: `medium`
- 적용 조건: server render 중 data를 읽거나 조합하는 code
- 결함 패턴: 자기 BFF route를 server에서 다시 호출(loopback)해 왕복과 cookie 재전달이 생김, read 경로에서 상태를 바꾸거나 cookie를 씀, 사용자별 응답을 공유 cache에 둠
- PASS 근거: server read가 upstream reader를 직접 쓰고, 사용자별 응답이 cache되지 않거나 identity가 cache key에 있다는 설정·test가 있다
- 지침: server read는 upstream을 직접 읽고 응답 정리 규칙은 BFF와 공유 helper로 재사용한다. 사용자별 응답은 cache하지 않거나 identity를 key에 넣는다
- 피함: loopback 호출, read 중 쓰기, 사용자 data의 공유 cache

### B2. 오류 번역

- 질문: upstream 오류가 내부 원문 없이 안전한 공통 형식으로 번역되고, 인증 만료·권한 없음·충돌·일시 장애가 구분되는가?
- 기본 severity: `medium`
- 적용 조건: upstream 오류를 browser 응답이나 화면 상태로 바꾸는 code
- 결함 패턴: 내부 오류 원문·stack·upstream 주소를 browser로 보냄, 모든 오류를 일반 오류 하나로 뭉쳐 화면이 다음 행동을 고르지 못함, route마다 오류 형식이 다름
- PASS 근거: 오류 종류별(인증 만료·권한 없음·대상 없음·충돌·일시 장애) 번역 test가 있고, 응답에 내부 정보가 없다는 assertion이 있다
- 지침: upstream 오류는 공통 helper로 안전한 형식에 번역하고 종류별 의미를 보존한다. 내부 정보는 server log에만 남긴다
- 피함: 오류 원문 전달하기, 오류 종류 구분 없애기, route별 오류 형식

### B3. 응답 최소화와 upstream 검증

- 질문: browser로 보내는 응답이 화면에 필요한 field만 담고, upstream 응답을 schema로 검증한 뒤 쓰는가?
- 기본 severity: `high`
- 적용 조건: BFF가 browser로 보내는 응답 형태를 더하거나 바꾸는 변경
- 결함 패턴: upstream 응답을 그대로 전달해 필요 없는 개인정보·내부 id·token이 나감, upstream 응답을 검증 없이 통과시켜 형식 변경이 화면 오류로 번짐, 같은 응답의 projection을 화면마다 따로 둠
- PASS 근거: route마다 응답 projection과 그 test(필요 없는 field가 없다는 assertion 포함)가 있고, upstream 응답의 schema 검증 위치가 있다
- 지침: route마다 화면에 필요한 field만 고르는 projection을 두고, upstream 응답은 공유 schema로 검증한 뒤 projection한다
- 피함: upstream 응답 통째 전달하기, 검증 없는 통과
