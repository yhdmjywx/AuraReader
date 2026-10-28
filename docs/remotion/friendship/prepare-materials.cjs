const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {JSDOM} = require('jsdom');
const JSZip = require('jszip');
const root = __dirname, project = path.resolve(root, '../../..');
const stamp = '2026-10-27T08:00:00.000Z';
const goalId = 'remotion-friendship-goal';
const initial = 'I want to make a new friend.';
const evolved = 'Find a friend I can talk about books with.';
const clean = text => text.replace(/\s+/g, ' ').trim();
const definitions = [
  {key:'anne',pg:'45',file:'Anne of Green Gables.epub',title:'Anne of Green Gables',author:'L. M. Montgomery',chapter:'VIII · Anne’s Bringing-up Is Begun',
    quote:'do you think that I shall ever have a bosom friend in Avonlea?',note:'I want someone I can really talk to.',noteZh:'我想有个能真正谈心的人。'},
  {key:'conversation',pg:'63995',file:'The Art of Conversation - Twelve Golden Rules.epub',title:'The Art of Conversation: Twelve Golden Rules',author:'Josephine Turck Baker',chapter:'Golden Rule Number VII',
    quote:'Choose subject of mutual interest.',note:'I could ask her what she’s reading.',noteZh:'我可以问问她在读什么。'},
];
function write(relative,data){const f=path.join(root,relative);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n');}
(async()=>{
 const dom=new JSDOM('');global.DOMParser=dom.window.DOMParser;global.document=dom.window.document;
 const load=file=>import(pathToFileURL(path.join(project,'dist/client',file)).href);
 const {parseEpub}=await load('infrastructure/epubParser.js');
 const {findQuoteRange,resolveAnnotationRange}=await load('domain/annotationRangeEngine.js');
 const books=[],annotations=[],materials=[],sources=[];
 for(const def of definitions){
  const bytes=fs.readFileSync(path.join(root,'sources',def.file));
  const book=await parseEpub(bytes,def.file,JSZip);book.id='remotion-friendship-'+def.key;book.title=def.title;book.author=def.author;book.updatedAt=stamp;
  const matches=[];
  book.pages.forEach((html,index)=>{const d=new JSDOM(html);const text=d.window.document.body.textContent;const range=findQuoteRange(text,def.quote);if(range)matches.push({page:index+1,range,text,body:d.window.document.body});else d.window.close();});
  assert.equal(matches.length,1,'Exactly one source match: '+def.key);
  const match=matches[0],raw=match.text.slice(match.range.start,match.range.end);
  assert.equal(clean(raw),def.quote);
  const p=[...match.body.querySelectorAll('p')].find(node=>clean(node.textContent).includes(def.quote));assert.ok(p);
  const paragraph=clean(p.textContent),at=paragraph.indexOf(def.quote);
  const own=['highlight','note'].map(kind=>({id:'remotion-friendship-'+def.key+'-'+kind,bookId:book.id,kind,quote:raw,comment:kind==='note'?def.note:'',color:kind==='note'?'green':'yellow',page:match.page,chapter:def.chapter,timestamp:stamp,location:{sectionId:'chapter-'+match.page,page:match.page,offset:match.range.start,...match.range}}));
  own.forEach(record=>assert.deepEqual(resolveAnnotationRange(match.text,record),match.range));
  let current=p,chapterAnchor='';while(current){if(current.id)chapterAnchor=current.id;if(/^(H1|H2|H3)$/.test(current.tagName)&&chapterAnchor)break;current=current.previousElementSibling;}
  materials.push({...def,bookId:book.id,sourcePage:match.page,location:own[1].location,chapterAnchor,
    before:paragraph.slice(0,at),after:paragraph.slice(at+def.quote.length),
    nextParagraph:clean(p.nextElementSibling?.textContent||''),
    sourceUrl:'https://www.gutenberg.org/cache/epub/'+def.pg+'/pg'+def.pg+'-images.html'});
  sources.push({title:def.title,author:def.author,catalog:'https://www.gutenberg.org/ebooks/'+def.pg,epub:'https://www.gutenberg.org/ebooks/'+def.pg+'.epub3.images',copyright:'Public domain in the USA.',license:'https://www.gutenberg.org/policy/license.html',sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  annotations.push(...own);books.push(book);match.body.ownerDocument.defaultView.close();
 }
 const makeGoal=text=>({id:goalId,parentId:null,text,origin:null,createdAt:stamp,updatedAt:stamp});
 function backup(book,phase){const included=phase==='clean'?[]:annotations.filter(a=>a.bookId===book.id);const hasGoal=phase!=='clean';return {version:'1.3',type:'aurareader_full_backup',exportedAt:stamp,books:[book],notes:included,goalGraph:{goals:hasGoal?[makeGoal(phase==='final'?evolved:initial)]:[],links:included.filter(a=>a.kind==='note').map(a=>({goalId,bookId:book.id,annotationId:a.id})),bookLinks:hasGoal?[{goalId,bookId:book.id}]:[]}};}
 for(let i=0;i<books.length;i++){write('imports/00-clean/'+definitions[i].key+'.aurabackup',backup(books[i],'clean'));write('imports/02-final/'+definitions[i].key+'.aurabackup',backup(books[i],'final'));}
 write('imports/01-after-anne/anne.aurabackup',backup(books[0],'after-a'));
 const demo={goalId,initialGoal:initial,evolvedGoal:evolved,durationSeconds:39,materials,sources,
  noteProvenance:'Fictional reader notes written for this demonstration. The books do not contain these notes or promise a friendship outcome.'};
 write('demo-content.json',demo);write('annotations.json',annotations);write('books.json',books);write('source-manifest.json',sources);
 const {createDataStore}=require(path.join(project,'src/server/dataStore.js'));
 const dir=path.join(root,'.validation');fs.mkdirSync(dir,{recursive:true});assert.equal(fs.readdirSync(dir).length,0);let store;
 try{store=createDataStore(dir);for(const book of books){const data=backup(book,'final');store.restore({opId:crypto.randomUUID(),books:data.books,notes:data.notes,goalGraph:data.goalGraph});}const state=store.goalLibrary().value;assert.equal(state.goals.length,1);assert.equal(state.links.length,2);assert.equal(state.goals[0].text,evolved);assert.deepEqual(store.check(),{integrity:'ok',foreignKeys:0});}
 finally{store?.close();for(const name of ['aurareader.sqlite','aurareader.sqlite-wal','aurareader.sqlite-shm']){const f=path.join(dir,name);if(fs.existsSync(f))fs.unlinkSync(f);}if(!fs.readdirSync(dir).length)fs.rmdirSync(dir);}
 write('validation.json',{status:'passed',books:2,verifiedQuotations:2,annotations:4,linkedNotes:2,goalCount:1,checks:['Official complete EPUBs parsed with AuraReader importer','Exact source ranges resolve for both highlight and note','Two per-book backups restore to one Goal with two cross-book notes','Actual SQLite integrity check passes']});
 dom.window.close();console.log(JSON.stringify({status:'passed',materials:materials.map(m=>({book:m.title,page:m.sourcePage,quote:m.quote,before:m.before,after:m.after,next:m.nextParagraph.slice(0,400)}))}));
})().catch(error=>{console.error(error);process.exitCode=1;});
