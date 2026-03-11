FROM nginx:alpine

# 기본 nginx html 삭제
RUN rm -rf /usr/share/nginx/html/*

# 프론트 파일 복사
COPY . /usr/share/nginx/html

# nginx 설정 추가
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]