import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import '../desktop/renderer/shell.css';

// The existing workspace keeps its DOM until its features migrate to components.
// React owns only this root; the reader continues to own the book/selection DOM.
let startup: Promise<unknown> | undefined;
function startRuntime() {
    window.__AURA_BOOTSTRAPPED__ = true;
    return startup ??= window.auraDesktop
        ? import('./desktop.js')
        : import('./main.js').then(application => application.startApp());
}

function App() {
    const [failure, setFailure] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        void startRuntime().catch(error => {
            console.error('应用启动失败', error);
            if (active) setFailure(error instanceof Error ? error.message : '应用暂时无法启动');
        });
        return () => { active = false; };
    }, []);
    return failure ? <section className="app-status" role="alert">
        <p>{failure}</p>
        <button type="button" onClick={() => location.reload()}>重新加载</button>
    </section> : null;
}

document.documentElement.dataset.renderer = 'react';
createRoot(document.getElementById('react-root')!).render(<App />);
