// Empty loading results are not edits. Explicit removal of the last word is an edit.
(function(){
'use strict';
const permittedEmpty=new Set();
const owner=()=>typeof myId==='string'&&myId?myId:'GUEST-000';
const identity=book=>owner()+'\n'+book;
const valid=draft=>draft&&Array.isArray(draft.master)&&(draft.master.length>0||draft.emptyConfirmed===true);
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}}
function resolve(book,preferred){
 if(window.LibraryState&&window.LibraryState.isDeleted('book',book,owner()))return null;
 if(valid(preferred))return preferred;
 const key='core_v4_vocab_draft_'+owner()+'_'+encodeURIComponent(book);
 const drafts=[window.__manualVocabDrafts&&window.__manualVocabDrafts[book],read(key)].filter(valid);
 drafts.sort((a,b)=>(Date.parse(b.savedAt)||0)-(Date.parse(a.savedAt)||0));
 if(drafts.length)return drafts[0];
 const masters=[read('core_v4_custom_words_'+owner()+'_'+book),typeof textbooksCacheMap!=='undefined'&&textbooksCacheMap[book],read('core_v4_cache_'+book)];
 for(const master of masters)if(Array.isArray(master)&&master.length)return {...(preferred||{}),master,emptyConfirmed:false};
 if(permittedEmpty.has(identity(book)))return {...(preferred||{}),master:[],emptyConfirmed:true};
 // Only parse the larger full-save snapshot when all per-book copies are missing.
 const save=read('save_studio_'+owner()+'_main'),memory=save&&save.data&&save.data.memory;
 const backup=memory&&memory.vocabBooks&&memory.vocabBooks[book];
 if(valid(backup))return backup;
 if(memory&&memory.vocabBookKey===book&&Array.isArray(memory.vocabMaster)&&memory.vocabMaster.length)return {...(preferred||{}),master:memory.vocabMaster,emptyConfirmed:false};
 return null;
}
function canRestoreStorage(key,raw,memory,uid){
 uid=uid||owner();memory=memory||{};
 let book=null,isDraft=false;
 if(key.startsWith('core_v4_cache_'))book=key.slice('core_v4_cache_'.length);
 else if(key.startsWith('core_v4_custom_words_'+uid+'_'))book=key.slice(('core_v4_custom_words_'+uid+'_').length);
 else if(key.startsWith('core_v4_vocab_draft_'+uid+'_')){try{book=decodeURIComponent(key.slice(('core_v4_vocab_draft_'+uid+'_').length));}catch(e){return false;}isDraft=true;}
 if(book===null)return true;
 let value;try{value=JSON.parse(raw);}catch(e){return false;}
 const master=isDraft?value&&value.master:value;
 if(!Array.isArray(master))return false;
 if(master.length)return true;
 if(isDraft)return value.emptyConfirmed===true;
 const draft=memory.vocabBooks&&memory.vocabBooks[book];
 return !!(draft&&draft.emptyConfirmed===true&&Array.isArray(draft.master)&&draft.master.length===0)||(memory.vocabBookKey===book&&memory.vocabEmptyConfirmed===true&&Array.isArray(memory.vocabMaster)&&memory.vocabMaster.length===0);
}
window.VocabMaster={resolve,canRestoreStorage,confirmEmpty:book=>permittedEmpty.add(identity(book)),canCapture(book,words){
 if(!Array.isArray(words))return false;
 if(words.length){permittedEmpty.delete(identity(book));return true;}
 if(permittedEmpty.has(identity(book)))return true;
 const draft=read('core_v4_vocab_draft_'+owner()+'_'+encodeURIComponent(book));
 return !!(draft&&draft.emptyConfirmed===true&&Array.isArray(draft.master)&&draft.master.length===0);
}};
})();
