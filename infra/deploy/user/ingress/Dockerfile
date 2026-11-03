# Web 단계 ingress image. 고정 nginx base 위에 Web 단계 설정과 정적 안내 화면을 담아 Web image와 쌍으로 배포한다.
# base pin은 Renovate가 갱신한다(infra/image-inventory.json `user-host-ingress`).
FROM nginx:1.31.8-alpine@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606

RUN rm -f /etc/nginx/conf.d/*.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/
COPY snippets/ /etc/nginx/snippets/
# 정적 안내 화면 넷은 고치지 않고 그대로 담는다. 설정이 내부 URI `/__pages/<파일>`로 내보낸다.
COPY html/ /usr/share/nginx/dormduri/__pages/

# 공식 image의 nginx 사용자(uid·gid 101)로 특권 port 없이(8080·8443·8081) 실행한다.
# 설정 파일을 고치는 공식 entrypoint script는 쓰지 않는다(read-only root).
USER 101:101
EXPOSE 8080 8443 8081
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
