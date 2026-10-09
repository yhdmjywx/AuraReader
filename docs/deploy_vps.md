# 🌐 AuraReader Workstation - VPS 部署与 HTTPS 证书配置指南

本指南将协助您快速将 **AuraReader Workstation** 部署到任何 VPS 节点（如阿里云、腾讯云、AWS、甲骨文云、搬瓦工等），并配置高性能 Nginx + 免费 HTTPS / SSL 证书。

---

## 快速一键部署 (Quick 1-Click Deploy)

只需登录您的 VPS 终端，运行以下命令：

```bash
# 1. 克隆项目仓库
git clone https://github.com/your-username/reader_workstation.git
cd reader_workstation

# 2. 赋予脚本执行权限并一键部署
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

部署完成后，即可在浏览器直接访问：
`http://<您的VPS公网IP>:8095`

---

## 🔒 配置免费 HTTPS / SSL 域名证书

在 VPS 绑定域名并开通加密传输（强烈推荐，可开启完整的 IndexedDB 与离线 Service Worker 体验）：

### 方式一：使用 Certbot 自动化申请 (Let's Encrypt)

```bash
# 1. 安装 Certbot
sudo apt-get install -y certbot

# 2. 申请域名 SSL 证书 (替换 your-domain.com 为您的实际域名)
sudo certbot certonly --webroot -w ./certbot/www -d your-domain.com

# 3. 编辑 deploy/nginx.conf，取消 SSL server 块的注释并填写您的域名
# 4. 重启 Docker 容器
docker compose -f deploy/docker-compose.yml restart
```

### 方式二：使用 Cloudflare (最省心推荐)

1. 在 Cloudflare 中将 DNS 记录指向您的 VPS 公网 IP（勾选黄色小云朵开启 CDN 代理）。
2. 在 Cloudflare 控制台将 **SSL/TLS 模式设置为 "Flexible" 或 "Full"**。
3. 即可直接通过 `https://your-domain.com` 安全访问！

---

## 🛠️ 运维与服务管理指令

```bash
# 查看容器实时运行状态
docker compose -f deploy/docker-compose.yml ps

# 查看访问日志与错误日志
docker compose -f deploy/docker-compose.yml logs -f aurareader

# 重启容器服务
docker compose -f deploy/docker-compose.yml restart

# 更新代码后重新构建部署
git pull && ./deploy/deploy.sh
```

---

## 🛡️ 防火墙与端口开放说明

请确保您的 VPS 云厂商控制台“安全组”及本地防火墙已放行以下端口：
- **80** (HTTP 标准端口)
- **443** (HTTPS 加密端口)
- **8095** (工作台备用服务端口)
