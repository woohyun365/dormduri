# 백오피스 admin ingress image(backoffice-foundation D-BF2). 고정 nginx base 위에 설정 하나만 담는다. host에는
# `127.0.0.1:4300`으로만 publish되고(compose), SSM 포트 포워딩으로 들어온 요청을 backoffice-web에 넘긴다.
# base pin은 Renovate가 갱신한다(infra/image-inventory.json `backoffice-ingress`).
FROM nginx:1.31.8-alpine@sha256:fed7e14be83cbd2661a75cdc5b872d936cf155d46c327084d30b8df19ae88d72

RUN rm -f /etc/nginx/conf.d/*.conf
COPY nginx.conf /etc/nginx/nginx.conf

# 공식 image의 nginx 사용자(uid·gid 101)로 특권 port 없이(8080, health 8081) 실행한다. 설정 파일을 고치는 공식 entrypoint
# script는 쓰지 않는다(read-only root).
USER 101:101
EXPOSE 8080
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
