export type BuiltinFontId = 'sarasa' | 'literata';
export type FontChoice =
    | { kind: 'auto' }
    | { kind: 'builtin'; id: BuiltinFontId }
    | { kind: 'system'; family: string; name?: string }
    | { kind: 'imported'; id: string; name: string };
export interface ImportedFont {
    id: string;
    name: string;
    url: string;
    weight?: string;
    [field: string]: unknown;
}
export interface ResolvedFont {
    family: string;
    name: string;
    loadFamilies: string[];
    missing?: boolean;
    systemFamily?: string;
    systemAlias?: string;
    importedFont?: ImportedFont;
}
