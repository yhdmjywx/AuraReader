import { createServer as createViteServer } from 'vite';
import serverModule from '../src/server/server.js';

const api = serverModule.createServer();
api.listen(Number(process.env.PORT || 8095), '127.0.0.1');
const vite = await createViteServer();
await vite.listen();
vite.printUrls();

async function close() {
    await vite.close();
    api.close();
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
