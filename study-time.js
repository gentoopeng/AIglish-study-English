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
    function readStats(doc) {
        const result={};let ledger=null,hasLedger=false;
        // Older profile saves write `stats` and can leave `userStats` null.
        [doc.userStatsJson,doc.statistics,doc.user_stats,doc.stats,doc.userStats].forEach(source=>{
            if(typeof source==='string'){try{source=JSON.parse(source);}catch(e){return;}}
            if(!source||typeof source!=='object'||Array.isArray(source))return;
            Object.assign(result,source);
            if(source.study_calendar_v2){ledger=mergeCurrent(ledger,source.study_calendar_v2);hasLedger=true;}
        });
        if(doc.studyLedgerJson){try{ledger=mergeCurrent(ledger,JSON.parse(doc.studyLedgerJson));hasLedger=true;}catch(e){}}
        if(hasLedger)result.study_calendar_v2=ledger;
        if(result.study_today_secs===undefined&&doc.todayStudySeconds!==undefined)result.study_today_secs=positive(doc.todayStudySeconds);
        if(!result.study_today_date&&doc.lastAccessDateStr)result.study_today_date=doc.lastAccessDateStr;
        return result;
    }
    function rankingSeconds(stats,range,now) {
        return Math.floor(rangeValue(resetLedger(stats.study_calendar_v2),range,now)/1000);
    }
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
    function weekValues(ledger,start) {
        return Array.from({length:7},(_,index)=>{const day=new Date(dateAt(start));day.setDate(day.getDate()+index);const date=dateKey(day);return {date,ms:dayMilliseconds(ledger.days[date])};});
    }
    const RESET_EPOCH='study-reset-2.62';
    function resetLedger(ledger) {return ledger&&ledger.epoch===RESET_EPOCH?ledger:{version:1,epoch:RESET_EPOCH,days:{},offset:0,updatedAt:0};}
    function mergeCurrent(left,right) {return merge(resetLedger(left),resetLedger(right));}
    const model={dateKey,normalizeDate,dayMilliseconds,merge,accrue,editDay,total,rangeValue,legacy,resetLedger,mergeCurrent,weekValues,readStats,rankingSeconds};
    window.StudyTimeModel=model;
    let sleepState=null,activitySlices=[];
    let user='',data=null,manual=false,paused=false,active=false,leader=false,lockPending=false,release=null,lastMono=performance.now(),lastWall=Date.now(),lastCloud=0;
    let month=new Date();month.setDate(1);let selected=dateKey(Date.now()),rankRange='daily',ranking=[],rankingLoading=false,rankingLoadedAt=0,rankingDay='';
    let fallbackLease=false;
    let selectedWeek=weekStart(Date.now());
    const tabId=crypto.randomUUID();
    let device=localStorage.getItem('aiglish_study_device');if(!device){device=crypto.randomUUID();localStorage.setItem('aiglish_study_device',device);}
    const uid=()=>myId||'';
    const storageKey=id=>'aiglish_study_ledger_'+id;
    function read(id) {try{return JSON.parse(localStorage.getItem(storageKey(id))||'null');}catch(e){return null;}}
    function persist() {if(!user||!data)return;data.updatedAt=Date.now();try{const previous=read(user);if(previous&&previous.epoch===RESET_EPOCH)localStorage.setItem(storageKey(user)+'_backup',JSON.stringify(mergeCurrent(previous,data)));localStorage.setItem(storageKey(user),JSON.stringify(data));}catch(e){const status=document.getElementById('studyTimerStatus');if(status)status.textContent='保存できません。ブラウザーの空き容量を確認してください。';console.error('勉強時間を保存できませんでした',e);}}
    function ensureUser() {
        const next=uid();if(next===user)return;
        unlock();sleepState=null;activitySlices=[];user=next;manual=false;paused=false;active=false;lastMono=performance.now();lastWall=Date.now();ranking=[];rankingLoadedAt=0;rankingDay='';
        if(!user){data=null;return;}
        let stats={};try{stats=JSON.parse(localStorage.getItem('core_v4_user_stats_'+user)||'{}');}catch(e){}
        const saved=read(user);let backup=null;try{backup=JSON.parse(localStorage.getItem(storageKey(user)+'_backup')||'null');}catch(e){}data=mergeCurrent(saved,backup);
        if(stats.study_calendar_v2)data=mergeCurrent(data,stats.study_calendar_v2);
        persist();sync();renderCalendar();renderRanking();
    }
    function visible(id) {const el=document.getElementById(id);return !!(el&&getComputedStyle(el).display!=='none'&&el.getClientRects().length);}
    function eligible() {
        if(!user||document.visibilityState!=='visible'||paused||sleepState)return false;
        if(!navigator.locks&&!document.hasFocus())return false;
        const gate=document.getElementById('auth-gate-screen');if(gate&&getComputedStyle(gate).display!=='none')return false;
        if(manual)return true;
        if(currentActiveTabId==='vocab')return visible('vocabBookContents')||visible('workbookContents');
        if(currentActiveTabId==='reader')return visible('text-reader-view');
        return visible('flashcard-play-screen')||!!(window.__loadQuiz&&window.__loadQuiz.active);
    }
    function unlock(){if(release){release();release=null;}if(fallbackLease&&user){try{const key='aiglish_study_lease_'+user,lease=JSON.parse(localStorage.getItem(key)||'null');if(lease&&lease.tab===tabId)localStorage.removeItem(key);}catch(e){}}leader=false;fallbackLease=false;}
    function writeLease(key,value){if(window.AppStorage)return window.AppStorage.setCoordination(key,value);try{localStorage.setItem(key,value);return true;}catch(error){return false;}}
    function claim() {
        if(!user||leader||lockPending)return;
        const claimedUser=user;
        if(navigator.locks){lockPending=true;navigator.locks.request('aiglish-study-'+user,{ifAvailable:true},async lock=>{lockPending=false;if(!lock||user!==claimedUser||!eligible())return;leader=true;lastMono=performance.now();lastWall=Date.now();await new Promise(resolve=>release=resolve);}).catch(()=>{lockPending=false;});}
        else {const key='aiglish_study_lease_'+user;let lease;try{lease=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}if(!lease||lease.expires<Date.now()||lease.tab===tabId){if(!writeLease(key,JSON.stringify({tab:tabId,expires:Date.now()+3000})))return;leader=true;fallbackLease=true;lastMono=performance.now();lastWall=Date.now();}}
    }
    function tick() {
        ensureUser();if(!data)return;
        const mono=performance.now(),wall=Date.now(),elapsed=mono-lastMono;
        if(sleepState){lastMono=mono;lastWall=wall;return;}
        if(fallbackLease){let lease;try{lease=JSON.parse(localStorage.getItem('aiglish_study_lease_'+user)||'null');}catch(e){}if(!lease||lease.tab!==tabId){leader=false;fallbackLease=false;}}
        // Hidden/suspended pages never accrue the time that elapsed before resuming.
        if(active&&leader&&elapsed>0&&elapsed<60000){data=mergeCurrent(data,read(user));accrue(data,device,lastWall,lastWall+elapsed);activitySlices.push([lastWall,lastWall+elapsed]);activitySlices=activitySlices.filter(slice=>slice[1]>wall-360000);persist();}
        lastMono=mono;lastWall=wall;active=eligible();
        if(!active)unlock();else if(!leader)claim();else if(fallbackLease&&!writeLease('aiglish_study_lease_'+user,JSON.stringify({tab:tabId,expires:wall+3000})))unlock();
        sync();renderDisplay();
        if(wall-lastCloud>30000){lastCloud=wall;if(user!=='GUEST-000'&&typeof window.saveUserStats==='function')window.saveUserStats();}
    }
    let syncedLedger=null,syncedStats=null,syncedRevision=-1,syncedDay="",lastChart=0;
    function sync() {
        if(!data||uid()!==user)return;
        const now=Date.now(),today=dateKey(now),day=new Date(now),week=weekStart(now);
        if(data===syncedLedger&&userStats===syncedStats&&data.updatedAt===syncedRevision&&today===syncedDay)return;
        syncedLedger=data;syncedStats=userStats;syncedRevision=data.updatedAt;syncedDay=today;
        todayStudySeconds=Math.floor(dayMilliseconds(data.days[today])/1000);lastAccessDateStr=today;
        weeklyStudyMinutesLog=Array(7).fill(0);for(let ago=0;ago<7;ago++){const d=new Date(day);d.setDate(d.getDate()-ago);weeklyStudyMinutesLog[(d.getDay()+6)%7]=dayMilliseconds(data.days[dateKey(d)])/60000;}
        Object.assign(userStats,{study_today_secs:todayStudySeconds,study_today_date:today.replace(/-0/g,'-'),study_week_secs:Math.floor(rangeValue(data,'weekly',now)/1000),study_week_key:week.replace(/-0/g,'-'),study_total_secs:Math.floor(total(data)/1000),study_weekly_log:weeklyStudyMinutesLog.slice(),study_last_date:today.replace(/-0/g,'-'),study_calendar_v2:JSON.parse(JSON.stringify(data))});
        userStats.study_burst=Math.floor(Math.max(0,...Object.values(data.days).map(dayMilliseconds))/60000);
        try{localStorage.setItem('core_v4_study_today_secs',String(todayStudySeconds));localStorage.setItem('core_v4_study_last_date',today);localStorage.setItem('core_v4_study_weekly_log',JSON.stringify(weeklyStudyMinutesLog));localStorage.setItem('core_v4_study_total_secs',String(userStats.study_total_secs));}catch(error){console.warn('勉強時間の表示用データは後で保存します',error);}
    }
    function format(ms) {const seconds=Math.floor(positive(ms)/1000);return String(Math.floor(seconds/3600)).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
    function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}
    function renderDisplay() {
        if(!data)return;const ms=dayMilliseconds(data.days[dateKey(Date.now())]);
        const header=document.getElementById('headerStudyTime');text(header,format(ms));
        const live=document.getElementById('studyLiveTime');text(live,format(ms));
        const totalLabel=document.getElementById('totalStudyTimeValue');text(totalLabel,format(total(data)));
        const state=document.getElementById('studyTimerStatus');text(state,active?(leader?'計測中':'別のタブで計測中'):paused?'一時停止中':'待機中');
        const button=document.getElementById('studyTimerToggle');text(button,manual?'一時停止':'開始');
        const selectedLabel=document.getElementById('studySelectedDay');text(selectedLabel,selected+' · '+format(dayMilliseconds(data.days[selected])));
        const todayButton=document.querySelector('#studyCalendar [data-date="'+dateKey(Date.now())+'"] small');text(todayButton,format(ms));
        if(currentActiveTabId==='study'){renderRanking();if(performance.now()-lastChart>=5000){lastChart=performance.now();chart();}}
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
        const container=document.getElementById('studyWeekChart');if(!container||!data)return;
        const values=weekValues(data,selectedWeek),signature=JSON.stringify(values);if(container.dataset.signature===signature)return;container.dataset.signature=signature;container.replaceChildren();
        const max=Math.max(60000,...values.map(v=>v.ms)),labels=['月','火','水','木','金','土','日'];
        document.getElementById('studyWeekRange').textContent=values[0].date+' — '+values[6].date;
        document.getElementById('studyWeekTotal').textContent='合計 '+format(values.reduce((sum,v)=>sum+v.ms,0));
        container.setAttribute('aria-label',values.map((v,i)=>labels[i]+'曜日 '+format(v.ms)).join('、'));
        values.forEach(({date,ms},index)=>{const column=document.createElement('div');column.className='study-week-column'+(date===dateKey(Date.now())?' is-today':'');const time=document.createElement('span');time.className='study-week-value';time.textContent=format(ms);const track=document.createElement('div');track.className='study-week-track';const fill=document.createElement('div');fill.className='study-week-fill';fill.style.height=(ms/max*100)+'%';track.append(fill);const label=document.createElement('small');label.textContent=labels[index];column.append(time,track,label);container.append(column);});
        document.getElementById('studyNextWeek').disabled=selectedWeek>=weekStart(Date.now());
    }
    function friendValue(entry) {
        return entry.date===dateKey(Date.now())?entry.seconds:0;
    }
    let podiumShape=null;
    function renderRanking() {
        const container=document.getElementById('studyFriendRanking');if(!container||!data)return;
        const rows=ranking.filter(f=>f.id!==user).map(f=>({name:f.name||f.id,seconds:friendValue(f),self:false,id:f.id,avatar:f.avatar||'',appearance:f.appearance,getStats:()=>f.stats}));
        if(user!=='GUEST-000')rows.push({name:(myName||'あなた'),seconds:Math.floor(rangeValue(data,'daily',Date.now())/1000),self:true,id:user,avatar:localStorage.getItem('core_v4_user_avatar_'+user)||'',appearance:localStorage.getItem('core_v4_profile_customization_'+user),getStats:()=>userStats});
        const top=rows.filter(r=>r.seconds>=300).sort((a,b)=>b.seconds-a.seconds||a.id.localeCompare(b.id)).slice(0,3);
        const signature=JSON.stringify(top.map(row=>[row.id,row.seconds]));
        const shape=[[user],...top.map(record=>[record.id,record.name,record.avatar,record.appearance])];
        const same=podiumShape&&podiumShape.length===shape.length&&podiumShape.every((row,i)=>row.length===shape[i].length&&row.every((value,j)=>value===shape[i][j]));
        if(same&&container.dataset.signature===signature)return;container.dataset.signature=signature;
        if(same){top.forEach((record,index)=>{const column=container.querySelector('.place-'+(index+1));if(column){column.querySelector('strong').textContent=format(record.seconds*1000);column.onclick=()=>{if(window.RankingVisuals)window.RankingVisuals.detailStudy(record,index+1);};}});return;}
        const mounted=podiumShape!==null;podiumShape=shape;container.replaceChildren();
        if(!top.length){const hint=document.createElement('p');hint.className='study-podium-empty';hint.textContent='今日5分以上勉強したユーザーが、ここに登場します。';container.append(hint);return;}
        const podium=document.createElement('div');podium.className='study-podium';
        [1,0,2].forEach(index=>{const record=top[index],place=index+1;const column=document.createElement(record?'button':'div');column.className='study-podium-place place-'+place+(record&&record.self?' is-self':'')+(mounted?' podium-mounted':'');if(!record){column.classList.add('is-empty');column.setAttribute('aria-hidden','true');podium.append(column);return;}
            column.type='button';column.setAttribute('aria-label',place+'位 '+record.name+'の今日の学習記録');column.onclick=()=>{if(window.RankingVisuals)window.RankingVisuals.detailStudy(record,place);};
            const name=document.createElement('span');name.className='study-podium-name';if(window.RankingVisuals)window.RankingVisuals.name(name,record.name,record.appearance);else name.textContent=record.name;
            const time=document.createElement('strong');time.textContent=format(record.seconds*1000);
            const step=document.createElement('div');step.className='study-podium-step';step.textContent=String(place);if(window.RankingVisuals)column.append(window.RankingVisuals.avatar(record.avatar,record.name,record.appearance));column.append(name,time,step);podium.append(column);
        });container.append(podium);
    }
    async function refreshRanking(force=false) {
        ensureUser();if(rankingLoading||!user||currentActiveTabId!=='study'||document.visibilityState!=='visible')return;
        if(!force&&rankingDay===dateKey(Date.now())&&Date.now()-rankingLoadedAt<60000){renderRanking();return;}
        const owner=user;rankingLoading=true;const button=document.getElementById('studyRefreshRanking'),message=document.getElementById('studyRankingMessage');button.disabled=true;button.textContent='更新中…';message.textContent='';
        try {
            if(!window.db||!window.fbGetDocs||!window.fbCollection)throw new Error('接続後に更新してください。');
            const records=[],today=dateKey(Date.now());
            await window.UserDirectory.scan((id,remote)=>{
                if(remote.deleted||id===owner||id==='GUEST-000')return;
                const stats=readStats(remote),seconds=rankingSeconds(stats,'daily',Date.now());
                if(seconds<300)return;
                // Keep only three podium candidates, never entire profile statistics/artwork.
                const compact={study_calendar_v2:resetLedger(stats.study_calendar_v2),learning_ranking_v2_json:remote.learningRankingV2Json||stats.learning_ranking_v2_json,learning_ranking_owner:stats.learning_ranking_owner};
                records.push({id,name:remote.playerName||remote.name||id,avatar:remote.avatar||'',appearance:window.RankingVisuals?.appearanceOf(remote),date:today,seconds,stats:compact});
                records.sort((a,b)=>b.seconds-a.seconds||a.id.localeCompare(b.id));records.splice(3);
            },()=>user===owner&&uid()===owner&&currentActiveTabId==='study'&&document.visibilityState==='visible');
            if(user===owner&&uid()===owner){ranking=records;rankingLoadedAt=Date.now();rankingDay=today;renderRanking();}
        }catch(e){if(uid()===owner)message.textContent='表彰台を取得できませんでした。'+e.message;}
        finally{rankingLoading=false;button.disabled=false;button.textContent='更新';}
    }
    function init(){ensureUser();if(data&&userStats.study_calendar_v2)data=mergeCurrent(data,userStats.study_calendar_v2);tick();chart();renderCalendar();}
    function sleep(since){
        if(sleepState)return 0;tick();sleepState={manual,paused};paused=true;active=false;unlock();
        const remove={days:{},offset:0},end=Math.min(Date.now(),since+300000);for(const [start,finish] of activitySlices){const left=Math.max(start,since),right=Math.min(finish,end);if(right>left)accrue(remove,device,left,right);}
        let deducted=0;for(const [day,value] of Object.entries(remove.days)){const ms=Math.min(dayMilliseconds(data.days[day]),dayMilliseconds(value));if(ms){editDay(data,day,dayMilliseconds(data.days[day])-ms,Math.max(Date.now(),Number(data.days[day]?.edit?.at||0)+1));deducted+=ms;}}
        activitySlices=[];persist();sync();renderDisplay();renderCalendar();return deducted;
    }
    function wake(){if(!sleepState)return;manual=sleepState.manual;paused=sleepState.paused;sleepState=null;lastMono=performance.now();lastWall=Date.now();active=eligible();if(active)claim();renderDisplay();}
    window.StudyTime={sleep,wake,init,sync,tick,snapshot:()=>{ensureUser();return data?JSON.parse(JSON.stringify(data)):null;},mergeCloud:calendar=>{ensureUser();if(data){data=mergeCurrent(data,calendar);persist();sync();renderCalendar();chart();}}};
    window.initStudyTimerAndDataRotation=init;
    window.__updateStudyTimeDisplay=()=>{sync();renderDisplay();};window.renderActivityChart=chart;window.__steSanitizeStudyData=()=>false;
    window.__openStudyTimeEditor=day=>{const d=new Date();d.setDate(d.getDate()-(((d.getDay()+6)%7-day+7)%7));editDate(dateKey(d));};
    const oldLoad=window.loadUserStats;
    window.loadUserStats=async function(){const owner=uid(),result=await oldLoad.apply(this,arguments);if(uid()===owner){ensureUser();if(userStats.study_calendar_v2)data=mergeCurrent(data,userStats.study_calendar_v2);persist();sync();renderCalendar();chart();}return result;};
    const oldSave=window.saveUserStats;window.saveUserStats=function(){if(data&&uid()===user&&userStats.study_calendar_v2)data=mergeCurrent(data,userStats.study_calendar_v2);sync();return oldSave.apply(this,arguments);};
    const oldSwitch=window.switchTab;window.switchTab=function(tab){tick();const result=oldSwitch.apply(this,arguments);active=eligible();lastMono=performance.now();lastWall=Date.now();if(!active)unlock();else claim();if(tab==='study'){renderCalendar();refreshRanking();}return result;};
    const oldLogout=window.logoutToGate;window.logoutToGate=async function(){tick();active=false;unlock();return oldLogout.apply(this,arguments);};
    document.getElementById('studyTimerToggle').onclick=()=>{tick();manual=!manual;paused=!manual;active=eligible();if(active)claim();else unlock();renderDisplay();};
    document.getElementById('studyPreviousMonth').onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar();};document.getElementById('studyNextMonth').onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar();};
    document.getElementById('studyPreviousWeek').onclick=()=>{const day=new Date(dateAt(selectedWeek));day.setDate(day.getDate()-7);selectedWeek=dateKey(day);chart();};
    document.getElementById('studyNextWeek').onclick=()=>{const day=new Date(dateAt(selectedWeek));day.setDate(day.getDate()+7);selectedWeek=dateKey(day);chart();};
    document.getElementById('studyEditDay').onclick=()=>editDate(selected);document.getElementById('studyRefreshRanking').onclick=()=>refreshRanking(true);
    document.querySelectorAll('#studyRankRanges [data-range]').forEach(button=>button.onclick=()=>{rankRange=button.dataset.range;document.querySelectorAll('#studyRankRanges button').forEach(b=>b.classList.toggle('active',b===button));renderRanking();});
    document.addEventListener('visibilitychange',()=>{tick();if(document.visibilityState!=='visible'){active=false;unlock();}else{lastMono=performance.now();lastWall=Date.now();active=eligible();claim();}if(user&&user!=='GUEST-000'&&window.saveUserStats)window.saveUserStats();});
    window.addEventListener('pagehide',()=>{tick();active=false;unlock();persist();});window.addEventListener('storage',event=>{if(user&&event.key===storageKey(user)){data=mergeCurrent(data,read(user));sync();renderCalendar();}});
    setInterval(tick,500);(window.ViewWork?.interval || setInterval)(chart,10000,['study']);window.onAppLoaded(init);init();
})();
