# Platform runtime

NestJS 애플리케이션이 시작되기 전후에 공통으로 필요한 process runtime 설정을 소유한다.

- `app.config.ts`, `app.env.ts`: 실행 환경, 포트, timezone contract
- `secret-source.config.ts`, `secret-source.env.ts`: secret materialization source 선택 contract
- `bootstrap/prepare-runtime-environment.ts`: Nest import 전에 required secret을 읽고 process env에 적용
- `bootstrap/runtime-bootstrap-receipt.ts`: secret value/key를 포함하지 않는 immutable 준비 완료 증거

지원 source는 local/test의 `env`, Lightsail production의 `mounted-files`, credential-provider chain을
제공하는 AWS runtime을 위한 `aws-secrets-manager`다. Lightsail에서는 release plane이 Secrets Manager
origin을 versioned file bundle로 설치하고 application은 read-only mount만 읽는다.

제품 도메인 설정이나 secret value는 이 디렉토리에 두지 않는다. Config composition과 deployment
manifest projection은 `src/config/`가 담당한다.
