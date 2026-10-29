import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import '../desktop/renderer/shell.css';
import { ReadingWorkbench } from './features/workbench/ReadingWorkbench.js';
import type { ReadingApplication } from './features/workbench/workbenchStore.js';
import { WorkbenchShell } from './features/workbench/WorkbenchShell.js';
import './components/ui/workbench.css';

// Render stable shell hosts first, then connect the existing engines and commands.
let startup: Promise<typeof import('./main.js')> | undefined;
function startRuntime() {
    window.__AURA_BOOTSTRAPPED__ = true;
    return startup ??= window.auraDesktop
        ? import('./desktop.js').then(desktop => desktop.applicationReady)
        : import('./main.js').then(async application => { await application.startApp(); return application; });
}

function App() {
    const [failure, setFailure] = useState<string | null>(null);
    const [application, setApplication] = useState<ReadingApplication | null>(null);
    useEffect(() => {
        let active = true;
        void startRuntime().then(app => { if (active) setApplication(app.appInstance); }).catch(error => {
            console.error('应用启动失败', error);
            if (active) setFailure(error instanceof Error ? error.message : '应用暂时无法启动');
        });
        return () => { active = false; };
    }, []);
    return <><WorkbenchShell />{failure ? <section className="app-status" role="alert">
        <p>{failure}</p>
        <button type="button" onClick={() => location.reload()}>重新加载</button>
    </section> : application ? <ReadingWorkbench application={application} /> : null}</>;
}

document.documentElement.dataset.renderer = 'react';
createRoot(document.getElementById('react-root')!).render(<App />);
