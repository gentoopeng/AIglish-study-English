// Presentation polling belongs to its visible screen. Data saves use their own timers.
(function(){
 'use strict';
 const jobs=new Set();
 function tab(){if(typeof currentActiveTabId!=='undefined')return currentActiveTabId;const view=document.querySelector('[id^="view-"].active');return view?view.id.slice(5):'';}
 function update(){const visible=!document.hidden&&!document.body.classList.contains('password-prompt-open')&&!document.body.classList.contains('shop-editing-active'),active=tab();jobs.forEach(job=>{const run=visible&&(!job.tabs.length||job.tabs.includes(active));if(run&&job.timer===null)job.timer=setInterval(job.fn,job.ms);else if(!run&&job.timer!==null){clearInterval(job.timer);job.timer=null;}});}
 window.ViewWork={interval(fn,ms,tabs=[]){const job={fn,ms,tabs,timer:null};jobs.add(job);update();return ()=>{if(job.timer!==null)clearInterval(job.timer);jobs.delete(job);};}};
 window.onTabChange(update);document.addEventListener('visibilitychange',update);
 new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
