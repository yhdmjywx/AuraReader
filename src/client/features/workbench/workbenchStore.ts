import type { bootstrapApp } from '../../main.js';
import type { Annotation } from '../../domain/annotation.js';
import type { Goal, GoalSourceLink } from '../../domain/goal.js';
import type { AppSurface } from '../../app/navigation.js';
import type { ReaderSnapshot } from '../reader/readerRuntime.js';
import { areaGoals } from '../../domain/goalLifecycle.js';
import { findChapterForPage } from '../../domain/readingLocation.js';
import { getBookSummariesFromDB } from '../../infrastructure/bookRepository.js';
import { initialWikiSite } from '../../../shared/wiki.js';
import { WikiController, type WikiState } from '../wiki/wikiController.js';

export type ReadingApplication = ReturnType<typeof bootstrapApp>;
export interface WorkbenchSnapshot {
    surface: AppSurface;
    reader: ReaderSnapshot;
    books: { id: string; title: string }[];
    notes: Annotation[];
    editingNoteId: string | null;
    focusedIds: string[];
    saveState: 'saving' | 'saved' | 'error';
    selectedGoal: Goal | null;
    children: Goal[];
    goalVisible: boolean;
    goalDisabled: boolean;
    materials: { link: GoalSourceLink; annotation?: Annotation; title: string }[];
    linkedIds: string[];
    error: string;
    wiki: WikiState | null;
}

/** A subscribed view of existing authorities. Commands reuse their persistence and navigation. */
export class WorkbenchStore {
    private listeners = new Set<() => void>();
    private detach: (() => void)[] = [];
    private books: WorkbenchSnapshot['books'] = [];
    private error = '';
    private snapshot: WorkbenchSnapshot;
    private wikiBookId = '';
    readonly wiki = new WikiController(() => this.publish());
    constructor(readonly app: ReadingApplication) { this.snapshot = this.read(); }
    getSnapshot = () => this.snapshot;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    private read(): WorkbenchSnapshot {
        const { annotations, goals, navigation, readerRuntime } = this.app;
        const selected = goals.allGoals ? null : goals.state.goals.find(goal => goal.id === goals.selected) || null;
        const value: WorkbenchSnapshot = {
            surface: navigation.surface, reader: readerRuntime.getSnapshot(), books: this.books,
            notes: annotations.getSidebarNotes().filter(note => note.kind === 'note' || annotations.showHighlightsInSidebar),
            editingNoteId: annotations.editingNoteId,
            focusedIds: [...annotations.focusedNoteIds, ...annotations.focusedHighlightIds],
            saveState: annotations.saveState,
            selectedGoal: selected, children: areaGoals(goals.state, 'library', selected?.id || null),
            goalVisible: goals.visible, goalDisabled: goals.disabled || goals.lifecycleBusy,
            materials: selected ? goals.materialEntries(selected.id) : [],
            linkedIds: goals.state.links.filter(link => link.goalId === selected?.id).map(link => link.annotationId),
            error: this.error,
            wiki: this.wiki.state,
        };
        return JSON.parse(JSON.stringify(value)) as WorkbenchSnapshot;
    }
    private publish = () => {
        if (this.wiki.state && (this.app.reader.getCurrentBook()?.id !== this.wikiBookId
            || this.app.navigation.surface !== 'reader' || this.app.readerRuntime.getSnapshot().selection)) {
            this.closeWiki();
        }
        const next = this.read();
        if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
        this.snapshot = next;
        for (const listener of this.listeners) listener();
    };
    connect() {
        const { annotations, goals, navigation, session, readerRuntime } = this.app;
        this.detach = [annotations.subscribe(this.publish), goals.subscribe(this.publish),
            navigation.subscribe(this.publish), readerRuntime.subscribe(this.publish),
            session.subscribe(() => { this.publish(); this.run(() => this.refreshBooks()); })];
        this.run(() => this.refreshBooks());
        this.publish();
        return () => { this.detach.splice(0).forEach(unsubscribe => unsubscribe()); this.closeWiki(); };
    }
    openWiki() {
        const text = this.app.readerRuntime.getSnapshot().selection?.text.trim();
        if (!text) return;
        const book = this.app.reader.getCurrentBook();
        this.wikiBookId = book?.id || '';
        this.app.readerRuntime.selection.pinSelectionTooltip(true);
        this.app.readerRuntime.selection.clearSelection();
        this.wiki.open(text, initialWikiSite(book?.language || book?.languages?.[0], navigator.language));
    }
    closeWiki() {
        this.app.readerRuntime.selection.pinSelectionTooltip(false);
        this.wiki.close();
        if (!this.app.readerRuntime.getSnapshot().selection) this.app.readerRuntime.selection.hideSelectionTooltip();
    }
    private async refreshBooks() {
        this.books = (await getBookSummariesFromDB()).map(({ id, title }) => ({ id, title }));
        this.publish();
    }
    run(action: () => unknown | Promise<unknown>) {
        this.error = '';
        return Promise.resolve().then(action).catch(error => {
            this.error = error instanceof Error ? error.message : String(error);
            this.app.appShell.showToast(this.error, { kind: 'error' });
        }).finally(this.publish);
    }
    async finishNote() {
        await this.app.annotations.finishInlineEdit();
        await this.app.annotations.assertInlineWritesSaved();
    }
    openBook(id: string) { return this.run(async () => { await this.finishNote(); await this.app.coordinator.openBook(id); }); }
    selectGoal(id: string | null) { return this.run(async () => {
        await this.finishNote();
        if (id) this.app.goals.selectGoal(id); else this.app.goals.goHome();
    }); }
    createGoal(text: string) { return this.run(async () => {
        await this.finishNote();
        if (text.trim()) await this.app.goals.createGoal(text, this.app.goals.allGoals ? null : this.app.goals.selected);
    }); }
    createFromSelection(kind: 'note' | 'highlight') {
        const { readerRuntime, reader, annotations, coordinator } = this.app;
        const pending = readerRuntime.selection.getPendingSelection();
        if (!pending) return Promise.resolve();
        const draft = { quote: pending.text, page: pending.page, location: pending.location,
            chapter: findChapterForPage(reader.getCurrentBook()?.toc, pending.page) };
        readerRuntime.selection.hideSelectionTooltip();
        readerRuntime.selection.clearSelection();
        return this.run(async () => {
            await this.finishNote();
            if (kind === 'note') annotations.createNote(draft);
            else await coordinator.addAnnotation({ ...draft, type: 'highlight', color: 'yellow' });
        });
    }
    editNote(note: Annotation) { this.app.annotations.beginInlineEdit(note); }
    updateNote(id: string, text: string) { this.app.annotations.updateInlineNote(id, text); }
    linkNote(id: string) { return this.run(async () => { await this.finishNote(); await this.app.goals.linkAnnotation(id); }); }
    jumpToSource(link: GoalSourceLink) { return this.run(async () => { await this.finishNote(); await this.app.goals.jumpMaterial(link); }); }
    deleteNote(id: string) { return this.run(() => this.app.annotations.deleteAnnotation(id)); }
}
