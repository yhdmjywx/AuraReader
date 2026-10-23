// Reuse the existing interface while its local services are still being added.
// Do not boot the HTTP client, initialize a library or pretend an empty library
// is a successful desktop connection.
for (const control of document.querySelectorAll('button, input, select, textarea')) {
    if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        control.disabled = true;
    }
}
const paper = document.getElementById('book-paper');
const message = document.createElement('section');
message.id = 'desktop-status';
message.setAttribute('role', 'status');
const title = document.createElement('h1');
title.textContent = 'AuraReader 桌面预览';
const description = document.createElement('p');
description.textContent = '本地书库暂未接入，阅读、导入与导出功能尚不可用。';
const hint = document.createElement('p');
hint.textContent = '你可以继续使用原有浏览器版访问书库。';
message.append(title, description, hint);
paper?.replaceChildren(message);
document.getElementById('current-page')?.replaceChildren(document.createTextNode('—'));
document.getElementById('total-pages')?.replaceChildren(document.createTextNode('—'));
const theme = document.getElementById('btn-theme-toggle');
if (theme instanceof HTMLButtonElement) {
    theme.disabled = false;
    theme.addEventListener('click', () => {
        const dark = document.body.classList.toggle('theme-dark');
        document.body.classList.toggle('theme-light', !dark);
    });
}
document.documentElement.dataset.desktopReady = 'true';
