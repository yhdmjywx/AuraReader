// Build one classic script from the annotation and chapter-export modules.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'dist');
const scope = '.aura-showcase-reader';
const sourceHashes = {};
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const read = filename => { const text = fs.readFileSync(filename, 'utf8'); sourceHashes[path.relative(root, filename).replaceAll('\\', '/')] = hash(text); return text; };
const dom = new JSDOM(read(path.join(root, 'src/client/index.html')));
const doc = dom.window.document;
const header = doc.querySelector('.app-header');
header.querySelectorAll('button').forEach(button => {
  if (button.id === 'btn-export-menu') return;
  button.removeAttribute('aria-controls'); button.removeAttribute('aria-expanded');
  button.setAttribute('aria-disabled', 'true'); button.dataset.previewOnly = '';
  button.tabIndex = -1;
});
header.querySelector('#current-book-title').textContent = "Alice's Adventures in Wonderland";
const template = header.outerHTML + doc.querySelector('#export-panel').outerHTML + '<main class="workspace-container immersive-notes layout-single" id="workspace-container"><section class="reader-panel" id="reader-panel"><div class="reader-viewport" id="reader-viewport"><div class="paper-container" id="paper-container"><article class="book-paper book-paper-left" id="book-paper"></article></div></div>' + doc.querySelector('#selection-tooltip').outerHTML + doc.querySelector('#highlight-action-tooltip').outerHTML + '</section><section class="notes-panel" id="notes-panel"><div class="notes-list" id="notes-list"><div class="empty-state" id="empty-notes-state"><p></p></div></div></section></main>';
dom.window.close();
function splitSelectors(selector) {
  let depth = 0, start = 0; const parts = [];
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(' || selector[i] === '[') depth++;
    if (selector[i] === ')' || selector[i] === ']') depth--;
    if (selector[i] === ',' && depth === 0) { parts.push(selector.slice(start, i)); start = i + 1; }
  }
  parts.push(selector.slice(start)); return parts;
}
function scopedCSS(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let result = '', at = 0;
  while (at < text.length) {
    const open = text.indexOf('{', at);
    if (open < 0) break;
    const selector = text.slice(at, open).trim();
    let depth = 1, end = open + 1;
    while (end < text.length && depth) { if (text[end] === '{') depth++; if (text[end] === '}') depth--; end++; }
    const body = text.slice(open + 1, end - 1);
    if (selector.startsWith('@media')) result += selector + '{' + scopedCSS(body) + '}\n';
    else if (selector.startsWith('@')) result += selector + '{' + body + '}\n';
    else result += splitSelectors(selector).map(part => {
      part = part.trim();
      return /^(?::root|body|html)(?=[\s.:#[]|$)/.test(part) ? part.replace(/^(?::root|body|html)/, scope) : scope + ' ' + part;
    }).join(',') + '{' + body + '}\n';
    at = end;
  }
  return result;
}
fs.writeFileSync(path.join(out, 'showcase-reader.css'), scopedCSS(read(path.join(root, 'src/client/styles.css'))) + read(path.join(__dirname, 'demo/demo.css')));
const modules = new Map();
const virtualTemplate = path.join(__dirname, 'demo/template.js');
function resolve(request, from) {
  if (!request.startsWith('.')) throw new Error('Unexpected dependency: ' + request);
  let filename = path.resolve(path.dirname(from), request);
  if (filename === virtualTemplate) return filename;
  if (!fs.existsSync(filename) && filename.endsWith('.js')) filename = filename.slice(0, -3) + '.ts';
  if (filename === path.join(root, 'src/client/infrastructure/storageClient.ts')) filename = path.join(__dirname, 'demo/memory-storage.js');
  return filename;
}
function include(filename) {
  const id = path.relative(root, filename).replaceAll('\\', '/');
  if (modules.has(id)) return id;
  modules.set(id, '');
  const input = filename === virtualTemplate ? 'export const readerTemplate = ' + JSON.stringify(template) + ';' : read(filename);
  let code = ts.transpileModule(input, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  code = code.replace(/require\((["'])([^"']+)\1\)/g, (_, quote, request) => 'require(' + JSON.stringify(include(resolve(request, filename))) + ')');
  modules.set(id, code);
  return id;
}
const entry = include(path.join(__dirname, 'demo/demo.js'));
const factories = [...modules].map(([id, code]) => JSON.stringify(id) + ':function(module,exports,require,localStorage){\n' + code + '\n}').join(',\n');
const bundle = "(function(){'use strict';\nconst factories={" + factories + "};\nwindow.AuraReaderShowcase={mount(host,options){\nconst cache=new Map(),values=new Map();const memory={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear()};\nfunction require(id){if(cache.has(id))return cache.get(id).exports;const module={exports:{}};cache.set(id,module);factories[id](module,module.exports,require,memory);return module.exports;}\nreturn require(" + JSON.stringify(entry) + ").mountShowcase(host,options);\n}};\n})();\n";
fs.writeFileSync(path.join(out, 'showcase.bundle.js'), bundle);
let fonts = '';
for (const [name, style] of [['literata', 'normal'], ['literata-italic', 'italic']]) {
  const data = fs.readFileSync(path.join(root, 'src/client/assets/fonts', name + '.woff2')).toString('base64');
  fonts += "@font-face{font-family:Literata;src:url(data:font/woff2;base64," + data + ") format('woff2');font-weight:200 900;font-style:" + style + ";font-display:swap}\n";
}
const iconFont = fs.readFileSync(path.join(root, 'node_modules/remixicon/fonts/remixicon.woff2')).toString('base64');
fonts += "@font-face{font-family:remixicon;src:url(data:font/woff2;base64," + iconFont + ") format('woff2');font-display:swap}\n";
fonts += scope + ' [class^="ri-"],' + scope + ' [class*=" ri-"]{font-family:remixicon!important;font-style:normal;-webkit-font-smoothing:antialiased}\n';
const icons = fs.readFileSync(path.join(root, 'node_modules/remixicon/fonts/remixicon.css'), 'utf8');
const needed = new Set((template + bundle).match(/ri-[a-z0-9-]+/g));
for (const name of needed) {
  const rule = icons.match(new RegExp('\\.' + name + ':before\\s*\\{[^}]+\\}'));
  if (rule) fonts += scope + ' ' + rule[0] + '\n';
}
fs.writeFileSync(path.join(out, 'showcase-fonts.css'), fonts);
fs.mkdirSync(path.join(out, 'assets/licenses'), { recursive: true });
fs.copyFileSync(path.join(root, 'src/client/assets/fonts/licenses/Literata-OFL.txt'), path.join(out, 'assets/licenses/Literata-OFL.txt'));
const iconLicense = ['License', 'LICENSE', 'LICENSE.txt'].map(name => path.join(root, 'node_modules/remixicon', name)).find(fs.existsSync);
if (iconLicense) fs.copyFileSync(iconLicense, path.join(out, 'assets/licenses/RemixIcon.txt'));
fs.writeFileSync(path.join(out, 'showcase-build.json'), JSON.stringify({ modules: [...modules.keys()], sourceHashes, scriptBytes: Buffer.byteLength(bundle), fontCSSBytes: Buffer.byteLength(fonts), defaults: { layout: 'single', font: 'Literata' } }, null, 2));
console.log('Showcase built: ' + modules.size + ' modules, ' + Math.round(Buffer.byteLength(bundle)/1024) + ' KB script, single page / Literata. No iframe or runtime imports.');

