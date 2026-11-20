import type { ReactNode } from 'react';
import { Button } from '../../components/ui/button.js';

export function ReadingToolbar() {
    return <div className="reader-toolbar-slot">
        <header className="reader-toolbar" aria-label="Book and pagination">
            <span id="current-book-title" className="book-nav-title">No book open</span>
            <nav className="reader-pagination" aria-label="Pagination">
                <Button id="btn-prev-page" size="icon-lg" className="page-turn-btn" title="Previous page (←)" aria-label="Previous page">
                    <span className="reader-tool-icon previous-icon" aria-hidden="true" />
                </Button>
                <span className="page-indicator"><span id="current-page">1</span>/<span id="total-pages">1</span><span id="page-unit"> page</span></span>
                <Button id="btn-next-page" size="icon-lg" className="page-turn-btn" title="Next page (→)" aria-label="Next page">
                    <span className="reader-tool-icon next-icon" aria-hidden="true" />
                </Button>
            </nav>
        </header>
        <span id="react-reading-book" />
    </div>;
}

interface ReadingToolsProps {
    library: ReactNode;
    settings: ReactNode;
}

export function ReadingTools({ library, settings }: ReadingToolsProps) {
    return <div className="reader-tools">
        <div className="reader-side-tools" role="group" aria-label="Book actions">
            <Button id="btn-toc" size="icon-lg" title="Open contents" aria-label="Contents" aria-expanded="false" aria-controls="toc-drawer">
                <span className="reader-tool-icon contents-icon" aria-hidden="true" />
            </Button>
            <nav className="reader-tool-panel toc-popover" id="toc-drawer" aria-label="Contents" hidden>
                <ul className="toc-list" id="toc-list" />
            </nav>
            <Button id="btn-shelf" size="icon-lg" title="My library" aria-label="My library" aria-expanded="false" aria-controls="shelf-panel" aria-haspopup="dialog" aria-describedby="shelf-book-count">
                <span className="reader-tool-icon library-icon" aria-hidden="true" /><span className="reader-tool-count" id="shelf-book-count" hidden>0</span>
            </Button>
            {library}
            <Button id="btn-appearance" size="icon-lg" title="Reading settings" aria-label="Reading settings" aria-expanded="false" aria-controls="appearance-panel" aria-haspopup="dialog">
                <span className="reader-tool-icon appearance-icon" aria-hidden="true" />
            </Button>
            {settings}
        </div>
    </div>;
}
