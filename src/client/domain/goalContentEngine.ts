import type { GoalInputDraft, GoalLibraryState, GoalSourceLink } from './goal.js';
import { goalEditable } from './goalLifecycle.js';

/** Stable compatibility order, not a fabricated historical timestamp. */
export function normalizeGoalContent(state: GoalLibraryState): GoalLibraryState {
    const links = state.links.map((link, i) => ({ ...link, order: link.order ?? state.links.length - i }));
    const inputs = state.inputs || [];
    const contentSequence = Math.max(state.contentSequence || 0, ...links.map(l => l.order), ...inputs.map(i => i.order || 0),
        ...[...links, ...inputs].map(i => i.response?.sequence || 0));
    return { ...state, formatVersion: 2, contentSequence, links, inputs };
}
function editable(state: GoalLibraryState, goalId: string) {
    if (!goalEditable(state, goalId)) throw new Error('Restore this goal before changing its content');
}
function nextSequence(state: GoalLibraryState) {
    const next = (state.contentSequence || 0) + 1;
    if (!Number.isSafeInteger(next)) throw new Error('Goal content order is exhausted');
    return next;
}
export function addGoalInput(state: GoalLibraryState, draft: GoalInputDraft, now = new Date().toISOString()): GoalLibraryState {
    editable(state, draft.goalId);
    if (!draft.text.trim()) return state;
    if (state.inputs?.some(i => i.id === draft.id)) throw new Error('Duplicate goal text');
    const normalized = normalizeGoalContent(state), order = nextSequence(normalized);
    return { ...normalized, contentSequence: order, inputs: [...normalized.inputs!, { ...draft, order, createdAt: now, updatedAt: now }] };
}
export function changeGoalInput(state: GoalLibraryState, goalId: string, id: string, text: string): GoalLibraryState {
    editable(state, goalId);
    const input = state.inputs?.find(i => i.id === id && i.goalId === goalId);
    if (!input) throw new Error('This goal text no longer exists');
    if (!text.trim() || input.text === text) return state;
    return { ...state, inputs: state.inputs!.map(i => i === input ? { ...i, text, updatedAt: new Date().toISOString() } : i) };
}
export function deleteGoalInput(state: GoalLibraryState, goalId: string, id: string): GoalLibraryState {
    editable(state, goalId);
    return { ...state, inputs: (state.inputs || []).filter(i => i.id !== id || i.goalId !== goalId) };
}
export function addGoalSource(state: GoalLibraryState, link: GoalSourceLink): GoalLibraryState {
    editable(state, link.goalId);
    if (state.links.some(l => l.goalId === link.goalId && l.annotationId === link.annotationId && l.bookId === link.bookId)) return state;
    const normalized = normalizeGoalContent(state), order = nextSequence(normalized);
    // A new association starts without the previous association's Response.
    const { response: _response, ...source } = link;
    return { ...normalized, contentSequence: order, links: [...normalized.links, { ...source, order }] };
}
export type GoalResponseTarget = { kind: 'input'; goalId: string; id: string }
    | { kind: 'annotation'; goalId: string; annotationId: string; bookId: string; generation: string; associationOrder: number };
export const responseTargetKey = (target: GoalResponseTarget) => target.kind === 'input'
    ? JSON.stringify([target.kind, target.goalId, target.id])
    : JSON.stringify([target.kind, target.goalId, target.bookId, target.generation, target.annotationId, target.associationOrder]);
export function responseContent(state: GoalLibraryState, target: GoalResponseTarget) {
    return target.kind === 'input' ? state.inputs?.find(i => i.goalId === target.goalId && i.id === target.id)
        : state.links.find(l => l.goalId === target.goalId && l.annotationId === target.annotationId && l.bookId === target.bookId
            && l.generation === target.generation && l.order === target.associationOrder);
}
export function setGoalResponse(state: GoalLibraryState, target: GoalResponseTarget, marked: boolean, now = new Date().toISOString()): GoalLibraryState {
    editable(state, target.goalId);
    const item = responseContent(state, target);
    if (!item || !!item.response === marked) return state;
    const sequence = marked ? nextSequence(state) : state.contentSequence;
    const { response: _response, ...rest } = item;
    const replacement = marked ? { ...rest, response: { markedAt: now, sequence: sequence! } } : rest;
    return { ...state, contentSequence: sequence,
        ...(target.kind === 'input' ? { inputs: state.inputs!.map(i => i === item ? replacement as typeof i : i) }
            : { links: state.links.map(l => l === item ? replacement as typeof l : l) }) };
}
export function goalContent(state: GoalLibraryState, goalId: string) {
    const normalized = normalizeGoalContent(state);
    return [
        ...normalized.inputs!.filter(i => i.goalId === goalId).map(input => ({ kind: 'input' as const, order: input.order || 0, input })),
        ...normalized.links.filter(l => l.goalId === goalId).map(link => ({ kind: 'annotation' as const, order: link.order || 0, link }))
    ].sort((a, b) => b.order - a.order);
}
