# Generated development artifacts

이 디렉터리는 저장소 도구가 생성하는 로컬 검증 결과의 공통 진입점이다. OMX를 포함한
특정 개발 도구의 설치 여부와 무관하며, production runtime에서는 사용하지 않는다.

기본 출력은 Git에서 제외되는 `artifacts/local/` 아래에 생성된다.

```text
artifacts/local/
├── build/          # OCI image, SBOM, provenance, manifest
├── infra/          # compose·runtime config 검증 결과
├── observability/  # Web/BFF 관측 rehearsal 결과
├── stress/         # API stress·capacity 결과
└── visual/         # 일반 개발 workflow의 시각 검증 결과
```

- 모든 생성물은 삭제 후 다시 만들 수 있어야 한다.
- token, cookie, password, DB URL, webhook 등 secret 원문을 기록하지 않는다.
- 출력 위치를 바꿔야 하면 `KNU_ARTIFACTS_DIR` 또는 각 command의 명시적 `--output`·전용
  환경변수를 사용한다.
- GitHub Actions는 checkout 내부가 아니라 `${{ runner.temp }}`에 evidence를 생성한 뒤
  Actions artifact로 업로드한다.
- `.omx/`는 OMX session state와 agent-owned 계획·로그만 소유하며 repository script의
  기본 출력 경로로 사용하지 않는다.
