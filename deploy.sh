#!/usr/bin/env bash

# ==============================================================================
# AuraReader Workstation - VPS 一键 Docker 部署脚本
# ==============================================================================

set -e

echo "🚀 开始部署 AuraReader Workstation 到 VPS 节点..."

# 1. 检查 Docker 环境
if ! command -v docker &> /dev/null; then
    echo "⚠️ 未检测到 Docker 运行环境，正在为您自动安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

# 2. 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    echo "⚠️ 未检测到 Docker Compose 插件，正在安装..."
    apt-get update && apt-get install -y docker-compose-plugin || yum install -y docker-compose-plugin
fi

# 3. 编译并启动容器
echo "📦 正在构建 Docker 镜像并启动 Nginx 容器服务..."
docker compose down || true
docker compose up --build -d

# 4. 部署成功提示
echo "=============================================================================="
echo "🎉 AuraReader Workstation 已成功成功部署并在后台运行！"
echo "🌐 访问地址: http://$(curl -s ifconfig.me):80 (或 http://$(curl -s ifconfig.me):8095)"
echo "📄 容器状态: $(docker ps --filter "name=aurareader-workstation" --format "{{.Status}}")"
echo "=============================================================================="
echo "💡 若需配置 HTTPS / SSL 证书，请参阅部署指南: deploy_vps.md"
