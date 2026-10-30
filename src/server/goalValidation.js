// Validate the complete book-local intent tree, including JSON relationships.
function validateGoalState(state, annotationExists = () => true, fail = message => { throw new Error(message); }) {
    const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;
    if (!state || typeof state !== 'object' || Array.isArray(state) || !identifier(state.bookId)
        || !Array.isArray(state.goals) || !Array.isArray(state.links)) return fail("Invalid goal data.");
    const nodes = new Map();
    for (const goal of state.goals) {
        if (!goal || !identifier(goal.id) || nodes.has(goal.id) || (goal.parentId !== null && !identifier(goal.parentId))
            || typeof goal.text !== 'string' || !goal.text.trim()
            || typeof goal.createdAt !== 'string' || !Number.isFinite(Date.parse(goal.createdAt))
            || typeof goal.updatedAt !== 'string' || !Number.isFinite(Date.parse(goal.updatedAt))) return fail("Invalid or duplicate goal node.");
        if (goal.origin !== null && (!goal.origin || !Number.isSafeInteger(goal.origin.sourcePage) || goal.origin.sourcePage < 1
            || typeof goal.origin.sectionId !== 'string' || typeof goal.origin.chapter !== 'string')) return fail("Invalid goal source.");
        for (const field of ['completedAt', 'archivedAt', 'deletedAt']) {
            if (goal[field] !== undefined && (typeof goal[field] !== 'string' || !Number.isFinite(Date.parse(goal[field])))) return fail("Invalid goal state.");
        }
        nodes.set(goal.id, goal);
    }
    // Each node is visited at most twice, even for a very deep tree.
    const done = new Set();
    for (const goal of state.goals) {
        const path = new Set(); let current = goal;
        while (current && !done.has(current.id)) {
            if (path.has(current.id)) return fail("The goal tree contains a cycle.");
            path.add(current.id);
            if (current.parentId !== null && !nodes.has(current.parentId)) return fail("The goal has no parent.");
            current = nodes.get(current.parentId);
        }
        for (const id of path) done.add(id);
    }
    const pairs = new Set();
    for (const link of state.links) {
        if (!link || !nodes.has(link.goalId) || !identifier(link.annotationId)
            || !annotationExists(link.annotationId, state.bookId)) return fail("The goal link has no annotation in the same book.");
        const key = JSON.stringify([link.goalId, link.annotationId]);
        if (pairs.has(key)) return fail("Duplicate goal link.");
        pairs.add(key);
    }
    return state;
}
module.exports = { validateGoalState };
