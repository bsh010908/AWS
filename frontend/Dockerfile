FROM nginx:alpine

# Remove default nginx static files.
RUN rm -rf /usr/share/nginx/html/*

# Copy frontend static files.
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
