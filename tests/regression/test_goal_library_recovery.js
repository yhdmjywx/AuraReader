const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const {randomUUID}=require('node:crypto');
(async()=>{
 const dom=new JSDOM('',{url:'http://localhost'});global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
 const storage=await require('../helpers/sqlite').clientStorage([{id:'a',title:'A',pages:['<p>A</p>']}]);
 try{
 const {storageRequest,bookVersion,readBooks}=await import('../../dist/client/infrastructure/storageClient.js');
 const {stageGoals,attachGoalCommand,pendingGoals,storeGoalDraft,readGoalDraft}=await import('../../dist/client/infrastructure/goalRecovery.js');
 const {loadGoalLibrary,libraryDrafts,pendingLibrary}=await import('../../dist/client/infrastructure/goalLibraryRepository.js');
 const {GoalController}=await import('../../dist/client/features/goals/goalController.js');
 const generation=(await bookVersion('a')).generation,now=new Date().toISOString();const g={id:'old',parentId:null,text:'Old purpose',origin:null,createdAt:now,updatedAt:now};
 let state={bookId:'a',goals:[g],links:[]};await storageRequest('goals/save',{opId:randomUUID(),expected:0,generation,state});
 state={...state,goals:[{...g,text:'Last pending text'}]};const entry=stageGoals(state,generation,1);const command={opId:entry.version,expected:1,generation,state};attachGoalCommand('a',entry.version,command);
 await storageRequest('goals/save',command);
 // A later unsent snapshot still has the predecessor's revision until its ACK.
 state={...state,goals:[{...g,text:'Latest queued purpose'}]};stageGoals(state,generation,1);
 let loaded=await loadGoalLibrary();assert.equal(loaded.error,undefined);assert.equal(pendingGoals('a').length,0);assert.equal(loaded.state.goals[0].text,'Latest queued purpose');assert.equal(loaded.state.goals.length,1);
 const draft={id:'unfinished',parentId:'old',text:'A recovered question\n中文',origin:{sourcePage:1,sectionId:'one',chapter:'One'}};storeGoalDraft({bookId:'a',generation,draft});loaded=await loadGoalLibrary();assert.equal(loaded.drafts.length,1);assert.ok(readGoalDraft('a'),'legacy draft retained until global ACK');assert.equal(loaded.drafts[0].draft.parentId,loaded.state.goals[0].id);
 const c=new GoalController({getAnnotations:()=>[],getLocation:()=>({bookId:'a',page:1,sectionId:'one',chapter:'One'}),getMode:()=> 'single',showToast:()=>{},jump:()=>{},finishAnnotations:async()=>{},annotationsSaved:async()=>{}});await c.initialize();assert.equal(c.edit.draft.text,draft.text);await c.assertWritesSaved();assert.equal(libraryDrafts().length,0);assert.equal(readGoalDraft('a'),null);assert.equal(pendingLibrary().length,0);
 let record=await storageRequest('goals/library',undefined);await storageRequest('goals/library/save',{opId:randomUUID(),expected:record.revision,state:{...record.value,goals:record.value.goals.map((g,i)=>i?g:{...g,text:'New global intent'})}});
 const stale=stageGoals(state,generation,3);loaded=await loadGoalLibrary();assert.ok(loaded.error);assert.equal(pendingGoals('a')[0].version,stale.version);assert.ok(loaded.state.goals.some(g=>g.text==='New global intent'),'conflict preserves current library as well as old pending command');
 localStorage.removeItem('aura_goals_pending_a');storeGoalDraft({bookId:'a',generation,draft:{...draft,id:'other'}});const books=await readBooks();await storageRequest('books/delete',{opId:randomUUID(),expected:books.find(b=>b.id==='a').revision,id:'a'});await storageRequest('books/save',{opId:randomUUID(),expected:books.find(b=>b.id==='a').revision+1,book:{id:'a',title:'Recreated',pages:['<p>new</p>']}});
 loaded=await loadGoalLibrary();assert.ok(loaded.error);assert.ok(readGoalDraft('a'));assert.equal(libraryDrafts().length,0,'old generation is not silently attached to a new book');
 console.log('Goal recovery: actual HTTP exact replay, legacy draft ID/parent conversion, ACK-only cleanup, global conflict preservation and deleted/recreated source generation guard passed.');
 }finally{await storage.close();dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
