import { BackupDialog } from '../backup/BackupDialog.js';
import { memo } from 'react';
import { Button } from '../../components/ui/button.js';
import { ActionIcon } from '../../components/ui/action-icon.js';
import { Input } from '../../components/ui/input.js';
import { WorkspaceSettings } from './WorkspaceSettings.js';

// Mount once before bootstrap. Controllers own only the explicit engine/view hosts below.
// Keeping these hosts stable preserves EPUB ranges, imported fonts and export command state.
export const WorkbenchShell = memo(function WorkbenchShell() {
    return <>
    <section id="app-status" className="app-status" role="status" aria-live="polite"><p>{"Opening library…"}</p></section>
    <header className="app-header">
        <div className="header-side header-brand">
            <div className="brand">
                <i className="ri-book-open-fill brand-icon"></i>
                <span className="brand-name">{"AuraReader"}</span>
            </div>
        </div>
        <Button id="btn-goal-sidebar" size="icon-lg" className="btn btn-icon-sm" type="button" aria-label="Toggle goals sidebar" aria-expanded="true" aria-controls="goal-sidebar" hidden><ActionIcon name="sidebar" /></Button>
        <WorkspaceSettings />
    </header>
    <div id="appearance-panel" className="appearance-panel" role="dialog" aria-label="Reading settings">
        <h2 className="appearance-heading">Reading settings</h2>
        <div className="appearance-row">
            <label htmlFor="font-family-select">{"Font"}</label>
            <div id="font-picker" className="font-picker">
                <Button id="font-family-select" size="lg" className="font-trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="font-menu" title="Font: Auto">
                    <span id="font-choice-label">{"Auto"}</span>
                    <ActionIcon name="down" />
                </Button>
                <div id="font-menu" className="font-menu" role="menu" aria-label="Font" hidden>
                    <div id="font-main-view">
                        <div id="font-current-custom" hidden></div>
                        <p className="font-group-label">{"Basic"}</p>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="true" data-font-choice="auto">{"Auto"}</Button>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="false" data-font-choice="original">
                            {"Book font"}
                        </Button>
                        <p className="font-group-label">{"Chinese"}</p>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="false" data-font-choice="sarasa">{"Sarasa Gothic SC"}</Button>
                        <p className="font-group-label">{"English"}</p>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="false" data-font-choice="literata">{"Literata"}</Button>
                        <Button id="btn-more-fonts" className="font-more-entry" type="button" role="menuitem">
                            <i className="ri-font-size" aria-hidden="true" />{"More fonts…"}
                            <i className="ri-arrow-right-s-line" aria-hidden="true" />
                        </Button>
                    </div>
                    <div id="font-more-view" hidden>
                        <Button id="btn-font-back" className="font-back" type="button"><i className="ri-arrow-left-s-line" aria-hidden="true" />{"Back to fonts"}</Button>
                        <Input id="font-search" className="font-search" type="search" maxLength={160} placeholder="Search fonts" aria-label="Search fonts" />
                        <div className="font-browser-actions">
                            <Button id="btn-read-system-fonts" type="button"><i className="ri-computer-line" aria-hidden="true" />{"Read fonts"}</Button>
                            <Button id="btn-import-font" type="button"><i className="ri-upload-line" aria-hidden="true" />{"Import font"}</Button>
                        </div>
                        <Input id="font-file-input" type="file" accept=".ttf,.otf,.woff2" hidden />
                        <p id="font-status" className="font-status" role="status" aria-live="polite"></p>
                        <div id="font-browser-list" className="font-browser-list" role="group" aria-label="More fonts"></div>
                    </div>
                </div>
            </div>
        </div>
        <div className="appearance-row">
            <span>{"Size"}</span>
            <div className="appearance-stepper">
                <Button id="btn-font-dec" size="icon-lg" className="btn btn-icon-sm" type="button" title="Decrease font size" aria-label="Decrease font size"><ActionIcon name="minus" /></Button>
                <span id="font-size-label" className="font-size-text">{"18px"}</span>
                <Button id="btn-font-inc" size="icon-lg" className="btn btn-icon-sm" type="button" title="Increase font size" aria-label="Increase font size"><ActionIcon name="plus" /></Button>
            </div>
        </div>
        <div className="appearance-row">
            <span id="line-spacing-title">{"Line spacing"}</span>
            <div className="appearance-stepper reading-geometry-stepper" role="group" aria-labelledby="line-spacing-title">
                <Button id="btn-line-spacing-dec" size="icon-lg" className="btn btn-icon-sm" type="button" title="Decrease line spacing" aria-label="Decrease line spacing"><ActionIcon name="minus" /></Button>
                <span id="line-spacing-label" className="font-size-text" aria-live="polite">{"1.85×"}</span>
                <Button id="btn-line-spacing-inc" size="icon-lg" className="btn btn-icon-sm" type="button" title="Increase line spacing" aria-label="Increase line spacing"><ActionIcon name="plus" /></Button>
            </div>
        </div>
        <div className="appearance-row">
            <span id="reading-width-title">{"Reading width"}</span>
            <div className="appearance-stepper reading-geometry-stepper" role="group" aria-labelledby="reading-width-title">
                <Button id="btn-reading-width-dec" size="icon-lg" className="btn btn-icon-sm" type="button" title="Decrease reading width" aria-label="Decrease reading width"><ActionIcon name="minus" /></Button>
                <span id="reading-width-label" className="font-size-text" aria-live="polite">{"560px"}</span>
                <Button id="btn-reading-width-inc" size="icon-lg" className="btn btn-icon-sm" type="button" title="Increase reading width" aria-label="Increase reading width"><ActionIcon name="plus" /></Button>
            </div>
        </div>
        <div className="appearance-row">
            <label htmlFor="indent-select">{"Indent"}</label>
            <select id="indent-select" className="select-sm" title="First-line indent" defaultValue="2em">
                <option value="0em">{"None"}</option>
                <option value="2em">{"2 em"}</option>
                <option value="3em">{"3 em"}</option>
            </select>
        </div>
        <div className="appearance-row">
            <span>{"Paper"}</span>
            <div className="paper-themes">
                <Button size="icon-lg" className="paper-btn paper-white active" type="button" data-paper="white" title="White" aria-label="White paper" />
                <Button size="icon-lg" className="paper-btn paper-sepia" type="button" data-paper="sepia" title="Sepia paper" aria-label="Sepia paper" />
                <Button size="icon-lg" className="paper-btn paper-dark" type="button" data-paper="dark" title="Dark" aria-label="Dark paper" />
            </div>
        </div>
        <div className="appearance-row">
            <span>{"Layout"}</span>
            <div className="reader-mode-group">
                <Button id="btn-mode-scroll" size="lg" className="btn btn-icon-sm mode-choice" type="button" title="Continuous scroll">{"Scroll"}</Button>
                <Button id="btn-mode-single" size="lg" className="btn btn-icon-sm mode-choice" type="button" title="Single page">{"Page"}</Button>
            </div>
        </div>
    </div>
    <section id="export-panel" className="export-panel" role="dialog" aria-labelledby="export-panel-title" aria-hidden="true">
        <div className="export-panel-heading">
            <h2 id="export-panel-title">{"Export book"}</h2>
            <p>
                {"Book · "}
                <span id="export-book-title">{"No book open"}</span>
            </p>
        </div>
        <h3 className="export-section-title">{"Export"}</h3>
        <Button id="btn-export-markdown" className="export-menu-action" type="button" data-export-action="">
            <i className="ri-file-text-line" aria-hidden="true"></i>
            <span className="export-action-label">{"Notes summary"}</span>
            <span className="export-extension">{".md"}</span>
        </Button>
        <div id="chapter-export-entry" className="chapter-export-entry">
            <Button id="btn-export-chapters" className="export-menu-action" type="button" aria-expanded="false" aria-controls="chapter-export-options">
                <i className="ri-folder-download-line" aria-hidden="true"></i>
                <span className="export-action-label">{"Chapters"}</span>
                <span className="export-extension">{".md"}</span>
            </Button>
            <div id="chapter-export-options" className="chapter-export-options" hidden>
                <Button id="btn-collapse-chapter-export" className="chapter-export-back" type="button" aria-label="Back to export menu">
                    <i className="ri-arrow-left-s-line" aria-hidden="true"></i>
                    {"Chapters"}
                </Button>
                <Button id="btn-export-current-chapter" className="chapter-export-range" type="button">{"Current chapter"}</Button>
                <Button id="btn-export-all-chapters" className="chapter-export-range" type="button">{"All chapters"}</Button>
                <Button id="btn-select-chapters" className="chapter-export-range" type="button" aria-expanded="false" aria-controls="chapter-export-custom">
                    {"Select chapters"}
                    <i className="ri-arrow-right-s-line" aria-hidden="true"></i>
                </Button>
                <div id="chapter-export-custom" hidden>
                    <div id="chapter-export-list" className="chapter-export-list" role="group" aria-label="Select chapters to export"></div>
                    <div className="chapter-export-actions">
                        <Button id="btn-cancel-chapter-export" className="btn btn-ghost-sm" type="button">{"Cancel"}</Button>
                        <Button id="btn-confirm-chapter-export" className="btn btn-primary" type="button" disabled>{"Export"}</Button>
                    </div>
                </div>
            </div>
        </div>
    </section>
    <div className="reading-workspace" id="reading-workspace">
        <aside className="goal-sidebar" id="goal-sidebar" aria-label="Goals sidebar" hidden>
            <div className="goal-panel" id="goal-panel" aria-label="Reading goals" hidden></div>
            <div className="goal-resizer" id="goal-resizer" role="separator" tabIndex={0} aria-label="Resize goals sidebar" aria-orientation="vertical" aria-controls="goal-sidebar"></div>
        </aside>
        <main className="workspace-container immersive-notes" id="workspace-container">
            <header className="reader-toolbar" aria-label="Book actions">
                <div className="header-center"><Button id="btn-toc" size="lg" className="book-nav-btn" type="button" title="Open contents" aria-expanded="false" aria-controls="toc-drawer">
                    <ActionIcon name="contents" /><span id="current-book-title" className="book-nav-title">No book open</span><ActionIcon name="down" className="book-nav-caret" />
                </Button></div>
                <nav className="reader-pagination" aria-label="Pagination">
                    <Button id="btn-prev-page" size="icon-lg" className="page-turn-btn" type="button" title="Previous page (←)" aria-label="Previous page"><ActionIcon name="left" /></Button>
                    <span className="page-indicator">
                        <span id="current-page">{"1"}</span>
                        {"/"}
                        <span id="total-pages">{"1"}</span>
                        <span id="page-unit">{" page"}</span>
                    </span>
                    <Button id="btn-next-page" size="icon-lg" className="page-turn-btn" type="button" title="Next page (→)" aria-label="Next page"><ActionIcon name="right" /></Button>
                </nav>
                <div className="header-actions">
                    <Button id="btn-shelf" size="icon-lg" className="btn btn-icon nav-icon" type="button" title="My library" aria-expanded="false" aria-controls="shelf-panel" aria-haspopup="dialog">
                        <ActionIcon name="library" /><span className="badge-count" id="shelf-book-count" hidden>0</span>
                    </Button>
                    <Button id="btn-appearance" size="icon-lg" className="btn btn-icon reader-appearance-trigger" type="button" title="Reading settings" aria-label="Reading settings" aria-expanded="false" aria-controls="appearance-panel"><ActionIcon name="palette" /></Button>
                    <Button id="btn-export-menu" size="icon-lg" className="btn btn-icon nav-icon" type="button" title="Export book" aria-label="Export book" aria-expanded="false" aria-controls="export-panel"><ActionIcon name="more" /></Button>
                </div>
                <span id="react-reading-book"></span>
            </header>
            <section className="reader-panel" id="reader-panel">
                <aside className="toc-drawer" id="toc-drawer">
                    <div className="toc-header">
                        <h4>
                            <i className="ri-list-check"></i>
                            {"Contents"}
                        </h4>
                        <Button id="btn-close-toc" className="btn btn-icon-sm"><i className="ri-close-line"></i></Button>
                    </div>
                    <ul className="toc-list" id="toc-list"></ul>
                </aside>
                <div className="reader-viewport" id="reader-viewport"><div className="paper-container" id="paper-container"><article className="book-paper" id="book-paper"></article></div></div>
                <div className="selection-tooltip" id="selection-tooltip">
                    <span id="react-selection-actions"></span>
                    <Button className="tooltip-btn hl-yellow" data-color="yellow" title="Highlight text">
                        <i className="ri-mark-pen-line"></i>
                        {"Highlight"}
                    </Button>
                    <Button className="tooltip-btn" id="btn-add-note" title="Add note">
                        <i className="ri-sticky-note-line"></i>
                        {"Note"}
                    </Button>
                </div>
                <div className="selection-tooltip" id="highlight-action-tooltip">
                    <Button className="tooltip-btn" id="btn-hl-remove" type="button" style={{"color":"#fca5a5"}} title="Remove only the yellow highlight">
                        <i className="ri-delete-bin-line"></i>
                        {"Delete highlight"}
                    </Button>
                    <Button className="tooltip-btn" id="btn-note-remove" type="button" style={{"color":"#fca5a5"}} title="Delete only the linked note">
                        <i className="ri-delete-bin-line"></i>
                        <span>{"Delete note"}</span>
                    </Button>
                    <Button className="tooltip-btn" id="btn-annotation-goal" type="button" hidden aria-label="Add to goal">
                        <i className="ri-links-line" aria-hidden="true"></i>
                        <span>{"Goal"}</span>
                    </Button>
                </div>
            </section>
            <section className="notes-panel" id="notes-panel">
                <div className="tabs-header"><Button className="tab-btn active" data-tab="tab-highlights">
                        <i className="ri-quill-pen-line"></i>
                        <span>{"Highlights and notes"}</span>
                        <span className="badge-count" id="count-highlights">{"0"}</span>
                    </Button></div>
                <div className="tab-content active" id="tab-highlights">
                    <div className="notes-toolbar">
                        <span className="notes-count-text">
                            <strong id="notes-total-count">{"0"}</strong>
                            {" notes"}
                        </span>
                        <div className="notes-actions" style={{"display":"flex","gap":"6px","alignItems":"center"}}><Button id="btn-toggle-show-highlights" className="btn btn-outline-sm" style={{"fontSize":"0.78rem","padding":"3px 8px"}} title="Toggle highlights in the notes panel">
                                <i className="ri-eye-line"></i>
                                {"Show highlights ("}
                                <span id="count-pure-highlights">{"0"}</span>
                                {")"}
                            </Button></div>
                    </div>
                    <div className="notes-list" id="notes-list">
                        <div id="react-notes"></div>
                        <div className="empty-state" id="empty-notes-state">
                            <i className="ri-draft-line"></i>
                            <p>{"No highlights or notes"}</p>
                            <small>{"Select text in the book to highlight or add a note."}</small>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    </div>
    <main id="goal-page" className="goal-page" aria-label="Goals" hidden>
        <Button id="btn-goal-back" className="btn btn-icon-sm" type="button" aria-label="Back to reading" title="Back to reading"><i className="ri-fullscreen-exit-line" aria-hidden="true"></i></Button>
        <div id="goal-page-content" className="goal-page-content"></div>
    </main>
    <main id="goal-home" className="goal-home" aria-label="Reading home" hidden></main>
    <BackupDialog />
    <section id="shelf-panel" className="appearance-panel shelf-panel" role="dialog" aria-modal="false" aria-labelledby="shelf-panel-title" aria-hidden="true">
        <div className="shelf-header">
            <h2 id="shelf-panel-title">{"Local library"}</h2>
            <Button id="btn-close-shelf" size="icon" className="btn btn-icon-sm" type="button" aria-label="Close library" title="Close library"><ActionIcon name="close" /></Button>
        </div>
        <div className="shelf-actions">
            <Button id="btn-import-book" className="btn btn-ghost-sm" type="button" title="Open local EPUB / PDF / TXT">{"Import book"}</Button>
            <Button id="btn-switch-demo" className="btn btn-ghost-sm" type="button" title="Switch sample book">{"Sample book"}</Button>
            <Input type="file" id="file-input" accept=".epub,.pdf,.txt" hidden />
        </div>
        <ul className="shelf-list" id="shelf-list" aria-label="Local books"></ul>
    </section>
    <div className="toast" id="toast-msg"></div>
    </>;
});
