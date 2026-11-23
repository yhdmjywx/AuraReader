const path = require('node:path');
const { createRequire } = require('node:module');

const pkg = path.resolve(__dirname, '../../dist/connector');
const requireConnector = createRequire(path.join(pkg, 'package.json'));
const { Client } = requireConnector('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = requireConnector('@modelcontextprotocol/sdk/client/stdio.js');

async function connect(profile, packageRoot = pkg) {
    const client = new Client({ name: 'aurareader-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
        command: process.env.AURAREADER_TEST_NODE || process.execPath,
        args: [path.join(packageRoot, 'server/index.cjs'), '--profile', profile], stderr: 'pipe',
        env: { ...(process.platform === 'win32' && process.env.APPDATA ? { APPDATA: process.env.APPDATA } : {}) }
    });
    let stderr = '';
    transport.stderr.on('data', chunk => { stderr += chunk; });
    try { await client.connect(transport); }
    catch (error) { await client.close(); throw new Error(stderr || error.message); }
    return client;
}
module.exports = { connect, pkg };
