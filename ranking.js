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
    const queues=new Map();
    function read(id){try{return JSON.parse(localStorage.getItem(storageKey(id))||'null');}catch(e){return null;}}
    function store(key,value){try{if(localStorage.getItem(key)!==value)localStorage.setItem(key,value);}catch(error){console.warn('ランキング記録を端末へ保存できませんでした',error);}}
    function persist(){if(owner()!==user)return;store(storageKey(user),JSON.stringify(record));userStats.learning_ranking_v2_json=JSON.stringify(record);delete userStats.learning_ranking;userStats.learning_ranking_owner=user;userStats.vocab_rated_count=wordCount(record);userStats.flash_count=flashCount(record);}
    function ensure(){
        const id=owner();if(user===id)return;
        user=id;cache=[];cacheAt=0;cacheReady=false;generation++;
        const saved=read(id),remote=userStats.learning_ranking_owner&&userStats.learning_ranking_owner!==id?null:(userStats.learning_ranking_v2_json||userStats.learning_ranking);
        record=merge(saved,remote);
        readSwipeJournals();persist();
    }
    function scanCurrent(){} // Only explicit rating actions count in this generation.
    function readSwipeJournals(){const prefix='core_v4_ranking_swipes_v2_'+user+'_';for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix)){const id=key.slice(prefix.length);record.flash.sources[id]=Math.max(record.flash.sources[id]||0,nonnegative(localStorage.getItem(key)));}}}
    window.syncRankingMetrics=function(){ensure();record=merge(record,read(user));if(!userStats.learning_ranking_owner||userStats.learning_ranking_owner===user)record=merge(record,userStats.learning_ranking_v2_json||userStats.learning_ranking);readSwipeJournals();scanCurrent();persist();};
    window.recordRankedWord=function(book,num){if(!book)return;ensure();record=merge(record,read(user));record.words[wordKey(book,num)]=1;persist();scheduleSync();};
    window.recordRankedSwipe=function(){ensure();record=merge(record,read(user));record.flash.sources[sourceId]=nonnegative(record.flash.sources[sourceId])+1;store('core_v4_ranking_swipes_v2_'+user+'_'+sourceId,String(record.flash.sources[sourceId]));persist();scheduleSync();};
    let syncTimer=null;
    function scheduleSync(){if(!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;syncCloud();},2000);}
    async function syncCloud(){
        window.syncRankingMetrics();const id=user;
        if(id==='GUEST-000'||!window.fbRunTransaction||!window.db)return false;
        if(queues.has(id))return queues.get(id);
        const local=JSON.parse(JSON.stringify(record)),time=window.StudyTime.snapshot();
        const task=(async()=>{try{
            const combined=await window.fbRunTransaction(window.db,async transaction=>{
                const ref=window.fbDoc(window.db,'users',id),snap=await transaction.get(ref);
                const merged=merge(fromProfile(snap.exists()?snap.data():{}),local);
                const study=window.StudyTimeModel.mergeCurrent(window.StudyTimeModel.readStats(snap.exists()?snap.data():{}).study_calendar_v2,time);
                transaction.set(ref,{learningRankingV2Json:JSON.stringify(merged),studyLedgerJson:JSON.stringify(study)},{merge:true});return merged;
            });
            if(owner()===id&&user===id){record=merge(record,combined);persist();if(JSON.stringify(merge(record,local))!==JSON.stringify(merge(combined,local)))scheduleSync();}
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
                    const doc=snap.data(),stats=statsOf(doc);
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
    function name(element,value,appearance){let profile=appearance;if(typeof profile==='string'){try{profile=JSON.parse(profile);}catch{profile=null;}}element.style.color=/^#[0-9a-f]{6}$/i.test(profile?.nameColor||'')?profile.nameColor:'';element.replaceChildren();String(value||'ユーザー').trim().split(/\s+/u).forEach((part,index)=>{if(index)element.append(document.createElement('br'));element.append(document.createTextNode(part));});}
    const avatarPreviews=new Map();
    function preview(img,source){
        img.decoding='async';img.referrerPolicy='no-referrer';
        if(!source.startsWith('data:image/')||!window.ProfileImages){img.src=source;return;}
        let task=avatarPreviews.get(source);
        if(!task){task=fetch(source).then(response=>response.blob()).then(blob=>window.ProfileImages.imageFile(blob,64,'image/png'));avatarPreviews.set(source,task);if(avatarPreviews.size>12)avatarPreviews.delete(avatarPreviews.keys().next().value);task.catch(()=>avatarPreviews.delete(source));}
        task.then(value=>{if(img.isConnected)img.src=value;}).catch(()=>{if(img.isConnected)img.dispatchEvent(new Event('error'));});
    }
    function avatar(value,label,appearance){const frame=document.createElement('span');frame.className='podium-avatar';const safe=typeof value==='string'&&(/^(https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(value));if(safe){const img=document.createElement('img');preview(img,value);img.alt=String(label||'ユーザー')+'のアイコン';img.referrerPolicy='no-referrer';img.onerror=()=>{frame.textContent=String(label||'人').trim().slice(0,1);};frame.append(img);}else{frame.textContent=String(label||'人').trim().slice(0,1);}return frame;}
    window.RankingVisuals={name,avatar};
    const labels={time:'合計勉強時間',words:'理解度を付けた単語数',flash:'フラッシュのスワイプ数'};
    const duration=seconds=>{seconds=nonnegative(seconds);const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?h+'時間'+m+'分':m?m+'分'+s+'秒':s+'秒';};
    const value=(row,key)=>key==='time'?duration(row.time):nonnegative(row[key]).toLocaleString('ja-JP')+(key==='words'?'語':'回');
    function statsOf(doc){return window.StudyTimeModel.readStats(doc);}
    function appearanceOf(doc){let profile;try{profile=JSON.parse(doc.profileCustomizationJson||'{}');}catch{profile={};}const value={nameColor:/^#[0-9a-f]{6}$/i.test(profile.nameColor||'')?profile.nameColor:'',frame:typeof profile.frame==='string'?profile.frame:''};return value.nameColor||value.frame?JSON.stringify(value):null;}
    function row(id,doc){const stats=statsOf(doc),combined=fromProfile(doc),ledger=window.StudyTimeModel.resetLedger(stats.study_calendar_v2);return {id,name:doc.playerName||doc.name||id,avatar:doc.avatar||'',appearance:appearanceOf(doc),time:window.StudyTimeModel.rankingSeconds(stats,'total',Date.now()),words:wordCount(combined),flash:flashCount(combined)};}
    function self(){window.syncRankingMetrics();return row(user,{playerName:myName,avatar:localStorage.getItem('core_v4_user_avatar_'+user)||'',userStats,profileCustomizationJson:localStorage.getItem('core_v4_profile_customization_'+user),learningRankingV2Json:JSON.stringify(record)});}
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
        const person=dialog.querySelector('.ranking-detail-person'),heading=document.createElement('h3');person.replaceChildren();dialog.querySelector('dl').replaceChildren();name(heading,entry.name,entry.appearance);person.append(avatar(entry.avatar,entry.name,entry.appearance),heading);dialog.querySelector('.ranking-detail-place').textContent=(context||labels[detailKey])+' · '+(rank?rank+'位':entry[detailKey]>0?'順位未取得':'未計測');
        Object.keys(labels).forEach(key=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=labels[key];dd.textContent=value(entry,key);dialog.querySelector('dl').append(dt,dd);});return dialog;
    }
    window.RankingVisuals.detailStudy=function(entry,rank){const known=row(entry.id,{playerName:entry.name,avatar:entry.avatar,userStats:entry.getStats?entry.getStats():{}});showDetail(known,rank,'今日の勉強時間');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='今日の勉強時間';dd.textContent=duration(entry.seconds);const dl=document.querySelector('.ranking-detail dl');dl.prepend(dt,dd);};
    const podiumShapes=new WeakMap();
    function sameShape(left,right){return !!left&&left.length===right.length&&left.every((row,i)=>row.length===right[i].length&&row.every((value,j)=>value===right[i][j]));}
    function render(){
        const host=document.getElementById('rankingPodium');if(!host)return;ensure();const local=self(),rows=cache.filter(entry=>entry.id!==user);if(user!=='GUEST-000')rows.push(local);
        Object.keys(labels).forEach(key=>{
            let section=host.querySelector('[data-podium-metric="'+key+'"]');
            if(!section){section=document.createElement('section');section.className='ranking-mini-panel';section.dataset.podiumMetric=key;const heading=document.createElement('h3');heading.textContent=labels[key];const podium=document.createElement('div');podium.className='learning-podium';const own=document.createElement('button');own.type='button';own.className='ranking-mini-self';section.append(heading,podium,own);host.append(section);}
            const measured=rows.filter(entry=>entry[key]>0).sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id)),top=cacheReady?measured.slice(0,3):[],podium=section.querySelector('.learning-podium');
            const shape=[[user],...top.map(entry=>[entry.id,entry.name,entry.avatar,entry.appearance])];
            if(!sameShape(podiumShapes.get(section),shape)){
                const mounted=podiumShapes.has(section);podiumShapes.set(section,shape);podium.replaceChildren();
                [1,0,2].forEach(index=>{const entry=top[index],place=index+1,column=document.createElement(entry?'button':'div');column.dataset.place=String(place);column.className='learning-podium-place place-'+place+(entry&&entry.id===user?' is-self':'')+(!entry?' is-empty':'')+(mounted?' podium-mounted':'');
                    if(entry){column.type='button';column.append(avatar(entry.avatar,entry.name,entry.appearance));const nickname=document.createElement('span');nickname.className='podium-name';name(nickname,entry.name,entry.appearance);const amount=document.createElement('strong');column.append(nickname,amount);}else{const blank=document.createElement('span');blank.className='podium-empty-label';blank.textContent='—';column.append(blank);column.setAttribute('aria-label',place+'位 未計測');}
                    const step=document.createElement('span');step.className='podium-step';step.textContent=String(place);column.append(step);podium.append(column);
                });
            }
            top.forEach((entry,index)=>{const column=podium.querySelector('[data-place="'+(index+1)+'"]'),amount=column.querySelector('strong'),text=value(entry,key);if(amount.textContent!==text)amount.textContent=text;column.setAttribute('aria-label',labels[key]+' '+(index+1)+'位 '+entry.name+'の詳細');column.onclick=()=>detail(entry,index+1,labels[key]);});
            const ownRank=cacheReady?measured.findIndex(entry=>entry.id===user)+1:0,own=section.querySelector('.ranking-mini-self'),text=(user==='GUEST-000'?'あなた（ゲスト）':'あなた · '+(ownRank?ownRank+'位':local[key]>0?'順位未取得':'未計測'))+'　'+value(local,key);if(own.textContent!==text)own.textContent=text;own.onclick=()=>detail(local,ownRank,labels[key]);
        });
    }
    const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
    async function refresh(force,foreground=false){
        ensure();if(user==='GUEST-000'){render();document.getElementById('rankingMessage').textContent='ログインすると全ユーザーの表彰台に参加できます。';return;}
        if(!force&&cacheReady&&Date.now()-cacheAt<60000){render();return;}
        if(inflight&&inflight.id===user)return inflight.promise;
        const id=user,token=++generation,button=document.getElementById('rankingRefresh'),message=document.getElementById('rankingMessage');button.disabled=true;message.textContent='記録を取得中…';
        let cancelled=false,loading=false;
        const endLoading=()=>{if(loading){loading=false;window.hidePenguinLoading?.();}};
        const active=()=>!cancelled&&owner()===id&&generation===token;
        const leave=()=>{if(currentActiveTabId!=='titles')endLoading();};
        if((!cacheReady||foreground)&&currentActiveTabId==='titles'&&window.showPenguinLoading){loading=true;window.showPenguinLoading('ランキングを読み込んでいます');}
        window.onTabChange(leave);
        // Synchronization must not gate the independent leaderboard read.
        syncCloud().catch(error=>console.warn('ランキング同期は再試行します',error));
        const collect=async()=>{
            const list=[],tops={time:[],words:[],flash:[]};let cursor=null;
            const paged=!!(window.fbQuery&&window.fbOrderBy&&window.fbDocumentId&&window.fbLimit&&window.fbStartAfter);
            do{
                let ref=window.fbCollection(window.db,'users');
                if(paged){const parts=[window.fbOrderBy(window.fbDocumentId()),window.fbLimit(10)];if(cursor)parts.push(window.fbStartAfter(cursor));ref=window.fbQuery(ref,...parts);}
                const snapshot=await window.fbGetDocs(ref);if(!active())return list;
                const docs=snapshot.docs||[];if(!snapshot.docs)snapshot.forEach(doc=>docs.push(doc));
                for(let i=0;i<docs.length;i++){
                    if(!active())return list;
                    const doc=docs[i],source=doc.data();
                    if(!source.deleted&&doc.id!=='GUEST-000'&&doc.id!==id){try{
                        const entry=row(doc.id,source),previous=new Set(Object.values(tops).flat());list.push(entry);
                        Object.keys(tops).forEach(key=>{if(entry[key]>0){tops[key].push(entry);tops[key].sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id));tops[key]=tops[key].slice(0,3);}});
                        const retained=new Set(Object.values(tops).flat());if(!retained.has(entry))entry.avatar='';for(const old of previous)if(!retained.has(old))old.avatar='';
                    }catch(error){console.warn('ランキングの一部の記録を読み取れませんでした',error);}}
                    if(i%8===7)await yieldFrame();
                }
                cursor=docs[docs.length-1];if(!paged||docs.length<10)break;await yieldFrame();
            }while(active());return list;
        };
        const task=Promise.resolve().then(async()=>{try{
            if(!window.db||!window.fbGetDocs)throw Error('接続待ち');
            const list=await deadline(collect());if(active()){cache=list;cacheReady=true;cacheAt=Date.now();message.textContent='';render();}
        }catch(error){if(active()){message.textContent='記録を取得できませんでした。更新で再試行できます。';render();}}
        finally{cancelled=true;endLoading();const index=window.__tabChangeHandlers?.indexOf(leave);if(index>=0)window.__tabChangeHandlers.splice(index,1);if(generation===token)button.disabled=false;if(inflight?.token===token)inflight=null;}});
        inflight={id,token,promise:task};return task;
    }
    // Compatibility names keep old save files readable; title behavior is retired.
    ['renderTitles','renderSeasonTitles','equipTitle','unequipTitle','checkAndRewardTitleBonusXP','updateTitleProgressUI'].forEach(key=>{window[key]=function(){};});
    window.showTitlesPage=function(){window.switchTab('titles');};
    window.injectCommunityRankingUI=function(){};window.renderCommunityRankPills=function(){};window.renderCommunityRankSubPills=function(){};
    window.renderLeaderboard=function(force){render();if(typeof currentActiveTabId!=='undefined'&&currentActiveTabId==='titles')return refresh(!!force);};
    document.getElementById('rankingRefresh').onclick=()=>refresh(true,true);
    window.onTabChange(tab=>{if(tab==='titles'){render();refresh(false);}else if(tab==='vocab'){ensure();scanCurrent();persist();}});
    window.onAppLoaded(()=>{ensure();window.syncRankingMetrics();render();});
    window.addEventListener('storage',event=>{if(event.key===storageKey(owner())){ensure();record=merge(record,read(user));persist();render();}});
    setInterval(()=>{if(document.visibilityState==='visible'&&typeof currentActiveTabId!=='undefined'&&currentActiveTabId==='titles')refresh(true);},30000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&typeof currentActiveTabId!=='undefined'&&currentActiveTabId==='titles')refresh(true);});
    window.LearningRanking={render,refresh,sync:syncCloud,snapshot:()=>{window.syncRankingMetrics();return JSON.parse(JSON.stringify(record));}};
})();
