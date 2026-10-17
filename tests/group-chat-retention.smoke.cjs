const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium,
    browser = await type.launch(
      type === chromium
        ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
        : { executablePath: process.env.WEBKIT_EXECUTABLE_PATH },
    );
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.clock.install();
    await page.goto("http://127.0.0.1:8000");
    await page
      .getByRole("button", { name: "ゲストとしてテストプレイ" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady);
    await page.evaluate(() => {
      myId = "chat-a";
      myName = "自分";
      window.db = {};
      const now = Date.now(),
        photo = "http://127.0.0.1:8000/aiglish.png",
        group = {
          name: "テストグループ",
          owner: "chat-a",
          members: { "chat-a": { name: "自分" }, "chat-b": { name: "友達" } },
          baseline: {},
          progress: {},
          events: [],
          goal: null,
        };
      const docs = new Map([
          ["studyGroups/test", group],
          ["users/chat-a", { playerName: "自分", avatar: photo }],
          ["users/chat-b", { playerName: "友達", avatar: photo }],
        ]),
        listeners = new Set();
      for (let i = 0; i < 17; i++)
        docs.set("studyGroups/test/messages/m" + i, {
          ownerId: "chat-b",
          name: "友達",
          text: "以前のトーク" + i,
          sentAt: now - i * 1000 - (i >= 15 ? 8 * 86400000 : 0),
          createdAt: now - i * 1000 - (i >= 15 ? 8 * 86400000 : 0),
        });
      localStorage.setItem("core_v4_user_avatar_chat-a", photo);
      ProfileIdentityCache.remember("chat-b", docs.get("users/chat-b"));
      const path = (r) => r.path,
        one = (r) => ({
          id: r.path.split("/").at(-1),
          ref: r,
          exists: () => docs.has(path(r)),
          data: () => structuredClone(docs.get(path(r))),
        });
      function list(q) {
        let rows = [...docs]
          .filter(
            ([key]) =>
              key.startsWith(q.path + "/") &&
              !key.slice(q.path.length + 1).includes("/"),
          )
          .map(([key, value]) => ({
            id: key.split("/").at(-1),
            ref: { path: key },
            data: () => structuredClone(value),
          }));
        rows.sort(
          (a, b) =>
            Number(b.data().createdAt) - Number(a.data().createdAt) ||
            b.id.localeCompare(a.id),
        );
        for (const p of q.parts || []) {
          if (p.after) {
            const i = rows.findIndex((row) => row.id === p.after.id);
            if (i >= 0) rows = rows.slice(i + 1);
          }
          if (p.limit) rows = rows.slice(0, p.limit);
        }
        return { docs: rows };
      }
      window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
      window.fbCollection = (_, ...parts) => ({ path: parts.join("/") });
      window.fbOrderBy = (field, direction) => ({ field, direction });
      window.fbLimit = (limit) => ({ limit });
      window.fbStartAfter = (after) => ({ after });
      window.fbQuery = (q, ...parts) => ({ ...q, parts });
      window.fbServerTimestamp = () => Date.now();
      window.fbGetDoc = async (r) => one(r);
      window.fbGetDocs = async (q) => list(q);
      window.__notifyChat = () =>
        listeners.forEach((item) => item.callback(list(item.q)));
      window.fbOnSnapshot = (q, callback) => {
        const item = { q, callback };
        listeners.add(item);
        queueMicrotask(() => callback(list(q)));
        return () => listeners.delete(item);
      };
      window.fbRunTransaction = async (_, fn) => {
        const writes = [];
        const result = await fn({
          get: async (r) => one(r),
          set: (r, value, options) => writes.push({ r, value, options }),
          delete: (r) => writes.push({ r, remove: true }),
        });
        for (const w of writes) {
          if (w.remove) docs.delete(path(w.r));
          else
            docs.set(
              path(w.r),
              w.options?.merge
                ? { ...docs.get(path(w.r)), ...w.value }
                : w.value,
            );
        }
        window.__notifyChat();
        if (window.__loseReply) {
          window.__loseReply = false;
          throw Error("lost response");
        }
        return result;
      };
      const d = document.createElement("dialog");
      d.className = "group-chat-dialog";
      d.innerHTML =
        '<h2>テスト</h2><div class="group-content"></div><p data-group-status></p>';
      document.body.append(d);
      d.showModal();
      GroupChat.mount(d, { id: "test", ...group });
      window.__chatDocs = docs;
      window.__chatCount = () =>
        [...docs.keys()].filter((key) =>
          key.startsWith("studyGroups/test/messages/"),
        ).length;
    });
    await page.waitForFunction(() => __chatCount() === 10);
    assert.equal(await page.locator(".group-chat-message").count(), 10);
    assert.equal(await page.locator("[data-chat-older]").count(), 0);
    await page
      .locator(".group-chat-message .podium-avatar img")
      .first()
      .waitFor();
    const initial = await page.evaluate(() =>
      [...__chatDocs.keys()].filter((key) => key.includes("/messages/")),
    );
    assert.equal(
      initial.some((key) => key.endsWith("/m10")),
      false,
    );
    assert.equal(
      initial.some((key) => key.endsWith("/m16")),
      false,
    );
    await page.evaluate(() => (window.__loseReply = true));
    await page.getByLabel("メッセージ", { exact: true }).fill("新しいトーク");
    await page.getByRole("button", { name: "送信", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-chat-status]")
        .textContent.includes("送信できませんでした"),
    );
    const after = await page.evaluate(() => __chatCount());
    await page.getByRole("button", { name: "送信", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("textarea").value === "",
    );
    assert.equal(await page.evaluate(() => __chatCount()), after);
    assert.equal(after, 10);
    assert.equal(
      await page.locator(".group-chat-message.is-self img").count(),
      1,
    );
    await page.evaluate(() => {
      const [key, value] = [...__chatDocs].find(([k]) =>
        k.includes("/messages/"),
      );
      value.createdAt = Date.now() - 7 * 86400000 + 100;
      __chatDocs.set(key, value);
      __notifyChat();
    });
    await page.clock.runFor(110);
    await page.waitForFunction(() => __chatCount() === 9);
    assert.equal(await page.locator(".group-chat-message").count(), 9);
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now + 7 * 86400000 + 1000);
    await page.evaluate(() => __notifyChat());
    await page.waitForFunction(() => __chatCount() === 0);
    assert.equal(await page.locator(".group-chat-message").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": legacy history physically trimmed to ten, seven-day live expiry and removal, sender photos, idempotent lost-response retry",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
