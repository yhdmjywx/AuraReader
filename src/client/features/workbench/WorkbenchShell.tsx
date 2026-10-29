import { BackupDialog } from '../backup/BackupDialog.js';
import { memo } from 'react';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { WorkspaceSettings } from './WorkspaceSettings.js';

// Mount once before bootstrap. Controllers own only the explicit engine/view hosts below.
// Keeping these hosts stable preserves EPUB ranges, imported fonts and export command state.
export const WorkbenchShell = memo(function WorkbenchShell() {
    return <>
    <section id="app-status" className="app-status" role="status" aria-live="polite"><p>{"正在打开书库…"}</p></section>
    <header className="app-header">
        <div className="header-side header-brand">
            <div className="brand">
                <i className="ri-book-open-fill brand-icon"></i>
                <span className="brand-name">{"AuraReader"}</span>
            </div>
        </div>
        <WorkspaceSettings />
    </header>
    <div id="appearance-panel" className="appearance-panel" role="dialog" aria-label="视觉偏好">
        <div className="appearance-row">
            <label htmlFor="font-family-select">{"字体"}</label>
            <div id="font-picker" className="font-picker">
                <Button id="font-family-select" className="font-trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="font-menu" title="字体：自动选择">
                    <span id="font-choice-label">{"自动选择"}</span>
                    <span aria-hidden="true">{"⌄"}</span>
                </Button>
                <div id="font-menu" className="font-menu" role="menu" aria-label="字体" hidden>
                    <div id="font-main-view">
                        <div id="font-current-custom" hidden></div>
                        <p className="font-group-label">{"基础"}</p>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="true" data-font-choice="auto">{"自动选择"}</Button>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="false" disabled title="原书字体恢复将在后续支持">
                            {"原书字体"}
                            <span className="font-option-note">{"暂未启用"}</span>
                        </Button>
                        <p className="font-group-label">{"中文"}</p>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="false" data-font-choice="sarasa">{"更纱黑体"}</Button>
                        <p className="font-group-label">{"英文"}</p>
                        <Button className="font-option" type="button" role="menuitemradio" aria-checked="false" data-font-choice="literata">{"Literata"}</Button>
                        <Button id="btn-more-fonts" className="font-more-entry" type="button" role="menuitem">
                            {"更多字体…"}
                            <span aria-hidden="true">{"›"}</span>
                        </Button>
                    </div>
                    <div id="font-more-view" hidden>
                        <Button id="btn-font-back" className="font-back" type="button">{"‹ 返回字体列表"}</Button>
                        <Input id="font-search" className="font-search" type="search" maxLength={160} placeholder="搜索字体" aria-label="搜索字体" />
                        <div className="font-browser-actions">
                            <Button id="btn-read-system-fonts" type="button">{"读取本机字体"}</Button>
                            <Button id="btn-import-font" type="button">{"导入字体文件"}</Button>
                        </div>
                        <Input id="font-file-input" type="file" accept=".ttf,.otf,.woff2" hidden />
                        <p id="font-status" className="font-status" role="status" aria-live="polite"></p>
                        <div id="font-browser-list" className="font-browser-list" role="group" aria-label="更多字体"></div>
                    </div>
                </div>
            </div>
        </div>
        <div className="appearance-row">
            <span>{"字号"}</span>
            <div className="appearance-stepper">
                <Button id="btn-font-dec" className="btn btn-icon-sm" type="button" title="减小字号">{"A-"}</Button>
                <span id="font-size-label" className="font-size-text">{"18px"}</span>
                <Button id="btn-font-inc" className="btn btn-icon-sm" type="button" title="增大字号">{"A+"}</Button>
            </div>
        </div>
        <div className="appearance-row">
            <label htmlFor="indent-select">{"段落缩进"}</label>
            <select id="indent-select" className="select-sm" title="首行缩进模式" defaultValue="2em">
                <option value="0em">{"无"}</option>
                <option value="2em">{"2字"}</option>
                <option value="3em">{"3字"}</option>
            </select>
        </div>
        <div className="appearance-row">
            <span>{"阅读背景"}</span>
            <div className="paper-themes">
                <Button className="paper-btn paper-white active" type="button" data-paper="white" title="纯白" aria-label="纯白纸张">白</Button>
                <Button className="paper-btn paper-sepia" type="button" data-paper="sepia" title="护眼羊皮纸" aria-label="护眼羊皮纸">暖</Button>
                <Button className="paper-btn paper-dark" type="button" data-paper="dark" title="夜间墨黑" aria-label="夜间墨黑纸张">夜</Button>
            </div>
        </div>
        <div className="appearance-row">
            <span>{"版式"}</span>
            <div className="reader-mode-group">
                <Button id="btn-mode-scroll" className="btn btn-icon-sm mode-choice" type="button" title="连续滚动">{"滚动"}</Button>
                <Button id="btn-mode-single" className="btn btn-icon-sm mode-choice" type="button" title="单页阅读">{"单页"}</Button>
            </div>
        </div>
    </div>
    <section id="export-panel" className="export-panel" role="dialog" aria-labelledby="export-panel-title" aria-hidden="true">
        <div className="export-panel-heading">
            <h2 id="export-panel-title">{"导出当前书籍"}</h2>
            <p>
                {"当前书籍 ·"}
                <span id="export-book-title">{"未打开书籍"}</span>
            </p>
        </div>
        <h3 className="export-section-title">{"导出"}</h3>
        <Button id="btn-export-markdown" className="export-menu-action" type="button" data-export-action="">
            <i className="ri-file-text-line" aria-hidden="true"></i>
            <span className="export-action-label">{"笔记摘要"}</span>
            <span className="export-extension">{".md"}</span>
        </Button>
        <div id="chapter-export-entry" className="chapter-export-entry">
            <Button id="btn-export-chapters" className="export-menu-action" type="button" aria-expanded="false" aria-controls="chapter-export-options">
                <i className="ri-folder-download-line" aria-hidden="true"></i>
                <span className="export-action-label">{"按章节导出"}</span>
                <span className="export-extension">{".md"}</span>
            </Button>
            <div id="chapter-export-options" className="chapter-export-options" hidden>
                <Button id="btn-collapse-chapter-export" className="chapter-export-back" type="button" aria-label="返回导出菜单">
                    <i className="ri-arrow-left-s-line" aria-hidden="true"></i>
                    {"按章节导出"}
                </Button>
                <Button id="btn-export-current-chapter" className="chapter-export-range" type="button">{"当前章节"}</Button>
                <Button id="btn-export-all-chapters" className="chapter-export-range" type="button">{"全部章节"}</Button>
                <Button id="btn-select-chapters" className="chapter-export-range" type="button" aria-expanded="false" aria-controls="chapter-export-custom">
                    {"选择章节"}
                    <i className="ri-arrow-right-s-line" aria-hidden="true"></i>
                </Button>
                <div id="chapter-export-custom" hidden>
                    <div id="chapter-export-list" className="chapter-export-list" role="group" aria-label="选择需要导出的章节"></div>
                    <div className="chapter-export-actions">
                        <Button id="btn-cancel-chapter-export" className="btn btn-ghost-sm" type="button">{"取消"}</Button>
                        <Button id="btn-confirm-chapter-export" className="btn btn-primary" type="button" disabled>{"导出"}</Button>
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
            <header className="reader-toolbar" aria-label="当前书籍操作">
                <Button id="btn-goal-sidebar" className="btn btn-icon-sm" type="button" aria-label="Toggle goals sidebar" aria-expanded="true" aria-controls="goal-sidebar" hidden><i className="ri-side-bar-line" aria-hidden="true" /></Button>
                <div className="header-center"><Button id="btn-toc" className="book-nav-btn" type="button" title="打开章节目录" aria-expanded="false" aria-controls="toc-drawer">
                    <i className="ri-list-unordered" /><span id="current-book-title" className="book-nav-title">未打开书籍</span><i className="ri-arrow-down-s-line book-nav-caret" />
                </Button></div>
                <div className="header-actions">
                    <Button id="btn-shelf" className="btn btn-icon nav-icon" type="button" title="我的书库" aria-expanded="false" aria-controls="shelf-panel" aria-haspopup="dialog">
                        <i className="ri-book-shelf-line" /><span className="badge-count" id="shelf-book-count" hidden>0</span>
                    </Button>
                    <Button id="btn-appearance" className="btn reader-appearance-trigger" type="button" title="阅读设置" aria-label="阅读设置" aria-expanded="false" aria-controls="appearance-panel"><span aria-hidden="true">Aa</span><span className="reader-action-label">阅读设置</span></Button>
                    <Button id="btn-export-menu" className="btn btn-icon nav-icon" type="button" title="导出当前书籍" aria-label="导出当前书籍" aria-expanded="false" aria-controls="export-panel"><i className="ri-more-line" aria-hidden="true" /></Button>
                </div>
            </header>
            <section className="reader-panel" id="reader-panel">
                <aside className="toc-drawer" id="toc-drawer">
                    <div className="toc-header">
                        <h4>
                            <i className="ri-list-check"></i>
                            {"书籍目录"}
                        </h4>
                        <Button id="btn-close-toc" className="btn btn-icon-sm"><i className="ri-close-line"></i></Button>
                    </div>
                    <ul className="toc-list" id="toc-list"></ul>
                </aside>
                <div className="reader-viewport" id="reader-viewport"><div className="paper-container" id="paper-container"><article className="book-paper" id="book-paper"></article></div></div>
                <nav className="reader-pagination" aria-label="翻页">
                    <span id="react-reading-book"></span>
                    <Button id="btn-prev-page" className="page-turn-btn" type="button" title="上一页 (←)">{"‹"}</Button>
                    <span className="page-indicator">
                        <span id="current-page">{"1"}</span>
                        {"/"}
                        <span id="total-pages">{"1"}</span>
                        <span id="page-unit">{"页"}</span>
                    </span>
                    <Button id="btn-next-page" className="page-turn-btn" type="button" title="下一页 (→)">{"›"}</Button>
                </nav>
                <div className="selection-tooltip" id="selection-tooltip">
                    <span id="react-selection-actions"></span>
                    <Button className="tooltip-btn hl-yellow" data-color="yellow" title="高亮标记">
                        <i className="ri-mark-pen-line"></i>
                        {"高亮"}
                    </Button>
                    <Button className="tooltip-btn" id="btn-add-note" title="添加随笔">
                        <i className="ri-sticky-note-line"></i>
                        {"笔记"}
                    </Button>
                </div>
                <div className="selection-tooltip" id="highlight-action-tooltip">
                    <Button className="tooltip-btn" id="btn-hl-remove" type="button" style={{"color":"#fca5a5"}} title="只移除黄色高亮">
                        <i className="ri-delete-bin-line"></i>
                        {"删除高亮"}
                    </Button>
                    <Button className="tooltip-btn" id="btn-note-remove" type="button" style={{"color":"#fca5a5"}} title="只删除此处关联的笔记">
                        <i className="ri-delete-bin-line"></i>
                        <span>{"删除笔记"}</span>
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
                        <span>{"划线与笔记"}</span>
                        <span className="badge-count" id="count-highlights">{"0"}</span>
                    </Button></div>
                <div className="tab-content active" id="tab-highlights">
                    <div className="notes-toolbar">
                        <span className="notes-count-text">
                            <strong id="notes-total-count">{"0"}</strong>
                            {"条笔记"}
                        </span>
                        <div className="notes-actions" style={{"display":"flex","gap":"6px","alignItems":"center"}}><Button id="btn-toggle-show-highlights" className="btn btn-outline-sm" style={{"fontSize":"0.78rem","padding":"3px 8px"}} title="点击切换是否在笔记区显示纯划线">
                                <i className="ri-eye-line"></i>
                                {"显示划线 ("}
                                <span id="count-pure-highlights">{"0"}</span>
                                {")"}
                            </Button></div>
                    </div>
                    <div className="notes-list" id="notes-list">
                        <div id="react-notes"></div>
                        <div className="empty-state" id="empty-notes-state">
                            <i className="ri-draft-line"></i>
                            <p>{"暂无划线或笔记"}</p>
                            <small>{"在左侧图书中选中文本即可高亮或添加笔记"}</small>
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
            <h2 id="shelf-panel-title">{"本地书库"}</h2>
            <Button id="btn-close-shelf" className="btn btn-icon-sm" type="button" aria-label="关闭书库" title="关闭书库"><i className="ri-close-line" aria-hidden="true"></i></Button>
        </div>
        <div className="shelf-actions">
            <Button id="btn-import-book" className="btn btn-ghost-sm" type="button" title="打开本地 EPUB / PDF / TXT">{"导入书籍"}</Button>
            <Button id="btn-switch-demo" className="btn btn-ghost-sm" type="button" title="切换示例图书">{"示例图书"}</Button>
            <Input type="file" id="file-input" accept=".epub,.pdf,.txt" hidden />
        </div>
        <ul className="shelf-list" id="shelf-list" aria-label="本地书籍"></ul>
        <p className="shelf-hint">{"书籍与标注保存在本机。请定期备份阅读成果，并保持本地服务运行。"}</p>
    </section>
    <div className="toast" id="toast-msg"></div>
    </>;
});
