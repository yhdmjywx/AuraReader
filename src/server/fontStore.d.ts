import type { DesktopFont } from '../shared/desktop.js';
export const MAX_FONT_BYTES: number;
export function inspectFont(bytes: Buffer, filename: string): DesktopFont;
export function createFontStore(directory: string): {
    list(): Promise<DesktopFont[]>;
    import(bytes: Buffer, filename: string): Promise<DesktopFont>;
    file(name: string): { path: string; mime: string } | null;
};
export function listSystemFonts(): Promise<{ supported: boolean; fonts: string[] }>;
