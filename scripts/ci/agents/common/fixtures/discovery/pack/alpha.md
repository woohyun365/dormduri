# Fixture/Alpha

[Discovery fixture pack](./README.md)의 Alpha layer입니다.

## one

`Fixture/Pack/Alpha/one`

### 결정 목록

#### alpha.one.style

- 수준: `architecture-style`
- 질문: 전체 모양을 가로 할까, 나로 할까?
- 선택지:
  - 가: 가 모양으로 만든다. 단순하지만 확장이 어렵다
  - 나: 나 모양으로 만든다. 유연하지만 규칙이 늘어난다
- 먼저 정할 결정: 없음
- 되돌림: `one-way`. 모양 전체를 다시 쓴다
- 기본값: 가. 처음에는 단순한 쪽이 낫다. 여러 팀이 나눠 쓰면 나를 고른다
- 확인 단서: `{{binding:stack.alpha}}`
- 기준 항목: 없음

#### alpha.one.layout

- 수준: `framework-pattern`
- 질문: 화면 배치를 고정할까, 바꿀 수 있게 할까?
- 선택지:
  - 고정: 배치를 하나로 둔다. 단순하지만 바꿀 때 전부 고친다
  - 교체: 배치를 바꿀 수 있게 둔다. 유연하지만 경계가 늘어난다
- 먼저 정할 결정: `alpha.one.style`
- 되돌림: `costly`. 배치를 쓰는 곳을 모두 고친다
- 기본값: 고정. 화면이 적을 때는 충분하다. 화면이 늘면 교체를 고른다
- 확인 단서: `{{binding:repo-structure.alpha-layout}}`
- 기준 항목: 없음

#### alpha.one.copy

- 수준: `code-pattern`
- 질문: 문구를 어디에 둘까?
- 선택지:
  - 부품 안: 부품마다 문구를 둔다. 찾기 쉽지만 중복된다
  - 한 곳: 문구를 모아 둔다. 중복이 없지만 간접 참조가 늘어난다
- 먼저 정할 결정: `alpha.one.layout`
- 되돌림: `easy`. 문구 위치만 옮긴다
- 기본값: 한 곳. 같은 문구를 여러 번 쓰지 않는다. 문구가 한두 개뿐이면 부품 안에 둔다
- 확인 단서: `{{binding:repo-structure.alpha-copy}}`
- 기준 항목: 없음

### 위험

- 배치와 모양이 어긋남
- 비가역 선택: `alpha.one.style`(`one-way`), `alpha.one.layout`(`costly`, 다른 결정이 먼저 정할 결정으로 가리킴)

## two

`Fixture/Pack/Alpha/two`

### 결정 목록

#### alpha.two.cache

- 수준: `code-pattern`
- 질문: 받은 data를 어디에 보관할까?
- 선택지:
  - 화면: 화면이 들고 있는다. 단순하지만 화면끼리 공유하지 못한다
  - 공유 저장소: 한 곳에 둔다. 공유되지만 무효화 규칙이 필요하다
- 먼저 정할 결정: `alpha.one.layout`, `beta.three.retention`
- 되돌림: `costly`. 보관 위치를 쓰는 곳을 모두 고친다
- 기본값: 공유 저장소. 같은 data를 두 번 받지 않는다. 화면이 하나뿐이면 화면에 둔다
- 확인 단서: `{{binding:repo-structure.alpha-cache}}`
- 기준 항목: 없음

#### alpha.two.naming

- 수준: `code-pattern`
- 질문: 이름 규칙을 정할까?
- 선택지:
  - 규칙: 이름 규칙을 둔다. 읽기 쉽지만 지켜야 한다
  - 자유: 정하지 않는다. 빠르지만 섞인다
- 먼저 정할 결정: `alpha.one.copy`
- 되돌림: `easy`. 이름만 바꾼다
- 기본값: 규칙. 섞이지 않는다. 한 사람만 쓰면 자유로 둔다
- 확인 단서: `{{binding:tool.alpha-lint}}`
- 기준 항목: 없음

### 위험

- 보관 위치가 화면마다 다름
- 비가역 선택: 없음. `alpha.two.cache`는 `costly`이지만 다른 결정이 먼저 정할 결정으로 가리키지 않는다
