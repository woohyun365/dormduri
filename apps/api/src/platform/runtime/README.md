# Platform runtime

NestJS 애플리케이션이 시작되기 전후에 공통으로 필요한 process runtime 설정을 소유한다.

- `app.config.ts`, `app.env.ts`: 실행 환경, 포트, timezone contract
- `secret-source.config.ts`, `secret-source.env.ts`: secret materialization source 선택 contract
- `bootstrap/prepare-runtime-environment.ts`: Nest import 전에 required secret을 읽고 process env에 적용
- `bootstrap/runtime-bootstrap-receipt.ts`: secret value/key를 포함하지 않는 immutable 준비 완료 증거

제품 도메인 설정이나 secret value는 이 디렉토리에 두지 않는다. Config composition과 deployment
manifest projection은 `src/config/`가 담당한다.
