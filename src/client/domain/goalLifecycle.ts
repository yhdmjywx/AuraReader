import type { Goal, GoalLibraryState } from './goal.js';

export type GoalArea = 'library' | 'archive' | 'trash';
export type GoalFilter = 'all' | 'ongoing' | 'completed';
export type GoalOperation = 'complete' | 'reopen' | 'archive' | 'unarchive' | 'delete' | 'restore' | 'restore-root' | 'purge';

export function goalAncestors(state: { goals: Goal[] }, id: string): Goal[] {
    const nodes = new Map(state.goals.map(g => [g.id, g])), path: Goal[] = [], seen = new Set<string>();
    let goal = nodes.get(id);
    while (goal && !seen.has(goal.id)) { seen.add(goal.id); path.push(goal); goal = goal.parentId ? nodes.get(goal.parentId) : undefined; }
    return path;
}
export function goalArea(state: { goals: Goal[] }, id: string): GoalArea {
    return goalAreas(state).get(id) || 'library';
}
export function goalAreas(state: { goals: Goal[] }): Map<string, GoalArea> {
    const nodes = new Map(state.goals.map(g => [g.id, g])), areas = new Map<string, GoalArea>();
    for (const goal of state.goals) {
        const path: Goal[] = [], seen = new Set<string>(); let current: Goal | undefined = goal;
        while (current && !areas.has(current.id) && !seen.has(current.id)) { path.push(current); seen.add(current.id); current = current.parentId ? nodes.get(current.parentId) : undefined; }
        let area: GoalArea = current ? areas.get(current.id) || 'library' : 'library';
        for (const g of path.reverse()) { area = area === 'trash' || g.deletedAt ? 'trash' : area === 'archive' || g.archivedAt ? 'archive' : 'library'; areas.set(g.id, area); }
    }
    return areas;
}
export function goalBranch(state: { goals: Goal[] }, id: string): Set<string> {
    const children = new Map<string, string[]>();
    for (const g of state.goals) if (g.parentId) { const list = children.get(g.parentId) || []; list.push(g.id); children.set(g.parentId, list); }
    const ids = new Set<string>(), pending = [id];
    while (pending.length) { const next = pending.pop()!; if (ids.has(next)) continue; ids.add(next); pending.push(...(children.get(next) || [])); }
    return ids;
}
export function goalPath(state: { goals: Goal[] }, id: string): string {
    return goalAncestors(state, id).reverse().map(g => g.text).join(' / ');
}
export function areaGoals(state: { goals: Goal[] }, area: GoalArea, parentId: string | null, query = '', filter: GoalFilter = 'all'): Goal[] {
    const search = query.trim().toLocaleLowerCase(), areas = goalAreas(state);
    return state.goals.filter(g => {
        if (areas.get(g.id) !== area) return false;
        if (area === 'library' && !search && g.parentId !== parentId) return false;
        if (area !== 'library' && !search && (parentId ? g.parentId !== parentId : g.parentId && areas.get(g.parentId) === area)) return false;
        return (!search || goalPath(state, g.id).toLocaleLowerCase().includes(search))
            && (filter === 'all' || !!g.completedAt === (filter === 'completed'));
    });
}
export function goalEditable(state: { goals: Goal[] }, id: string | null): boolean {
    return !!id && state.goals.some(g => g.id === id) && goalArea(state, id) === 'library';
}
export function operateGoal(state: GoalLibraryState, id: string, operation: GoalOperation, now = new Date().toISOString()): GoalLibraryState {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) throw new Error('This goal is no longer available');
    const areas = goalAreas(state), area = areas.get(id), branch = goalBranch(state, id);
    if (operation === 'purge') {
        if (area !== 'trash') throw new Error('Move this goal to Recently deleted first');
        return { ...state, goals: state.goals.filter(g => !branch.has(g.id)), links: state.links.filter(l => !branch.has(l.goalId)),
            bookLinks: (state.bookLinks || []).filter(l => !branch.has(l.goalId)) };
    }
    if (['complete', 'reopen', 'archive'].includes(operation) && area !== 'library') throw new Error('Restore this goal before changing it');
    if (operation === 'unarchive' && area !== 'archive') throw new Error('This goal is not archived');
    if (['restore', 'restore-root'].includes(operation) && area !== 'trash') throw new Error('This goal is not deleted');
    const path = new Set(goalAncestors(state, id).map(g => g.id));
    const goals = state.goals.map(g => {
        const next = { ...g };
        if (operation === 'complete' && branch.has(g.id) && areas.get(g.id) !== 'trash' && !g.completedAt) next.completedAt = now;
        if (g.id === id) {
            if (operation === 'reopen') delete next.completedAt;
            if (operation === 'archive') next.archivedAt = now;
            if (operation === 'delete') { if (area === 'trash') throw new Error('This goal is already deleted'); next.deletedAt = now; }
            if (operation === 'restore-root') { next.parentId = null; delete next.deletedAt; }
        }
        // Clear only this node and required ancestors; independent descendant markers survive.
        if (operation === 'unarchive' && path.has(g.id)) delete next.archivedAt;
        if (operation === 'restore' && path.has(g.id)) delete next.deletedAt;
        if (JSON.stringify(next) === JSON.stringify(g)) return g;
        next.updatedAt = now; return next;
    });
    return goals.every((g, i) => g === state.goals[i]) ? state : { ...state, goals };
}
