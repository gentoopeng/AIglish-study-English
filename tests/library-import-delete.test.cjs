const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('vocab_ui.js','utf8');
const ctx={};ctx.window=ctx;
vm.runInNewContext(source.slice(source.indexOf('    window.migrateVocabData ='),source.indexOf('    window.formatWordForDisplay ='))+source.slice(source.indexOf('    window.parseVocabImport ='),source.indexOf('    window.handleBulkWordImport =')),ctx);
test('detailed import handles numbered meanings, examples and upserts without altering input',()=>{
 const existing=[{num:2,word:'old',meaning:'古い'}];
 const result=ctx.parseVocabImport('1:follow:①従う②続く:example: extra\n2:read:読む:',existing);
 assert.equal(result[0].meanings.length,2);assert.equal(result[0].sub,'example: extra');assert.equal(result[1].word,'read');assert.equal(existing[0].word,'old');
 assert.throws(()=>ctx.parseVocabImport('3:write:書く:\ninvalid',existing));assert.equal(existing.length,1);
});
test('JSON imports replace content and retain per-meaning understanding',()=>{
 const result=ctx.parseVocabImport(JSON.stringify([{num:4,word:'four',meaning:'四',meanings:[{id:'4-0',text:'四',status:'ok',history:['ok']}]}]),[{num:2}]);
 assert.equal(result.length,1);assert.equal(result[0].meanings[0].status,'ok');assert.throws(()=>ctx.parseVocabImport('[{"word":"missing number"}]',[]));
});
const lib=fs.readFileSync('library.js','utf8');
test('permanent deletion cleans chunked cloud saves and local drafts while retaining other books',async()=>{
 const values=new Map();const uid='test-user',book='personal-test';
 const save={savedAt:'2026-01-01',data:{localStorage:{draft_book:'secret',draft_other:'keep'},memory:{vocabBooks:{[book]:{master:['secret']},other:{master:['keep']}},vocabBookKey:book,vocabList:['secret']}}};
 values.set('save_studio_'+uid+'_slot',JSON.stringify(save));values.set('draft_book','secret');
 const cloud=new Map([['users/test-user/saves/slot',{partCount:1,generation:'old'}],['users/test-user/saves/slot/parts/old_p0',{d:JSON.stringify(save)}],['users/test-user/vocabBooks/personal-test/parts/old',{d:'secret'}]]);
 const context={console,crypto:require('node:crypto').webcrypto,textbooksCacheMap:{[book]:[]},userId:()=>uid,key:()=> 'library',cloudAvailable:()=>true,publish:async()=>{},localStorage:{get length(){return values.size},key:n=>[...values.keys()][n],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 context.window=context;context.db={};context.getVocabProgressStorageKey=()=> 'progress';context.__manualVocabLocalKey=()=> 'draft_book';context.__manualVocabCloudId=x=>x;context.__gameSaveChecksum=x=>require('node:crypto').createHash('sha256').update(x).digest('hex');context.fbDoc=(_, ...args)=>args.join('/');context.fbCollection=context.fbDoc;
 context.fbGetDocs=async prefix=>({forEach:cb=>{for(const [path,data] of cloud)if(path.startsWith(prefix+'/')&&!path.slice(prefix.length+1).includes('/'))cb({id:path.split('/').pop(),data:()=>data});}});
 context.fbSetDoc=async(path,data)=>cloud.set(path,data);context.fbDeleteDoc=async path=>cloud.delete(path);
 vm.runInNewContext(lib.slice(lib.indexOf('    function bookStorageKeys'),lib.indexOf('    window.openLibraryBookActions'))+'\nthis.erase=eraseBook;',context);
 await context.erase(book,{visibility:'private'});
 assert.equal(values.has('draft_book'),false);assert.equal(cloud.has('users/test-user/vocabBooks/personal-test/parts/old'),false);assert.equal(cloud.has('users/test-user/saves/slot/parts/old_p0'),false);
 const meta=cloud.get('users/test-user/saves/slot');const restored=JSON.parse(cloud.get('users/test-user/saves/slot/parts/'+meta.generation+'_p0').d);
 assert.equal(restored.data.memory.vocabBooks[book],undefined);assert.equal(restored.data.memory.vocabBooks.other.master[0],'keep');assert.equal(restored.data.localStorage.draft_other,'keep');assert.equal(restored.data.localStorage.draft_book,undefined);
 assert.equal(JSON.parse(values.get('save_studio_'+uid+'_slot')).data.memory.vocabList.length,0);
});
