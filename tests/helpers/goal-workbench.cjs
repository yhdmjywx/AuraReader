const { createWorkbench, ui } = require('./react-workbench.cjs');

async function goalWorkbench(books = [{ id: 'a', title: 'Book A', pages: ['<p>Source</p>'] }], notes = []) {
    const dom = createWorkbench();
    const storage = await require('./sqlite').clientStorage(books);
    const { saveNoteToDB } = await import('../../dist/client/infrastructure/annotationRepository.js');
    for (const note of notes) await saveNoteToDB(note);
    const { GoalController } = await import('../../dist/client/features/goals/goalController.js');
    const { renderSurface } = await import('../../dist/client/components/ui/renderSurface.js');
    const context = { dom, storage, bookId: books[0]?.id || '', mode: 'single', notes, messages: [], jumps: [] };
    const elements = {};
    for (const [key, id] of Object.entries({ goalPanel:'goal-panel', goalSidebar:'goal-sidebar', goalResizer:'goal-resizer', btnGoalSidebar:'btn-goal-sidebar', btnGoalBack:'btn-goal-back', goalPage:'goal-page', goalPageContent:'goal-page-content', readingWorkspace:'reading-workspace', workspaceContainer:'workspace-container' })) elements[key] = document.getElementById(id);
    Object.defineProperty(elements.readingWorkspace, 'clientWidth', { value: 1440 });
    const goals = new GoalController({ getAnnotations: () => context.notes.filter(n => n.bookId === context.bookId),
        getLocation: () => ({ bookId: context.bookId, page: 1, sectionId: 'one', chapter: 'One', totalPages: 1, offset: 0, anchor: '' }),
        getMode: () => context.mode, showToast: message => context.messages.push(message), jump: (id, source) => context.jumps.push(source || id),
        finishAnnotations: async () => {}, annotationsSaved: async () => {}, onActionsChanged: () => context.home?.changed() });
    await ui(async () => { goals.initUI(elements); await goals.initialize(); });
    return Object.assign(context, { goals, elements, async close() {
        await ui(async () => {
            await goals.assertWritesSaved();
            clearTimeout(goals.actionUI?.noticeTimer);
            for (const host of [elements.goalPanel, document.getElementById('goal-home'), ...document.querySelectorAll('[data-react-goal-overlays]')]) renderSurface(host, null);
        });
        await storage.close(); dom.window.close();
    } });
}
module.exports = { goalWorkbench };
