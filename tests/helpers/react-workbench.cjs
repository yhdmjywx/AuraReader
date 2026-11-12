const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

/** Mount the real React shell; tests no longer assume index.html contains the workbench. */
function createWorkbench(options = {}) {
    const dom = new JSDOM(fs.readFileSync(path.resolve('src/client/index.html'), 'utf8'), { url: 'http://localhost/', pretendToBeVisual: true, ...options });
    const saved = new Map();
    const install = (key, value) => {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    };
    for (const key of ['window','document','localStorage','HTMLElement','Element','Node','NodeFilter','DocumentFragment','MutationObserver','DOMParser','FileReader','Event','MouseEvent','KeyboardEvent']) install(key, key === 'window' ? dom.window : key === 'document' ? dom.window.document : dom.window[key]);
    install('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
    install('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
    install('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
    install('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    dom.window.ResizeObserver = globalThis.ResizeObserver;
    dom.window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    install('IS_REACT_ACT_ENVIRONMENT', true);
    const React = require('react');
    const { createRoot } = require('react-dom/client');
    const { WorkbenchShell } = require('../../dist/client/features/workbench/WorkbenchShell.js');
    const root = createRoot(document.getElementById('react-root'));
    React.act(() => root.render(React.createElement(WorkbenchShell)));
    const close = dom.window.close.bind(dom.window);
    dom.window.close = () => {
        React.act(() => root.unmount()); close();
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    };
    return dom;
}
// Native engine tests need only a DOM fixture. Generate it from the current React shell.
function shellHtml() {
    const dom = createWorkbench();
    try { return '<!DOCTYPE html>\n' + dom.window.document.documentElement.outerHTML; }
    finally { dom.window.close(); }
}
const ui = async action => { await require('react').act(async () => { await action?.(); }); };
const click = selector => ui(() => {
    const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!node) throw new Error('Missing control: ' + selector); node.click();
});
const input = (selector, value) => ui(() => {
    const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
    const prototype = node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new window.Event('input', { bubbles: true }));
});
const waitFor = async predicate => {
    const end = Date.now() + 5000;
    while (!predicate()) {
        if (Date.now() > end) throw new Error('React condition timed out: ' + predicate);
        await ui(() => new Promise(resolve => setTimeout(resolve, 5)));
    }
};
module.exports = { createWorkbench, shellHtml, ui, click, input, waitFor };
