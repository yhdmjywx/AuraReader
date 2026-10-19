const { createServer } = require('../../src/server/server');
let server;
const forbidden = new Set([2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);
function start() {
    server = createServer({ dataDirectory: process.argv[2] });
    server.listen(0, '127.0.0.1', () => {
        if (forbidden.has(server.address().port)) return server.close(start);
        process.send({ port: server.address().port });
    });
}
start();
process.on('message', message => { if (message === 'close') server.close(() => process.exit(0)); });
