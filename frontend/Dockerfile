FROM nginx:alpine

# nginx 기본 html 폴더 비우기
RUN rm -rf /usr/share/nginx/html/*

# 프론트 파일 복사
COPY . /usr/share/nginx/html

# 80포트 사용
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]