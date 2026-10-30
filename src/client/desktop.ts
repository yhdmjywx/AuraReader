import { assertNoGoalRecovery } from './infrastructure/goalRecovery.js';
import { assertNoLibraryRecovery } from './infrastructure/goalLibraryRepository.js';
import { drainStorage, unwrapDesktop } from './infrastructure/storageClient.js';
import { positionMarginNotes } from './features/layout/marginNotesLayout.js';

const bridge = window.auraDesktop;
if (!bridge) throw new Error("The secure desktop bridge is unavailable.");
let application: typeof import('./main.js') | null = null;
let boot: Promise<void> | null = null;
let resolveApplication!: (value: typeof import('./main.js')) => void;
export const applicationReady = new Promise<typeof import('./main.js')>(resolve => { resolveApplication = resolve; });
const originalControls = new Map([...document.querySelectorAll<HTMLButtonElement>('button, input, select, textarea')]
    .map(control => [control, control.disabled]));
// Chromium's native window.close() destroys WebContents without emitting the
// BrowserWindow close event. Route the app's page-close API through the same
// main-process flush handshake as the title-bar close button.
Object.defineProperty(window, 'close', { configurable: false, writable: false, value: () => {
    bridge!.lifecycle.requestClose().then(unwrapDesktop).catch(error => {
        console.error("Close request failed", error);
        application?.appShell.showToast("Could not close. Keep this window open and try again.");
    });
} });

function gate(message: string, create = false) {
    for (const control of document.querySelectorAll('button, input, select, textarea')) {
        if ('disabled' in control) (control as HTMLButtonElement).disabled = true;
    }
    const panel = document.createElement('section');
    panel.id = 'desktop-status'; panel.setAttribute('role', 'status');
    const title = document.createElement('h1'); title.textContent = "AuraReader Desktop";
    const text = document.createElement('p'); text.textContent = message;
    const button = document.createElement('button');
    button.id = create ? 'desktop-create-library' : 'desktop-retry';
    button.className = 'btn btn-primary';
    button.textContent = create ? "Create local library" : "Retry";
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            if (create) unwrapDesktop(await bridge!.storage.createLibrary());
            await load();
        } catch (error) { document.documentElement.dataset.desktopReady = 'error'; gate(error instanceof Error ? error.message : "The local library is unavailable. Existing data has been preserved."); }
    });
    panel.append(title, text, button);
    const host = document.getElementById('app-status');
    if (host) { host.hidden = false; host.replaceChildren(panel); }
}

async function start() {
    window.__AURA_BOOTSTRAPPED__ = true;
    originalControls.forEach((disabled, control) => { control.disabled = disabled; });
    application = await import('./main.js');
    await application.startApp();
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
        if (application) positionMarginNotes(application.elements);
    });
    document.documentElement.dataset.desktopReady = 'library';
    resolveApplication(application);
}

async function load() {
    const status = unwrapDesktop(await bridge!.storage.status());
    if (!status.initialized) {
        document.documentElement.dataset.desktopReady = 'setup';
        gate("Create a library on this device to import books, read, and take notes. Books and notes are stored locally.", true);
        return;
    }
    if (!boot) boot = start().catch(error => { boot = null; throw error; });
    await boot;
}

function assertNoRecoveryBuffers() {
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith('aura_notes_pending_')) continue;
        const pending: unknown = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(pending) || pending.length) throw new Error("Some notes are not confirmed saved. This window remains open. Resolve recovery items or conflicts first.");
    }
}

bridge.lifecycle.onCloseCancelled(message => {
    document.body.inert = false;
    if (application) application.appShell.showToast(message);
    else gate(message);
});
bridge.lifecycle.onPrepareClose(async requestId => {
    document.body.inert = true;
    try {
        if (boot) await boot;
        await application?.home?.prepareClose();
        await application?.goals.finishInlineEdit();
        await application?.annotations.finishInlineEdit();
        await application?.annotations.assertInlineWritesSaved();
        await application?.goals.assertWritesSaved();
        await drainStorage();
        assertNoGoalRecovery();
        assertNoLibraryRecovery();
        assertNoRecoveryBuffers();
        unwrapDesktop(await bridge.lifecycle.completeClose(requestId, { ok: true }));
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : "Saving is incomplete. This window remains open.";
        try { unwrapDesktop(await bridge.lifecycle.completeClose(requestId, { ok: false, message })); }
        catch (failure) { console.error("Close confirmation failed", failure); document.body.inert = false; }
    }
});

load().catch(error => {
    document.documentElement.dataset.desktopReady = 'error';
    console.error("Desktop library startup stopped", error);
    gate(error instanceof Error ? error.message : "The local library is unavailable. Existing data has been preserved.");
});
