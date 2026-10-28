const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
(async () => {
    const dom = new JSDOM(fs.readFileSync('src/client/index.html','utf8'),{url:'http://localhost'});
    global.window=dom.window; global.document=dom.window.document; global.localStorage=dom.window.localStorage; global.HTMLElement=dom.window.HTMLElement;
    const storage = await require('../helpers/sqlite').clientStorage([{id:'lifecycle-book',title:'Original book',pages:['<p>Source</p>']}]);
    let goals;
    try {
        const { GoalController } = await import('../../dist/client/features/goals/goalController.js');
        const { GoalHome } = await import('../../dist/client/features/goals/goalHome.js');
        const { AppShell } = await import('../../dist/client/app/appShell.js');
        const { storageRequest, bookVersion, readGoalLibrary } = await import('../../dist/client/infrastructure/storageClient.js');
        const { saveNoteToDB } = await import('../../dist/client/infrastructure/annotationRepository.js');
        const { goalGraphsForBooks, pendingLibrary, stageBookIntent, pendingBookIntents } = await import('../../dist/client/infrastructure/goalLibraryRepository.js');
        const { goalArea } = await import('../../dist/client/domain/goalLifecycle.js');
        const notes=[{id:'lifecycle-note',bookId:'lifecycle-book',kind:'note',quote:'Source',comment:'My original note',page:1},
            {id:'lifecycle-highlight',bookId:'lifecycle-book',kind:'highlight',quote:'Source',comment:'',page:1}];
        for(const note of notes) await saveNoteToDB(note);
        const d=document, elements={};
        for(const [key,id] of Object.entries({goalPanel:'goal-panel',goalSidebar:'goal-sidebar',goalResizer:'goal-resizer',btnGoalSidebar:'btn-goal-sidebar',goalPage:'goal-page',goalPageContent:'goal-page-content',readingWorkspace:'reading-workspace',workspaceContainer:'workspace-container'})) elements[key]=d.getElementById(id);
        Object.defineProperty(elements.readingWorkspace,'clientWidth',{value:1440});
        let home, jumps=0, pageTurns=0;
        goals=new GoalController({getAnnotations:()=>notes,getLocation:()=>({bookId:'lifecycle-book',page:1,sectionId:'',chapter:''}),getMode:()=> 'single',showToast:()=>{},jump:()=>{jumps++;},finishAnnotations:async()=>{},annotationsSaved:async()=>{},onActionsChanged:()=>home?.changed()});
        goals.initUI(elements); await goals.initialize();
        const root=await goals.createRoot('Root intention'), child=await goals.createGoal('Child intention',root), grand=await goals.createGoal('Nested intention',child), independent=await goals.createGoal('Already archived',root), other=await goals.createRoot('Other intention');
        await goals.addBook(root,'lifecycle-book'); await goals.addBook(other,'lifecycle-book');
        goals.selectGoal(child); await goals.linkAnnotation(notes[0].id); await goals.linkAnnotation(notes[1].id);
        const beforeBooks=storage.read('books'), beforeNotes=storage.read('annotations');
        const originalRelations=structuredClone(goals.state.links);
        const makeHome=()=>new GoalHome(d.getElementById('goal-home'),{goals,coordinator:{openBook:async()=>{}},finishAnnotations:async()=>{},currentBookId:()=> 'lifecycle-book',beforeOpen(){}});
        home=makeHome(); await home.open();
        const settle=async()=>{const until=Date.now()+5000;while(goals.lifecycleBusy){if(Date.now()>until)throw Error('Lifecycle timeout');await new Promise(r=>setTimeout(r,5));}};
        const click=selector=>{const e=d.querySelector(selector);assert.ok(e,selector);e.click();};
        const menu=id=>{home.showArea(goalArea(goals.state,id));home.navigate(id);click('#home-goal-title + .home-current-actions button');};
        menu(root);click('[data-operation="complete"]');await settle();
        assert.equal(d.getElementById('home-status').textContent,'','a successful lifecycle operation must not leave an unavailable error');
        assert.ok(goals.state.goals.filter(g=>g.id!==other).every(g=>g.completedAt));
        assert.ok(d.querySelector('[data-goal-undo]'));
        click('[data-goal-undo]');await settle();assert.equal(goals.state.goals.some(g=>g.completedAt),false);
        await goals.operate(child,'complete'); assert.equal(goals.state.goals.find(g=>g.id===root).completedAt,undefined);
        await goals.operate(independent,'archive');await goals.operate(root,'complete');await goals.operate(child,'reopen');
        assert.ok(goals.state.goals.find(g=>g.id===root).completedAt);assert.ok(goals.state.goals.find(g=>g.id===grand).completedAt);
        goals.selectGoal(child);await goals.operate(root,'archive');assert.equal(goals.selected,null);assert.equal(localStorage.getItem('aura_selected_goal'),null);
        home.showArea('archive');assert.equal(d.querySelectorAll('#home-goal-folders [data-goal-id]').length,1);
        const search=d.getElementById('home-goal-search');search.value='Nested';search.dispatchEvent(new window.Event('input'));
        assert.equal(d.querySelector('#home-goal-folders [data-goal-id]').dataset.goalId,grand);assert.match(d.querySelector('.goal-original-path').textContent,/Root intention.*Child intention.*Nested intention/);
        home.navigate(child);assert.equal(d.querySelectorAll('#home-material-list .goal-item').length,2);assert.equal(d.getElementById('home-add-book').hidden,true);
        click('#home-material-list button');await Promise.resolve();assert.equal(jumps,1);assert.equal(goalArea(goals.state,child),'archive');
        await assert.rejects(goals.addBook(root,'lifecycle-book'),/Restore/);
        await goals.operate(root,'unarchive');assert.equal(goalArea(goals.state,independent),'archive');assert.equal(goals.selected,null);
        menu(root);click('[data-operation="delete"]');assert.match(d.querySelector('.goal-confirm').textContent,/3 subgoals.*Original books, highlights and notes will be kept/);
        click('.goal-confirm button');assert.equal(d.querySelector('.goal-confirm'),null);assert.equal(goalArea(goals.state,root),'library');
        menu(root);click('[data-operation="delete"]');click('.goal-confirm .goal-danger');await settle();
        assert.equal(goalArea(goals.state,grand),'trash');assert.deepEqual(goals.state.links,originalRelations);
        home.showArea('trash');menu(child);assert.ok(d.querySelector('[data-operation="restore-root"]'));click('[data-operation="restore-root"]');await settle();
        assert.equal(goals.state.goals.find(g=>g.id===child).parentId,null);assert.equal(goalArea(goals.state,root),'trash');assert.equal(goalArea(goals.state,child),'library');
        menu(root);click('[data-operation="restore"]');await settle();assert.equal(goalArea(goals.state,independent),'archive');
        // Status and relationships survive a real service/database restart and enter the per-book graph.
        await goals.operate(child,'delete');
        let graph=(await goalGraphsForBooks(['lifecycle-book'])).get('lifecycle-book');
        assert.ok(graph.goals.find(g=>g.id===child).deletedAt);assert.ok(graph.goals.find(g=>g.id===root).completedAt);
        const persisted=structuredClone(goals.state); await storage.restart();storage.configureClient();
        goals.ready=null;await goals.initialize();assert.deepEqual(goals.state,persisted);
        await goals.operate(child,'purge');assert.equal(goals.state.goals.some(g=>g.id===grand),false);
        assert.equal(goals.state.links.some(l=>l.goalId===child),false);
        assert.ok(goals.state.bookLinks.some(l=>l.goalId===other));
        assert.deepEqual(storage.read('books'),beforeBooks);assert.deepEqual(storage.read('annotations'),beforeNotes,'purging goals must not touch source records');
        // A failed lifecycle write remains in recovery, and exact replay commits it once.
        const actualFetch=global.fetch;let fail=true;
        storage.configureClient(async(url,options)=>{
            if(fail && url.endsWith('goals/library/save')) return {ok:false,status:503,json:async()=>({error:'Injected write failure'})};
            return actualFetch(url,options);
        });
        await readGoalLibrary();
        await assert.rejects(goals.operate(other,'archive'),/Injected/);assert.ok(pendingLibrary().length);
        fail=false;await goals.assertWritesSaved();assert.equal(pendingLibrary().length,0);
        assert.ok((await storageRequest('goals/library')).value.goals.find(g=>g.id===other).archivedAt);
        // A pending book association must not become stranded behind a newly archived branch.
        await goals.operate(other,'unarchive');const version=await bookVersion('lifecycle-book');
        stageBookIntent({goalId:other,bookId:'lifecycle-book',generation:version.generation});
        await goals.operate(other,'archive');assert.equal(pendingBookIntents().length,0);
        const pendingGoal=await goals.createRoot('Pending book intention');
        stageBookIntent({goalId:pendingGoal,bookId:'lifecycle-book',generation:version.generation});
        await assert.rejects(goals.operate(pendingGoal,'archive'),/pending book/i);
        assert.equal(goalArea(goals.state,pendingGoal),'library');assert.equal(pendingBookIntents().length,1);
        await goals.recoverBookIntents();await goals.operate(pendingGoal,'archive');assert.equal(pendingBookIntents().length,0);
        // Native menus and confirmation dialogs must isolate reading keyboard shortcuts.
        const shell=new AppShell();shell.init({}, {onNextPage:()=>pageTurns++,onPrevPage:()=>pageTurns++});
        await goals.operate(other,'unarchive');menu(other);
        d.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
        assert.equal(pageTurns,0,'menu arrows must not turn the book page');
        click('[data-operation="delete"]');d.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
        assert.equal(pageTurns,0,'dialog arrows must not turn the book page');click('.goal-confirm button');
        console.log('Goal lifecycle: real HTTP/SQLite, menu/undo, downward completion, archive/search/read-only materials, trash restore/purge, source preservation, restart/backup, failed-write replay, pending associations and keyboard isolation passed.');
    } finally {if(goals?.timer)clearTimeout(goals.timer);await storage.close();dom.window.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
