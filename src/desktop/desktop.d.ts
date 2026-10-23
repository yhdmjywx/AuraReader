interface Window {
    readonly auraDesktop?: {
        readonly stage: 2;
        readonly storageAvailable: false;
        readonly platform: string;
        readonly versions: { readonly electron: string; readonly node: string };
    };
}
