(() => {
  const preview = document.getElementById('reader-preview');
  const viewport = document.getElementById('reader-demo-viewport');
  const shield = document.getElementById('reader-demo-shield');
  const loading = document.getElementById('reader-demo-loading');
  const status = document.getElementById('reader-demo-status');
  const progress = document.getElementById('reader-demo-progress');
  const pause = document.getElementById('demo-pause');
  const replay = document.getElementById('demo-replay');
  const expand = document.getElementById('demo-expand');
  const tryButton = document.getElementById('demo-try');
  let runtime, host, started = false, visible = false, expanded = false, takingOver = false;
  let previousFocus;
  function setExpanded(value) {
    expanded = value;
    if (value) previousFocus = document.activeElement;
    preview.classList.toggle('reader-preview-expanded', value);
    document.body.classList.toggle('reader-demo-expanded', value);
    expand.setAttribute('aria-expanded', String(value));
    expand.setAttribute('aria-label', value ? '收起阅读界面' : '展开阅读界面');
    expand.querySelector('span').textContent = value ? '收起' : '展开';
    for (const item of document.querySelectorAll('header.site-header, footer.site-footer, .skip-link, main > section:not(#workspace)')) item.inert = value;
    if (value) {
      preview.setAttribute('role', 'dialog'); preview.setAttribute('aria-modal', 'true');
      preview.setAttribute('aria-label', 'AuraReader 阅读演示与试读');
      expand.focus({preventScroll:true});
    } else {
      preview.removeAttribute('role'); preview.removeAttribute('aria-modal'); preview.removeAttribute('aria-label');
      previousFocus?.focus({preventScroll:true});
    }
    runtime?.app.layout();
  }
  function begin() {
    if (!runtime || started || !visible) return;
    started = true; runtime.play();
  }
  function update(data) {
    if (data.type !== 'state') return;
    preview.dataset.state = data.state;
    if (data.label) status.textContent = data.label;
    if (typeof data.progress === 'number') progress.value = data.progress;
    const interactive = data.state === 'interactive';
    pause.hidden = !['playing','paused'].includes(data.state);
    pause.textContent = data.state === 'paused' ? '继续' : '暂停';
    pause.setAttribute('aria-pressed', String(data.state === 'paused'));
    shield.hidden = interactive;
    host.setAttribute('aria-busy', String(!interactive));
    tryButton.disabled = !runtime || data.state === 'resetting';
    tryButton.querySelector('span').textContent = interactive ? 'Start over' : 'Try it yourself';
    tryButton.title = interactive ? '清空本次标注，重新开始' : '停止演示、清空标注，并开始自由体验';
    replay.textContent = interactive ? '观看演示' : '重新播放';
    progress.hidden = interactive;
    if (interactive && takingOver) {
      takingOver = false;
      host.querySelector('#book-paper').focus({preventScroll:true});
    }
  }
  async function load() {
    if (host) return;
    host = document.createElement('div');
    host.className = 'reader-demo-surface';
    viewport.insertBefore(host, shield);
    try {
      if (!window.AuraReaderShowcase) throw new Error('展示脚本缺失，请确认 showcase.bundle.js 与 index.html 位于同一目录');
      runtime = await window.AuraReaderShowcase.mount(host, {onEvent:update});
      host.querySelector('#book-paper').tabIndex = -1;
      preview.classList.add('reader-demo-ready');
      loading.hidden = true; replay.disabled = false; tryButton.disabled = false;
      begin();
    } catch (error) {
      console.error('AuraReader showcase initialization:', error);
      preview.dataset.state = 'error';
      loading.textContent = '展示加载失败：' + error.message;
      status.textContent = '展示文件未能启动，请查看上方具体原因。';
      replay.disabled = false; replay.textContent = '重试';
    }
  }
  pause.addEventListener('click', () => runtime?.pause());
  replay.addEventListener('click', () => {
    if (!runtime) { host?.remove(); host = null; load(); return; }
    takingOver = false; shield.hidden = false; runtime.play();
  });
  tryButton.addEventListener('click', () => {
    if (!runtime || tryButton.disabled) return;
    started = true; takingOver = true; shield.hidden = false;
    tryButton.disabled = true; runtime.try();
  });
  expand.addEventListener('click', () => setExpanded(!expanded));
  document.addEventListener('keydown', event => {
    if (expanded && event.key === 'Escape' && !event.target.matches('.note-editor')) { event.preventDefault(); setExpanded(false); }
  });
  load();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      begin();
    }, {threshold:0.55}).observe(viewport);
  } else { visible = true; begin(); }
})();

