import type { GoalDraft, GoalGraphBackup, GoalLibraryState, GoalBookLink } from '../domain/goal.js';
import type { SaveGoalLibraryCommand } from '../../shared/storage.js';
import { acknowledgeGoals, attachGoalCommand, pendingGoals, readGoalDraft, clearGoalDraft } from './goalRecovery.js';
import { acceptGoalLibrary, bookVersion, cachedGoalLibrary, enqueue, operationId, readBooks, readGoalLibrary, readNotes, storageRequest } from './storageClient.js';
import { getNotesForBooks } from './annotationRepository.js';

const PENDING = 'aura_goal_library_pending', DRAFTS = 'aura_goal_library_drafts';
const BOOK_INTENTS = 'aura_goal_book_pending';
interface Entry { version: string; expected: number; state: GoalLibraryState; command?: SaveGoalLibraryCommand }
export interface LibraryDraft { draft: GoalDraft; legacyBookId?: string }
function read<T>(key: string, fallback: T): T {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    try { return JSON.parse(value) as T; } catch { throw new Error('Goal 恢复缓冲损坏，请保留站点数据'); }
}
export function pendingBookIntents(): GoalBookLink[] {
    const links = read<GoalBookLink[]>(BOOK_INTENTS, []);
    if (!Array.isArray(links) || links.some(l => !l?.goalId || !l.bookId || !l.generation)) throw new Error('Invalid pending book association; local data has been preserved');
    return links;
}
export function stageBookIntent(link: GoalBookLink) {
    const links = pendingBookIntents();
    if (!links.some(l => l.goalId === link.goalId && l.bookId === link.bookId && l.generation === link.generation)) localStorage.setItem(BOOK_INTENTS, JSON.stringify([...links, link]));
}
export function acknowledgeBookIntent(link: GoalBookLink) {
    const links = pendingBookIntents().filter(l => l.goalId !== link.goalId || l.bookId !== link.bookId || l.generation !== link.generation);
    if (links.length) localStorage.setItem(BOOK_INTENTS, JSON.stringify(links)); else localStorage.removeItem(BOOK_INTENTS);
}
export function pendingLibrary(): Entry[] {
    const entries = read<Entry[]>(PENDING, []);
    if (!Array.isArray(entries) || entries.some(e => !e.version || !Number.isSafeInteger(e.expected) || !e.state || !Array.isArray(e.state.goals) || !Array.isArray(e.state.links))) throw new Error('无效 Goal 恢复缓冲');
    return entries;
}
function writePending(entries: Entry[]) { if (entries.length) localStorage.setItem(PENDING, JSON.stringify(entries)); else localStorage.removeItem(PENDING); }
export function libraryDrafts(): LibraryDraft[] {
    const drafts = read<LibraryDraft[]>(DRAFTS, []);
    if (!Array.isArray(drafts) || drafts.some(e => !e.draft?.id || typeof e.draft.text !== 'string')) throw new Error('无效 Goal 草稿');
    return drafts;
}
export function storeLibraryDraft(draft: LibraryDraft) {
    const drafts = libraryDrafts().filter(e => e.draft.id !== draft.draft.id);
    if (draft.draft.text.trim()) drafts.push(draft);
    if (drafts.length) localStorage.setItem(DRAFTS, JSON.stringify(drafts)); else localStorage.removeItem(DRAFTS);
}
function clearDraft(id: string) {
    const prior = libraryDrafts().find(e => e.draft.id === id);
    if (prior?.legacyBookId) clearGoalDraft(prior.legacyBookId);
    storeLibraryDraft({ draft: { id, text: '', parentId: null, origin: null } });
}
export function discardLibraryDraft(id: string) { clearDraft(id); }
export function stageLibrary(state: GoalLibraryState) {
    const entries = pendingLibrary(), last = entries.at(-1);
    if (last && !last.command) entries.pop();
    entries.push({ version: operationId(), expected: last && !last.command ? last.expected : cachedGoalLibrary()?.revision || 0, state: structuredClone(state) });
    writePending(entries);
}
export function flushLibrary(): Promise<void> {
    return enqueue('goal-library', async () => {
        for (;;) {
            const entry = pendingLibrary()[0]; if (!entry) return;
            const command = entry.command || { opId: entry.version, expected: entry.expected, state: entry.state };
            if (!entry.command) { const entries = pendingLibrary(); entries[0].command = command; writePending(entries); }
            const result = await storageRequest('goals/library/save', command);
            if (command.state.bookLinks === undefined) await readGoalLibrary();
            else acceptGoalLibrary({ id: 'reader-goals', revision: result.revision, deleted: false, value: command.state });
            const remaining = pendingLibrary().filter(e => e.version !== entry.version);
            remaining.forEach(e => { if (!e.command) e.expected = result.revision; }); writePending(remaining);
            for (const item of libraryDrafts()) if (command.state.goals.some(g => g.id === item.draft.id && g.text === item.draft.text)) clearDraft(item.draft.id);
            for (const link of pendingBookIntents()) if (command.state.bookLinks?.some(l => l.goalId === link.goalId && l.bookId === link.bookId && l.generation === link.generation)) acknowledgeBookIntent(link);
        }
    });
}
async function legacyId(book: string, id: string) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([book, id])));
    return 'legacy-' + [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function recoverLegacy() {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) || '');
    if (keys.some(k => k.startsWith('aura_goals_'))) await readBooks();
    for (const key of keys.filter(k => k.startsWith('aura_goals_pending_'))) {
        const bookId = key.slice('aura_goals_pending_'.length);
        for (;;) {
            const entry = pendingGoals(bookId)[0]; if (!entry) break;
            const command = entry.command || { opId: entry.version, expected: entry.baseRevision, generation: entry.generation, state: entry.state };
            if (!entry.command) attachGoalCommand(bookId, entry.version, command);
            const result = await storageRequest('goals/save', command);
            acknowledgeGoals(bookId, entry.version, result.revision, command.state);
        }
    }
    for (const key of keys.filter(k => k.startsWith('aura_goals_draft_'))) {
        const bookId = key.slice('aura_goals_draft_'.length), entry = readGoalDraft(bookId); if (!entry) continue;
        const version = await bookVersion(bookId);
        if (version.generation !== entry.generation) throw new Error('旧 Goal 草稿来源已变化，恢复内容已保留');
        const draft = { ...entry.draft, id: await legacyId(bookId, entry.draft.id), parentId: entry.draft.parentId ? await legacyId(bookId, entry.draft.parentId) : null,
            origin: { ...(entry.draft.origin || { sourcePage: null, sectionId: '', chapter: '' }), bookId } };
        if (!libraryDrafts().some(e => e.draft.id === draft.id)) storeLibraryDraft({ draft, legacyBookId: bookId });
    }
}
export async function loadGoalLibrary() {
    await readGoalLibrary();
    let error: unknown;
    try {
        const sources = new Set(pendingLibrary().flatMap(e => e.state.links.map(l => l.bookId)));
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i); if (key?.startsWith('aura_goals_pending_')) sources.add(key.slice('aura_goals_pending_'.length));
        }
        if (sources.size) await getNotesForBooks([...sources]);
        await recoverLegacy(); await flushLibrary();
    } catch (cause) { error = cause; }
    const record = await readGoalLibrary(), pending = pendingLibrary();
    return { state: pending.at(-1)?.state || (!record.deleted ? record.value : { goals: [], links: [] }), drafts: libraryDrafts(), pending: pending.length > 0, error };
}
export async function loadGoalMaterials(state: GoalLibraryState) {
    const ids = [...new Set(state.links.map(l => l.bookId))];
    const [notes, books] = await Promise.all([ids.length ? readNotes(ids) : Promise.resolve([]), readBooks()]);
    return { annotations: notes.flatMap(n => n.deleted ? [] : [n.value]), titles: new Map(books.filter(b => !b.deleted).map(b => [b.id, b.deleted ? '' : b.value.title])) };
}
export function assertNoLibraryRecovery() {
    if (pendingLibrary().length || libraryDrafts().length || pendingBookIntents().length) throw new Error('仍有未确认保存的 Goal，窗口已保留');
}
export async function goalGraphsForBooks(bookIds: string[]): Promise<Map<string, GoalGraphBackup>> {
    const loaded = await loadGoalLibrary(); if (loaded.error) throw loaded.error;
    if (loaded.drafts.length || pendingBookIntents().length) throw new Error('请先完成 Goal 草稿或待确认书籍关联再导出');
    const state = loaded.state, result = new Map<string, GoalGraphBackup>();
    for (const bookId of bookIds) {
        const seeds = new Set([...state.links.filter(l => l.bookId === bookId).map(l => l.goalId), ...(state.bookLinks || []).filter(l => l.bookId === bookId).map(l => l.goalId), ...state.goals.filter(g => g.origin?.bookId === bookId).map(g => g.id)]);
        const roots = new Set<string>();
        for (const id of seeds) { let g = state.goals.find(g => g.id === id); while (g?.parentId) g = state.goals.find(p => p.id === g!.parentId); if (g) roots.add(g.id); }
        const included = new Set(roots); let changed = true;
        while (changed) { changed = false; for (const g of state.goals) if (g.parentId && included.has(g.parentId) && !included.has(g.id)) { included.add(g.id); changed = true; } }
        result.set(bookId, { goals: state.goals.filter(g => included.has(g.id)), links: state.links.filter(l => l.bookId === bookId && included.has(l.goalId)), bookLinks: (state.bookLinks || []).filter(l => l.bookId === bookId && included.has(l.goalId)) });
    }
    return result;
}
