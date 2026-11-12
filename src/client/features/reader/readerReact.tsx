import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { AppElements } from '../../app/elements.js';
import type { ReaderRuntime } from './readerRuntime.js';

export function useReaderSnapshot(runtime: ReaderRuntime) {
    return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
}

/** React creates the hosts, while the runtime exclusively manages paper descendants. */
export function ReaderSurface({ runtime, controls }: { runtime: ReaderRuntime; controls?: AppElements }) {
    const root = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        runtime.mount(root.current!, controls);
        return () => runtime.destroy();
    }, [runtime, controls]);
    return <section ref={root} className="reader-panel">
        <div className="reader-viewport" data-reader-viewport>
            <div className="paper-container" data-reader-container>
                <article className="book-paper" data-reader-paper />
            </div>
        </div>
    </section>;
}
