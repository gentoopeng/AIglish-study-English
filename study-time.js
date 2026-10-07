// One elapsed-time ledger for the home display, calendar and study rankings.
(function () {
    'use strict';
    const DAY = 86400000;
    const dateKey = time => {const d = new Date(time); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');};
    const dateAt = key => new Date(key + 'T00:00:00').getTime();
    const normalizeDate = value => {const p=String(value||'').split('-').map(Number); if(p.length!==3||!p.every(Number.isFinite))return '';const d=new Date(p[0],p[1]-1,p[2]);return d.getFullYear()===p[0]&&d.getMonth()+1===p[1]&&d.getDate()===p[2]?dateKey(d):'';};
    const positive = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    function dayMilliseconds(day) {
        if (!day) return 0;
        const edit=day.edit, sources=day.sources||{};
        return Math.min(DAY,(edit?positive(edit.ms):0)+Object.keys(sources).reduce((total,id)=>total+Math.max(0,positive(sources[id])-positive(edit&&edit.baseline&&edit.baseline[id])),0));
    }
    function merge(left,right) {
        const result=JSON.parse(JSON.stringify(left||{version:1,days:{},offset:0}));
        if(!right||right.version!==1||typeof right.days!=='object'||!right.days)return result;
        result.offset=Math.max(positive(result.offset),positive(right.offset));
        Object.entries(right.days).forEach(([key,day])=>{
            if(normalizeDate(key)!==key||!day||typeof day!=='object')return;
            const target=result.days[key]||(result.days[key]={sources:{}});target.sources=target.sources||{};
            Object.entries(day.sources||{}).forEach(([source,value])=>{target.sources[source]=Math.min(DAY,Math.max(positive(target.sources[source]),positive(value)));});
            if(day.edit&&(!target.edit||positive(day.edit.at)>positive(target.edit.at)))target.edit={at:positive(day.edit.at),ms:Math.min(DAY,positive(day.edit.ms)),baseline:Object.assign({},day.edit.baseline||{})};
        });
        result.updatedAt=Math.max(positive(result.updatedAt),positive(right.updatedAt));return result;
    }
    function accrue(data,source,start,end) {
        if(!(end>start))return;
        let cursor=start;
        while(cursor<end){const date=dateKey(cursor),d=new Date(cursor);d.setHours(24,0,0,0);const boundary=Math.min(end,d.getTime());const day=data.days[date]||(data.days[date]={sources:{}});day.sources[source]=Math.min(DAY,positive(day.sources[source])+boundary-cursor);cursor=boundary;}
    }
    function editDay(data,date,ms,now) {
        const day=data.days[date]||(data.days[date]={sources:{}});day.edit={at:now,ms:Math.min(DAY,positive(ms)),baseline:Object.assign({},day.sources)};
    }
    function total(data) {return positive(data.offset)+Object.values(data.days).reduce((sum,day)=>sum+dayMilliseconds(day),0);}
    function weekStart(now) {const d=new Date(now);d.setDate(d.getDate()-((d.getDay()+6)%7));d.setHours(0,0,0,0);return dateKey(d);}
    function rangeValue(data,range,now) {if(range==='daily')return dayMilliseconds(data.days[dateKey(now)]);if(range==='weekly'){const start=weekStart(now),end=dateKey(now);return Object.entries(data.days).reduce((sum,[date,day])=>sum+(date>=start&&date<=end?dayMilliseconds(day):0),0);}return total(data);}
    function legacy(stats,local,now) {
        const data={version:1,days:{},offset:0,updatedAt:now},last=normalizeDate(stats.study_last_date||stats.study_weekly_log_today_date||local.date);
        const logs=Array.isArray(stats.study_weekly_log)?stats.study_weekly_log:local.log;
        if(last&&Array.isArray(logs)){
            for(let ago=0;ago<7;ago++){const d=new Date(dateAt(last));d.setDate(d.getDate()-ago);const ms=Math.min(DAY,positive(logs[(d.getDay()+6)%7])*60000);if(ms)data.days[dateKey(d)]={sources:{legacy:ms}};}
        }
        const today=normalizeDate(stats.study_today_date||stats.study_last_date||local.date);
        if(today){const ms=Math.min(DAY,Math.max(positive(stats.study_today_secs),positive(local.today))*1000);const day=data.days[today]||(data.days[today]={sources:{}});day.sources.legacy=Math.max(positive(day.sources.legacy),ms);}
        data.offset=Math.max(0,Math.max(positive(stats.study_total_secs),positive(local.total))*1000-total(data));return data;
    }
    const model={dateKey,normalizeDate,dayMilliseconds,merge,accrue,editDay,total,rangeValue,legacy};
    window.StudyTimeModel=model;
    let user='',data=null,manual=false,paused=false,active=false,leader=false,lockPending=false,release=null,lastMono=performance.now(),lastWall=Date.now(),lastCloud=0;
    let month=new Date();month.setDate(1);let selected=dateKey(Date.now()),rankRange='daily',ranking=[],rankingLoading=false;
    let fallbackLease=false;
    const tabId=crypto.randomUUID();
    let device=localStorage.getItem('aiglish_study_device');if(!device){device=crypto.randomUUID();localStorage.setItem('aiglish_study_device',device);}
    const uid=()=>myId||'';
    const storageKey=id=>'aiglish_study_ledger_'+id;
    function read(id) {try{return JSON.parse(localStorage.getItem(storageKey(id))||'null');}catch(e){return null;}}
    function persist() {if(!user||!data)return;data.updatedAt=Date.now();try{localStorage.setItem(storageKey(user),JSON.stringify(data));}catch(e){const status=document.getElementById('studyTimerStatus');if(status)status.textContent='保存できません。ブラウザーの空き容量を確認してください。';console.error('勉強時間を保存できませんでした',e);}}
    function localLegacy(id) {
        if(localStorage.getItem('core_v4_userId')!==id)return {};
        let log=[];try{log=JSON.parse(localStorage.getItem('core_v4_study_weekly_log')||'[]');}catch(e){}
        return {date:localStorage.getItem('core_v4_study_last_date'),today:localStorage.getItem('core_v4_study_today_secs'),total:localStorage.getItem('core_v4_study_total_secs'),log};
    }
    function ensureUser() {
        const next=uid();if(next===user)return;
        unlock();user=next;manual=false;paused=false;active=false;lastMono=performance.now();lastWall=Date.now();ranking=[];
        if(!user){data=null;return;}
        let stats={};try{stats=JSON.parse(localStorage.getItem('core_v4_user_stats_'+user)||'{}');}catch(e){}
        const saved=read(user);data=saved&&saved.version===1?merge(null,saved):legacy(stats,localLegacy(user),Date.now());
        if(stats.study_calendar)data=merge(data,stats.study_calendar);
        persist();sync();renderCalendar();renderRanking();
    }
    function visible(id) {const el=document.getElementById(id);return !!(el&&getComputedStyle(el).display!=='none'&&el.getClientRects().length);}
    function eligible() {
        if(!user||document.visibilityState!=='visible'||paused)return false;
        if(!navigator.locks&&!document.hasFocus())return false;
        const gate=document.getElementById('auth-gate-screen');if(gate&&getComputedStyle(gate).display!=='none')return false;
        if(manual)return true;
        if(currentActiveTabId==='vocab')return visible('vocabBookContents')||visible('workbookContents');
        if(currentActiveTabId==='reader')return visible('text-reader-view');
        return visible('flashcard-play-screen')||visible('multi-battle-play-screen')||!!(window.__loadQuiz&&window.__loadQuiz.active);
    }
    function unlock(){if(release){release();release=null;}if(fallbackLease&&user){try{const key='aiglish_study_lease_'+user,lease=JSON.parse(localStorage.getItem(key)||'null');if(lease&&lease.tab===tabId)localStorage.removeItem(key);}catch(e){}}leader=false;fallbackLease=false;}
    function claim() {
        if(!user||leader||lockPending)return;
        const claimedUser=user;
        if(navigator.locks){lockPending=true;navigator.locks.request('aiglish-study-'+user,{ifAvailable:true},async lock=>{lockPending=false;if(!lock||user!==claimedUser||!eligible())return;leader=true;lastMono=performance.now();lastWall=Date.now();await new Promise(resolve=>release=resolve);}).catch(()=>{lockPending=false;});}
        else {const key='aiglish_study_lease_'+user;let lease;try{lease=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}if(!lease||lease.expires<Date.now()||lease.tab===tabId){localStorage.setItem(key,JSON.stringify({tab:tabId,expires:Date.now()+3000}));leader=true;fallbackLease=true;lastMono=performance.now();lastWall=Date.now();}}
    }
    function tick() {
        ensureUser();if(!data)return;
        const mono=performance.now(),wall=Date.now(),elapsed=mono-lastMono;
        if(fallbackLease){let lease;try{lease=JSON.parse(localStorage.getItem('aiglish_study_lease_'+user)||'null');}catch(e){}if(!lease||lease.tab!==tabId){leader=false;fallbackLease=false;}}
        // Hidden/suspended pages never accrue the time that elapsed before resuming.
        if(active&&leader&&elapsed>0&&elapsed<60000){data=merge(data,read(user));accrue(data,device,lastWall,lastWall+elapsed);persist();}
        lastMono=mono;lastWall=wall;active=eligible();
        if(!active)unlock();else if(!leader)claim();else if(fallbackLease)localStorage.setItem('aiglish_study_lease_'+user,JSON.stringify({tab:tabId,expires:wall+3000}));
        sync();renderDisplay();
        if(wall-lastCloud>30000){lastCloud=wall;if(user!=='GUEST-000'&&typeof window.saveUserStats==='function')window.saveUserStats();}
    }
    function sync() {
        if(!data||uid()!==user)return;
        const now=Date.now(),today=dateKey(now),day=new Date(now),week=weekStart(now);
        todayStudySeconds=Math.floor(dayMilliseconds(data.days[today])/1000);lastAccessDateStr=today;
        weeklyStudyMinutesLog=Array(7).fill(0);for(let ago=0;ago<7;ago++){const d=new Date(day);d.setDate(d.getDate()-ago);weeklyStudyMinutesLog[(d.getDay()+6)%7]=dayMilliseconds(data.days[dateKey(d)])/60000;}
        Object.assign(userStats,{study_today_secs:todayStudySeconds,study_today_date:today.replace(/-0/g,'-'),study_week_secs:Math.floor(rangeValue(data,'weekly',now)/1000),study_week_key:week.replace(/-0/g,'-'),study_total_secs:Math.floor(total(data)/1000),study_weekly_log:weeklyStudyMinutesLog.slice(),study_last_date:today.replace(/-0/g,'-'),study_calendar:JSON.parse(JSON.stringify(data))});
        userStats.study_burst=Math.max(positive(userStats.study_burst),Math.floor(todayStudySeconds/60));
        localStorage.setItem('core_v4_study_today_secs',String(todayStudySeconds));localStorage.setItem('core_v4_study_last_date',today);localStorage.setItem('core_v4_study_weekly_log',JSON.stringify(weeklyStudyMinutesLog));localStorage.setItem('core_v4_study_total_secs',String(userStats.study_total_secs));
    }
    function format(ms) {const seconds=Math.floor(positive(ms)/1000);return String(Math.floor(seconds/3600)).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
    function renderDisplay() {
        if(!data)return;const ms=dayMilliseconds(data.days[dateKey(Date.now())]);
        const home=document.getElementById('todayStudyTimeDisplay');if(home)home.textContent=format(ms);
        const live=document.getElementById('studyLiveTime');if(live)live.textContent=format(ms);
        const totalLabel=document.getElementById('totalStudyTimeValue');if(totalLabel)totalLabel.textContent=format(total(data));
        const state=document.getElementById('studyTimerStatus');if(state)state.textContent=active?(leader?'計測中':'別のタブで計測中'):paused?'一時停止中':'待機中';
        const button=document.getElementById('studyTimerToggle');if(button)button.textContent=manual?'一時停止':'開始';
        const selectedLabel=document.getElementById('studySelectedDay');if(selectedLabel)selectedLabel.textContent=selected+' · '+format(dayMilliseconds(data.days[selected]));
        const todayButton=document.querySelector('#studyCalendar [data-date="'+dateKey(Date.now())+'"] small');if(todayButton)todayButton.textContent=format(ms);
        if(currentActiveTabId==='study')renderRanking();
    }
    function renderCalendar() {
        const container=document.getElementById('studyCalendar');if(!container||!data)return;
        document.getElementById('studyMonthTitle').textContent=month.getFullYear()+'年'+(month.getMonth()+1)+'月';container.replaceChildren();
        const offset=(month.getDay()+6)%7;for(let i=0;i<offset;i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');container.append(empty);}
        const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
        for(let n=1;n<=days;n++){const date=dateKey(new Date(month.getFullYear(),month.getMonth(),n)),ms=dayMilliseconds(data.days[date]);const button=document.createElement('button');button.type='button';button.dataset.date=date;button.className='study-day'+(date===dateKey(Date.now())?' is-today':'')+(date===selected?' is-selected':'');button.innerHTML='<span>'+n+'</span><small>'+format(ms)+'</small>';button.setAttribute('aria-label',date+' '+format(ms));button.onclick=()=>{selected=date;renderCalendar();renderDisplay();};container.append(button);}
        renderDisplay();
    }
    function editDate(date) {
        if(!data)return;const owner=user;const modal=window.openLibraryDialog('勉強時間を編集', '<form><p class="library-editor-hint">'+date+'</p><label for="studyEditMinutes">勉強時間（分）</label><input id="studyEditMinutes" type="number" min="0" max="1440" step="0.01" required><p class="library-editor-error" role="alert"></p><div class="library-editor-actions"><button type="button" data-library-close>キャンセル</button><button type="submit" class="library-editor-primary">保存</button></div></form>');
        modal.querySelector('input').value=Math.round(dayMilliseconds(data.days[date])/600)/100;
        modal.querySelector('form').onsubmit=event=>{event.preventDefault();try{if(uid()!==owner)throw new Error('ユーザーが切り替わりました。');const minutes=Number(modal.querySelector('input').value);if(!Number.isFinite(minutes)||minutes<0||minutes>1440)throw new Error('0〜1440分で入力してください。');tick();editDay(data,date,minutes*60000,Date.now());persist();sync();renderCalendar();window.renderActivityChart();if(window.saveUserStats)window.saveUserStats();window.closeLibraryDialog();}catch(e){modal.querySelector('.library-editor-error').textContent=e.message;}};
    }
    function chart() {
        const container=document.getElementById('activityBarChart');if(!container||!data)return;
        container.replaceChildren();const values=[];for(let ago=6;ago>=0;ago--){const d=new Date();d.setDate(d.getDate()-ago);values.push({date:dateKey(d),ms:dayMilliseconds(data.days[dateKey(d)])});}const max=Math.max(1,...values.map(v=>v.ms));
        values.forEach(({date,ms})=>{const bar=document.createElement('div');bar.className='bar-wrap';bar.innerHTML='<span>'+Math.floor(ms/60000)+'分</span><div class="bar-track"><div class="bar-fill" style="height:'+(ms/max*100)+'%"></div></div><small>'+date.slice(5)+'</small>';bar.tabIndex=0;bar.setAttribute('role','button');bar.setAttribute('aria-label',date+'の勉強時間を編集');bar.onclick=()=>editDate(date);bar.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();editDate(date);}};container.append(bar);});
    }
    function friendValue(entry) {
        const stats=entry.stats||{};if(stats.study_calendar)return Math.floor(rangeValue(stats.study_calendar,rankRange,Date.now())/1000);
        if(rankRange==='daily')return normalizeDate(stats.study_today_date)===dateKey(Date.now())?positive(stats.study_today_secs):0;
        if(rankRange==='weekly')return normalizeDate(stats.study_week_key)===weekStart(Date.now())?positive(stats.study_week_secs):0;
        return positive(stats.study_total_secs||entry.studyTotalSecs);
    }
    function renderRanking() {
        const container=document.getElementById('studyFriendRanking');if(!container||!data)return;
        container.replaceChildren();const rows=ranking.filter(f=>f.id!==user).map(f=>({name:f.name||f.id,seconds:friendValue(f),self:false}));rows.push({name:(myName||'あなた')+'（あなた）',seconds:Math.floor(rangeValue(data,rankRange,Date.now())/1000),self:true});rows.sort((a,b)=>b.seconds-a.seconds);
        rows.forEach((record,index)=>{const row=document.createElement('div');row.className='study-rank-row'+(record.self?' is-self':'');const name=document.createElement('span');name.textContent=(index+1)+'. '+record.name;const value=document.createElement('strong');value.textContent=format(record.seconds*1000);row.append(name,value);container.append(row);});
        if(user==='GUEST-000'){const hint=document.createElement('p');hint.className='library-editor-hint';hint.textContent='フレンドのランキングはログイン後に表示されます。';container.append(hint);}
    }
    async function refreshRanking() {
        ensureUser();if(rankingLoading||!user||user==='GUEST-000')return;
        const owner=user;rankingLoading=true;const button=document.getElementById('studyRefreshRanking');button.disabled=true;button.textContent='更新中…';
        try{if(!window.db||!window.fbGetDoc||!window.fbDoc)throw new Error('接続できません。接続後に更新してください。');const friends=Array.isArray(myFriendList)?myFriendList:[];const records=await Promise.all(friends.map(async friend=>{const id=friend.code||friend.id;try{const snap=await window.fbGetDoc(window.fbDoc(window.db,'users',id));if(!snap||!snap.exists())return null;const remote=snap.data();let stats=remote.userStats||{};if(typeof remote.userStatsJson==='string')stats=JSON.parse(remote.userStatsJson);return {id,name:remote.playerName||remote.name||friend.name,stats,studyTotalSecs:friend.studyTotalSecs};}catch(e){return {id,name:friend.name,stats:friend.stats||{},studyTotalSecs:friend.studyTotalSecs};}}));if(user===owner&&uid()===owner){ranking=records.filter(Boolean);renderRanking();}}
        catch(e){const message=document.createElement('p');message.className='library-editor-error';message.textContent=e.message;document.getElementById('studyFriendRanking').append(message);}
        finally{rankingLoading=false;button.disabled=false;button.textContent='更新';}
    }
    function init(){ensureUser();tick();chart();renderCalendar();}
    window.StudyTime={init,sync,tick,mergeCloud:calendar=>{ensureUser();if(data){data=merge(data,calendar);persist();sync();renderCalendar();chart();}}};
    window.initStudyTimerAndDataRotation=init;
    window.__updateStudyTimeDisplay=()=>{sync();renderDisplay();};window.renderActivityChart=chart;window.__steSanitizeStudyData=()=>false;
    window.__openStudyTimeEditor=day=>{const d=new Date();d.setDate(d.getDate()-(((d.getDay()+6)%7-day+7)%7));editDate(dateKey(d));};
    const oldLoad=window.loadUserStats;
    window.loadUserStats=async function(){const owner=uid(),result=await oldLoad.apply(this,arguments);if(uid()===owner){ensureUser();if(userStats.study_calendar)data=merge(data,userStats.study_calendar);else if(data)data=merge(data,legacy(userStats,{},Date.now()));persist();sync();renderCalendar();chart();}return result;};
    const oldSave=window.saveUserStats;window.saveUserStats=function(){if(data&&uid()===user&&userStats.study_calendar)data=merge(data,userStats.study_calendar);sync();return oldSave.apply(this,arguments);};
    const oldSwitch=window.switchTab;window.switchTab=function(tab){tick();const result=oldSwitch.apply(this,arguments);active=eligible();lastMono=performance.now();lastWall=Date.now();if(!active)unlock();else claim();if(tab==='study'){renderCalendar();refreshRanking();}return result;};
    const oldLogout=window.logoutToGate;window.logoutToGate=async function(){tick();active=false;unlock();return oldLogout.apply(this,arguments);};
    document.getElementById('studyTimerToggle').onclick=()=>{tick();manual=!manual;paused=!manual;active=eligible();if(active)claim();else unlock();renderDisplay();};
    document.getElementById('studyPreviousMonth').onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar();};document.getElementById('studyNextMonth').onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar();};
    document.getElementById('studyEditDay').onclick=()=>editDate(selected);document.getElementById('studyRefreshRanking').onclick=refreshRanking;
    document.querySelectorAll('#studyRankRanges [data-range]').forEach(button=>button.onclick=()=>{rankRange=button.dataset.range;document.querySelectorAll('#studyRankRanges button').forEach(b=>b.classList.toggle('active',b===button));renderRanking();});
    document.addEventListener('visibilitychange',()=>{tick();if(document.visibilityState!=='visible'){active=false;unlock();}else{lastMono=performance.now();lastWall=Date.now();active=eligible();claim();}if(user&&user!=='GUEST-000'&&window.saveUserStats)window.saveUserStats();});
    window.addEventListener('pagehide',()=>{tick();active=false;unlock();persist();});window.addEventListener('storage',event=>{if(user&&event.key===storageKey(user)){data=merge(data,read(user));sync();renderCalendar();}});
    setInterval(tick,500);setInterval(chart,10000);window.onAppLoaded(init);init();
})();
