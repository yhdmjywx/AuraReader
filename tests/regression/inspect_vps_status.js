const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const keyPath = path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519');
const privateKey = fs.readFileSync(keyPath);

const config = {
    host: '168.222.0.61',
    port: 22222,
    username: 'root',
    privateKey: privateKey,
    readyTimeout: 20000
};

const conn = new Client();

console.log("📡 正在连接 VPS 检查 AuraReader 服务运行状态:", config.host + ":" + config.port);

conn.on('ready', () => {
    console.log("✅ ED25519 验证成功，执行全面状态巡检命令...\n");

    const checkCmd = `
        echo "=== [1. 容器运行状态 Docker Containers] ==="
        docker ps -a --filter "name=aurareader" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        
        echo ""
        echo "=== [2. 本地 HTTP 接口响应状态 (Port 8095)] ==="
        curl -Is http://127.0.0.1:8095 | head -n 5
        
        echo ""
        echo "=== [3. 容器最近运行日志 (Recent Logs)] ==="
        docker logs aurareader-workstation --tail 15
        
        echo ""
        echo "=== [4. 宿主机系统负载与内存使用 (System Load & Memory)] ==="
        free -h
        echo ""
        uptime
    `;

    conn.exec(checkCmd, (err, stream) => {
        if (err) throw err;

        stream.on('close', (code) => {
            console.log(`\n🏁 VPS 服务状态巡检完成 (退出码: ${code})`);
            conn.end();
            process.exit(code || 0);
        });

        stream.on('data', (data) => process.stdout.write(data.toString()));
        stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
    });
});

conn.on('error', (err) => {
    console.error("❌ SSH 连接失败:", err.message);
    process.exit(1);
});

conn.connect(config);
