// Reuse the desktop export menu and serializer. The website shows the result
// locally; no file picker or download runs during the presentation.
import { ChapterExportMenu } from '../../src/client/features/backup/chapterExportMenu.js';
import { buildChapterDocuments } from '../../src/client/infrastructure/exporters.js';
import { aliceBook } from './alice.js';

const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function inline(text) {
  // Only the small, known subset produced by the chapter exporter is styled.
  // All input is escaped first; HTML in user notes cannot become executable.
  return escape(text.replace(/\\([\\`*_{}\[\]<>])/g, '$1'))
    .replace(/&amp;(#\d+;|amp;|lt;|gt;|quot;)/g, '&$1')
    .replace(/&lt;(\/?)mark&gt;/g, '<$1mark>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function renderDocument(markdown) {
  const lines = markdown.split(/\r?\n/), output = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) output.push('<p>' + inline(paragraph.join(' ')) + '</p>'); paragraph = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flush(); output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    if (/^---+$/.test(line.trim())) { flush(); output.push('<hr>'); continue; }
    if (/^>/.test(line)) {
      flush(); const quoted = [];
      do { quoted.push(lines[i].replace(/^> ?/, '')); i++; } while (i < lines.length && /^>/.test(lines[i]));
      i--;
      output.push('<blockquote>' + quoted.join('\n').split(/\n\s*\n/).map(part => '<p>' + inline(part.replace(/\n/g, ' ')) + '</p>').join('') + '</blockquote>');
      continue;
    }
    paragraph.push(line);
  }
  flush(); return output.join('\n');
}

export function createExportPreview(host, app) {
  const get = id => host.querySelector('#' + id);
  const panel = get('export-panel'), menuButton = get('btn-export-menu');
  const workspace = get('workspace-container'), header = host.querySelector('.app-header');
  get('export-book-title').textContent = aliceBook.title;
  // These entries retain the desktop menu's appearance; this demonstration
  // implements chapter export only, without importing backup/restore services.
  for (const id of ['btn-export-markdown','btn-export-full-backup','btn-import-full-backup']) {
    get(id).setAttribute('aria-disabled', 'true'); get(id).dataset.previewOnly = '';
  }
  const view = document.createElement('section');
  view.className = 'showcase-markdown'; view.hidden = true;
  view.setAttribute('aria-label', 'Markdown in Obsidian / VS Code');
  view.innerHTML = `<header class="markdown-windowbar"><span class="markdown-environment">Markdown in <strong>Obsidian / VS Code</strong></span><button type="button" class="markdown-back"><i class="ri-arrow-left-s-line" aria-hidden="true"></i>返回阅读</button></header><div class="markdown-workspace"><aside class="markdown-sidebar"><div class="markdown-folder-title">AURAREADER EXPORT</div><div class="markdown-folder"><i class="ri-folder-open-line" aria-hidden="true"></i><span>章节导出</span></div><div class="markdown-file-index"><i class="ri-file-text-line" aria-hidden="true"></i>00_目录概览.md</div><div class="markdown-file-active"><i class="ri-markdown-line" aria-hidden="true"></i><span></span></div><div class="markdown-sidebar-foot">原文 · 高亮 · 笔记<br>一起带入下一次思考</div></aside><main class="markdown-main"><div class="markdown-tab"><i class="ri-markdown-line" aria-hidden="true"></i><span></span><span class="markdown-preview-tag">阅读视图</span></div><div class="markdown-scroll"><article class="markdown-document"></article></div></main></div><footer class="markdown-statusbar"><span><i class="ri-check-line" aria-hidden="true"></i>Markdown · UTF-8</span><span>高亮与笔记随正文保留</span></footer>`;
  host.append(view);
  let current = null;
  function closePanel() {
    panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
    menuButton.setAttribute('aria-expanded', 'false');
    panel.dispatchEvent(new Event('exportpanelclose'));
  }
  function closePreview() {
    view.hidden = true; host.classList.remove('showcase-export-view');
    workspace.inert = header.inert = false;
    workspace.removeAttribute('aria-hidden'); header.removeAttribute('aria-hidden');
  }
  function showPreview(book, notes, options) {
    const documents = buildChapterDocuments(book, notes, options);
    const chapter = documents.chapterFiles[0];
    current = { ...chapter, filename: `${documents.bookTitle}_${chapter.filename}` };
    view.querySelector('.markdown-document').innerHTML = renderDocument(current.text);
    for (const label of view.querySelectorAll('.markdown-file-active span,.markdown-tab>span:first-of-type')) label.textContent = current.filename;
    view.querySelector('.markdown-folder span').textContent = documents.bookTitle;
    view.querySelector('.markdown-file-index').hidden = documents.chapterFiles.length === 1;
    view.querySelector('.markdown-scroll').scrollTop = 0;
    view.hidden = false; host.classList.add('showcase-export-view');
    workspace.inert = header.inert = true;
    workspace.setAttribute('aria-hidden', 'true'); header.setAttribute('aria-hidden', 'true');
    return { status: 'preview' };
  }
  menuButton.addEventListener('click', () => {
    if (panel.classList.contains('open')) closePanel();
    else {
      panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
      menuButton.setAttribute('aria-expanded', 'true');
    }
  });
  const elements = {
    exportPanel:panel, btnExportMenu:menuButton,
    chapterExportEntry:get('chapter-export-entry'), btnExportChapters:get('btn-export-chapters'),
    btnCollapseChapterExport:get('btn-collapse-chapter-export'), chapterExportOptions:get('chapter-export-options'),
    chapterExportCustom:get('chapter-export-custom'), btnSelectChapters:get('btn-select-chapters'),
    btnCancelChapterExport:get('btn-cancel-chapter-export'), btnExportCurrentChapter:get('btn-export-current-chapter'),
    btnExportAllChapters:get('btn-export-all-chapters'), btnConfirmChapterExport:get('btn-confirm-chapter-export'),
    chapterExportList:get('chapter-export-list')
  };
  const menu = new ChapterExportMenu(elements, {
    getCurrentBook:()=>aliceBook, getCurrentPage:()=>1,
    getCurrentNotes:()=>app.annotations.getNotes(), onExport:showPreview, closeExportPanel:closePanel
  });
  view.querySelector('.markdown-back').addEventListener('click', () => { closePreview(); app.layout(); });
  host.addEventListener('pointerdown', event => {
    if (!panel.contains(event.target) && !menuButton.contains(event.target)) closePanel();
  });
  host.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!view.hidden) closePreview();
    else if (panel.classList.contains('open')) closePanel();
  });
  return {
    reset() { closePreview(); closePanel(); },
    get view() { return view; }, get document() { return current; }, get busy() { return menu.busy; }
  };
}
