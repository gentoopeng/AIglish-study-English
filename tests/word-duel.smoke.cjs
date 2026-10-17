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
    const docs = new Map(),
      versions = new Map(),
      listeners = new Map(),
      pages = [],
      errors = [];
    for (const id of ["duel-a", "duel-b", "duel-c", "duel-d"])
      docs.set("users/" + id, {
        playerName: id,
        avatar: "http://127.0.0.1:8000/aiglish.png",
        wordDuelRating: 1500,
        lastActiveAt: Date.now(),
        protected: "learning-preserved",
        wordDuelSoloBest: 777,
      });
    async function notify(path) {
      for (const { page, key } of listeners.values())
        if (key === path)
          await page.evaluate(
            ({ path, value }) => {
              window.__duelListeners[path]?.({
                exists: () => !!value,
                data: () => structuredClone(value),
              });
            },
            { path, value: docs.get(path) },
          );
    }
    async function pageFor(id) {
      const page = await browser.newPage({
        viewport: { width: 393, height: 852 },
      });
      pages.push(page);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install();
      await page.route("https://**/*", (r) => r.abort());
      await page.addInitScript(() =>
        localStorage.setItem(
          "aiglish_sound_settings",
          JSON.stringify({ enabled: false }),
        ),
      );
      await page.exposeFunction("__duelRead", (path) => ({
        value: docs.get(path) || null,
        version: versions.get(path) || 0,
      }));
      await page.exposeFunction("__duelCommit", async ({ reads, writes }) => {
        for (const [path, version] of Object.entries(reads))
          if ((versions.get(path) || 0) !== version) return false;
        for (const write of writes) {
          docs.set(
            write.path,
            write.merge
              ? { ...docs.get(write.path), ...write.value }
              : write.value,
          );
          versions.set(write.path, (versions.get(write.path) || 0) + 1);
        }
        for (const write of writes) await notify(write.path);
        return true;
      });
      await page.exposeFunction("__duelSubscribe", async (path) => {
        listeners.set(id, { page, key: path });
        return docs.get(path) || null;
      });
      await page.exposeFunction("__duelUnsubscribe", () =>
        listeners.delete(id),
      );
      await page.exposeFunction("__duelList", () =>
        Array.from(docs.entries())
          .filter(([path]) => /^users\/[^/]+$/.test(path))
          .map(([path, value]) => ({ id: path.split("/")[1], value })),
      );
      await page.goto("http://127.0.0.1:8000");
      await page.waitForFunction(() => window.WordDuel);
      await page
        .getByRole("button", { name: "ゲストとしてテストプレイ" })
        .click();
      await page.waitForFunction(() => window.__learningBootReady === true);
      await page.evaluate((id) => {
        myId = id;
        myName = id;
        textbooksPool = [{ id: "duel-book", name: "対戦テスト" }];
        currentTextbook = "duel-book";
        localStorage.setItem(
          "core_v4_cache_duel-book",
          JSON.stringify(
            Array.from({ length: 20 }, (_, i) => ({
              num: i,
              word: "word" + i,
              meaning: "意味" + i,
            })),
          ),
        );
        window.db = {};
        const pathOf = (ref) => (typeof ref === "string" ? ref : ref.path);
        window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
        window.fbCollection = (_, ...parts) => parts.join("/");
        window.fbServerTimestamp = () => Date.now();
        window.fbGetDoc = async (reference) => {
          const path = pathOf(reference),
            { value } = await __duelRead(path);
          return { exists: () => !!value, data: () => structuredClone(value) };
        };
        window.RankingQuery.fetch = async () =>
          (await __duelList()).map((doc) => ({ id: doc.id, data: doc.value }));
        window.fbGetDocs = async () => ({
          docs: (await __duelList()).map((doc) => ({
            id: doc.id,
            data: () => doc.value,
          })),
        });
        window.fbRunTransaction = async (_, fn) => {
          for (let attempt = 0; attempt < 20; attempt++) {
            const reads = {},
              writes = [];
            const result = await fn({
              get: async (reference) => {
                const path = pathOf(reference),
                  { value, version } = await __duelRead(path);
                reads[path] = version;
                return {
                  exists: () => !!value,
                  data: () => structuredClone(value),
                };
              },
              set: (reference, value, options) =>
                writes.push({
                  path: pathOf(reference),
                  value,
                  merge: options?.merge === true || !!options?.mergeFields,
                }),
            });
            if (await __duelCommit({ reads, writes })) return result;
          }
          throw Error("transaction conflict");
        };
        window.__duelListeners = {};
        window.fbSetDoc = (reference, value, options) =>
          __duelCommit({
            reads: {},
            writes: [
              {
                path: pathOf(reference),
                value,
                merge: options?.merge === true,
              },
            ],
          });
        AccountWriteGuard.install();
        window.fbOnSnapshot = (reference, callback) => {
          const path = pathOf(reference);
          __duelListeners[path] = callback;
          __duelSubscribe(path).then((value) =>
            callback({ exists: () => !!value, data: () => value }),
          );
          return () => {
            delete __duelListeners[path];
            __duelUnsubscribe();
          };
        };
      }, id);
      return page;
    }
    const clients = [];
    for (const id of ["duel-a", "duel-b", "duel-c", "duel-d"])
      clients.push(await pageFor(id));
    const [a, b, c, d] = clients;
    for (const [i, page] of clients.entries())
      await page.evaluate((i) => {
        StudyTime.mergeCloud({
          version: 1,
          epoch: "study-reset-2.62",
          days: {},
          offset: 3600000,
        });
        localStorage.setItem(
          "core_v4_user_avatar_" + myId,
          "http://127.0.0.1:8000/aiglish.png",
        );
        localStorage.setItem(
          "core_v4_profile_customization_" + myId,
          JSON.stringify({ frame: i ? "stone" : "wood" }),
        );
      }, i);
    async function lobby(page, intent = "create") {
      await page.locator("#nav-battle").click();
      await page.locator(".mode-casual").click();
      assert.equal(await page.locator("[data-config-tab]").count(), 0);
      await page.locator("[data-battle-route=" + intent + "]").click();
      if (intent !== "join") {
        await page.locator("[data-config-tab=events]").click();
        await page.locator("[data-events]").uncheck();
        await page.locator("[data-config-tab=books]").click();
      }
    }
    async function answer(page, correct = true) {
      const prompt = await page.locator(".duel-prompt").textContent(),
        meaning = "意味" + prompt.slice(4),
        texts = await page.locator(".duel-options button").allTextContents(),
        right = texts.includes(meaning) ? texts.indexOf(meaning) : 9;
      await page
        .locator(".duel-options button")
        .nth(correct ? right : (right + 1) % 10)
        .click();
      if (correct) {
        assert.equal(
          await page.locator(".duel-options button.is-selected").count(),
          1,
        );
        assert.equal(
          await page.locator(".duel-options button:disabled").count(),
          10,
        );
        await page.clock.fastForward(200);
      }
    }
    async function join(page, code) {
      await lobby(page, "join");
      assert.equal(await page.locator(".battle-book-picker").count(), 0);
      assert.match(code, /^\d{4}$/);
      await page.getByRole("textbox", { name: "部屋番号" }).fill(code);
      await page.getByRole("button", { name: "参加", exact: true }).click();
    }
    await lobby(a, "solo");
    await a.locator("[data-config-tab=rules]").click();
    await a.getByLabel("制限時間の分").selectOption("2");
    assert.equal(await a.getByLabel("ミス時の減点").inputValue(), "100");
    await a.getByLabel("ミス時の減点").fill("0");
    await a.getByRole("button", { name: "一人プレイ", exact: true }).click();
    await a.locator(".duel-options button").first().waitFor();
    assert.equal(await a.locator(".duel-clock").textContent(), "120");
    assert.equal(await a.locator(".duel-player").count(), 1);
    assert.equal(
      await a
        .locator(".duel-content")
        .textContent()
        .then((value) => value.includes("自己ベスト")),
      false,
    );
    await answer(a);
    await answer(a);
    await answer(a);
    await answer(a, false);
    assert.equal(await a.locator(".duel-correction").isVisible(), true);
    assert.equal(
      await a
        .getByRole("button", { name: "あと3秒", exact: true })
        .isDisabled(),
      true,
    );
    await a.clock.fastForward(3000);
    await a.getByRole("button", { name: "次の問題", exact: true }).click();
    await answer(a);
    await a.clock.fastForward(61000);
    assert.equal(await a.locator(".duel-solo-result").count(), 0);
    await a.clock.fastForward(61000);
    await a.locator(".duel-solo-result").waitFor();
    assert.equal(
      await a.locator(".duel-solo-result strong").textContent(),
      "480点",
    );
    assert.equal(docs.get("users/duel-a").wordDuelSoloBest, 777);
    assert.equal(
      await a.evaluate(() =>
        localStorage.getItem("core_v4_word_duel_solo_duel-a"),
      ),
      null,
    );
    await a.getByRole("button", { name: "閉じる", exact: true }).click();
    for (const page of clients) await page.clock.setSystemTime(Date.now());
    await lobby(a);
    await a.locator("[data-config-tab=rules]").click();
    await a.getByLabel("制限時間の分").selectOption("3");
    await a.getByLabel("対戦人数").selectOption("4");
    await a.getByLabel("ミス時の減点").fill("200");
    assert.equal(await a.getByLabel("制限時間の分").isDisabled(), false);
    assert.equal(await a.getByLabel("ミス時の減点").inputValue(), "200");
    await a.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await a.locator(".duel-wait strong").waitFor();
    const code = await a.locator(".duel-wait strong").textContent();
    await join(b, code);
    assert.equal(await a.locator(".duel-options").count(), 0);
    await join(c, code);
    await a.waitForFunction(() =>
      document
        .querySelector("[data-wait-count]")
        ?.textContent.includes("3 / 4人"),
    );
    assert.match(
      await a.locator("[data-wait-count]").textContent(),
      /3 \/ 4人/,
    );
    // A waiting guest frees the seat using a full replacement of the players map.
    await c.getByRole("button", { name: "戻る" }).click();
    await a.waitForFunction(
      (code) =>
        Object.keys(window.__duelListeners).includes("wordDuelRooms/" + code),
      code,
    );
    for (
      let i = 0;
      i < 100 &&
      Object.keys(docs.get("wordDuelRooms/" + code).players).length !== 2;
      i++
    )
      await a.waitForTimeout(10);
    assert.equal(
      Object.keys(docs.get("wordDuelRooms/" + code).players).length,
      2,
    );
    await join(c, code);
    await join(d, code);
    for (const page of clients) {
      await page.locator(".duel-options button").first().waitFor();
      await page.clock.fastForward(4000);
      assert.equal(await page.locator(".duel-player").count(), 4);
      await page.locator(".duel-player-avatar img").last().waitFor();
    }
    assert.ok(
      await a
        .locator(".duel-leave")
        .evaluate(
          (node) =>
            node.getBoundingClientRect().bottom <
            document.querySelector(".duel-options").getBoundingClientRect().top,
        ),
    );
    assert.ok(
      await a
        .locator(".duel-options button")
        .first()
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize) >= 15),
    );
    assert.equal(
      new Set(
        await Promise.all(
          clients.map((page) => page.locator(".duel-prompt").textContent()),
        ),
      ).size,
      1,
    );
    // Ten options, exit, and correction must remain reachable without page scrolling.
    for (const height of [568, 668, 740]) {
      await d.setViewportSize({ width: 320, height });
      await d.evaluate(() => {
        document.querySelector(".duel-correction").hidden = false;
        document.querySelector(".duel-correction strong").textContent =
          "誤答の長い正しい意味を確認するテスト".repeat(12);
        document.querySelector(".duel-prompt").dataset.original ??=
          document.querySelector(".duel-prompt").textContent;
        document.querySelector(".duel-prompt").textContent =
          "問題文がとても長い場合も表示を確かめる".repeat(8);
        document.querySelectorAll(".duel-player small").forEach((node) => {
          node.dataset.original ??= node.textContent;
          node.textContent = "長いニックネームのプレイヤー".repeat(3);
        });
        document.querySelector(".duel-status").textContent =
          "通信に時間がかかっている場合の長い警告メッセージ".repeat(5);
      });
      await d.waitForTimeout(30);
      const bounds = await d
        .locator(".duel-options button, .duel-leave, [data-duel-next]")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            bottom: node.getBoundingClientRect().bottom,
            top: node.getBoundingClientRect().top,
            height: innerHeight,
          })),
        );
      assert.ok(
        bounds.every((box) => box.top >= 0 && box.bottom <= box.height),
        JSON.stringify(bounds),
      );
    }
    await d.evaluate(() => {
      document.querySelector(".duel-correction").hidden = true;
      document.querySelector(".duel-status").textContent = "";
      document.querySelector(".duel-prompt").textContent =
        document.querySelector(".duel-prompt").dataset.original;
      document
        .querySelectorAll(".duel-player small")
        .forEach((node) => (node.textContent = node.dataset.original));
    });
    await d.setViewportSize({ width: 393, height: 852 });
    await a.setViewportSize({ width: 320, height: 668 });
    assert.equal(
      await a
        .locator(".word-duel-screen")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
      true,
    );
    await a.screenshot({ path: "/tmp/battle-four-" + type.name() + ".png" });
    await a.setViewportSize({ width: 393, height: 852 });
    for (let i = 0; i < 3; i++) await answer(a);
    for (let i = 0; i < 2; i++) await answer(b);
    await answer(c);
    await answer(d, false);
    assert.match(await d.locator(".duel-combo").textContent(), /−200/);
    assert.equal(docs.get("wordDuelRooms/" + code).missPenalty, 200);
    await a.waitForFunction(() =>
      Array.from(document.querySelectorAll(".duel-player strong")).some(
        (node) => node.textContent === "-200",
      ),
    );
    for (const page of clients) await page.clock.fastForward(181000);
    for (const page of clients) await page.locator(".duel-results").waitFor();
    const result = docs.get("wordDuelRooms/" + code).result;
    assert.deepEqual(Object.values(result.deltas), [0, 0, 0, 0]);
    assert.deepEqual(Object.values(result.scores), [360, 230, 110, -190]);
    for (const [i, id] of ["duel-a", "duel-b", "duel-c", "duel-d"].entries()) {
      assert.equal(result.places[id], i + 1);
      assert.equal(
        docs.get("users/" + id).wordDuelRating,
        1500 + [0, 0, 0, 0][i],
      );
      assert.equal(docs.get("users/" + id).protected, "learning-preserved");
      assert.equal(docs.get("users/" + id).wordDuelSoloBest, 777);
    }
    const games = docs.get("users/duel-a").wordDuelGames;
    await a.evaluate((code) => WordDuel.settle(code), code);
    assert.equal(docs.get("users/duel-a").wordDuelGames, games);
    assert.ok(
      Object.values(
        JSON.parse(docs.get("users/duel-d/vocabProgress/duel-book").wordsJson),
      ).some((word) => word.status === "bad"),
    );
    for (const page of clients)
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    // Three players: a tie shares first/second, and the lower score loses 30.
    for (const page of clients) await page.clock.setSystemTime(Date.now());
    await lobby(a);
    await a.locator("[data-config-tab=rules]").click();
    await a.getByLabel("制限時間の分").selectOption("3");
    await a.getByLabel("対戦人数").selectOption("3");
    await a.getByLabel("ミス時の減点").fill("200");
    await a.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await a.locator(".duel-wait strong").waitFor();
    const triple = await a.locator(".duel-wait strong").textContent();
    await join(b, triple);
    await join(c, triple);
    await join(d, triple);
    assert.match(
      await d.locator(".duel-status").textContent(),
      /参加できません/,
    );
    await d.getByRole("button", { name: "戻る" }).click();
    for (const page of [a, b, c]) {
      await page.locator(".duel-options button").first().waitFor();
      await page.clock.fastForward(4000);
    }
    await answer(a);
    await answer(b);
    await answer(c, false);
    for (const page of [a, b, c]) await page.clock.fastForward(181000);
    for (const page of [a, b, c]) await page.locator(".duel-results").waitFor();
    assert.deepEqual(
      Object.values(docs.get("wordDuelRooms/" + triple).result.deltas),
      [0, 0, 0],
    );
    for (const page of [a, b, c])
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    // Two players: scoreless draw is zero; an abandoned player loses 30 after finish.
    for (const page of [a, b]) await page.clock.setSystemTime(Date.now());
    await lobby(a);
    await a.locator("[data-config-tab=rules]").click();
    await a.getByLabel("制限時間の分").selectOption("3");
    await a.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await a.locator(".duel-wait strong").waitFor();
    const ratingsBefore = Object.fromEntries(
      ["duel-a", "duel-b"].map((id) => [
        id,
        docs.get("users/" + id).wordDuelRating,
      ]),
    );
    const pair = await a.locator(".duel-wait strong").textContent();
    await join(b, pair);
    for (const page of [a, b]) {
      await page.locator(".duel-options button").first().waitFor();
      await page.clock.fastForward(4000);
    }
    await b.getByRole("button", { name: "終了する", exact: true }).click();
    await a.clock.fastForward(181000);
    await a.locator(".duel-results").waitFor();
    await b.locator(".duel-results").waitFor();
    assert.equal(docs.get("wordDuelRooms/" + pair).result.deltas["duel-a"], 0);
    assert.equal(docs.get("wordDuelRooms/" + pair).result.deltas["duel-b"], 0);
    for (const id of ["duel-a", "duel-b"])
      assert.equal(docs.get("users/" + id).wordDuelRating, ratingsBefore[id]);
    for (const page of [a, b])
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    // Attack events synchronize other players' scores and final placement, not just the label.
    for (const page of [a, b]) await page.clock.setSystemTime(Date.now());
    await lobby(a);
    await a.locator("[data-config-tab=events]").click();
    await a.locator("[data-events]").check();
    await a.locator("[data-event-preset=none]").click();
    await a.locator('[data-event-category="特殊"]').click();
    await a.locator("[data-event-type][value=attack]").check();
    await a.getByLabel("イベント加減点").fill("80");
    await a.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await a.locator(".duel-wait strong").waitFor();
    const eventCode = await a.locator(".duel-wait strong").textContent();
    await join(b, eventCode);
    for (const page of [a, b]) {
      await page.locator(".duel-options").waitFor();
      await page.clock.fastForward(15000);
      assert.equal(
        await page.locator(".duel-event-banner").getAttribute("data-phase"),
        "preview",
      );
      assert.match(
        await page.locator(".duel-event-banner").textContent(),
        /まもなく/,
      );
      await page.clock.fastForward(4000);
      assert.equal(await page.locator(".duel-event-banner").isVisible(), true);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10));
    }
    await answer(a);
    await a.clock.fastForward(400);
    await b.clock.fastForward(1000);
    await b.locator("[data-duel-score]").filter({ hasText: /^-80$/ }).waitFor();
    await a.setViewportSize({ width: 320, height: 568 });
    await b.setViewportSize({ width: 320, height: 568 });
    await answer(b, false);
    assert.equal(
      await b.locator("[data-event-explanation]").textContent(),
      "正解で相手全員から80点を減点。",
    );
    assert.equal(await b.locator(".duel-event-notice").isVisible(), true);
    assert.equal((await b.locator(".duel-score-change").count()) <= 2, true);
    await b.evaluate(() => {
      const board = document.querySelector(".duel-scoreboard");
      board.style.setProperty("--duel-players", "4");
      window.__extraColumns = [...board.children].map((node, i) => {
        const clone = node.cloneNode(true);
        clone.dataset.playerId = "extra-" + i;
        clone.querySelector("small").textContent = "長い名前のプレイヤー";
        board.append(clone);
        return clone;
      });
    });
    assert.equal(
      await b.locator(".duel-event-banner").getAttribute("data-phase"),
      "active",
    );
    assert.equal(
      await b.locator(".duel-event-notice small").textContent(),
      "イベント発生",
    );
    await b.screenshot({
      path: "/tmp/event-feedback-" + type.name() + ".png",
      animations: "disabled",
    });
    const layout = await b.evaluate(() => {
      const s = document.querySelector("#wordDuelScreen");
      return {
        scroll: s.scrollHeight > s.clientHeight + 1,
        answers: s.querySelector(".duel-options").getBoundingClientRect()
          .bottom,
        correction: s.querySelector("[data-duel-next]").getBoundingClientRect()
          .bottom,
        height: innerHeight,
      };
    });
    assert.equal(layout.scroll, false, JSON.stringify(layout));
    assert.ok(
      layout.answers <= layout.height && layout.correction <= layout.height,
      JSON.stringify(layout),
    );
    await b.evaluate(() => {
      __extraColumns.forEach((node) => node.remove());
      document
        .querySelector(".duel-scoreboard")
        .style.setProperty("--duel-players", "2");
    });
    await a.setViewportSize({ width: 393, height: 852 });
    await b.setViewportSize({ width: 393, height: 852 });
    await b.clock.fastForward(400);
    await b.clock.resume();
    await a.clock.fastForward(1000);await a.clock.resume();
    await a.waitForFunction(() =>
      [...document.querySelectorAll(".duel-player strong")].some(
        (n) => n.textContent === "-180",
      ),
    );
    for (const page of [a, b]) await page.clock.fastForward(61000);
    for (const page of [a, b]) await page.locator(".duel-results").waitFor();
    assert.deepEqual(
      Object.values(docs.get("wordDuelRooms/" + eventCode).result.scores),
      [110, -170],
    );
    for (const page of [a, b])
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    assert.equal(
      await a.locator(".duel-event-notice,.duel-score-change").count(),
      0,
    );
    // Banked scores release at the end of the event even when nobody submits another answer.
    for (const page of [a, b]) await page.clock.setSystemTime(Date.now());
    await lobby(a);
    await a.locator("[data-config-tab=events]").click();
    await a.locator("[data-event-preset=none]").click();
    await a.locator('[data-event-category="特殊"]').click();
    await a.locator("[data-event-type][value=bank]").check();
    await a.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await a.locator(".duel-wait strong").waitFor();
    const bankCode = await a.locator(".duel-wait strong").textContent();
    await join(b, bankCode);
    for (const page of [a, b]) {
      await page.locator(".duel-options").waitFor();
      await page.clock.fastForward(19000);
    }
    await answer(a);
    assert.equal(await a.locator("[data-duel-score]").textContent(), "0");
    await a.clock.fastForward(400);
    await a.clock.fastForward(7000);
    await b.clock.fastForward(7600);
    assert.equal(await a.locator("[data-duel-score]").textContent(), "100");
    await b.waitForFunction(
      () =>
        document.querySelector('[data-player-id="duel-a"] strong')
          .textContent === "100",
    );
    for (const page of [a, b]) await page.clock.fastForward(61000);
    for (const page of [a, b]) await page.locator(".duel-results").waitFor();
    assert.deepEqual(
      Object.values(docs.get("wordDuelRooms/" + bankCode).result.scores),
      [110, 0],
    );
    for (const page of [a, b])
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    // Deletion can begin before the room's answers are purged. Treat that player as abandoned.
    const retainedProfile = structuredClone(docs.get("users/duel-b"));
    let erasedCode = "654321";
    while (docs.has("wordDuelRooms/" + erasedCode))
      erasedCode = String(Number(erasedCode) + 1);
    const erasedRoom = structuredClone(docs.get("wordDuelRooms/" + code));
    erasedRoom.status = "playing";
    erasedRoom.startsAt = Date.now() - 200000;
    delete erasedRoom.result;
    docs.set("wordDuelRooms/" + erasedCode, erasedRoom);
    docs.set("users/duel-b", { deleted: true, deletionState: "pending" });
    versions.set("users/duel-b", (versions.get("users/duel-b") || 0) + 1);
    await a.evaluate((code) => WordDuel.settle(code), erasedCode);
    const erasedResult = docs.get("wordDuelRooms/" + erasedCode).result;
    assert.equal(erasedResult.places["duel-b"], 4);
    assert.equal(erasedResult.scores["duel-b"], 0);
    assert.equal(erasedResult.deltas["duel-b"], 0);
    assert.deepEqual(docs.get("users/duel-b"), {
      deleted: true,
      deletionState: "pending",
    });
    assert.equal(docs.get("users/duel-a").protected, "learning-preserved");
    docs.set("users/duel-b", retainedProfile);
    versions.set("users/duel-b", (versions.get("users/duel-b") || 0) + 1);
    await a.locator("#nav-titles").click();
    await a.getByRole("button", { name: "対戦レート", exact: true }).click();
    await a.locator("#rankingRefresh").click();
    await a.locator("[data-podium-metric=rating] .place-1 strong").waitFor();
    assert.equal(await a.locator("[data-podium-metric=solo]").count(), 0);
    assert.equal(await a.locator(".ranking-mini-panel").count(), 1);
    await a.locator(".rating-roster summary").click();
    assert.equal(await a.locator(".rating-roster li").count(), 1);
    await a.screenshot({ path: "/tmp/rate-expanded-" + type.name() + ".png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": timed solo without best writes, 4-player casual live scores and places, 3-player tie/overfill rejection without rating changes, 2-player forfeit, waiting exit/rejoin, atomic idempotent settlement, understanding preservation and expandable rate list",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
