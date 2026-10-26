import type { BookGoalState, GoalDraft } from '../domain/goal.js';
import type { SaveGoalsCommand } from '../../shared/storage.js';

export interface PendingGoalWrite {
    version: string; generation: string; baseRevision: number;
    state: BookGoalState; command?: SaveGoalsCommand;
}
export interface RecoverableGoalDraft { bookId: string; generation: string; draft: GoalDraft }
const PENDING = 'aura_goals_pending_', DRAFT = 'aura_goals_draft_';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function read<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw) as T; }
    catch { throw new Error('Goal 恢复缓冲损坏，请保留页面及站点数据'); }
}
export function pendingGoals(bookId: string): PendingGoalWrite[] {
    const entries = read<PendingGoalWrite[]>(PENDING + bookId, []);
    if (!Array.isArray(entries) || entries.some(entry => !entry?.state || entry.state.bookId !== bookId
        || !entry.version || !entry.generation || !Number.isSafeInteger(entry.baseRevision))) throw new Error('无效 Goal 恢复缓冲');
    return entries;
}
function writePending(bookId: string, entries: PendingGoalWrite[]) {
    if (entries.length) localStorage.setItem(PENDING + bookId, JSON.stringify(entries));
    else localStorage.removeItem(PENDING + bookId);
}
export function stageGoals(state: BookGoalState, generation: string, revision: number) {
    const entries = pendingGoals(state.bookId), last = entries.at(-1);
    const entry: PendingGoalWrite = {
        version: globalThis.crypto.randomUUID(), state: clone(state), generation,
        baseRevision: last && !last.command ? last.baseRevision : revision
    };
    if (last && !last.command) entries.pop();
    entries.push(entry); writePending(state.bookId, entries); return entry;
}
export function attachGoalCommand(bookId: string, version: string, command: SaveGoalsCommand) {
    const entries = pendingGoals(bookId), entry = entries.find(item => item.version === version);
    if (!entry) throw new Error('Goal 待写内容已改变');
    entry.command = command; writePending(bookId, entries);
}
export function acknowledgeGoals(bookId: string, version: string, revision: number, state: BookGoalState) {
    const entries = pendingGoals(bookId).filter(entry => entry.version !== version);
    // Only our own acknowledged predecessor can advance an unsent snapshot.
    for (const entry of entries) if (!entry.command) entry.baseRevision = revision;
    writePending(bookId, entries);
    const draft = readGoalDraft(bookId);
    if (draft && state.goals.some(goal => goal.id === draft.draft.id && goal.text === draft.draft.text)) clearGoalDraft(bookId);
}
export function readGoalDraft(bookId: string): RecoverableGoalDraft | null {
    const result = read<RecoverableGoalDraft | null>(DRAFT + bookId, null);
    if (result && (result.bookId !== bookId || !result.generation || !result.draft?.id || typeof result.draft.text !== 'string')) throw new Error('无效 Goal 草稿恢复缓冲');
    return result;
}
export function storeGoalDraft(value: RecoverableGoalDraft) {
    if (!value.draft.text.trim()) { clearGoalDraft(value.bookId); return; }
    localStorage.setItem(DRAFT + value.bookId, JSON.stringify(value));
}
export function clearGoalDraft(bookId: string) { localStorage.removeItem(DRAFT + bookId); }
export function clearBookGoals(bookId: string) {
    // Deleting an acknowledged book must also work in headless/denied-storage contexts.
    try { localStorage.removeItem(PENDING + bookId); clearGoalDraft(bookId); } catch { /* Deleted book generation still rejects stale writes. */ }
}
export function assertNoGoalRecovery() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PENDING) && pendingGoals(key.slice(PENDING.length)).length) throw new Error('仍有未确认保存的 Goal，窗口已保留');
        if (key?.startsWith(DRAFT) && readGoalDraft(key.slice(DRAFT.length))) throw new Error('仍有未提交的 Goal 草稿，窗口已保留');
    }
}
