// Pure dated activity and wallet models. Existing understanding records are never used as actions.
(function(root){
'use strict';
const DAY=86400000,ZONE=9*3600000,prizes=[10000,5000,1000];
const number=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
function decode(value){try{value=typeof value==='string'?JSON.parse(value):value;return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
const dateKey=time=>new Date(time+ZONE).toISOString().slice(0,10);
function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
function shiftDay(day,count){if(!validDay(day))throw Error('日付が正しくありません。');return new Date(Date.parse(day+'T00:00:00Z')+count*DAY).toISOString().slice(0,10);}
function weekStart(time){const day=dateKey(time),weekday=new Date(day+'T00:00:00Z').getUTCDay();return shiftDay(day,-((weekday+6)%7));}
function activity(){return {version:1,days:{}};}
function mergeActivity(left,right){const result=activity();for(const raw of [left,right]){const record=decode(raw);if(record.version!==1)continue;for(const [day,value] of Object.entries(decode(record.days))){if(!validDay(day))continue;const target=result.days[day]||(result.days[day]={ratings:{},swipes:{}});for(const kind of ['ratings','swipes'])for(const [source,count] of Object.entries(decode(value?.[kind])))if(source&&!['__proto__','constructor','prototype'].includes(source))target[kind][source]=Math.max(number(target[kind][source]),number(count));}}return result;}
function count(record,kind,start,end=start){if(!['ratings','swipes'].includes(kind))return 0;return Object.entries(mergeActivity(record).days).reduce((sum,[date,day])=>sum+(date>=start&&date<=end?Object.values(day[kind]).reduce((n,v)=>n+v,0):0),0);}
function add(record,kind,source,time){if(!['ratings','swipes'].includes(kind)||!source||['__proto__','constructor','prototype'].includes(source))throw Error('記録が正しくありません。');const next=mergeActivity(record),day=dateKey(time),entry=next.days[day]||(next.days[day]={ratings:{},swipes:{}});entry[kind][source]=number(entry[kind][source])+1;return next;}
function wallet(base=0,createdDay=dateKey(Date.now())){return {version:1,base:number(base),createdDay,credits:{},debits:{},equipped:{id:'',at:0}};}
function validWallet(raw){const value=decode(raw);return value.version===1&&Number.isSafeInteger(value.base)&&value.base>=0&&validDay(value.createdDay)&&value.credits&&typeof value.credits==='object'&&!Array.isArray(value.credits)&&value.debits&&typeof value.debits==='object'&&!Array.isArray(value.debits);}
function mergeWallet(left,right){const values=[left,right].map(decode).filter(v=>v.version===1),result=wallet();if(!values.length)return result;result.base=Math.max(...values.map(v=>number(v.base)));result.createdDay=values.map(v=>v.createdDay).filter(validDay).sort()[0]||result.createdDay;for(const value of values){for(const field of ['credits','debits'])for(const [id,amount] of Object.entries(decode(value[field])))if(!['__proto__','constructor','prototype'].includes(id))result[field][id]=Math.max(number(result[field][id]),number(amount));if(number(value.equipped?.at)>result.equipped.at)result.equipped={id:String(value.equipped.id||''),at:number(value.equipped.at)};}return result;}
const balance=record=>{const w=mergeWallet(record);return Math.max(0,w.base+Object.values(w.credits).reduce((n,v)=>n+v,0)-Object.values(w.debits).reduce((n,v)=>n+v,0));};
function price(index){if(!Number.isInteger(index)||index<0||index>9)throw Error('フレームが正しくありません。');return 100*5**index;}
const owned=(record,id)=>Object.hasOwn(mergeWallet(record).debits,'frame:'+id);
function purchase(record,id,catalog,time){const next=mergeWallet(record),index=catalog.findIndex(frame=>frame.id===id);if(index<0)throw Error('フレームが見つかりません。');if(owned(next,id))return next;if(index>0&&!owned(next,catalog[index-1].id))throw Error('ひとつ前のフレームを購入してください。');const cost=price(index);if(balance(next)<cost)throw Error('コインが足りません。');next.debits['frame:'+id]=cost;next.equipped={id,at:Math.max(time,next.equipped.at+1)};return next;}
function equip(record,id,time){const next=mergeWallet(record);if(id&&!owned(next,id))throw Error('未購入のフレームです。');next.equipped={id,at:Math.max(time,next.equipped.at+1)};return next;}
function claim(record,id,amount){if(typeof id!=='string'||!id||['__proto__','constructor','prototype'].includes(id)||!number(amount))throw Error('郵便が正しくありません。');const next=mergeWallet(record);next.credits[id]=Math.max(number(next.credits[id]),number(amount));return next;}
function dailyMail(day,ms,ratings){const minutes=Math.floor(number(Math.floor(ms))/60000),answers=number(ratings);return {id:'daily:'+day,kind:'daily',day,minutes,ratings:answers,amount:minutes*10+answers};}
function podium(rows,metric){return rows.filter(row=>row.id&&row.id!=='GUEST-000'&&!row.deleted&&number(row[metric])>0).sort((a,b)=>number(b[metric])-number(a[metric])||a.id.localeCompare(b.id)).slice(0,3);}
function weeklyMail(start,rows,owner){return ['time','words','flash'].flatMap(metric=>{const place=podium(rows,metric).findIndex(row=>row.id===owner);return place<0?[]:[{id:'weekly:'+start+':'+metric,kind:'weekly',week:start,metric,place:place+1,amount:prizes[place]}];});}
const model={DAY,dateKey,validDay,shiftDay,weekStart,activity,mergeActivity,count,add,wallet,validWallet,mergeWallet,balance,price,owned,purchase,equip,claim,dailyMail,podium,weeklyMail};
root.LearningRewardsModel=model;
if(typeof module!=='undefined'&&module.exports)module.exports=model;
})(typeof window==='undefined'?globalThis:window);
