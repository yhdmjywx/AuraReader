interface Window {
    readonly auraDesktop?: import('../../shared/desktop.js').DesktopBridge;
    __AURA_BOOTSTRAPPED__?: boolean;
    JSZip?: typeof import('jszip');
}
