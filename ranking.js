// Cumulative learning records and a shared, accessible podium presentation.
(function () {
    'use strict';
    const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    const empty = () => ({version:2, epoch:'learning-reset-3.52', words:{}, flash:{baseline:0,sources:{}}});
    function merge(left,right) {
        const result=empty();
        [left,right].forEach(record=>{
            if(typeof record==='string'){try{record=JSON.parse(record);}catch(e){return;}}
            if(!record||record.version!==2||record.epoch!=='learning-reset-3.52')return;
            Object.keys(record.words||{}).forEach(key=>{result.words[key]=1;});
            result.flash.baseline=Math.max(result.flash.baseline,nonnegative(record.flash&&record.flash.baseline));
            Object.entries(record.flash&&record.flash.sources||{}).forEach(([id,value])=>{result.flash.sources[id]=Math.max(result.flash.sources[id]||0,nonnegative(value));});
        });return result;
    }
    const wordCount = record => Object.keys(record&&record.words||{}).length;
    const flashCount = record => nonnegative(record&&record.flash&&record.flash.baseline)+Object.values(record&&record.flash&&record.flash.sources||{}).reduce((sum,value)=>sum+nonnegative(value),0);
    const wordKey=(book,num)=>JSON.stringify([String(book),String(num)]);
    const rated=word=>['ok','so','bad'].includes(word&&word.status)||Object.values(word&&word.meanings||{}).some(meaning=>['ok','so','bad'].includes(meaning.status));
    function fromProfile(doc){let result=empty();[doc.userStatsJson,doc.statistics,doc.user_stats,doc.stats,doc.userStats].forEach(stats=>{if(typeof stats==='string'){try{stats=JSON.parse(stats);}catch(e){return;}}if(stats)result=merge(result,stats.learning_ranking_v2_json);});return merge(result,doc.learningRankingV2Json);}
    window.LearningRankingModel={empty,merge,wordCount,flashCount,wordKey,rated,fromProfile};
    const owner=()=>typeof myId==='string'?myId:'GUEST-000';
    const storageKey=id=>'core_v4_learning_ranking_v2_'+id;
    let device=localStorage.getItem('aiglish_ranking_device');if(!device){device=crypto.randomUUID();localStorage.setItem('aiglish_ranking_device',device);}
    const sourceId=device+'.'+crypto.randomUUID();
    let user='',record=empty(),cache=[],cacheAt=0,cacheReady=false,inflight=null,generation=0;
    const groupCaches=new Map();
    const queues=new Map();
    function read(id){try{return JSON.parse(localStorage.getItem(storageKey(id))||'null');}catch(e){return null;}}
    function store(key,value){try{if(localStorage.getItem(key)!==value)localStorage.setItem(key,value);}catch(error){console.warn('ランキング記録を端末へ保存できませんでした',error);}}
    function persist(){if(owner()!==user)return;store(storageKey(user),JSON.stringify(record));userStats.learning_ranking_v2_json=JSON.stringify(record);delete userStats.learning_ranking;userStats.learning_ranking_owner=user;userStats.vocab_rated_count=wordCount(record);userStats.flash_count=flashCount(record);}
    function ensure(){
        const id=owner();if(user===id)return;
        inflight?.controller.abort();groupCaches.clear();user=id;cache=[];cacheAt=0;cacheReady=false;generation++;
        const saved=read(id),remote=userStats.learning_ranking_owner&&userStats.learning_ranking_owner!==id?null:(userStats.learning_ranking_v2_json||userStats.learning_ranking);
        record=merge(saved,remote);
        readSwipeJournals();persist();
    }
    function scanCurrent(){} // Only explicit rating actions count in this generation.
    function readSwipeJournals(){const prefix='core_v4_ranking_swipes_v2_'+user+'_';for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix)){const id=key.slice(prefix.length);record.flash.sources[id]=Math.max(record.flash.sources[id]||0,nonnegative(localStorage.getItem(key)));}}}
    window.syncRankingMetrics=function(){ensure();record=merge(record,read(user));if(!userStats.learning_ranking_owner||userStats.learning_ranking_owner===user)record=merge(record,userStats.learning_ranking_v2_json||userStats.learning_ranking);readSwipeJournals();scanCurrent();persist();};
    window.recordRankedWord=function(book,num){if(!book)return;ensure();record=merge(record,read(user));record.words[wordKey(book,num)]=1;persist();scheduleSync();};
    window.recordRankedSwipe=function(){ensure();record=merge(record,read(user));record.flash.sources[sourceId]=nonnegative(record.flash.sources[sourceId])+1;store('core_v4_ranking_swipes_v2_'+user+'_'+sourceId,String(record.flash.sources[sourceId]));persist();scheduleSync();};
    let syncTimer=null;const syncedStates=new Map();
    function scheduleSync(){if(!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;syncCloud();},2000);}
    async function syncCloud(){
        window.syncRankingMetrics();const id=user;
        if(id==='GUEST-000'||!window.fbRunTransaction||!window.db)return false;
        if(queues.has(id))return queues.get(id);
        const local=JSON.parse(JSON.stringify(record)),time=window.StudyTime.snapshot();
        const fingerprint=JSON.stringify([local,time?{epoch:time.epoch,days:time.days,offset:time.offset}:null]);if(syncedStates.get(id)===fingerprint)return true;
        const task=(async()=>{try{
            const combined=await window.fbRunTransaction(window.db,async transaction=>{
                const ref=window.fbDoc(window.db,'users',id),snap=await transaction.get(ref);
                const merged=merge(fromProfile(snap.exists()?snap.data():{}),local);
                const study=window.StudyTimeModel.mergeCurrent(window.StudyTimeModel.readStats(snap.exists()?snap.data():{}).study_calendar_v2,time);
                transaction.set(ref,{rankingLearningSummaryV1:{epoch:merged.epoch,studyEpoch:study.epoch,time:Math.floor(window.StudyTimeModel.total(study)/1000),words:wordCount(merged),flash:flashCount(merged)},learningRankingV2Json:JSON.stringify(merged),studyLedgerJson:JSON.stringify(study)},{merge:true});return merged;
            });
            if(owner()===id&&user===id){record=merge(record,combined);persist();syncedStates.set(id,JSON.stringify([combined,time?{epoch:time.epoch,days:time.days,offset:time.offset}:null]));if(JSON.stringify(merge(record,local))!==JSON.stringify(merge(combined,local)))scheduleSync();}
            return true;
        }catch(error){console.warn('ランキング記録の同期を次回に再試行します',error);return false;}finally{queues.delete(id);}})();
        queues.set(id,task);return task;
    }
    const oldSave=window.saveUserStats;
    window.saveUserStats=function(){window.syncRankingMetrics();const syncing=syncCloud();const saving=oldSave.apply(this,arguments);return Promise.all([Promise.resolve(saving),syncing]).then(([result])=>result);};
    setInterval(()=>syncCloud(),30000);
    window.addEventListener('online',scheduleSync);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')syncCloud();});
    const oldLoad=window.loadUserStats;
    window.loadUserStats=async function(){
        const id=owner();ensure();
        if(id!=='GUEST-000'&&window.fbGetDoc&&window.db){
            try{
                const snap=await window.fbGetDoc(window.fbDoc(window.db,'users',id));
                if(owner()!==id)return;
                if(snap.exists()){
                    const doc=snap.data(),stats=statsOf(doc);window.WordDuel?.mergeRating(doc);
                    if(window.StudyTime&&stats.study_calendar_v2)window.StudyTime.mergeCloud(stats.study_calendar_v2);
                    const cloudRecord=fromProfile(doc);
                    record=merge(record,cloudRecord);
                    persist();
                }
                if(window.__readLearningRankingBackup){const backup=await window.__readLearningRankingBackup(id);if(owner()!==id)return;record=merge(record,backup);persist();scheduleSync();}
            }catch(e){console.warn('既存のランキング記録は次回接続時に取り込みます',e);}
        }
        if(owner()!==id)return;
        const result=await oldLoad.apply(this,arguments);
        if(owner()===id){record=merge(record,userStats.learning_ranking_v2_json||userStats.learning_ranking);persist();render();}return result;
    };
    function name(element,value,appearance){let profile=appearance;if(typeof profile==='string'){try{profile=JSON.parse(profile);}catch{profile=null;}}element.style.color=/^#[0-9a-f]{6}$/i.test(profile?.nameColor||'')?profile.nameColor:'';const color=element.style.color,hex=profile?.nameColor||'';if(color){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));element.style.webkitTextStrokeColor=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114<140?'rgba(235,240,255,.8)':'rgba(5,9,20,.9)';}else element.style.webkitTextStrokeColor='';element.replaceChildren();String(value||'ユーザー').trim().split(/\s+/u).forEach((part,index)=>{if(index)element.append(document.createElement('br'));element.append(document.createTextNode(part));});}
    const avatarPreviews=new Map();
    function preview(img,source){
        img.decoding='async';img.referrerPolicy='no-referrer';
        if(!source.startsWith('data:image/')||!window.ProfileImages){img.src=source;return;}
        let task=avatarPreviews.get(source);
        if(!task){task=fetch(source).then(response=>response.blob()).then(blob=>window.ProfileImages.imageFile(blob,64,'image/png'));avatarPreviews.set(source,task);if(avatarPreviews.size>12)avatarPreviews.delete(avatarPreviews.keys().next().value);task.catch(()=>avatarPreviews.delete(source));}
        task.then(value=>{if(img.isConnected)img.src=value;}).catch(()=>{if(img.isConnected)img.dispatchEvent(new Event('error'));});
    }
    function avatar(value,label,appearance){const frame=document.createElement('span');frame.className='podium-avatar';const safe=typeof value==='string'&&(/^(https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(value));if(safe){const img=document.createElement('img');preview(img,value);img.alt=String(label||'ユーザー')+'のアイコン';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();frame.prepend(document.createTextNode(String(label||'人').trim().slice(0,1)));};frame.append(img);}else{frame.textContent=String(label||'人').trim().slice(0,1);}return frame;}
    window.RankingVisuals={name,avatar,appearanceOf:doc=>appearanceOf(doc)};
    let rankMode='learning';
    const labels={rating:'対戦レート',time:'合計勉強時間',words:'理解度を付けた単語数',flash:'フラッシュのスワイプ数'};
    const hasRecord=(entry,key)=>key==='rating'||entry[key]>0;
    const duration=seconds=>{seconds=nonnegative(seconds);const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?h+'時間'+m+'分':m?m+'分'+s+'秒':s+'秒';};
    const value=(row,key)=>row[key]===undefined||row[key]===null?'未取得':key==='rating'?String(row.rating??1500):key==='time'?duration(row.time):nonnegative(row[key]).toLocaleString('ja-JP')+(key==='words'?'語':'回');
    function statsOf(doc){return window.StudyTimeModel.readStats(doc);}
    function appearanceOf(doc){let profile;try{profile=JSON.parse(doc.profileCustomizationJson||'{}');}catch{profile={};}const value={nameColor:/^#[0-9a-f]{6}$/i.test(profile.nameColor||'')?profile.nameColor:'',frame:typeof profile.frame==='string'?profile.frame:''};return value.nameColor||value.frame?JSON.stringify(value):null;}
    function row(id,doc,group){const brief=window.RankingQuery.summary(doc),learning=group!=='battle',stats=learning&&!brief?statsOf(doc):{},combined=learning&&!brief?fromProfile(doc):null;return {id,name:doc.playerName||doc.name||id,avatar:typeof doc.avatar==='string'&&doc.avatar.length<=48000?doc.avatar:'',appearance:appearanceOf(doc),rating:group==='learning'?null:window.WordDuelModel?.rating(doc.wordDuelRating)??1500,time:brief?.time??(learning?window.StudyTimeModel.rankingSeconds(stats,'total',Date.now()):null),words:learning?(brief?.words??wordCount(combined)):null,flash:learning?(brief?.flash??flashCount(combined)):null};}

    function self(){window.syncRankingMetrics();return row(user,{playerName:myName,avatar:localStorage.getItem('core_v4_user_avatar_'+user)||'',userStats,profileCustomizationJson:localStorage.getItem('core_v4_profile_customization_'+user),learningRankingV2Json:JSON.stringify(record),wordDuelRating:window.WordDuel?.localRating()});}
    function deadline(promise,ms=15000){let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('通信が完了しませんでした')),ms))]).finally(()=>clearTimeout(timer));}
    async function detail(entry,rank,context){
        const account=owner(),dialog=showDetail(entry,rank,context);
        try{if(window.db&&window.fbGetDoc){const snap=await deadline(window.fbGetDoc(window.fbDoc(window.db,'users',entry.id)),5000);if(owner()!==account||!dialog.isConnected)return;if(snap.exists()){const latest=row(entry.id,snap.data());showDetail(entry.id===account?self():latest,rank,context,dialog);}}}catch(error){console.warn('詳細は取得済みの記録を表示しています',error);}
        return dialog;
    }
    function showDetail(entry,rank,context,existing){
        const detailKey=Object.keys(labels).find(key=>labels[key]===context)||'time';
        const dialog=existing||window.openLibraryDialog('学習記録','<div class="ranking-detail"><div class="ranking-detail-person"></div><p class="ranking-detail-place"></p><dl></dl></div><div class="library-editor-actions"><button type="button" data-library-close>閉じる</button></div>');
        dialog.querySelector('.library-editor-eyebrow').textContent='LEARNING RECORDS';
        const person=dialog.querySelector('.ranking-detail-person'),heading=document.createElement('h3');person.replaceChildren();dialog.querySelector('dl').replaceChildren();name(heading,entry.name,entry.appearance);person.append(window.RankingVisuals.avatar(entry.avatar,entry.name,entry.appearance),heading);dialog.querySelector('.ranking-detail-place').textContent=(context||labels[detailKey])+' · '+(rank?rank+'位':hasRecord(entry,detailKey)?'順位未取得':'未計測');
        Object.keys(labels).forEach(key=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=labels[key];dd.textContent=value(entry,key);dialog.querySelector('dl').append(dt,dd);});return dialog;
    }
    window.RankingVisuals.detailStudy=function(entry,rank){const known=row(entry.id,{playerName:entry.name,avatar:entry.avatar,userStats:entry.getStats?entry.getStats():{},profileCustomizationJson:entry.appearance});showDetail(known,rank,'今日の勉強時間');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='今日の勉強時間';dd.textContent=duration(entry.seconds);const dl=document.querySelector('.ranking-detail dl');dl.prepend(dt,dd);};
    const podiumShapes=new WeakMap();
    function sameShape(left,right){return !!left&&left.length===right.length&&left.every((row,i)=>row.length===right[i].length&&row.every((value,j)=>value===right[i][j]));}
    function render(){
        const host=document.getElementById('rankingPodium');if(!host)return;ensure();const local=self(),rows=cache.filter(entry=>entry.id!==user);if(user!=='GUEST-000')rows.push(local);
        const metrics=rankMode==='learning'?['time','words','flash']:['rating'];
        host.querySelectorAll('[data-podium-metric]').forEach(section=>{if(!metrics.includes(section.dataset.podiumMetric))section.remove();});
        host.classList.toggle('is-battle-mode',rankMode==='battle');
        metrics.forEach(key=>{
            let section=host.querySelector('[data-podium-metric="'+key+'"]');
            if(!section){section=document.createElement('section');section.className='ranking-mini-panel';section.dataset.podiumMetric=key;const heading=document.createElement('h3');heading.textContent=labels[key];const podium=document.createElement('div');podium.className='learning-podium';const own=document.createElement('button');own.type='button';own.className='ranking-mini-self';section.append(heading,podium,own);host.append(section);}
            const measured=rows.filter(entry=>hasRecord(entry,key)).sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id)),top=cacheReady?measured.slice(0,3):[],podium=section.querySelector('.learning-podium');
            const shape=[[user],...top.map(entry=>[entry.id,entry.name,entry.avatar,entry.appearance])];
            if(!sameShape(podiumShapes.get(section),shape)){
                const mounted=podiumShapes.has(section);podiumShapes.set(section,shape);podium.replaceChildren();
                [1,0,2].forEach(index=>{const entry=top[index],place=index+1,column=document.createElement(entry?'button':'div');column.dataset.place=String(place);column.className='learning-podium-place place-'+place+(entry&&entry.id===user?' is-self':'')+(!entry?' is-empty':'')+(mounted?' podium-mounted':'');
                    if(entry){column.type='button';column.append(window.RankingVisuals.avatar(entry.avatar,entry.name,entry.appearance));const nickname=document.createElement('span');nickname.className='podium-name';name(nickname,entry.name,entry.appearance);const amount=document.createElement('strong');column.append(nickname,amount);}else{const blank=document.createElement('span');blank.className='podium-empty-label';blank.textContent='—';column.append(blank);column.setAttribute('aria-label',place+'位 未計測');}
                    const step=document.createElement('span');step.className='podium-step';step.textContent=String(place);column.append(step);podium.append(column);
                });
            }
            top.forEach((entry,index)=>{const column=podium.querySelector('[data-place="'+(index+1)+'"]'),amount=column.querySelector('strong'),text=value(entry,key);if(amount.textContent!==text)amount.textContent=text;column.setAttribute('aria-label',labels[key]+' '+(index+1)+'位 '+entry.name+'の詳細');column.onclick=()=>detail(entry,index+1,labels[key]);});
            const ownRank=cacheReady?measured.findIndex(entry=>entry.id===user)+1:0,own=section.querySelector('.ranking-mini-self'),text=(user==='GUEST-000'?'あなた（ゲスト）':'あなた · '+(ownRank?ownRank+'位':hasRecord(local,key)?'順位未取得':'未計測'))+'　'+value(local,key);if(own.textContent!==text)own.textContent=text;own.onclick=()=>detail(local,ownRank,labels[key]);
        });
        renderRatingList(host,rows);
    }
    function renderRatingList(host,rows){
        let list=host.querySelector('.rating-roster');const ranked=rows.slice().sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id)),rest=cacheReady&&rankMode==='battle'?ranked.slice(3):[];
        if(!rest.length){list?.remove();return;}
        if(!list){list=document.createElement('details');list.className='rating-roster';const summary=document.createElement('summary');summary.textContent='4位以下のレート';list.append(summary,document.createElement('ol'));host.querySelector('.ranking-mini-panel').append(list);}
        const shape=JSON.stringify(rest.map(entry=>[entry.id,entry.name,entry.rating,entry.appearance]));if(list.dataset.shape===shape)return;list.dataset.shape=shape;const ol=list.querySelector('ol');ol.replaceChildren();
        rest.forEach((entry,index)=>{const li=document.createElement('li'),button=document.createElement('button'),place=document.createElement('span'),nickname=document.createElement('span'),rate=document.createElement('strong');button.type='button';button.className=entry.id===user?'is-self':'';place.textContent=(index+4)+'位';name(nickname,entry.name,entry.appearance);rate.textContent=String(entry.rating);button.append(place,nickname,rate);button.onclick=()=>detail(entry,index+4,labels.rating);li.append(button);ol.append(li);});
    }
    function selectCache(){const saved=groupCaches.get(rankMode);cache=saved?.rows||[];cacheAt=saved?.at||0;cacheReady=!!saved;}
    async function refresh(force,foreground=false){
        ensure();selectCache();const message=document.getElementById('rankingMessage');
        if(user==='GUEST-000'){render();message.textContent='ログインすると表彰台に参加できます。';return;}
        if(!force&&cacheReady&&Date.now()-cacheAt<300000){message.textContent='';render();return;}
        if(inflight&&inflight.id===user&&inflight.group===rankMode&&!inflight.controller.signal.aborted)return inflight.promise;
        inflight?.controller.abort();
        const id=user,group=rankMode,token=++generation,controller=new AbortController(),button=document.getElementById('rankingRefresh');button.disabled=true;message.textContent='記録を取得中…';
        let loading=false;const endLoading=()=>{if(loading){loading=false;window.hidePenguinLoading?.();}};
        const active=()=>!controller.signal.aborted&&owner()===id&&generation===token&&rankMode===group;
        const leave=()=>{if(currentActiveTabId!=='titles'){controller.abort();endLoading();}};
        if((!cacheReady||foreground)&&currentActiveTabId==='titles'&&window.showPenguinLoading){loading=true;window.showPenguinLoading('ランキングを読み込んでいます');}
        window.onTabChange(leave);
        const timeout=setTimeout(()=>controller.abort('timeout'),15000);
        const task=Promise.resolve().then(async()=>{try{
            const docs=await window.RankingQuery.fetch(group,{signal:controller.signal});
            const list=docs.filter(doc=>doc.id!==id).map(doc=>row(doc.id,doc.data,group));
            const metrics=group==='learning'?['time','words','flash']:['rating'],retained=new Set(metrics.flatMap(key=>list.filter(entry=>hasRecord(entry,key)).sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id)).slice(0,3)));for(const entry of list)if(!retained.has(entry))entry.avatar='';
            if(active()){groupCaches.set(group,{rows:list,at:Date.now()});selectCache();message.textContent='';render();}
        }catch(error){if(owner()===id&&generation===token&&rankMode===group&&currentActiveTabId==='titles'){message.textContent=controller.signal.reason==='timeout'?'通信に時間がかかっています。更新で再試行できます。':controller.signal.aborted?'':'記録を取得できませんでした。更新で再試行できます。';render();}}
        finally{clearTimeout(timeout);endLoading();const index=window.__tabChangeHandlers?.indexOf(leave);if(index>=0)window.__tabChangeHandlers.splice(index,1);if(generation===token)button.disabled=false;if(inflight?.token===token)inflight=null;}});
        inflight={id,group,token,controller,promise:task};return task;
    }
    // Compatibility names keep old save files readable; title behavior is retired.
    ['renderTitles','renderSeasonTitles','equipTitle','unequipTitle','checkAndRewardTitleBonusXP','updateTitleProgressUI'].forEach(key=>{window[key]=function(){};});
    window.showTitlesPage=function(){window.switchTab('titles');};
    window.injectCommunityRankingUI=function(){};window.renderCommunityRankPills=function(){};window.renderCommunityRankSubPills=function(){};
    window.renderLeaderboard=function(force){render();if(typeof currentActiveTabId!=='undefined'&&currentActiveTabId==='titles')return refresh(!!force);};
    document.querySelectorAll('[data-rank-mode]').forEach(button=>button.onclick=()=>{inflight?.controller.abort();rankMode=button.dataset.rankMode;selectCache();document.querySelectorAll('[data-rank-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rankMode===rankMode)));render();refresh(false);});
    document.getElementById('rankingRefresh').onclick=()=>refresh(true,true);
    window.onTabChange(tab=>{if(tab==='titles'){render();refresh(false);}else if(tab==='vocab'){ensure();scanCurrent();persist();}});
    window.onAppLoaded(()=>{ensure();window.syncRankingMetrics();render();});
    window.addEventListener('storage',event=>{if(event.key===storageKey(owner())){ensure();record=merge(record,read(user));persist();render();}});
    setInterval(()=>{if(document.visibilityState==='visible'&&typeof currentActiveTabId!=='undefined'&&currentActiveTabId==='titles'&&!window.IdleSleep?.isSleeping())refresh(false);},300000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&typeof currentActiveTabId!=='undefined'&&currentActiveTabId==='titles')refresh(false);});
    window.LearningRanking={render,refresh,sync:syncCloud,snapshot:()=>{window.syncRankingMetrics();return JSON.parse(JSON.stringify(record));}};
})();
