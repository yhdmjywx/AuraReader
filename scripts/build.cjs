const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n'
    }));
    process.exit(1);
}
if (program.emit().emitSkipped) throw new Error('TypeScript build failed');
fs.mkdirSync(path.join(root, 'dist/client'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/client/package.json'), path.join(root, 'dist/client/package.json'));
console.log('Client build and strict TypeScript checks passed.');
