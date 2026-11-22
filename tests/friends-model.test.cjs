"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { DuelStore, FriendsModel } = require("../friends.js");

const memoryStore = () => {
  const map = new Map();
  return { get: (k) => (map.has(k) ? map.get(k) : null), set: (k, v) => map.set(k, v) };
};

test("duel records: a round counts once, totals add up per opponent", () => {
  const duels = DuelStore.create(memoryStore());
  const entry = { key: "casino:duel:AB12:100:1:pay", opponent: "friend1", name: "フレンド", result: "win", at: 1000 };
  assert.equal(duels.record("me", entry), true);
  assert.equal(duels.record("me", entry), false, "the same round again adds nothing");
  assert.equal(duels.record("me", { ...entry, key: "k2", result: "lose", at: 2000 }), true);
  assert.equal(duels.record("me", { ...entry, key: "k3", result: "draw", at: 3000 }), true);
  assert.deepEqual(duels.get("me", "friend1"), { name: "フレンド", w: 1, l: 1, d: 1, at: 3000 });
  assert.equal(duels.get("me", "nobody"), null);
  assert.equal(duels.record("me", { ...entry, key: "k4", opponent: "me" }), false, "not against oneself");
  assert.equal(duels.record("me", { ...entry, key: "k5", result: "cheat" }), false);
});

test("studying now: active within 15 minutes and studied today", () => {
  const now = 100 * 60000;
  assert.equal(FriendsModel.studyingNow(now - 5 * 60000, 600, now), true);
  assert.equal(FriendsModel.studyingNow(now - 16 * 60000, 600, now), false, "too long ago");
  assert.equal(FriendsModel.studyingNow(now - 5 * 60000, 0, now), false, "has not studied today");
  assert.equal(FriendsModel.studyingNow(0, 600, now), false);
});

test("name candidates: by name as you type, exact first, self left out (10.173)", () => {
  const people = [
    { id: "ME", name: "たろう", timestamp: 900 },
    { id: "U1", name: "たろう", timestamp: 100 },
    { id: "U2", name: "たろう2号", timestamp: 500 },
    { id: "U3", name: "はなこたろう", timestamp: 800 },
    { id: "U4", name: "じろう", timestamp: 700 },
    { id: "U2", name: "たろう2号", timestamp: 500 },
  ];
  assert.deepEqual(FriendsModel.nameCandidates(people, "たろう", "ME").map((p) => p.id), ["U1", "U2", "U3"]);
  assert.deepEqual(FriendsModel.nameCandidates(people, " たろう ", "ME").map((p) => p.id), ["U1", "U2", "U3"], "spaces do not matter");
  assert.deepEqual(FriendsModel.nameCandidates(people, "", "ME"), []);
  assert.deepEqual(FriendsModel.nameCandidates(people, "さぶろう", "ME"), []);
  assert.deepEqual(FriendsModel.nameCandidates(people, "u4", "ME").map((p) => p.id), ["U4"], "an ID finds them too");
  assert.equal(FriendsModel.nameCandidates(people, "た", "ME", 2).length, 2, "the limit holds");
});

test("ranking rows: by the week, then today, places from 1", () => {
  const rows = FriendsModel.rankRows([
    { id: "a", name: "A", week: 100, today: 50 },
    { id: "b", name: "B", week: 300, today: 10 },
    { id: "c", name: "C", week: 300, today: 90 },
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.place]), [["c", 1], ["b", 2], ["a", 3]]);
});
