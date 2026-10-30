import { unwrapDesktop } from './storageClient.js';

export async function chooseDesktopFile(kind: 'book' | 'backup'): Promise<File | null> {
    const desktop = window.auraDesktop;
    if (!desktop) throw new Error("The desktop file bridge is unavailable.");
    const result = unwrapDesktop(await (kind === 'book' ? desktop.files.chooseBook() : desktop.files.chooseBackup()));
    if (result.canceled) return null;
    return new File([new Uint8Array(result.file.bytes).buffer], result.file.name);
}
