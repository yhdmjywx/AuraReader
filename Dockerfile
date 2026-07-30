# 使用轻量级 Nginx Alpine 镜像
FROM nginx:1.25-alpine

# 删除默认 Nginx 配置
RUN rm -rf /etc/nginx/conf.d/default.conf

# 复制自定义 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制前端代码至 Nginx 默认工作目录
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY app.js /usr/share/nginx/html/app.js
COPY README.md /usr/share/nginx/html/README.md

# 开放 80, 443 及 8095 端口
EXPOSE 80 443 8095

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
