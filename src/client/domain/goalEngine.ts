import type { BookGoalState, Goal, GoalDraft, GoalOrigin } from './goal.js';
import { goalEditable } from './goalLifecycle.js';

export const emptyGoals = (bookId: string): BookGoalState => ({ bookId, goals: [], links: [] });
export const copyGoals = (state: BookGoalState): BookGoalState => structuredClone(state);
export function createGoal(draft: GoalDraft): Goal {
    if (!draft.text.trim()) throw new Error('Goal cannot be empty');
    const now = new Date().toISOString();
    return { ...draft, createdAt: now, updatedAt: now };
}
export function goalChildren(state: { goals: Goal[] }, parentId: string | null, sourcePage?: number, bookId?: string): Goal[] {
    return state.goals.filter(goal => goal.parentId === parentId &&
        (sourcePage === undefined || !goal.origin || (goal.origin.sourcePage === sourcePage && (!bookId || goal.origin.bookId === bookId))));
}
export function changeGoal<S extends { goals: Goal[] }>(state: S, id: string, text: string): S {
    if (!text.trim()) return state;
    const next = structuredClone(state), goal = next.goals.find(item => item.id === id);
    if (!goal) throw new Error('Goal no longer exists');
    if (!goalEditable(state, id)) throw new Error('Restore this goal before editing it');
    if (goal.text === text) return state;
    goal.text = text; goal.updatedAt = new Date().toISOString(); return next;
}
export function addGoal<S extends { goals: Goal[] }>(state: S, draft: GoalDraft): S {
    if (state.goals.some(goal => goal.id === draft.id)) throw new Error('Duplicate Goal');
    if (draft.parentId && !state.goals.some(goal => goal.id === draft.parentId)) throw new Error('Parent Goal no longer exists');
    if (draft.parentId && !goalEditable(state, draft.parentId)) throw new Error('Restore the parent goal before adding a child');
    return { ...state, goals: [...state.goals, createGoal(draft)] };
}
export function linkGoal(state: BookGoalState, goalId: string, annotationId: string): BookGoalState {
    if (!state.goals.some(goal => goal.id === goalId)) throw new Error('Goal no longer exists');
    if (state.links.some(link => link.goalId === goalId && link.annotationId === annotationId)) return state;
    return { ...state, links: [...state.links, { goalId, annotationId }] };
}
export function unlinkGoal(state: BookGoalState, goalId: string, annotationId: string): BookGoalState {
    return { ...state, links: state.links.filter(link => link.goalId !== goalId || link.annotationId !== annotationId) };
}
export function goalOrigin(page: number, sectionId = '', chapter = ''): GoalOrigin {
    return { sourcePage: page, sectionId, chapter };
}
