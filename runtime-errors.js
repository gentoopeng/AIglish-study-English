// Install before all application scripts: retain bounded, actionable diagnostics.
(function(){
'use strict';
const records=[],limit=8;let toast=null,timer=null;
function filename(value){if(!value)return '';try{return new URL(value,location.href).pathname.split('/').pop()||'index.html';}catch(error){return '';}}
function show(record){if(!toast)return;toast.textContent='⚠️ '+record.message+(record.file?'（'+record.file+(record.line?':'+record.line:'')+'）':'');toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),6000);}
function record(message,file,line,column,kind){const entry={message:String(message||'不明なエラー').slice(0,500),file:filename(file),line:Number(line)||0,column:Number(column)||0,kind,version:document.querySelector('meta[name=application-version]')?.content||'',at:new Date().toISOString()};records.push(entry);if(records.length>limit)records.shift();console.warn('[アプリのエラー]',entry);show(entry);}
window.AppErrors={snapshot:()=>records.map(entry=>({...entry}))};
window.addEventListener('error',event=>{if(!event.message)return;record(event.message,event.filename,event.lineno,event.colno,'script');});
window.addEventListener('unhandledrejection',event=>{const reason=event.reason,source=reason&&typeof reason.stack==='string'?reason.stack.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/):null;record(reason&&reason.message||reason||'非同期エラー',source?source[1]:'',source?source[2]:0,source?source[3]:0,'promise');});
function mount(){const style=document.createElement('style');style.id='b3ErrCss';style.textContent='.b3-err-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:100000;max-width:90vw;padding:10px 16px;border-radius:10px;background:#b91c1c;color:#fff;font:700 12px system-ui;opacity:0;pointer-events:none;overflow-wrap:anywhere}.b3-err-toast.show{opacity:1}';document.head.append(style);toast=document.createElement('div');toast.id='b3ErrToast';toast.className='b3-err-toast';toast.setAttribute('role','status');document.body.append(toast);if(records.length)show(records[0]);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
