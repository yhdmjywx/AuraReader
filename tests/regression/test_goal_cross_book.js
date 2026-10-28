const assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM(fs.readFileSync('src/client/index.html','utf8'),{url:'http://localhost'});global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;global.HTMLElement=dom.window.HTMLElement;
 global.FileReader=class{readAsText(file){file.text().then(text=>this.onload({target:{result:text}}),e=>this.onerror(e));}};
 const books=['a','b'].map(id=>({id,title:'Book '+id,pages:['<p>Source '+id+'</p>']}));const storage=await require('../helpers/sqlite').clientStorage(books);
 try{
 const {saveNoteToDB}=await import('../../dist/client/infrastructure/annotationRepository.js');
 const {storageRequest}=await import('../../dist/client/infrastructure/storageClient.js');
 const {GoalController}=await import('../../dist/client/features/goals/goalController.js');
 const {goalGraphsForBooks}=await import('../../dist/client/infrastructure/goalLibraryRepository.js');
 const {exportSelectiveBackup}=await import('../../dist/client/infrastructure/exporters.js');
 const {BackupController}=await import('../../dist/client/features/backup/backupController.js');
 const notes=books.map(b=>({id:'n-'+b.id,bookId:b.id,kind:'note',quote:'Source '+b.id,comment:'My thought from '+b.id,page:1}));for(const n of notes)await saveNoteToDB(n);
 const d=document;const elements={goalPanel:d.getElementById('goal-panel'),goalSidebar:d.getElementById('goal-sidebar'),goalResizer:d.getElementById('goal-resizer'),btnGoals:d.getElementById('btn-goals'),btnGoalSidebar:d.getElementById('btn-goal-sidebar'),btnGoalBack:d.getElementById('btn-goal-back'),goalPage:d.getElementById('goal-page'),goalPageContent:d.getElementById('goal-page-content'),readingWorkspace:d.getElementById('reading-workspace'),workspaceContainer:d.getElementById('workspace-container')};
 let width=1613,book='a',mode='single',chooseBook=false;Object.defineProperty(elements.readingWorkspace,'clientWidth',{get:()=>width});const failures=[];
 const goals=new GoalController({getAnnotations:()=>notes.filter(n=>n.bookId===book),getLocation:()=>({bookId:book,page:1,sectionId:'one',chapter:'One',offset:0,totalPages:1,anchor:''}),getMode:()=>mode,showToast:t=>failures.push(t),jump:()=>{},finishAnnotations:async()=>{},annotationsSaved:async()=>{},chooseBook:()=>chooseBook=true});
 goals.initUI(elements);await goals.initialize();
 const input=text=>{goals.ui.editor.value=text;goals.ui.editor.dispatchEvent(new window.Event('input',{bubbles:true}));};
 goals.beginEdit('root');input('My continuing question');const root=goals.edit.draft.id;await goals.finishInlineEdit();goals.selectGoal(root);
 goals.beginEdit('child');input('A question from A');const childA=goals.edit.draft.id;await goals.finishInlineEdit();goals.selectGoal(childA);await goals.linkAnnotation('n-a');
 goals.itemsOpen=false;book='b';await goals.bookChanged();assert.equal(goals.selected,childA);assert.equal(goals.itemsOpen,false,'book switches preserve display state');
 await goals.linkAnnotation('n-b');assert.equal(d.querySelectorAll('.goal-item').length,2);assert.match(d.querySelector('.goal-items').textContent,/thought from a/);assert.match(d.querySelector('.goal-items').textContent,/Book a/);assert.equal(goals.callbacks.getAnnotations().length,1,'reader annotations remain book-local');
 goals.selectGoal(root);goals.beginEdit('child');input('A question from B');await goals.finishInlineEdit();goals.selectGoal(root);assert.equal(d.querySelectorAll('.goal-child').length,2,'folder contents stay stable across source books');
 const textarea=goals.ui.editor;await goals.openPage();assert.equal(elements.goalSidebar.hidden,true);assert.equal(elements.readingWorkspace.hidden,true);assert.equal(d.querySelectorAll('#goal-panel').length,1);assert.equal(elements.goalSidebar.contains(elements.goalPanel),false);assert.equal(elements.goalPageContent.contains(elements.goalPanel),true);assert.equal(d.querySelectorAll('.goal-child').length,2);assert.equal(goals.ui.editor,textarea);
 width=800;mode='double';goals.updateReadingContext();assert.equal(elements.goalPanel.hidden,false,'independent Goal page is available in narrow windows and any reading preference');
 goals.selectGoal(childA);assert.equal(d.querySelectorAll('.goal-item').length,2);await goals.returnToReader();assert.equal(elements.goalPage.hidden,true);assert.equal(goals.selected,childA);assert.equal(elements.goalPanel.hidden,true);width=1613;mode='single';goals.updateReadingContext();assert.equal(elements.goalSidebar.hidden,false);assert.equal(localStorage.getItem('aura_goal_sidebar_closed'),null);
 await goals.openPage();book='';goals.beginEdit('root');input('A purpose without a book');const independent=goals.edit.draft.id;await goals.finishInlineEdit();goals.selectGoal(independent);assert.equal(goals.state.goals.find(g=>g.id===independent).origin,null);await goals.returnToReader();assert.equal(chooseBook,true);
 const files=[];window.auraDesktop={files:{saveExport:async f=>{files.push(JSON.parse(Buffer.from(f.bytes).toString()));return{ok:true,value:{status:'saved'}};}}};
 const graphs=await goalGraphsForBooks(['a','b']);await exportSelectiveBackup({selectedBooks:books,notes,goalGraphs:graphs});assert.equal(files.length,2);for(let i=0;i<2;i++){assert.equal(files[i].version,'1.3');assert.equal(files[i].goalGraph.goals.some(g=>g.id===independent),false);assert.ok(files[i].goalGraph.links.every(l=>l.bookId===books[i].id));assert.equal(files[i].notes.length,1);}
 const backup=new BackupController({callbacks:{showToast:t=>{if(t.includes('失败'))throw new Error(t);}}});
 files[0].goalGraph.goals.find(g=>g.id===root).text='Restored reading purpose';
 await backup.importFullBackup(new Blob([JSON.stringify(files[0])]));assert.equal(goals.state.goals.find(g=>g.id===root).text,'Restored reading purpose','restore updates the live controller before another Goal can be saved');assert.equal(goals.selected,independent);
 await backup.importFullBackup(new Blob([JSON.stringify(files[1])]));let record=await storageRequest('goals/library',undefined);assert.equal(record.value.links.filter(l=>l.goalId===childA).length,2,'per-book restore never erases the other book links');assert.equal(record.value.goals.filter(g=>g.id===root).length,1);
 files.length=0;await exportSelectiveBackup({selectedBooks:[books[0]],notes:[],goalGraphs:graphs,includeNotes:false});assert.equal(Object.hasOwn(files[0].goalGraph,'links'),false);await backup.importFullBackup(new Blob([JSON.stringify(files[0])]));record=await storageRequest('goals/library',undefined);assert.equal(record.value.links.filter(l=>l.goalId===childA).length,2);assert.equal(failures.length,0);
 const now=new Date().toISOString();await backup.importFullBackup(new Blob([JSON.stringify({version:'1.1',type:'aurareader_full_backup',books:[books[0]],notes:[],goalStates:[{bookId:'a',goals:[{id:'legacy-import',parentId:null,text:'Legacy imported purpose',origin:null,createdAt:now,updatedAt:now}]}]})]));assert.ok(goals.state.goals.some(g=>g.text==='Legacy imported purpose'),'1.1 imports also refresh the global live state');assert.equal(goals.selected,independent);assert.equal(failures.length,0);
 console.log('Cross-book Goal: actual HTTP, stable selection and material counts, source-aware chapters, one UI/editor, independent narrow/empty-book page, 1.2 partial backups and omitted-link preservation passed.');
 }finally{await storage.close();dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
