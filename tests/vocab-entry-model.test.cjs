const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  m = require("../vocab-entry.js");
const fields = {
  word: "follow",
  meanings: [{ text: "〜に従う", partOfSpeech: "動" }, { text: "〜に続く" }],
  sub: "例文：Follow the rules.\n規則に従いなさい。",
};
test("structured addition appends with a fresh number without mutating old meanings or learning fields", () => {
  const old = [
      {
        num: 1,
        word: "既存",
        meanings: [
          { id: "a", text: "意味", status: "ok", history: ["bad", "ok"] },
        ],
        note: "private",
        sticky: true,
      },
      { num: 7, word: "別の語" },
    ],
    before = JSON.stringify(old);
  const result = m.append(old, fields);
  assert.equal(result.entry.num, 8);
  assert.equal(result.master.length, 3);
  assert.equal(JSON.stringify(old), before);
  assert.equal(result.master[0].note, "private");
  assert.equal(result.master[0].meanings[0].status, "ok");
  assert.equal(result.entry.meanings[0].partOfSpeech, "動");
  assert.equal(result.entry.meanings[1].id, "8-1");
  assert.equal(result.entry.sub, fields.sub);
  assert.equal(result.entry.status, undefined);
  assert.equal(result.entry.note, undefined);
});
test("manual numbers and non-English content are supported; collisions and empty values are rejected", () => {
  assert.equal(
    m.append([], {
      num: 2,
      word: "大化の改新が始まった年",
      meanings: [{ text: "645年" }],
    }).entry.word,
    "大化の改新が始まった年",
  );
  for (const num of [0, -1, 1.5, "", Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => m.append([], { ...fields, num }));
  assert.throws(
    () => m.append([{ num: "03" }], { ...fields, num: 3 }),
    /使用中/,
  );
  assert.throws(() => m.append([], { ...fields, word: " " }));
  assert.throws(() => m.append([], { ...fields, meanings: [] }));
  assert.throws(() =>
    m.append([], { ...fields, meanings: [{ text: "valid" }, { text: " " }] }),
  );
});
test("structured fields preserve colons, circled digits and markup literally instead of parsing import delimiters", () => {
  const entry = m.append([], {
    word: "<img>:①",
    meanings: [{ text: "①は説明の一部：a:b" }],
    sub: "<script>文字</script>\n詳細:補足",
  }).entry;
  assert.equal(entry.meanings.length, 1);
  assert.equal(entry.meanings[0].text, "①は説明の一部：a:b");
  assert.equal(entry.sub, "<script>文字</script>\n詳細:補足");
  assert.equal(
    m.nextNumber([{ num: Number.MAX_SAFE_INTEGER - 1 }]),
    Number.MAX_SAFE_INTEGER,
  );
  assert.throws(() => m.nextNumber([{ num: Number.MAX_SAFE_INTEGER }]));
});
