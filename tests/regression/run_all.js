const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('🧪 AuraReader 回归测试套件全量执行器 (Regression Suite Runner)');
console.log('====================================================\n');

const regDir = __dirname;
const allFiles = fs.readdirSync(regDir)
    .filter(f => f.endsWith('.js') && f !== 'run_all.js')
    .sort();

let total = allFiles.length;
let passed = 0;
let failed = 0;
const failureDetails = [];

allFiles.forEach((file, index) => {
    const filePath = path.join(regDir, file);
    process.stdout.write(`[${index + 1}/${total}] 运行 ${file} ... `);
    try {
        const stdout = execSync(`node "${filePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        passed++;
        console.log('✅ PASSED');
    } catch (err) {
        failed++;
        console.log('❌ FAILED');
        failureDetails.push({ file, stderr: err.stderr || err.message, stdout: err.stdout });
    }
});

console.log('\n====================================================');
console.log(`📊 回归测试执行汇总: 共 ${total} 项, 通过: ${passed}, 失败: ${failed}`);
console.log('====================================================');

if (failed > 0) {
    console.error('\n❌ 以下测试未能通过:');
    failureDetails.forEach(f => {
        console.error(`- ${f.file}:\n${f.stderr || f.stdout}`);
    });
    process.exit(1);
} else {
    console.log('🎉 全部回归测试套件 100% 通过验证！');
    process.exit(0);
}
