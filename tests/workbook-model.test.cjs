const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('workbook.js','utf8');
const ctx={window:{escapeVocabText:x=>x,showVocabLibrarySelection:()=>{}}};
vm.runInNewContext(source.slice(0,source.lastIndexOf('    ensureScreen(); window.renderVocabLibrarySelection();'))+'})();',ctx);
const model=ctx.window.WorkbookModel;
const now=new Date('2026-10-06T12:00:00').getTime();
const unit=()=>model.cleanUnit({num:12},12);
test('fixed interval follows actual completion, and no-review keeps history without dates',()=>{
 const u=unit(),work={review:{mode:'interval',days:5,date:''}};
 model.mark(work,u,'ok',now);assert.equal(u.nextReview,model.addDays(now,5));
 model.mark(work,u,'ok',now+3*86400000);assert.equal(u.nextReview,model.addDays(now,8));
 work.review={mode:'none'};model.mark(work,u,'bad',now);assert.equal(u.nextReview,0);assert.equal(u.history.at(-1),'bad');
});
test('curve expands on successful reviews and resets after failure',()=>{
 const u=unit(),work={review:{mode:'curve'}};
 model.mark(work,u,'ok',now);assert.equal(u.nextReview,model.addDays(now,1));
 model.mark(work,u,'ok',now+86400000);assert.equal(u.nextReview,model.addDays(now,4));
 model.mark(work,u,'bad',now+4*86400000);assert.equal(u.nextReview,model.addDays(now,5));assert.equal(u.step,0);
});
test('explicit dates work before first answer and clear on completion of a due review',()=>{
 const u=unit(),work={review:{mode:'date',date:'2026-10-06'}};
 model.schedule(work,u,now,false);assert.equal(model.isDue(u,now),true);
 model.mark(work,u,'ok',now);assert.equal(u.nextReview,0);
 u.review={mode:'none'};work.review={mode:'interval',days:2};model.mark(work,u,'bad',now);assert.equal(u.nextReview,0);
 assert.throws(()=>model.policy({mode:'interval',days:0}));assert.throws(()=>model.policy({mode:'date',date:'2026-02-30'}));
});
test('legacy migration preserves subquestions, notes, status and review dates',()=>{
 const work=model.migrate({id:'old',name:'数学',from:1,to:2,entries:{1:{q:'旧問題',ans:'答え',memo:'計算ミス',status:'bad',nextReview:123,lastReview:100,subs:{2:{q:'小問',status:'ok'}}}},nonums:[{id:'x',after:1,label:'例題',subs:[{sub:1,q:'追加小問'}]}]});
 assert.equal(work.unitKind,'problem');assert.equal(work.units.length,5);assert.equal(work.units[0].note,'計算ミス');assert.equal(work.units[0].nextReview,123);assert.equal(work.units[1].subNumber,2);assert.equal(work.units[1].q,'小問');assert.equal(work.units[4].q,'追加小問');
});
test('numbered imports preserve learning state on upsert and reject partial invalid input',()=>{
 const existing=[model.cleanUnit({num:12,status:'bad',lastReview:now},12)];
 const result=model.importUnits('12:2x=4:x=2:方程式\n13:::',existing);
 assert.equal(result[0].status,'bad');assert.equal(result[0].lastReview,now);assert.equal(result[0].q,'2x=4');assert.equal(result[1].q,'');
 assert.throws(()=>model.importUnits('12:changed::\nwrong',existing));assert.equal(existing[0].q,'');
});
test('public workbooks exclude personal learning and scheduling data',()=>{
 const work={id:'w',name:'数学',photo:'',unitKind:'page',from:12,to:12,testDate:'2026-10-10',review:{mode:'date',date:'2026-10-09'},units:[model.cleanUnit({num:12,status:'bad',history:['bad'],memo:'補足',note:'secret',lastReview:now,nextReview:now},12)]};
 const published=model.publicContent(work);assert.equal(published.units[0].memo,'補足');assert.equal(published.units[0].status,undefined);assert.equal(published.units[0].note,undefined);assert.equal(published.units[0].nextReview,undefined);assert.equal(published.testDate,undefined);assert.equal(published.review,undefined);
});
test('test-date planning ends before the test and does not repeatedly schedule a completed final review',()=>{
 const u=unit(),work={review:{mode:'interval',days:30},testDate:'2026-10-08'};
 model.mark(work,u,'ok',now);assert.equal(u.nextReview,model.dateTime('2026-10-07'));
 model.mark(work,u,'ok',new Date('2026-10-07T12:00:00').getTime());assert.equal(u.nextReview,0);
});
test('parenthesized subquestions import separately and preserve each existing learning record',()=>{
 const existing=[model.cleanUnit({num:2,status:'so',note:'親'},2),model.cleanUnit({num:2,subNumber:2,status:'bad',note:'小問メモ',history:['bad'],lastReview:now,nextReview:now+86400000},2)];
 const result=model.importUnits('2:共通条件::\n2(1):一問目:A:補足\n2の（2）:二問目:B:',existing);
 assert.equal(result.length,3);assert.equal(result[0].status,'so');assert.equal(result[1].id,'2:s1');assert.equal(result[2].id,'2:s2');assert.equal(result[2].status,'bad');assert.equal(result[2].note,'小問メモ');assert.equal(result[2].nextReview,now+86400000);assert.equal(existing[1].q,'');
 const published=model.publicContent({units:result});assert.equal(published.units[2].subNumber,2);assert.equal(published.units[2].note,undefined);
});
test('invalid or repeated subquestion references reject the entire import without altering records',()=>{
 const existing=[model.cleanUnit({num:2,subNumber:2,q:'残す'},2)];for(const input of ['2(0):x::','2(-1):x::','2(1.5):x::','2(1)(2):x::','2(2):x::\n2の(2):y::'])assert.throws(()=>model.importUnits(input,existing));assert.equal(existing[0].q,'残す');
});

test('empty legacy group headers are hidden without deleting records or hiding real parent work',()=>{const blank=model.cleanUnit({num:2},2),child=model.cleanUnit({num:2,subNumber:1,q:'解く問題'},2),work={from:1,to:3,units:[blank,child,model.cleanUnit({num:3},3)]};assert.equal(model.visibleUnits(work).length,2);assert.equal(work.units.length,3);for(const fields of [{q:'共通条件'},{ans:'答え'},{note:'自分のメモ'},{status:'ok'},{nextReview:now},{review:{mode:'none'}}]){Object.assign(blank,model.cleanUnit({num:2,...fields},2));assert.equal(model.visibleUnits(work).length,3);}});
