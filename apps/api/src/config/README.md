# API configuration composition

이 디렉토리는 API runtime configuration의 **composition root**다. 제품 정책이나 domain 설정의
의미를 새로 소유하지 않는다.

## Source of truth

`composition/api-config.registry.ts`의 `API_CONFIG_SLICES`가 다음 projection의 단일 등록 지점이다.

- NestJS `ConfigModule`이 load하는 config factory
- bootstrap에서 사용하는 Joi validation schema
- `infra/deploy/api/env.manifest.json`을 만드는 env metadata

각 slice는 `environment/config-slice.ts`의 `ApiConfigSlice` contract를 사용한다. Registry는 시작 시
factory key와 env key 중복을 거부하고 schema key와 metadata key가 정확히 일치하는지 확인한다.

## 변경 순서

환경 변수를 추가하거나 수정할 때는 다음을 함께 변경한다.

1. 해당 owner의 config factory 또는 runtime reader
2. 해당 owner의 Joi schema definition
3. 해당 owner의 `EnvKeyDefinition`
4. `API_CONFIG_SLICES`의 owner slice 등록
5. `pnpm --dir apps/api env:manifest:generate`
6. config registry, env validation, deployment env contract test

설정 값의 의미, Joi schema, env metadata는 실제 consumer owner가 함께 정의한다. 이 디렉토리는
owner-local slice를 조합하고 manifest를 생성하는 공통 contract만 담당한다.

## 금지 사항

- `AppModule`, `environment/env.validation.ts`, `environment/env-key.registry.ts`에 별도의 수동 목록을
  추가하지 않는다.
- secret value, production credential, materialized secret을 registry나 manifest에 저장하지 않는다.
- `config/` root에 제품 의미를 가진 `*.config.ts`, `*.env.ts`, category schema를 추가하지 않는다.
- schema만 또는 metadata만 등록하지 않는다. Registry parity guard가 이를 bootstrap 전에 거부한다.
