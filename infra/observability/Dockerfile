# 관측 설정 image `dormduri/observability-config`(production-api-baseline D-AB14). 설정 파일만 담는 FROM scratch image이고 실행하지
# 않는다. API 배포 document가 `docker create` 뒤 `docker cp`로 /dormduri-observability를 host의
# /opt/dormduri/observability/config/<digest>/에 펼치고(Owner 2026-11-11), API 묶음 조각의 관측 container가 그 경로를 읽기 전용으로
# mount한다. build context는 이 디렉터리다(api-cd). 아래 COPY 원본이 api-cd 경로 filter이고 api-cd-contract test가 둘을 대조한다.
# secret·webhook URL·local 예시(.env.observability.example, alertmanager.yml.example)는 담지 않는다.
FROM scratch
COPY alloy/config.alloy alloy/pipeline.alloy /dormduri-observability/alloy/
COPY loki/loki.yml /dormduri-observability/loki/
COPY loki/rules/ /dormduri-observability/loki/rules/
COPY prometheus/prometheus.production.yml /dormduri-observability/prometheus/
COPY prometheus/rules/ /dormduri-observability/prometheus/rules/
COPY alertmanager/alertmanager.production.yml /dormduri-observability/alertmanager/
COPY alertmanager/templates/ /dormduri-observability/alertmanager/templates/
COPY grafana/provisioning/ /dormduri-observability/grafana/provisioning/
COPY grafana/dashboards/ /dormduri-observability/grafana/dashboards/
