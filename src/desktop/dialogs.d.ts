import type { OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from 'electron';
export interface DialogPort {
    open(options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
    save(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
}
