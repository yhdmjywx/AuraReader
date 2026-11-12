import { useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Menu } from '@base-ui/react/menu';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { openWikiExternal } from '../../infrastructure/wikiClient.js';
import type { WorkbenchStore } from '../workbench/workbenchStore.js';
import type { WikiState } from './wikiController.js';
import { marginGeometry } from '../layout/marginNotesLayout.js';
import { DropdownMenuContent } from '../../components/ui/dropdown-menu.js';
import './wiki.css';

const languages = [
    { value: 'zh-hans', site: 'zh', label: '简体中文' },
    { value: 'en', site: 'en', label: 'English' },
    { value: 'zh-hant', site: 'zh', label: '繁體中文' },
    { value: 'fr', site: 'fr', label: 'Français' },
    { value: 'de', site: 'de', label: 'Deutsch' },
    { value: 'es', site: 'es', label: 'Español' },
];
const notices = {
    disambiguation: 'This title has multiple meanings. Open Wikipedia or enter a more specific title.',
    section: 'This title links to a section. Open Wikipedia to read that section.',
    empty: 'No introduction is available for this article. Open Wikipedia to read it.'
};

function WikiContent({ state, store }: { state: WikiState; store: WorkbenchStore }) {
    const [draft, setDraft] = useState(state.query);
    const [linkError, setLinkError] = useState('');
    const languageTrigger = useRef<HTMLButtonElement>(null);
    const article = state.article;
    const languageValue = state.site === 'zh' ? state.variant : state.site;
    const languageLabel = languages.find(language => language.value === languageValue)?.label || state.site;
    const available = (site: string) => !!article && (site === state.site || state.languages.some(language => language.site === site));
    const external = (url: string) => {
        setLinkError('');
        void openWikiExternal(url).catch(() => setLinkError('The link could not be opened. Please try again.'));
    };
    return <>
        <div className="wiki-controls">
            <form onSubmit={event => { event.preventDefault(); setLinkError(''); store.wiki.submit(draft); }}>
                <Input className="wiki-query" aria-label="Wikipedia query" value={draft} autoComplete="off" spellCheck={false}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => {
                        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                            if (event.key === 'Enter') event.preventDefault();
                        }
                    }} />
            </form>
            <Menu.Root>
                <Menu.Trigger ref={languageTrigger} render={<Button className="wiki-language" />}
                    aria-label="Wikipedia language" disabled={state.loading || state.languagesLoading || !article}>
                    <span>{languageLabel}</span><img src="./wiki/arrow-down.svg" width="12" height="8" alt="" />
                </Menu.Trigger>
                <DropdownMenuContent anchor={{ getBoundingClientRect: () => languageTrigger.current!.getBoundingClientRect() }} className="wiki-language-menu" aria-label="Wikipedia languages">
                    <Menu.RadioGroup value={languageValue} onValueChange={(value: string) => { setLinkError(''); store.wiki.switchLanguage(value); }}>
                        {languages.map(language => <Menu.RadioItem key={language.value} value={language.value}
                            label={language.label} disabled={!available(language.site)} closeOnClick>
                            <Menu.RadioItemIndicator className="wiki-language-indicator"><img src="./wiki/selected.svg" width="6" height="6" alt="" /></Menu.RadioItemIndicator>
                            {language.label}
                        </Menu.RadioItem>)}
                    </Menu.RadioGroup>
                </DropdownMenuContent>
            </Menu.Root>
        </div>
        <Button className="wiki-original" aria-label="Open article on Wikipedia" title="Open article on Wikipedia"
            disabled={!article} onClick={() => { if (article) external(article.url); }}>
            <img src="./wiki/original-link.svg" width="10.05" height="10.05" alt="" />
        </Button>
        <div className="wiki-body" key={article?.url || state.query} tabIndex={0} aria-label="Wikipedia introduction" aria-busy={state.loading}>
            {state.loading && <div role="status">Loading Wikipedia…</div>}
            {state.error && <div role="alert">{state.error} <Button className="wiki-text-action" onClick={() => store.wiki.retryArticle()}>Retry</Button></div>}
            {linkError && <div role="alert">{linkError}</div>}
            {state.missing && <div role="status">No article found. Edit the query and press Enter.</div>}
            {article && <>
                {article.notice ? <div role="status">{notices[article.notice]}</div>
                    : <div className="wiki-extract" lang={article.site === 'zh' ? state.variant : article.site} dir="auto">{article.extract.split(/\r?\n+/).filter(text => text.trim()).map((text, index) => <p key={index}>{text}</p>)}</div>}
                {state.languagesLoading && <div className="wiki-feedback" role="status">Loading language editions…</div>}
                {state.languagesError && <div className="wiki-feedback" role="alert">{state.languagesError} <Button className="wiki-text-action" disabled={state.loading} onClick={() => store.wiki.retryLanguages()}>Retry languages</Button></div>}
            </>}
        </div>
        {article && <footer className="wiki-attribution"><Button className="wiki-text-action" onClick={() => external(article.url)}>Wikipedia contributors</Button>
            {' · '}<Button className="wiki-text-action" title={article.license.name} onClick={() => external(article.license.url)}>CC BY-SA {article.license.url.match(/by-sa\/([\d.]+)/)?.[1] || ''}</Button></footer>}
    </>;
}

export function WikiLookup({ state, store }: { state: WikiState | null; store: WorkbenchStore }) {
    const workspace = store.app.elements.workspaceContainer!;
    // Same geometry as margin notes, with the Wiki's own design width. No selected-text anchoring.
    const anchor = useMemo(() => ({ contextElement: workspace, getBoundingClientRect() {
        const bounds = workspace.getBoundingClientRect();
        const viewport = store.app.elements.readerViewport!.getBoundingClientRect();
        const geometry = marginGeometry(workspace.clientWidth);
        return new DOMRect(bounds.left + geometry.rightNoteLeft, viewport.top + 32, 0, 0);
    } }), [workspace, store]);
    return <Popover.Root open={!!state} onOpenChange={open => { if (open) store.openWiki(); else store.closeWiki(); }}>
        <Popover.Trigger render={<Button className="tooltip-btn" />} onMouseDown={event => event.preventDefault()}
            aria-label={state ? 'Close Wikipedia' : 'Look up on Wikipedia'} title={state ? 'Close Wikipedia' : 'Look up on Wikipedia'}>Wiki</Popover.Trigger>
        <Popover.Portal>
            <Popover.Positioner anchor={anchor} positionMethod="fixed" side="bottom" align="start" sideOffset={0}
                collisionAvoidance={{ side: 'none', align: 'none', fallbackAxisSide: 'none' }} className="wiki-positioner">
                <Popover.Popup className="wiki-dialog" data-slot="dialog-content" aria-label="Wikipedia" onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
                    {state && <WikiContent state={state} store={store} />}
                </Popover.Popup>
            </Popover.Positioner>
        </Popover.Portal>
    </Popover.Root>;
}
