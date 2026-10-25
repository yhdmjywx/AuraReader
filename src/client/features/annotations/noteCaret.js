// A visual caret only; the native textarea still owns input, selection and IME.
export function attachNoteCaret(editor, shell) {
    const doc = editor.ownerDocument;
    const win = doc.defaultView;
    const mirror = doc.createElement('div');
    mirror.className = 'note-caret-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    const caret = doc.createElement('span');
    caret.className = 'note-block-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.hidden = true;
    shell.append(mirror, caret);
    let composing = false;
    const update = () => {
        caret.hidden = true;
        editor.classList.remove('has-block-caret');
        if (!win || doc.activeElement !== editor || composing || editor.selectionStart !== editor.selectionEnd) return;
        const style = win.getComputedStyle(editor);
        for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'lineHeight',
            'letterSpacing', 'wordSpacing', 'textAlign', 'textIndent', 'textTransform', 'tabSize', 'direction',
            'whiteSpace', 'overflowWrap', 'wordBreak', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
            mirror.style[property] = style[property];
        }
        mirror.style.width = `${editor.clientWidth}px`;
        const offset = editor.selectionStart;
        const marker = doc.createElement('span');
        marker.textContent = editor.value.slice(offset) || '\u200b';
        mirror.replaceChildren(doc.createTextNode(editor.value.slice(0, offset)), marker);
        const rect = marker.getClientRects()[0];
        if (!rect || !rect.height) return; // Keep the native caret if measurement is unavailable.
        const host = shell.getBoundingClientRect();
        caret.style.left = `${rect.left - host.left - editor.scrollLeft}px`;
        caret.style.top = `${rect.top - host.top - editor.scrollTop}px`;
        caret.style.height = `${rect.height}px`;
        caret.hidden = false;
        editor.classList.add('has-block-caret');
    };
    for (const event of ['focus', 'blur', 'input', 'select', 'selectionchange', 'keyup', 'click', 'scroll']) {
        editor.addEventListener(event, update);
    }
    editor.addEventListener('compositionstart', () => { composing = true; update(); });
    editor.addEventListener('compositionend', () => { composing = false; update(); });
    return update;
}
