const test=require('node:test'),assert=require('node:assert/strict'),m=require('../word-duel-model.js');
const words=m.pool(Array.from({length:20},(_,i)=>({word:'word'+i,meaning:'意味'+i})));
test('ten options are deterministic, unique and sometimes omit the answer',()=>{let absent=0;for(let i=0;i<100;i++){const q=m.question(words,123,i);assert.deepEqual(q,m.question(words,123,i));assert.equal(q.options.length,10);assert.equal(new Set(q.options).size,10);if(q.correct===9)absent++;}assert.ok(absent>0&&absent<100);});
test('combo is additive 10 percent and resets after a minus-50 miss',()=>{const right=i=>m.question(words,1,i).correct;const log=[{choice:right(0),at:0},{choice:right(1),at:100},{choice:right(2),at:200},{choice:(right(3)+1)%10,at:300},{choice:right(4),at:3400}];assert.deepEqual(m.score(words,1,log),{total:380,combo:1});assert.throws(()=>m.score(words,1,[{choice:0,at:60000}]));assert.throws(()=>m.score(words,1,[{choice:11,at:0}]));});
test('2, 3 and 4 players receive score-based places without rating deltas',()=>{for(const count of [2,3,4]){const players={};for(let i=0;i<count;i++)players['p'+i]={answers:Array.from({length:count-i},(_,j)=>({choice:m.question(words,1,j).correct,at:j*100})),abandoned:false};const result=m.placements({players,pool:words,seed:1,duration:60000});assert.equal(result.some(entry=>Object.hasOwn(entry,"delta")),false);assert.deepEqual(result.map(entry=>entry.place),Array.from({length:count},(_,i)=>i+1));}});
test('ties share a place and abandonment always ranks below active players',()=>{const room={pool:words,seed:1,duration:60000,players:{a:{answers:[]},b:{answers:[]},c:{answers:[{choice:(m.question(words,1,0).correct+1)%10,at:0}]}}};assert.deepEqual(m.placements(room).map(entry=>entry.place),[1,1,3]);room.players.a.abandoned=true;assert.equal(m.placements(room).at(-1).id,'a');for(const player of Object.values(room.players))player.abandoned=true;assert.equal(m.placements(room),null);});
test('all selectable durations bound answers at the chosen finish time',()=>{for(const limit of m.durations){assert.doesNotThrow(()=>m.score(words,1,[{choice:0,at:limit-1}],limit));assert.throws(()=>m.score(words,1,[{choice:0,at:limit}],limit));}assert.throws(()=>m.score(words,1,[],45001));assert.equal(m.rating,undefined);});
test('malformed and incompatible room snapshots are rejected before they reach the UI',()=>{const room={version:7,matchType:'casual',missPenalty:50,duration:60000,capacity:2,book:'test-book',status:'playing',host:'a',guest:'b',pool:words.map((word,i)=>({...word,ref:{num:String(i),mid:i+'-0',sig:i+'::'+word.prompt+'::'+word.meaning,count:1}})),seed:1,players:{a:{answers:[]},b:{answers:[]}}};assert.equal(m.validRoom(room),true);assert.equal(m.validRoom({...room,version:1}),false);assert.equal(m.validRoom({...room,version:4}),false);assert.equal(m.validRoom({...room,version:5}),false);assert.equal(m.validRoom({...room,missPenalty:-1}),false);assert.equal(m.validRoom({...room,missPenalty:undefined}),false);assert.equal(m.validRoom({...room,pool:[]}),false);assert.equal(m.validRoom({...room,players:{a:{answers:[{choice:11,at:0}]},b:{answers:[]}}}),false);assert.equal(m.validRoom({...room,status:'finished'}),false);});
test('prompts cover every word before repeating and distractors rotate instead of repeating a subset',()=>{const full=m.pool(Array.from({length:120},(_,i)=>({word:'word'+i,meaning:'意味'+i})));const questions=full.map((_,i)=>m.question(full,5566,i));assert.equal(new Set(questions.map(q=>q.prompt)).size,120);const options=questions.slice(0,12).flatMap(q=>q.options.slice(0,9));assert.ok(new Set(options).size>90);for(let i=1;i<12;i++){const previous=new Set(questions[i-1].options.slice(0,9));assert.ok(questions[i].options.slice(0,9).filter(text=>previous.has(text)).length<=3);}});
test('sampling includes the entire book, stays bounded and is deterministic for each match',()=>{const source=Array.from({length:3000},(_,i)=>({word:'word'+i,meaning:'意味'+i})),pool=m.pool(source,42);assert.equal(pool.length,120);assert.deepEqual(pool,m.pool(source,42));assert.ok(pool.some(item=>Number(item.prompt.slice(4))>2000));assert.equal(new Set(pool.map(item=>item.meaning)).size,120);});
test('the correct meaning is available when none of the nine choices is correct',()=>{let q;for(let i=0;i<100;i++){q=m.question(words,123,i);if(q.correct===9)break;}assert.equal(q.correct,9);assert.equal(q.options.slice(0,9).includes(q.meaning),false);assert.ok(q.meaning.startsWith('意味'));});

test('stable word references survive sampling and shuffled questions',()=>{const source=Array.from({length:300},(_,i)=>({word:'w'+i,meaning:'m'+i,duelRef:{num:String(i),mid:i+'-0',sig:'sig'+i,count:2}})),pool=m.pool(source,42);for(let i=0;i<120;i++){const q=m.question(pool,42,i);assert.equal(q.ref.sig,'sig'+q.prompt.slice(1));assert.equal(q.ref.count,2);}});

test('over-capacity rooms, unsupported settings and partially populated playing rooms are rejected',()=>{const room={version:7,matchType:'casual',missPenalty:50,duration:30000,capacity:4,book:'book',host:'a',status:'waiting',seed:1,pool:words.map((word,i)=>({...word,ref:{num:String(i),mid:i+'-0',sig:'sig'+i,count:1}})),players:{a:{answers:[]}}};assert.equal(m.validRoom(room),true);assert.equal(m.validRoom({...room,status:'playing'}),false);assert.equal(m.validRoom({...room,capacity:5}),false);assert.equal(m.validRoom({...room,duration:0}),false);assert.equal(m.validRoom({...room,players:{a:{answers:[]},b:{answers:[]},c:{answers:[]},d:{answers:[]},e:{answers:[]}}}),false);});

test('a two-player tie shares first place',()=>{assert.deepEqual(m.placements({pool:words,seed:1,duration:30000,players:{a:{answers:[]},b:{answers:[]}}}).map(entry=>entry.place),[1,1]);});

test('every ten questions balance all answer positions and none-of-the-above never repeats consecutively',()=>{for(const seed of [0,1,42,123,5566,2147483647,-1,...Array.from({length:40},(_,i)=>i*99991)]){let previous=-1;for(let start=0;start<m.maxAnswers;start+=10){const counts=Array(10).fill(0);for(let i=start;i<start+10;i++){const q=m.question(words,seed,i);counts[q.correct]++;assert.ok(previous!==9||q.correct!==9,`seed ${seed}, question ${i}`);assert.equal(q.options[q.correct],q.correct===9?'選択肢の中にはない':q.meaning);previous=q.correct;}assert.deepEqual(counts,Array(10).fill(1));}}});

test('custom miss penalties apply to scoring, reset combos and reject malformed settings',()=>{const right=i=>m.question(words,1,i).correct,log=[{choice:right(0),at:0},{choice:(right(1)+1)%10,at:10},{choice:right(2),at:3010}];for(const penalty of [0,25,50,100,1000]){assert.deepEqual(m.score(words,1,log,60000,penalty),{total:200-penalty,combo:1});const room={pool:words,seed:1,duration:60000,missPenalty:penalty,players:{a:{answers:log},b:{answers:[]}}};assert.equal(m.placements(room).find(entry=>entry.id==='a').score,230-penalty);}for(const penalty of [-1,1001,1.5,NaN,'50',null])assert.throws(()=>m.score(words,1,[],60000,penalty));});

test('answer bonus is ten per submitted answer and cannot bypass the three-second miss lock',()=>{const right=i=>m.question(words,1,i).correct,log=[{choice:(right(0)+1)%10,at:0}];assert.deepEqual(m.finalScore(words,1,log,180000,200),{base:-200,bonus:10,answered:1,total:-190});assert.throws(()=>m.score(words,1,[...log,{choice:right(1),at:2999}],180000,200));assert.equal(m.score(words,1,[...log,{choice:right(1),at:3000}],180000,200).total,-100);});

test('retired ranked rooms are rejected and casual rooms retain custom rules',()=>{const room={version:7,matchType:'ranked',duration:180000,missPenalty:200,capacity:2,book:'book',host:'a',status:'waiting',seed:1,pool:words.map((word,i)=>({...word,ref:{num:String(i),mid:i+'-0',sig:'sig'+i,count:1}})),players:{a:{answers:[]}}};assert.equal(m.validRoom(room),false);assert.equal(m.validRoom({...room,matchType:'casual',duration:60000}),true);assert.equal(m.validRoom({...room,missPenalty:50}),false);assert.equal(m.validRoom({...room,matchType:'other'}),false);assert.equal(m.validRoom({...room,version:6}),false);});

test('casual rules configure points, additive combo increments, bonus and five-second duration steps',()=>{
 const rules={...m.defaultRules,points:200,combo:1.25,answerBonus:7},answers=[0,1].map(i=>({at:i*200,choice:m.question(words,44,i).correct}));
 assert.deepEqual(m.finalScore(words,44,answers,45000,100,rules),{base:650,bonus:14,answered:2,total:664});
 for(const time of [15000,45000,95000,600000])assert.equal(m.validDuration(time),true);
 for(const time of [0,10000,16000,605000,NaN])assert.equal(m.validDuration(time),false);
 assert.equal(m.validRules({...rules,combo:Infinity}),false);assert.equal(m.validRules({...rules,events:true,eventTypes:[]}),false);
});
test('all six events replay deterministically, including effects on every opponent',()=>{
 for(const type of m.eventTypes.slice(0,6)){const rules={...m.defaultRules,events:true,eventTypes:[type],eventSeconds:8,eventPoints:80},seed=7,right=i=>m.question(words,seed,i).correct;
 const miss=['reset','gift'].includes(type),room={pool:words,seed,duration:60000,missPenalty:100,rules,players:{a:{answers:[{choice:right(0),at:1000},{choice:miss?(right(1)+1)%10:right(1),at:16000}]},b:{answers:[]},c:{answers:[]}}};
 const scores=m.roomScores(room);assert.deepEqual(scores,m.roomScores(structuredClone(room)));
 assert.equal(scores.a.total,{double:420,triple:530,half:255,reset:0,attack:310,gift:100}[type]);
 assert.equal(scores.b.total,type==='attack'?-80:type==='gift'?80:0);assert.equal(scores.b.total,scores.c.total);
 assert.equal(m.eventAt(seed,14999,rules),null);assert.equal(m.eventAt(seed,15000,rules).type,type);assert.equal(m.eventAt(seed,23000,rules),null);
 assert.equal(m.roomScores(room,true).a.total,scores.a.total+20);
 }
});
test('cross-player event ordering is independent of object insertion order and validated before settlement',()=>{
 const rules={...m.defaultRules,events:true,eventTypes:['reset','attack','gift']},room={pool:words,seed:2,duration:60000,missPenalty:100,rules,players:{b:{answers:[{choice:0,at:16000}]},a:{answers:[{choice:1,at:16000}]}}};
 assert.deepEqual(m.roomScores(room),m.roomScores({...room,players:{a:room.players.a,b:room.players.b}}));
 assert.throws(()=>m.roomScores({...room,players:{...room.players,a:{answers:[{choice:11,at:0}]}}}));
});
test('weak sampling favors error history without excluding mastered meanings',()=>{
 const candidates=Array.from({length:500},(_,i)=>({word:'w'+i,meaning:'m'+i,duelStatus:i<50?'bad':'ok',duelHistory:i<50?['bad','bad']:['ok']}));
 let weak=0,uniform=0,mastered=0;for(let seed=1;seed<=30;seed++){const a=m.selectPool(candidates,seed,true),b=m.selectPool(candidates,seed);weak+=a.filter(x=>Number(x.prompt.slice(1))<50).length;uniform+=b.filter(x=>Number(x.prompt.slice(1))<50).length;mastered+=a.filter(x=>Number(x.prompt.slice(1))>=50).length;assert.deepEqual(a,m.selectPool(candidates,seed,true));}assert.ok(weak>uniform*2);assert.ok(mastered>0);
});
test('version eight rooms carry bounded books and rules and reject invalid cross-book references',()=>{
 const room={version:8,matchType:'casual',duration:45000,missPenalty:100,rules:{...m.defaultRules},books:['one','two'],book:'one',host:'a',status:'waiting',seed:1,capacity:2,pool:words.map((word,i)=>({...word,ref:{book:i%2?'one':'two',num:String(i),mid:i+'-0',sig:'sig'+i,count:1}})),players:{a:{answers:[]}}};
 assert.equal(m.validRoom(room),true);assert.equal(m.validRoom({...room,rules:{...room.rules,points:-1}}),false);assert.equal(m.validRoom({...room,books:['one']}),false);assert.equal(m.validRoom({...room,matchType:'ranked'}),false);
});
test('multi-book pools avoid several correct meanings of the same prompt in the choices',()=>{const candidates=[{word:'follow',meaning:'続く'},{word:'Follow',meaning:'従う'},...Array.from({length:12},(_,i)=>({word:'w'+i,meaning:'m'+i}))];for(const selected of [m.pool(candidates),m.selectPool(candidates,1),m.selectPool(candidates,1,true)])assert.equal(selected.filter(w=>w.prompt.toLowerCase()==='follow').length,1);});
test('seeing that the meaning is missing from the choices scores double, before event multipliers',()=>{
 const seed=7,right=i=>m.question(words,seed,i).correct;assert.equal(right(0),9);assert.notEqual(right(1),9);
 assert.equal(m.score(words,seed,[{choice:9,at:0}]).total,200);
 assert.equal(m.score(words,seed,[{choice:(right(0)+1)%10,at:0}]).total,-50);
 assert.equal(m.score(words,seed,[{choice:9,at:0},{choice:right(1),at:100}]).total,200+110);
 const rules={...m.defaultRules,events:true,eventTypes:['double'],eventSeconds:8,eventPoints:80};
 assert.equal(m.score(words,seed,[{choice:9,at:15000}],60000,50,rules).total,400);
});
test('「わからない」 has no penalty, breaks the combo, keeps the wait, earns no answer bonus and needs a version 10 room',()=>{
 const seed=1,right=i=>m.question(words,seed,i).correct,rules={...m.defaultRules};
 const log=[{choice:right(0),at:0},{choice:right(1),at:100},{choice:m.pass,at:200},{choice:right(3),at:3200}];
 // 100 + 110, pass (no penalty, combo back to 0), then 100 again (doubled if it was a none-of-the-above question).
 const third=right(3)===9?200:100;
 assert.deepEqual(m.score(words,seed,log,60000,500),{total:210+third,combo:1});
 assert.throws(()=>m.score(words,seed,[{choice:m.pass,at:0},{choice:right(1),at:2999}]));
 assert.deepEqual(m.finalScore(words,seed,log,60000,500,rules),{base:210+third,bonus:30,answered:3,total:240+third});
 // No miss effects during events, even ones that punish mistakes.
 for(const type of ['reset','gift','collective','pressure','careful']){const room={version:10,pool:words,seed,duration:60000,missPenalty:100,rules:{...m.defaultRules,events:true,eventTypes:[type]},players:{a:{answers:[{choice:right(0),at:1000},{choice:m.pass,at:16000}]},b:{answers:[]}}};const s=m.roomScores(room);assert.equal(s.a.total,right(0)===9?200:100,type);assert.equal(s.a.combo,0);assert.equal(s.b.total,0,type);}
 // Older rooms are played by older apps that do not know the choice.
 const room={version:9,pool:words,seed,duration:60000,missPenalty:50,players:{a:{answers:[{choice:m.pass,at:0}]}}};
 assert.throws(()=>m.roomScores(room));assert.doesNotThrow(()=>m.roomScores({...room,version:10}));
});
test('event interval: 30 seconds for new rooms, 15 for rooms without the setting, and version 11 when it differs',()=>{
 const rules={...m.newRules,events:true,eventTypes:['double']};
 assert.equal(m.newRules.eventEvery,30);assert.equal(m.validRules(rules),true);assert.equal(m.validRules({...rules,eventEvery:20}),false);
 assert.equal(m.eventAt(1,15000,rules),null);assert.equal(m.eventAt(1,30000,rules).type,'double');assert.equal(m.eventAt(1,45000,rules),null);
 assert.equal(m.eventAt(1,15000,{...rules,eventEvery:undefined}).type,'double');
 assert.equal(m.eventPreview(1,27500,rules).start,30000);assert.equal(m.eventPreview(1,12500,rules),null);
 assert.equal(m.versionFor(words,rules),11);assert.equal(m.versionFor(words,{...rules,eventEvery:15}),10);assert.equal(m.versionFor(words,m.defaultRules),10);
 const room={version:10,matchType:'casual',duration:60000,missPenalty:100,rules,books:['b'],book:'b',host:'a',status:'waiting',seed:1,capacity:2,pool:words.map((word,i)=>({...word,ref:{book:'b',num:String(i),mid:i+'-0',sig:'sig'+i,count:1}})),players:{a:{answers:[]}}};
 assert.equal(m.validRoom(room),false);assert.equal(m.validRoom({...room,version:11}),true);
 // Scoring uses the interval: a right answer at 16 s is doubled only with 15-second events.
 const right=m.question(words,1,0).correct,log=[{choice:right,at:31000}];
 assert.equal(m.score(words,1,log,60000,50,rules).total,(right===9?2:1)*200);
 assert.equal(m.score(words,1,[{choice:right,at:16000}],60000,50,rules).total,(right===9?2:1)*100);
});
