# Fixture/beta

[Discovery fixture pack](./README.md)의 beta cross-cutting layer입니다.

## three

`Fixture/Pack/beta/three`

### 결정 목록

#### beta.three.retention

- 수준: `policy`
- 질문: data를 얼마나 보관할까?
- 선택지:
  - 짧게: 필요한 동안만 둔다. 안전하지만 나중에 다시 받을 수 없다
  - 길게: 오래 둔다. 다시 쓰기 쉽지만 보관 책임이 커진다
- 먼저 정할 결정: 없음
- 되돌림: `costly`. 보관 방식과 삭제 절차를 고친다
- 기본값: 짧게. 보관 책임이 작다. 법적 보관 의무가 있으면 그 기간을 따른다
- 확인 단서: `{{binding:policy.retention}}`
- 기준 항목: 없음

### 위험

- 보관 기간이 정책과 다름
- 비가역 선택: `beta.three.retention`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)
