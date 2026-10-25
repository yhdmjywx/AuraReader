import { createReader } from './reader.js';
import { drainStorage } from './memory-storage.js';
import { createExportPreview } from './export-preview.js';

const PLAYBACK_RATE = 1.3;

export async function mountShowcase(host, { onEvent = () => {} } = {}) {
host.style.setProperty('--demo-move-duration', `${320 / PLAYBACK_RATE}ms`);
let state = 'ready';
let scriptedInput = false;
const tabStops = new WeakMap();
const focusable = 'button,a[href],input,textarea,select,[tabindex],[contenteditable]';
function syncTabStops(root = host) {
  const nodes = [...root.querySelectorAll(focusable)];
  if (root.matches?.(focusable)) nodes.unshift(root);
  for (const node of nodes) {
    if (state === 'interactive') {
      if (!tabStops.has(node)) continue;
      const original = tabStops.get(node);
      if (original === null) node.removeAttribute('tabindex');
      else node.setAttribute('tabindex', original);
      tabStops.delete(node);
    } else {
      if (!tabStops.has(node)) tabStops.set(node, node.getAttribute('tabindex'));
      node.setAttribute('tabindex', '-1');
    }
  }
}
// Install before the original controllers' document handlers. Only the player
// can send input into a locked reader; outer playback controls remain usable.
function guardInput(event) {
  if (state === 'interactive' || scriptedInput || !host.contains(event.target)) return;
  if (event.type === 'keydown' && event.key === 'Tab') return;
  event.preventDefault(); event.stopImmediatePropagation();
}
for (const type of ['pointerdown','pointerup','click','dblclick','contextmenu','keydown','beforeinput','input','paste','cut','drop']) {
  document.addEventListener(type, guardInput, true);
}
function playerInput(action) {
  scriptedInput = true;
  try { return action(); } finally { scriptedInput = false; }
}
const { app } = createReader(host);
const exportPreview = createExportPreview(host, app);
new MutationObserver(records => {
  if (state === 'interactive') return;
  for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType === 1) syncTabStops(node);
  }
}).observe(host, { childList: true, subtree: true });
const send = (type, detail = {}) => onEvent({ type, ...detail });

const pointer = document.createElement('div');
pointer.className = 'demo-pointer';
pointer.setAttribute('aria-hidden', 'true');
pointer.innerHTML = '<svg viewBox="0 0 24 29"><path d="M2 2v22l6-6 5 10 4-2-5-10h9Z" fill="#1d2737" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>';
host.append(pointer);
let paused = false;
let abort;
let running = Promise.resolve();
let commandId = 0;
let exportShown = false;
function report(next, label, progress) {
  state = next;
  host.dataset.demoState = next;
  syncTabStops();
  send('state', { state: next, label, progress });
}
// Host playback controls can move native focus out of the frame. During the
// scripted pass only, keep that incidental blur from committing a partial note.
// Manual reading retains the original editor's blur-to-save behavior.
document.addEventListener('blur', event => {
  if ((state === 'playing' || state === 'paused') && event.target.matches?.('.note-editor')) event.stopImmediatePropagation();
}, true);
let pointerTarget;
let pointerFrame;
function positionPointer() {
  const target = pointerTarget?.();
  if (!target) return;
  const origin = host.getBoundingClientRect();
  pointer.style.transform = `translate(${target.x - origin.left}px, ${target.y - origin.top}px)`;
}
function trackPointer() {
  positionPointer();
  pointerFrame = requestAnimationFrame(trackPointer);
}
function point(target) {
  pointerTarget = target;
  positionPointer();
  // Commit the first position while hidden, so the arrow appears at the text.
  if (!pointer.classList.contains('visible')) pointer.getBoundingClientRect();
  pointer.classList.add('visible');
  if (pointerFrame == null) pointerFrame = requestAnimationFrame(trackPointer);
}
function parkPointer() {
  cancelAnimationFrame(pointerFrame);
  pointerFrame = null;
  pointerTarget = null;
  pointer.classList.remove('pressed', 'selecting');
}
function hidePointer() {
  parkPointer();
  pointer.classList.remove('visible');
}
function pointAt(element) {
  point(() => {
    if (!element.isConnected) return null;
    const r = element.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}
function pointBesideNote(editor) {
  point(() => {
    if (!editor.isConnected) return null;
    const r = editor.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    // Keep the entire 24px arrow in the gutter, with 8px clear of the text.
    return { x: r.left - 32, y: r.top + Math.min(14, r.height / 2) };
  });
}
async function wait(ms, signal) {
  let remaining = ms / PLAYBACK_RATE;
  while (remaining > 0) {
    if (signal.aborted) throw new DOMException('Playback cancelled', 'AbortError');
    const interval = Math.min(80, remaining);
    await new Promise(resolve => setTimeout(resolve, interval));
    if (!paused && !document.hidden) remaining -= interval;
  }
  if (signal.aborted) throw new DOMException('Playback cancelled', 'AbortError');
}
function textPoint(root, index) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (index <= node.length) return [node, index];
    index -= node.length;
  }
  throw new Error('找不到演示文字的位置');
}
async function selectPhrase(phrase, signal) {
  const root = document.getElementById('book-paper');
  const start = root.textContent.indexOf(phrase);
  if (start < 0) throw new Error('找不到 Alice 演示选句');
  const range = document.createRange();
  const [node, offset] = textPoint(root, start);
  range.setStart(node, offset);
  const [firstNode, firstOffset] = textPoint(root, start + 1);
  range.setEnd(firstNode, firstOffset);
  const selection = window.getSelection();
  // Travel from the previous action to the new sentence before starting a drag.
  point(() => {
    const first = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0);
    return first ? { x: first.left, y: first.top + first.height / 2 } : null;
  });
  await wait(420, signal);
  pointer.classList.add('selecting');
  for (let length = 1; length <= phrase.length; length++) {
    const [endNode, endOffset] = textPoint(root, start + length);
    range.setEnd(endNode, endOffset);
    selection.removeAllRanges(); selection.addRange(range);
    point(() => {
      const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      const last = rects[rects.length - 1];
      return last ? { x: last.right, y: last.top + last.height / 2 } : null;
    });
    await wait(25, signal);
  }
  pointer.classList.remove('selecting');
  app.selection.handleSelection();
  if (!app.selection.getPendingSelection()) throw new Error('选区未能建立，请重新播放');
  await wait(500, signal);
}
async function click(element, signal, { hideAfterClick = false } = {}) {
  if (!element) throw new Error('演示控件尚未就绪');
  pointAt(element); await wait(500, signal);
  // The original action hides its toolbar and may replace the selected DOM.
  // Keep this valid position instead of following that removed/hidden target.
  parkPointer();
  pointer.classList.add('pressed');
  playerInput(() => element.click());
  if (hideAfterClick) hidePointer();
  await wait(150, signal); pointer.classList.remove('pressed');
  await drainStorage();
}
async function resetReader({ keepPointer = false } = {}) {
  parkPointer();
  exportPreview.reset();
  await app.annotations.finishInlineEdit();
  await drainStorage();
  for (const note of [...app.annotations.getNotes()]) await app.annotations.deleteAnnotation(note.id);
  app.selection.clearSelection(); app.selection.clearAnnotationContext(); app.selection.hideSelectionTooltip();
  app.reader.renderPage(1, false, app.annotations.getNotes());
  if (!keepPointer) hidePointer();
}
async function writeNote(phrase, comment, signal) {
  await selectPhrase(phrase, signal);
  await click(document.getElementById('btn-add-note'), signal, { hideAfterClick: true });
  let editor = document.querySelector('.note-editor');
  if (!editor) throw new Error('批注编辑器未能打开');
  const draft = app.annotations.inlineEdit?.note;
  for (let length = 1; length <= comment.length; length++) {
    // A queued viewport update may finish the original editor. Reopen the same
    // draft through its controller rather than typing into a detached textarea.
    if (!editor.isConnected || app.annotations.getEditingNoteId() !== draft.id) {
      app.annotations.beginInlineEdit(draft);
      editor = document.querySelector('.note-editor');
      if (!editor) throw new Error('批注编辑器未能恢复');
    }
    editor.value = comment.slice(0, length);
    playerInput(() => editor.dispatchEvent(new Event('input', { bubbles: true })));
    await wait(45, signal);
  }
  await wait(700, signal);
  parkPointer();
  playerInput(() => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })));
  await app.annotations.finishInlineEdit();
  await app.annotations.assertInlineWritesSaved();
  await drainStorage();
  signal.throwIfAborted();
  if (app.annotations.getNotes().find(note => note.id === draft.id)?.comment !== comment) throw new Error('演示批注未完整写入');
  const card = [...host.querySelectorAll('.note-card')].find(item => item.dataset.annotationId === draft.id);
  if (card) pointBesideNote(card.querySelector('.note-comment-text') || card);
  else pointer.classList.add('visible');
}
async function showExport(signal) {
  report('playing', '05 / 把原文、高亮和笔记，一起导出为 Markdown。', 84);
  await wait(800, signal);
  await click(host.querySelector('#btn-export-menu'), signal);
  await wait(700, signal);
  await click(host.querySelector('#btn-export-chapters'), signal);
  await wait(700, signal);
  await click(host.querySelector('#btn-export-current-chapter'), signal, { hideAfterClick: true });
  report('playing', '06 / Markdown in Obsidian / VS Code。高亮与笔记，随正文一起保留。', 94);
  await wait(6500, signal);
  exportShown = true;
  exportPreview.reset();
  pointAt(host.querySelector('#btn-export-menu'));
  await wait(500, signal);
}
async function play(signal) {
  await resetReader({ keepPointer: true });
  signal.throwIfAborted();
  report('playing', '01 / 选中一句，让值得记住的文字留下来。', 8);
  await wait(800, signal);
  await selectPhrase('what is the use of a book', signal);
  await click(document.querySelector('.tooltip-btn[data-color="yellow"]'), signal);
  report('playing', '02 / 在页边记下想法，与这句原文自然关联。', 28);
  await wait(900, signal);
  await writeNote('without pictures or conversations?', 'A good book starts a conversation with its reader.', signal);
  report('playing', '03 / 再选一句，留下另一个阅读线索。', 52);
  await wait(900, signal);
  await selectPhrase('considering in her own mind', signal);
  await click(document.querySelector('.tooltip-btn[data-color="yellow"]'), signal);
  report('playing', '04 / 再添一条笔记，让新的想法留在原文身边。', 72);
  await wait(900, signal);
  await writeNote('very sleepy and stupid', 'A sleepy afternoon leaves room for adventure.', signal);
  if (!exportShown) await showExport(signal);
  parkPointer();
  report('playing', '高亮与笔记，随时带走。点击 Try it yourself，开始你的体验。', 100);
  await wait(3200, signal);
}
async function loop(signal) {
  while (!signal.aborted) await play(signal);
}
async function start(kind) {
  const id = ++commandId;
  abort?.abort(); paused = false;
  if (kind === 'try') report('resetting', '正在清空演示标注，为你准备空白阅读界面…', 0);
  await running.catch(() => {});
  if (id !== commandId) return;
  if (kind === 'play') exportShown = false;
  abort = new AbortController();
  const signal = abort.signal;
  running = (kind === 'try' ? resetReader().then(() => {
    signal.throwIfAborted();
    report('interactive', '轮到你了。选中文字，添加高亮或批注；点击页边笔记可编辑。', 0);
  }) : loop(signal))
    .catch(error => {
      if (error.name === 'AbortError') return;
      hidePointer();
      console.error('AuraReader demo:', error);
      report('error', '演示未能完成，请点击重新播放。', 0);
    });
}
function pause() {
  if (state === 'playing' || state === 'paused') {
    paused = !paused;
    report(paused ? 'paused' : 'playing', paused ? '演示已暂停，点击继续观看。' : '正在继续演示…');
  }
}
report('ready', '循环演示高亮与批注，随时点击 Try it yourself 接手操作。', 0);
return { app, exportPreview, play: () => start('play'), try: () => start('try'), pause, get state() { return state; } };
}
