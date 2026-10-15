# Web security-privacy data privacy and secret criteria

[Review criteria](./README.md)의 `web-security-privacy-data-privacy-secret` 기준입니다. 개인정보·비공개 필드·비밀값의 표시,
전달, 저장, 기록을 바꾸는 변경에 적용합니다. 지금은 숨긴 신원·비공개 필드의 공개 범위 항목만 있고, 나머지 항목은 이 영역을
바꾸는 변경 전에 더합니다.

이 문서를 고르면 [`swe`](./swe.md)도 함께 고릅니다. 이 문서의 항목은 `swe` 항목을 상속하고 그보다 좁은 조건을 더 봅니다. 강화 관계는 P1 →
[swe.md S2](./swe.md#s2-제품-정책-부합)입니다.
상속한 항목은 이 문서를 골라도 자기 기본 severity로 그대로 적용되고, 같은 결함이 두 항목에 함께 맞으면 기본
severity가 높은 항목으로 판정합니다. [web-bff-server-read-error-privacy-shaping](./web-bff-server-read-error-privacy-shaping.md)이
P1을 상속합니다.

각 항목의 지침·피함은 구현할 때 보는 보기이고, 나머지 줄은 리뷰할 때 보는 보기입니다. 적용 조건은 두 보기가 함께 씁니다.

### P1. 숨긴 신원·비공개 필드의 공개 범위 유지

- 질문: server가 숨긴 신원·비공개 필드를 client·BFF가 추론·재조회·cache·문구·URL·분석 event·log로 다시 드러내지 않는가?
- 기본 severity: `high`
- 적용 조건: 공개 범위가 제한된 신원·필드를 표시·전달·저장·기록하는 code
- 결함 패턴: 숨긴 값을 다른 API로 다시 조회함, 숨김 표시와 함께 원래 값을 응답·cache·URL에 남김, 문구나 개수로 숨긴 대상을 추론할 수 있게 함, 분석 event·log에 숨긴 값을 담음
- PASS 근거: 숨김 projection test(응답에 숨긴 필드가 없음)와 숨긴 대상을 다시 조회하지 않는다는 assertion이 있고, 분석 event·log의 필드 목록에 숨긴 값이 없다
- 지침: 공개 범위는 server 판정을 따르고 client·BFF는 숨긴 값을 받지도 다시 찾지도 않는다. 숨긴 대상은 필요한 최소 표시(익명 표기 등)만 쓴다
- 피함: 숨긴 값 재조회, 숨긴 값을 cache·URL·log에 저장하기, 개수·문구로 추론을 허용하기
