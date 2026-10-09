# 使用超轻量级 Node.js 20 Alpine 镜像 (~40MB)
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制项目核心文件与代码
COPY package.json ./
COPY src/ ./src/
COPY docs/ ./docs/
COPY README.md ./

# 暴露工作台服务端口
EXPOSE 8095

# 启动 Node.js 一体化 Web 服务
CMD ["node", "src/server/server.js"]
