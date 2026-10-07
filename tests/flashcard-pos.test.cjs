const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('game_core.js','utf8');const end=source.indexOf('    // ================================================================',source.indexOf('return null;'));
const ctx={window:{}};vm.runInNewContext(source.slice(0,end)+'})();',ctx);const pos=ctx.window.getFlashcardPartOfSpeech;
test('selected meaning overrides the word-level part of speech',()=>{assert.equal(pos({pos:'noun'},{text:'【動】走る'}).short,'動');assert.equal(pos({sub:'adj.'},{text:'【名】幸福'}).short,'名');});
test('Japanese and English grammar annotations and multi-role metadata work',()=>{assert.equal(pos({}, {text:'(adv.) slowly'}).short,'副');assert.equal(pos({}, {text:'【名・動】研究'}).short,'名・動');assert.equal(pos({pos:'n./v.'},{text:'活動'}).short,'名・動');assert.equal(pos({}, {text:'（他）読む'}).name,'動詞');});
test('ordinary translation text and missing metadata never create invented labels',()=>{assert.equal(pos({}, {text:'願い'}),null);assert.equal(pos({}, {text:'a new book'}),null);assert.equal(pos({}, {text:'読む'}),null);});
