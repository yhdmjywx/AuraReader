export const CURATED_FONTS = [
    { id: 'sarasa', name: '更纱黑体', family: 'Sarasa Gothic SC', group: '中文', fallback: 'sans-serif' },
    { id: 'source-han-serif', name: '思源宋体', family: 'Source Han Serif SC', group: '中文', fallback: 'serif' },
    { id: 'wenkai', name: '霞鹜文楷', family: 'LXGW WenKai', group: '中文', fallback: 'serif' },
    { id: 'literata', name: 'Literata', family: 'Literata', group: '英文', fallback: 'serif' },
    { id: 'source-serif', name: 'Source Serif 4', family: 'Source Serif 4', group: '英文', fallback: 'serif' }
];

export const SYSTEM_FALLBACK = 'system-ui, "Microsoft YaHei", sans-serif';
export const quoteFamily = family => `"${String(family).replace(/[\\"]/g, '\\$&').replace(/[\u0000-\u001f]/g, '')}"`;

export function normalizeFontChoice(choice) {
    if (!choice || typeof choice !== 'object') return { kind: 'auto' };
    if (choice.kind === 'builtin' && CURATED_FONTS.some(font => font.id === choice.id)) return { kind: 'builtin', id: choice.id };
    if (choice.kind === 'system' && typeof choice.family === 'string' && choice.family.trim() && choice.family.length <= 160) {
        return { kind: 'system', family: choice.family, name: choice.family };
    }
    if (choice.kind === 'imported' && /^[a-f0-9]{64}$/.test(choice.id) && typeof choice.name === 'string') {
        return { kind: 'imported', id: choice.id, name: choice.name.slice(0, 160) };
    }
    return { kind: 'auto' };
}

export function automaticFont(book) {
    const language = String(book?.language || book?.languages?.[0] || '').trim().replace(/_/g, '-').toLowerCase();
    if (language === 'zh' || /^zh-(cn|sg|hans)(-|$)/.test(language)) return 'sarasa';
    if (language === 'en' || language.startsWith('en-')) return 'literata';
    return null;
}

export function resolveFont(choice, book, imported = []) {
    choice = normalizeFontChoice(choice);
    const id = choice.kind === 'auto' ? automaticFont(book) : choice.id;
    const curated = CURATED_FONTS.find(font => font.id === id);
    if (choice.kind === 'auto' || choice.kind === 'builtin') {
        if (!curated) return { family: SYSTEM_FALLBACK, name: '自动选择', loadFamilies: [] };
        const english = curated.group === '英文';
        return { family: `${quoteFamily(curated.family)}, ${english ? '"Noto Serif SC", ' : ''}${curated.fallback}`,
            name: choice.kind === 'auto' ? '自动选择' : curated.name,
            loadFamilies: english ? [curated.family, 'Noto Serif SC'] : [curated.family] };
    }
    if (choice.kind === 'system') {
        const systemAlias = `AuraSystem_${[...choice.family].map(character => character.codePointAt(0).toString(16)).join('_')}`;
        return { family: `${quoteFamily(systemAlias)}, ${quoteFamily(choice.family)}, "Noto Serif SC", ${SYSTEM_FALLBACK}`,
            name: choice.family, systemFamily: choice.family, systemAlias, loadFamilies: ['Noto Serif SC'] };
    }
    const font = imported.find(font => font.id === choice.id);
    if (!font) return { family: SYSTEM_FALLBACK, name: choice.name, missing: true, loadFamilies: [] };
    return { family: `"AuraImported_${font.id}", "Noto Serif SC", ${SYSTEM_FALLBACK}`, name: font.name,
        importedFont: font, loadFamilies: ['Noto Serif SC'] };
}
