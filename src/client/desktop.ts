import { assertNoGoalRecovery } from './infrastructure/goalRecovery.js';
import { assertNoLibraryRecovery } from './infrastructure/goalLibraryRepository.js';
import { drainStorage, unwrapDesktop } from './infrastructure/storageClient.js';
import { positionMarginNotes } from './features/layout/marginNotesLayout.js';

const bridge = window.auraDesktop;
if (!bridge) throw new Error('桌面安全入口不可用');
let application: typeof import('./main.js') | null = null;
let boot: Promise<void> | null = null;
const originalControls = new Map([...document.querySelectorAll<HTMLButtonElement>('button, input, select, textarea')]
    .map(control => [control, control.disabled]));
// Chromium's native window.close() destroys WebContents without emitting the
// BrowserWindow close event. Route the app's page-close API through the same
// main-process flush handshake as the title-bar close button.
Object.defineProperty(window, 'close', { configurable: false, writable: false, value: () => {
    bridge!.lifecycle.requestClose().then(unwrapDesktop).catch(error => {
        console.error('关闭请求失败', error);
        application?.appShell.showToast('关闭未完成，请保留窗口并重试');
    });
} });

function gate(message: string, create = false) {
    for (const control of document.querySelectorAll('button, input, select, textarea')) {
        if ('disabled' in control) (control as HTMLButtonElement).disabled = true;
    }
    const panel = document.createElement('section');
    panel.id = 'desktop-status'; panel.setAttribute('role', 'status');
    const title = document.createElement('h1'); title.textContent = 'AuraReader 桌面版';
    const text = document.createElement('p'); text.textContent = message;
    const button = document.createElement('button');
    button.id = create ? 'desktop-create-library' : 'desktop-retry';
    button.className = 'btn btn-primary';
    button.textContent = create ? '创建独立桌面书库' : '重试';
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            if (create) unwrapDesktop(await bridge!.storage.createLibrary());
            await load();
        } catch (error) { gate(error instanceof Error ? error.message : '本地书库不可用，原数据未清除'); }
    });
    panel.append(title, text, button);
    document.getElementById('book-paper')?.replaceChildren(panel);
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
}

async function load() {
    const status = unwrapDesktop(await bridge!.storage.status());
    if (!status.initialized) {
        document.documentElement.dataset.desktopReady = 'setup';
        gate('创建此设备上的阅读书库，开始导入书籍、阅读和记录笔记。书籍与笔记仅保存在本机。', true);
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
        if (!Array.isArray(pending) || pending.length) throw new Error('仍有未确认保存的笔记，窗口已保留；请先处理恢复内容或冲突。');
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
        const message = error instanceof Error ? error.message.slice(0, 1000) : '保存未完成，窗口已保留';
        try { unwrapDesktop(await bridge.lifecycle.completeClose(requestId, { ok: false, message })); }
        catch (failure) { console.error('关闭确认失败', failure); document.body.inert = false; }
    }
});

load().catch(error => {
    document.documentElement.dataset.desktopReady = 'error';
    console.error('桌面书库启动停止', error);
    gate(error instanceof Error ? error.message : '本地书库不可用，原数据未清除');
});
