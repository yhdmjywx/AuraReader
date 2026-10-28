const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
// Code-drawn book mark, matching the existing blue reader icon. ICO embeds PNG.
const size = 256, rows = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const page = y >= 48 && y < 199 && ((x >= 35 && x < 119) || (x >= 137 && x < 221));
    const binding = y >= 62 && y < 215 && x >= 122 && x < 134;
    const inset = page && (x < 119 ? y < 58 + (x - 35) / 7 : y < 70 - (x - 137) / 7);
    const index = y * (size * 4 + 1) + 1 + x * 4;
    const color = page && !inset ? (x < 119 ? [59, 130, 246, 255] : [37, 99, 235, 255]) : binding ? [30, 64, 175, 255] : [0, 0, 0, 0];
    color.forEach((value, channel) => { rows[index + channel] = value; });
}
function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
}
function chunk(type, bytes) {
    const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
    return Buffer.concat([length, name, bytes, crc]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
const ico = Buffer.alloc(22); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.mkdirSync(path.join(root, 'build'), { recursive: true }); fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([ico, png]));

const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const notices = ['AuraReader third-party notices', 'JSZip is used under the MIT license option.', 'Electron LICENSE.electron.txt and LICENSES.chromium.html are provided alongside this file.'];
const mitReadme = fs.readFileSync(path.join(root, 'node_modules/isarray/README.md'), 'utf8');
const mitTerms = mitReadme.slice(mitReadme.indexOf('Permission is hereby granted,'));
if (!mitTerms.startsWith('Permission is hereby granted,')) throw new Error('MIT grant unavailable');
for (const [directory, metadata] of Object.entries(lock.packages)) {
    if (!directory.startsWith('node_modules/') || metadata.dev) continue;
    const folder = path.join(root, directory);
    const licenses = fs.readdirSync(folder).filter(name => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name) && fs.statSync(path.join(folder, name)).isFile());
    notices.push(`\n=== ${directory} ${metadata.version} (${metadata.license || 'see text'}) ===`);
    if (!licenses.length) {
        // Several existing fontkit dependencies publish only a README MIT declaration.
        // Preserve the declaration and author, and include the standard MIT grant.
        const readme = fs.readdirSync(folder).find(name => /^readme\.md$/i.test(name));
        const text = readme && fs.readFileSync(path.join(folder, readme), 'utf8');
        if (metadata.license !== 'MIT' || !text || !/## License\s+\(?MIT\)?/i.test(text)) throw new Error('Missing third-party license: ' + directory);
        const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
        notices.push('Upstream package attribution: ' + JSON.stringify(pkg.author), 'Upstream README:\n' + text);
        notices.push('Standard MIT permission and warranty terms:\n' + mitTerms);
    }
    for (const name of licenses) notices.push(fs.readFileSync(path.join(folder, name), 'utf8'));
}
notices.push('\n=== Brotli decoder: original source header ===', fs.readFileSync(path.join(root, 'node_modules/brotli/dec/decode.js'), 'utf8').split('*/')[0] + '*/',
    '\nApache License 2.0 full text:\n' + fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
for (const name of fs.readdirSync(path.join(root, 'src/client/assets/fonts/licenses'))) {
    notices.push('\n=== Bundled font: ' + name + ' ===', fs.readFileSync(path.join(root, 'src/client/assets/fonts/licenses', name), 'utf8'));
}
const output = path.join(root, '.commandcode/package-resources'); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
console.log('Generated book icon and third-party license notices.');
