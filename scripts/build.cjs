const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const typeTests = fs.readdirSync(path.join(root, 'tests/types')).filter(file => file.endsWith('.mts')).map(file => path.join(root, 'tests/types', file));
const contractProgram = ts.createProgram([...typeTests, ...parsed.fileNames.filter(file => file.endsWith('.d.ts'))], { ...parsed.options, rootDir: root, noEmit: true });
const desktopConfig = ts.readConfigFile(path.join(root, 'tsconfig.desktop.json'), ts.sys.readFile);
if (desktopConfig.error) throw new Error(ts.flattenDiagnosticMessageText(desktopConfig.error.messageText, '\n'));
const desktopParsed = ts.parseJsonConfigFileContent(desktopConfig.config, ts.sys, root);
const desktopProgram = ts.createProgram(desktopParsed.fileNames, desktopParsed.options);
const diagnostics = [...parsed.errors, ...desktopParsed.errors, ...ts.getPreEmitDiagnostics(program), ...ts.getPreEmitDiagnostics(contractProgram), ...ts.getPreEmitDiagnostics(desktopProgram)];
if (diagnostics.length) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n'
    }));
    process.exit(1);
}
if (!process.argv.includes('--check')) {
    // Vite transforms these in the renderer build. The unbundled Node test
    // modules need equivalent raw text and URLs pointing at emitted JS workers.
    const nodeAssets = context => source => {
        const resolve = createRequire(source.fileName).resolve;
        const visit = node => {
            if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
                && node.moduleSpecifier.text.endsWith('?raw')) {
                const clause = node.importClause;
                if (!clause?.name || clause.namedBindings) throw new Error('Unsupported raw import: ' + node.getText(source));
                const filename = resolve(node.moduleSpecifier.text.slice(0, -4));
                return context.factory.createVariableStatement(undefined,
                    context.factory.createVariableDeclarationList([
                        context.factory.createVariableDeclaration(clause.name, undefined, undefined,
                            context.factory.createStringLiteral(fs.readFileSync(filename, 'utf8')))
                    ], ts.NodeFlags.Const));
            }
            if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
                && node.arguments?.length === 2 && ts.isStringLiteral(node.arguments[0])
                && /\.tsx?$/.test(node.arguments[0].text) && node.arguments[1].getText(source) === 'import.meta.url') {
                return context.factory.updateNewExpression(node, node.expression, node.typeArguments,
                    [context.factory.createStringLiteral(node.arguments[0].text.replace(/\.tsx?$/, '.js')), node.arguments[1]]);
            }
            return ts.visitEachChild(node, visit, context);
        };
        return ts.visitNode(source, visit);
    };
    if (program.emit(undefined, undefined, undefined, undefined, { before: [nodeAssets] }).emitSkipped) throw new Error('TypeScript build failed');
    fs.mkdirSync(path.join(root, 'dist/client'), { recursive: true });
    fs.copyFileSync(path.join(root, 'src/client/package.json'), path.join(root, 'dist/client/package.json'));
}
console.log('Strict TypeScript and contract checks passed' + (process.argv.includes('--check') ? '.' : '; client built.'));
