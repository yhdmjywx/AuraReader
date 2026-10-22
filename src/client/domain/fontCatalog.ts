import type { Book } from './book.js';
import type { BuiltinFontId, FontChoice, ImportedFont, ResolvedFont } from './font.js';
export const CURATED_FONTS: { id: BuiltinFontId; name: string; family: string; group: string; fallback: string }[] = [
    { id: 'sarasa', name: '更纱黑体', family: 'Sarasa Gothic SC', group: '中文', fallback: 'sans-serif' },
    { id: 'literata', name: 'Literata', family: 'Literata', group: '英文', fallback: 'serif' }
];

export const SYSTEM_FALLBACK = 'system-ui, "Microsoft YaHei", sans-serif';
export const quoteFamily = (family: unknown) => `"${String(family).replace(/[\\"]/g, '\\$&').replace(/[\u0000-\u001f]/g, '')}"`;

export function normalizeFontChoice(input: unknown): FontChoice {
    const choice = input && typeof input === 'object' ? input as Record<string, unknown> : null;
    if (!choice || typeof choice !== 'object') return { kind: 'auto' };
    if (choice.kind === 'builtin' && CURATED_FONTS.some(font => font.id === choice.id)) return { kind: 'builtin', id: choice.id as BuiltinFontId };
    if (choice.kind === 'system' && typeof choice.family === 'string' && choice.family.trim() && choice.family.length <= 160) {
        return { kind: 'system', family: choice.family, name: choice.family };
    }
    if (choice.kind === 'imported' && typeof choice.id === 'string' && /^[a-f0-9]{64}$/.test(choice.id) && typeof choice.name === 'string') {
        return { kind: 'imported', id: choice.id, name: choice.name.slice(0, 160) };
    }
    return { kind: 'auto' };
}

export function automaticFont(book: Book | null | undefined): BuiltinFontId | null {
    const language = String(book?.language || book?.languages?.[0] || '').trim().replace(/_/g, '-').toLowerCase();
    if (language === 'zh' || /^zh-(cn|sg|hans)(-|$)/.test(language)) return 'sarasa';
    if (language === 'en' || language.startsWith('en-')) return 'literata';
    return null;
}

export function resolveFont(input: unknown, book: Book | null | undefined, imported: ImportedFont[] = []): ResolvedFont {
    const choice = normalizeFontChoice(input);
    const id = choice.kind === 'auto' ? automaticFont(book) : choice.kind === 'system' ? null : choice.id;
    const curated = CURATED_FONTS.find(font => font.id === id);
    if (choice.kind === 'auto' || choice.kind === 'builtin') {
        if (!curated) return { family: SYSTEM_FALLBACK, name: '自动选择', loadFamilies: [] };
        const english = curated.group === '英文';
        return { family: `${quoteFamily(curated.family)}, ${english ? '"Sarasa Gothic SC", ' : ''}${curated.fallback}`,
            name: choice.kind === 'auto' ? '自动选择' : curated.name,
            loadFamilies: english ? [curated.family, 'Sarasa Gothic SC'] : [curated.family] };
    }
    if (choice.kind === 'system') {
        const systemAlias = `AuraSystem_${[...choice.family].map(character => character.codePointAt(0)!.toString(16)).join('_')}`;
        return { family: `${quoteFamily(systemAlias)}, ${quoteFamily(choice.family)}, "Sarasa Gothic SC", ${SYSTEM_FALLBACK}`,
            name: choice.family, systemFamily: choice.family, systemAlias, loadFamilies: ['Sarasa Gothic SC'] };
    }
    const font = imported.find(font => font.id === choice.id);
    if (!font) return { family: SYSTEM_FALLBACK, name: choice.name, missing: true, loadFamilies: [] };
    return { family: `"AuraImported_${font.id}", "Sarasa Gothic SC", ${SYSTEM_FALLBACK}`, name: font.name,
        importedFont: font, loadFamilies: ['Sarasa Gothic SC'] };
}
