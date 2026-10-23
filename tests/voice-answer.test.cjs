const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  v = require("../voice-answer.js");
test("a spoken Japanese meaning matches any part, without 〜 and its particle", () => {
  const meaning = "①〜に従う②〜に続く(+ to A)";
  assert.deepEqual(v.answers(meaning).sort(), ["に従う", "に続く", "従う", "続く"].sort());
  assert.equal(v.judge(["従う"], meaning), "ok");
  assert.equal(v.judge(["に続く"], meaning), "ok");
  assert.equal(v.judge(["従います"], meaning), "ok");
  assert.equal(v.judge(["食べる"], meaning), "bad");
  // Another form of the same verb is right; another word sharing the first kanji is not.
  assert.equal(v.judge(["食べました"], "食べる"), "ok");
  assert.equal(v.judge(["食器"], "食べる"), "bad");
});
test("katakana and hiragana, spaces and punctuation do not matter; any alternative may match", () => {
  assert.equal(v.judge(["リンゴ"], "りんご"), "ok");
  assert.equal(v.judge(["しず か な"], "静かな、しずかな"), "ok");
  assert.equal(v.judge(["机", "つくえ"], "つくえ"), "ok");
  assert.equal(v.judge(["正気を失っている"], "正気を失っている"), "ok");
  assert.equal(v.judge(["正気"], "正気を失っている"), "bad");
});
test("English answers: case, a leading to/a/the, and near spellings", () => {
  assert.equal(v.judge(["Apple"], "apple", true), "ok");
  assert.equal(v.judge(["to follow"], "follow", true), "ok");
  assert.equal(v.judge(["follows"], "follow", true), "ok");
  assert.equal(v.judge(["hollow"], "follow", true), "bad");
});
test("saying わからない counts as a pass; nothing heard is wrong", () => {
  assert.equal(v.judge(["わからない"], "りんご"), "pass");
  assert.equal(v.judge(["パス"], "りんご"), "pass");
  assert.equal(v.judge([], "りんご"), "bad");
});
