# 使用超轻量级 Node.js 20 Alpine 镜像 (~40MB)
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制项目核心文件与代码
COPY package.json ./
COPY index.html styles.css app.js server.js ./
COPY README.md prd_v0_5.md workflow_architecture.md agent.md status.md ./

# 暴露工作台服务端口
EXPOSE 8095

# 启动 Node.js 一体化 Web 服务
CMD ["node", "server.js"]
