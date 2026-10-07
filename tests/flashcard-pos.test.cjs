const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('game_core.js','utf8');const end=source.indexOf('    // ================================================================',source.indexOf('return null;'));
const ctx={window:{}};vm.runInNewContext(source.slice(0,end)+'})();',ctx);const pos=ctx.window.getFlashcardPartOfSpeech;
test('selected meaning overrides the word-level part of speech',()=>{assert.equal(pos({pos:'noun'},{text:'走る',partOfSpeech:'動'}).short,'動');assert.equal(pos({pos:'adj.'},{text:'幸福',pos:'名'}).short,'名');});
test('independent Japanese and English metadata and multi-role values work',()=>{assert.equal(pos({}, {text:'slowly',pos:'adv.'}).short,'副');assert.equal(pos({pos:'n./v.'},{text:'活動'}).short,'名・動');assert.equal(pos({}, {text:'読む',pos:'他'}).name,'動詞');});
test('grammar-like explanations and examples never become part-of-speech labels',()=>{assert.equal(pos({sub:'(動) の例文'}, {text:'(名) についての説明'}),null);assert.equal(pos({}, {text:'a new book'}),null);assert.equal(pos({}, {text:'読む'}),null);});
