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
      errors = [];
    let reads = 0;
    for (const id of ["group-a", "group-b"])
      docs.set("users/" + id, {
        playerName: id,
        avatar: "http://127.0.0.1:8000/icon-192.png",
        lastActiveAt: Date.now(),
      });
    async function notify(path) {
      for (const [page, entries] of listeners)
        if (entries.has(path))
          await page.evaluate(
            ({ path, value }) =>
              window.__listeners[path]?.({
                exists: () => !!value,
                data: () => structuredClone(value),
                ...(Array.isArray(value)
                  ? {
                      docs: value.map((item) => ({
                        id: item.id,
                        data: () => item.value,
                      })),
                    }
                  : {}),
              }),
            {
              path,
              value: path.endsWith("/messages")
                ? [...docs]
                    .filter(([key]) => key.startsWith(path + "/"))
                    .map(([key, value]) => ({
                      id: key.split("/").at(-1),
                      value,
                    }))
                : docs.get(path),
            },
          );
    }
    async function pageFor(id) {
      const p = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion:
          process.env.REDUCED_MOTION === "1" ? "reduce" : "no-preference",
      });
      p.setDefaultTimeout(12000);
      p.on("pageerror", (e) => errors.push(e.message));
      await p.clock.install();
      await p.route("https://**/*", (r) => r.abort());
      await p.exposeFunction("__read", (path) => {
        reads++;
        return {
          value: docs.get(path) || null,
          version: versions.get(path) || 0,
        };
      });
      await p.exposeFunction("__list", (path) =>
        [...docs]
          .filter(
            ([key]) =>
              key.startsWith(path + "/") &&
              !key.slice(path.length + 1).includes("/"),
          )
          .map(([key, value]) => ({ id: key.split("/").at(-1), value })),
      );
      await p.exposeFunction("__commit", async ({ reads, writes }) => {
        if (
          Object.entries(reads).some(
            ([path, v]) => (versions.get(path) || 0) !== v,
          )
        )
          return false;
        for (const w of writes) {
          if (w.remove) docs.delete(w.path);
          else
            docs.set(
              w.path,
              w.merge ? { ...docs.get(w.path), ...w.value } : w.value,
            );
          versions.set(w.path, (versions.get(w.path) || 0) + 1);
        }
        for (const w of writes) {
          await notify(w.path);
          if (/\/messages\/[^/]+$/.test(w.path))
            await notify(w.path.split("/").slice(0, -1).join("/"));
        }
        return true;
      });
      await p.exposeFunction("__subscribe", (path) => {
        if (!listeners.has(p)) listeners.set(p, new Set());
        listeners.get(p).add(path);
        return path.endsWith("/messages")
          ? [...docs]
              .filter(([key]) => key.startsWith(path + "/"))
              .map(([key, value]) => ({ id: key.split("/").at(-1), value }))
          : docs.get(path) || null;
      });
      await p.exposeFunction("__unsubscribe", (path) =>
        listeners.get(p)?.delete(path),
      );
      await p.goto("http://127.0.0.1:8000");
      await p.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
      await p.waitForFunction(() => window.__learningBootReady);
      await p.evaluate((id) => {
        myId = id;
        myName = id;
        localStorage.setItem(
          "core_v4_user_avatar_" + id,
          "http://127.0.0.1:8000/icon-192.png",
        );
        myFriendList = []; // Group membership is selected from the user directory.
        currentTextbook = "groups-book";
        textbooksPool = [{ id: currentTextbook, name: "グループ教材" }];
        vocabList = migrateVocabData(
          Array.from({ length: 20 }, (_, i) => ({
            num: i + 1,
            word: "word" + i,
            meaning: "意味" + i,
          })),
        );
        textbooksCacheMap[currentTextbook] =
          stripVocabProgressFromWords(vocabList);
        localStorage.setItem(
          "core_v4_cache_" + currentTextbook,
          JSON.stringify(textbooksCacheMap[currentTextbook]),
        );
        localStorage.setItem(
          "core_v4_personal_library_" + id,
          JSON.stringify({ books: textbooksPool, hidden: [] }),
        );
        window.db = {};
        window.__listeners = {};
        const path = (r) => (typeof r === "string" ? r : r.path),
          snapshot = (value) => ({
            exists: () => !!value,
            data: () => structuredClone(value),
            ...(Array.isArray(value)
              ? {
                  docs: value.map((item) => ({
                    id: item.id,
                    data: () => item.value,
                  })),
                }
              : {}),
          });
        window.fbDoc = (_, ...parts) => ({ path: parts.join("/") });
        window.fbCollection = (_, ...parts) => ({ path: parts.join("/") });
        window.fbQuery = (r, ...rest) => r;
        window.fbLimit = (n) => n;
        window.fbOrderBy = () => "";
        window.fbStartAfter = () => "";
        window.fbGetDoc = async (r) => snapshot((await __read(path(r))).value);
        window.fbGetDocs = async (r) => ({
          docs: (await __list(path(r))).map((d) => ({
            id: d.id,
            data: () => d.value,
            ref: { path: path(r) + "/" + d.id },
          })),
        });
        window.fbServerTimestamp = () => Date.now();
        window.fbRunTransaction = async (_, fn) => {
          for (let i = 0; i < 20; i++) {
            const reads = {},
              writes = [];
            const result = await fn({
              get: async (r) => {
                const d = await __read(path(r));
                reads[path(r)] = d.version;
                return snapshot(d.value);
              },
              set: (r, value, o) =>
                writes.push({
                  path: path(r),
                  value,
                  merge: o?.merge === true || !!o?.mergeFields,
                }),
              delete: (r) => writes.push({ path: path(r), remove: true }),
            });
            if (await __commit({ reads, writes })) return result;
          }
          throw Error("conflict");
        };
        window.fbSetDoc = (r, value, o) =>
          window.fbRunTransaction(window.db, (tx) => tx.set(r, value, o));
        window.fbOnSnapshot = (r, callback) => {
          const k = path(r);
          window.__listeners[k] = callback;
          __subscribe(k).then((v) => callback(snapshot(v)));
          return () => {
            delete window.__listeners[k];
            __unsubscribe(k);
          };
        };
        AccountWriteGuard.install();
        StudyTime.init();
        switchTab("community");
      }, id);
      return p;
    }
    const a = await pageFor("group-a"),
      b = await pageFor("group-b");
    await a.getByRole("button", { name: "グループ", exact: true }).click();
    await a.getByRole("button", { name: "グループを作る" }).click();
    await a.locator("[data-group-name]").fill("放課後の学習");
    await a.locator(".group-friend-picker input").check();
    await a.getByRole("button", { name: "作成する", exact: true }).click();
    await a.locator(".group-chat-compose textarea").waitFor();
    await a.getByRole("button", { name: "グループ一覧に戻る" }).click();
    assert.equal(await a.locator(".group-chat-dialog").count(), 0);
    await a.getByRole("button", { name: "放課後の学習", exact: true }).click();
    await a.locator(".group-chat-compose textarea").waitFor();
    await a
      .locator(".group-chat-compose textarea")
      .fill("こんにちは <script>安全な文字</script>");
    await a.getByRole("button", { name: "送信", exact: true }).click();
    await a
      .getByText("こんにちは <script>安全な文字</script>", { exact: true })
      .waitFor();
    assert.equal(await a.locator(".group-chat-message script").count(), 0);
    assert.equal(
      await a.locator(".group-chat-message.is-self .podium-avatar img").count(),
      1,
    );
    await a.screenshot({ path: "/tmp/group-chat-ui.png" });
    await a.locator(".group-chat-compose textarea").fill("送信失敗でも残す");
    await a.evaluate(() => {
      window.__chatPaused = FirestoreReadGuard.paused;
      FirestoreReadGuard.paused = () => true;
      window.__chatComposer = document.querySelector(
        ".group-chat-compose textarea",
      );
    });
    await a.getByRole("button", { name: "送信", exact: true }).click();
    assert.equal(
      await a.locator(".group-chat-compose textarea").inputValue(),
      "送信失敗でも残す",
    );
    await a.evaluate(() => (FirestoreReadGuard.paused = __chatPaused));

    await a.getByRole("button", { name: "メンバー", exact: true }).click();
    await a.locator(".group-member-list").waitFor();
    const groupPath = [...docs.keys()].find((k) => /^studyGroups\//.test(k)),
      groupId = groupPath.split("/")[1];
    assert.equal(Object.keys(docs.get(groupPath).members).length, 2);
    assert.ok(docs.has("users/group-b/studyGroups/" + groupId));
    assert.equal(
      await a
        .getByRole("combobox", { name: "協力目標の達成方式" })
        .inputValue(),
      "individual",
    );
    assert.equal(await a.locator(".group-member-list .people-row").count(), 2);
    await a
      .getByRole("combobox", { name: "協力目標の達成方式" })
      .selectOption("sum");
    await a.getByRole("button", { name: "目標を設定" }).click();
    await a.waitForFunction(() =>
      document.querySelector(".group-goal progress"),
    );
    await a.evaluate(() => {
      for (let i = 1; i <= 100; i++) recordRankedWord("achievement-test", i);
      return StudyGroups.publish(true);
    });
    await a.waitForFunction(() =>
      document.querySelector(".group-goal").textContent.includes("達成！"),
    );
    assert.equal(docs.get(groupPath).goal.done, true);
    assert.match(
      docs.get("users/group-a/studyGroups/" + groupId).goalSummary,
      /達成/,
    );
    assert.equal(
      await a.evaluate(
        () =>
          __chatComposer ===
          document.querySelector(".group-chat-compose textarea"),
      ),
      true,
    );
    assert.equal(
      await a.locator(".group-chat-compose textarea").inputValue(),
      "送信失敗でも残す",
    );

    assert.equal(
      docs.get(groupPath).events.filter((e) => e.owner === "group-a").length,
      1,
    );
    // Achievements are posted in the talk, with a いいね button.
    await a.getByRole("button", { name: "トーク", exact: true }).click();
    assert.ok((await a.locator(".group-chat-event").count()) >= 1);
    assert.equal(await a.locator(".group-timeline").count(), 0);
    await a
      .getByRole("button", { name: "いいね 0", exact: true })
      .first()
      .click();
    await a.getByRole("button", { name: "いいね 1", exact: true }).waitFor();
    await a.getByRole("button", { name: "メンバー", exact: true }).click();
    const afterPublish = reads;
    await a.evaluate(() => StudyGroups.publish(true));
    assert.equal(
      reads,
      afterPublish,
      "unchanged totals must not perform transactions",
    );
    await a.getByLabel("協力目標の種類").selectOption("time");
    await a.getByLabel("協力目標の達成方式").selectOption("sum");
    await a.getByRole("button", { name: "目標を設定" }).click();
    await a.waitForFunction(() =>
      document
        .querySelector(".group-race-summary")
        .textContent.includes("0 / 30分"),
    );
    await a.evaluate(() => {
      StudyTime.mergeCloud({
        version: 1,
        epoch: "study-reset-2.62",
        days: {},
        offset: 1800000,
      });
      return StudyGroups.publish(true);
    });
    await a.waitForFunction(() =>
      document.querySelector(".group-goal").textContent.includes("達成！"),
    );
    assert.equal(docs.get(groupPath).goal.type, "time");
    assert.equal(docs.get(groupPath).goal.done, true);
    assert.ok(docs.get(groupPath).events.some((e) => e.text === "30分勉強"));
    await a.getByLabel("協力目標の種類").selectOption("attempts");
    await a.getByLabel("協力目標の数").fill("7");
    assert.equal(
      await a.getByLabel("協力目標の達成方式").inputValue(),
      "individual",
    );
    await a.getByRole("button", { name: "目標を設定", exact: true }).click();
    await a.waitForFunction(() =>
      document
        .querySelector(".group-race-summary")
        .textContent.includes("1人 7回"),
    );
    await a.evaluate(async () => {
      for (let i = 0; i < 7; i++) recordRankedWord("same-word", 1);
      await StudyGroups.publish(true);
    });
    assert.equal(
      docs.get(groupPath).goal.done,
      false,
      "one member cannot complete an individual goal for everyone",
    );
    assert.equal(await a.locator(".group-race-lane.is-complete").count(), 1);
    assert.equal(await a.locator(".group-race-track").count(), 2);
    await a.evaluate(
      () => (document.querySelector("dialog.group-chat-dialog").scrollTop = 0),
    );
    await a.clock.runFor(1000);
    await a.waitForTimeout(900);
    assert.equal(
      await a
        .locator(".group-race-runner")
        .first()
        .evaluate((el) => el.style.getPropertyValue("--race-progress")),
      "100%",
    );
    await a.screenshot({ path: "/tmp/group-member-race.png" });

    await b.getByRole("button", { name: "グループ", exact: true }).click();
    await b.screenshot({ path: "/tmp/group-list-ui.png" });
    // a's message makes the group unread in b's list, with a dot, until b opens the talk.
    await b.evaluate(() => {
      // The app icon shows the number of unread talks once the setting is on.
      localStorage.setItem("aiglish_app_badge", "1");
      navigator.setAppBadge = (n) => ((window.__badge = n), Promise.resolve());
      navigator.clearAppBadge = () => ((window.__badge = 0), Promise.resolve());
      return StudyGroups.load(true);
    });
    await b.waitForFunction(() => window.__badge === 1);
    const unreadRow = b.getByRole("button", { name: "放課後の学習（新しいメッセージ）", exact: true });
    await unreadRow.waitFor();
    assert.equal(await b.locator(".group-list-row.has-unread .group-list-unread").count(), 1);
    await unreadRow.click();
    await b.waitForFunction(() => window.__badge === 0);
    await b
      .getByText("こんにちは <script>安全な文字</script>", { exact: true })
      .waitFor();
    await b.locator(".group-chat-compose textarea").fill("返信です");
    await b.getByRole("button", { name: "送信", exact: true }).click();
    await b.getByText("返信です", { exact: true }).waitFor();
    await b.getByRole("button", { name: "メンバー", exact: true }).click();
    await b.evaluate(async () => {
      for (let i = 0; i < 7; i++) recordRankedWord("same-word", 1);
      await StudyGroups.publish(true);
    });
    await b.waitForFunction(
      () =>
        document.querySelectorAll(".group-race-lane.is-complete").length === 2,
    );
    assert.equal(docs.get(groupPath).goal.done, true);

    await b.getByRole("button", { name: "トーク", exact: true }).click();
    await b.getByRole("button", { name: "いいね 1", exact: true }).waitFor();
    assert.equal(
      await b
        .getByRole("button", { name: "いいね 1", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    // a's message has been read by b.
    await a.getByRole("button", { name: "トーク", exact: true }).click();
    await a.locator(".group-chat-message.is-self .group-chat-read").first().waitFor();
    await a.screenshot({ path: "/tmp/group-talk.png" });
    // Word quiz: a sends one from the shared book; b answers wrong and sees the right meaning.
    await a.locator("[data-chat-quiz]").click();
    await a.locator(".talk-quiz-preview strong").waitFor();
    assert.equal(await a.locator(".talk-quiz-preview span").count(), 4);
    const quizWord = await a.locator(".talk-quiz-preview strong").textContent();
    await a.screenshot({ path: "/tmp/talk-quiz-picker.png" });
    await a.getByRole("button", { name: "トークに送る", exact: true }).click();
    await a.locator(".talk-sheet").waitFor({ state: "detached" });
    const quizDoc = [...docs].find(([path, value]) => path.startsWith(groupPath + "/messages/") && value.quiz?.word === quizWord);
    assert.ok(quizDoc, "quiz message stored");
    assert.equal(quizDoc[1].quiz.ref.book, "groups-book");
    await b.getByRole("button", { name: "トーク", exact: true }).click();
    const bQuiz = b.locator(".talk-quiz").filter({ hasText: quizWord });
    await bQuiz.waitFor();
    assert.equal(await bQuiz.locator(".talk-quiz-result").textContent(), "タップして答える");
    const wrong = (quizDoc[1].quiz.correct + 1) % 4;
    await bQuiz.locator(".talk-quiz-options button").nth(wrong).click();
    await b.waitForFunction(
      (w) => [...document.querySelectorAll(".talk-quiz")].some((q) => q.textContent.includes(w) && /正解は「/.test(q.textContent)),
      quizWord,
    );
    assert.equal(docs.get(quizDoc[0]).answers["group-b"].c, wrong);
    const aQuiz = a.locator(".talk-quiz").filter({ hasText: quizWord });
    await a.waitForFunction(
      (w) => [...document.querySelectorAll(".talk-quiz")].some((q) => q.textContent.includes(w) && q.textContent.includes("1 / 1人が回答 · 0人正解")),
      quizWord,
    );
    assert.equal(await aQuiz.locator(".talk-quiz-options button.is-right").count(), 1);
    // English words in messages can be tapped: meaning from the word book, and a quick keep.
    await b.locator(".group-chat-compose textarea").fill("see word3 now");
    await b.getByRole("button", { name: "送信", exact: true }).click();
    await a.locator(".talk-word", { hasText: "word3" }).first().waitFor();
    await a.locator(".talk-word", { hasText: "word3" }).first().click();
    await a.locator(".talk-word-sheet .talk-word-meaning").filter({ hasText: "意味3" }).waitFor();
    await a.screenshot({ path: "/tmp/talk-word.png" });
    await a.getByRole("button", { name: "閉じる", exact: true }).last().click();
    await a.locator(".talk-word-sheet").waitFor({ state: "detached" });
    // Studying now: b is on flashcards for 15 s or more, and a's talk says so.
    await b.evaluate(() => document.body.classList.add("in-game-active"));
    await b.clock.runFor(21000);
    await a.locator(".group-studying", { hasText: "group-bさんが単語カード中" }).waitFor();
    await b.evaluate(() => document.body.classList.remove("in-game-active"));
    await b.clock.runFor(6000);
    await a.locator(".group-studying").waitFor({ state: "detached" });
    // Everyone's weak words: b's missed words reach the members tab and make a battle.
    await b.evaluate(async () => {
      for (const w of vocabList.slice(0, 11))
        GroupStudy.miss(w.word, w.meanings[0].text, {
          book: "groups-book",
          num: String(w.num),
          mid: String(w.meanings[0].id),
          sig: buildWordSignature(w),
          count: 1,
        });
      await StudyGroups.publish(true);
    });
    assert.equal(docs.get(groupPath).weak["group-b"].length, 8);
    await a.getByRole("button", { name: "メンバー", exact: true }).click();
    await a.locator(".group-weak-list li").nth(7).waitFor();
    const weakBattle = a.getByRole("button", { name: "苦手単語でグループバトル", exact: true });
    assert.equal(await weakBattle.isDisabled(), true);
    // a misses three more words: ten different meanings make a battle.
    await a.evaluate(async () => {
      for (const w of vocabList.slice(12, 15))
        GroupStudy.miss(w.word, w.meanings[0].text, {
          book: "groups-book",
          num: String(w.num),
          mid: String(w.meanings[0].id),
          sig: buildWordSignature(w),
          count: 1,
        });
      await StudyGroups.publish(true);
    });
    await a.waitForFunction(
      () => !document.querySelector(".group-weak-actions button")?.disabled,
    );
    assert.equal(await a.locator(".group-weak-list li").count(), 11);
    await a.screenshot({ path: "/tmp/group-weak.png" });
    await weakBattle.click();
    await a.locator(".group-weak-preset", { hasText: "みんなの苦手単語（11語）" }).waitFor();
    const preset = await a.evaluate(() => document.getElementById("wordDuelScreen").__presetWords(7));
    assert.equal(preset.pool.length, 11);
    assert.deepEqual(preset.books, ["groups-book"]);
    await a.keyboard.press("Escape");
    await a.locator("#wordDuelScreen").waitFor({ state: "detached" });
    await a.getByRole("button", { name: "放課後の学習", exact: true }).click();
    await a.getByRole("button", { name: "トーク", exact: true }).click();
    await b.getByRole("button", { name: "メンバー", exact: true }).click();
    await a.getByRole("button", { name: "メンバー", exact: true }).click();
    await a.screenshot({ path: "/tmp/study-group.png" });
    for (const p of [a, b]) {
      await p
        .getByRole("button", { name: "グループで単語バトル", exact: true })
        .click();
      await p
        .getByRole("button", { name: "グループで開始・参加", exact: true })
        .click();
    }
    await a.locator(".duel-options").waitFor();
    await b.locator(".duel-options").waitFor();
    const rooms = [...docs].filter(([path]) =>
      path.startsWith("wordDuelRooms/"),
    );
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0][1].groupId, groupId);
    assert.equal(Object.keys(rooms[0][1].players).length, 2);
    for (const p of [a, b]) await p.keyboard.press("Escape");
    // No group listeners remain when the group dialog or battle closes.
    assert.equal(await a.evaluate(() => Object.keys(__listeners).length), 0);
    assert.equal(await b.evaluate(() => Object.keys(__listeners).length), 0);
    await b.getByRole("button", { name: "放課後の学習", exact: true }).click();
    await b.getByRole("button", { name: "メンバー", exact: true }).click();
    await b
      .locator(".group-member-list .people-profile-button")
      .first()
      .click();
    await b
      .getByRole("heading", { name: "プロフィール", exact: true })
      .waitFor();
    await b.getByRole("button", { name: "閉じる", exact: true }).click();
    await b.waitForFunction(() => Object.keys(__listeners).length === 0);
    // Mid-deck durable checkpoint survives a real reload without replaying a swipe.
    await a.evaluate(() => {
      window.db = null;
      switchTab("vocab");
      openBookFlashcardSettings("groups-book");
    });
    await a
      .getByRole("button", { name: "カードを開始する", exact: true })
      .click();
    await a.waitForFunction(() => flashcardOriginQueue.length === 20);
    await a.evaluate(() => swipeFlashcard("right", 100, 0));
    const checkpoint = await a.evaluate(() => ({
      next: flashcardOriginQueue[flashcardCurrentIndex].en,
      index: flashcardCurrentIndex,
      count: userStats.flash_count,
    }));
    assert.equal(
      await a
        .getByRole("button", { name: "中断", exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundImage),
      "none",
    );
    await a.getByRole("button", { name: "中断", exact: true }).click();
    assert.equal(
      await a
        .locator("#nav-vocab")
        .evaluate((el) => el.classList.contains("active")),
      true,
    );
    assert.equal(
      await a.evaluate(() =>
        Object.keys(__collectGameSaveData().localStorage).some((k) =>
          /^core_v4_flash_(queue|cursor)_/.test(k),
        ),
      ),
      false,
      "device queues must not inflate cloud backups",
    );
    await a.evaluate(() => {
      const k =
        "core_v4_flash_cursor_" +
        myId +
        "_" +
        encodeURIComponent(currentTextbook);
      LearningSessionsStorage.restore(k, JSON.stringify({ index: 0 }));
    });
    assert.equal(
      await a.evaluate(
        () => FlashCheckpoint.session(currentTextbook).state.index,
      ),
      checkpoint.index,
    );
    await a.reload();
    await a.waitForFunction(() => window.FlashCheckpoint);
    if (
      await a
        .getByRole("button", { name: "ゲストとしてテストプレイ" })
        .isVisible()
    )
      await a.getByRole("button", { name: "ゲストとしてテストプレイ" }).click();
    await a.waitForFunction(() => window.__learningBootReady);
    await a.evaluate(() => {
      myId = "group-a";
      currentTextbook = "groups-book";
      textbooksPool = [{ id: currentTextbook, name: "グループ教材" }];
      vocabList = migrateVocabData(
        Array.from({ length: 20 }, (_, i) => ({
          num: i + 1,
          word: "word" + i,
          meaning: "意味" + i,
        })),
      );
      textbooksCacheMap[currentTextbook] =
        stripVocabProgressFromWords(vocabList);
      window.db = null;
      openBookFlashcardSettings(currentTextbook);
    });
    await a.getByRole("button", { name: /途中から再開/ }).click();
    await a.waitForFunction(() =>
      document.body.classList.contains("in-game-active"),
    );
    assert.equal(
      await a.evaluate(() => flashcardCurrentIndex),
      checkpoint.index,
    );
    assert.equal(
      await a.evaluate(() => flashcardOriginQueue[flashcardCurrentIndex].en),
      checkpoint.next,
    );
    await a.evaluate(() => finishFlashcardSession());
    assert.equal(
      await a.evaluate(() => FlashCheckpoint.session("groups-book")),
      null,
    );
    // Isolate warm-up rewards in this mock account; no production data is touched.
    await a.evaluate(() => localStorage.removeItem(StudyPoints.key(myId)));
    // Random warm-up uses cached words only; ratings are journaled and △ stays △.
    await a.evaluate(() => {
      window.__learningBootReady = true;
      window.__afterAppLoadHandlers.find(
        (fn) => fn.name === "startLoginWarmup",
      )();
    });
    await a.clock.fastForward(1300);
    await a
      .getByRole("heading", { name: "まずは10単語", exact: true })
      .waitFor({ state: "attached" });
    assert.equal(await a.locator(".warmup-count").textContent(), "1 / 10");
    const sharedLayout = await a.evaluate(() => {
      const normal = document.getElementById("flashcard-play-screen"),
        warm = document.querySelector(
          "dialog.flash-warmup-dialog>.flashcard-session-screen",
        );
      return {
        children: normal.children.length === warm.children.length,
        stage: !!warm.querySelector(".flashcard-deck-stage"),
        history: warm.querySelectorAll(".fc-history-bubble").length,
        duplicateIds: warm.querySelectorAll("[id]").length,
        info: !!warm.querySelector(".flashcard-info-button"),
        back: !!warm.querySelector(".flashcard-previous-button"),
      };
    });
    assert.deepEqual(sharedLayout, {
      children: true,
      stage: true,
      history: 5,
      duplicateIds: 0,
      info: true,
      back: true,
    });
    await a.screenshot({ path: "/tmp/flash-warmup-ui.png" });
    const prompt = await a
      .locator(".warmup-card .flashcard-face-front>div")
      .textContent();
    await a.locator(".warmup-card").click({ force: true });
    await a.locator("[data-warmup=so]").evaluate((b) => b.onclick());
    assert.equal(await a.locator(".warmup-count").textContent(), "2 / 10");
    assert.equal(
      await a.evaluate(() => StudyPoints.balance()),
      2,
      "a self-rated login warm-up card earns the same 2 points as any answer",
    );
    const status = await a.evaluate((prompt) => {
      const w = vocabList.find((w) => w.word === prompt);
      return LearningData.read(currentTextbook)[String(w.num)].meanings[
        String(w.meanings[0].id)
      ].status;
    }, prompt);
    assert.equal(status, "so");
    const bounds = await a.locator(".warmup-card").boundingBox();
    await a.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await a.mouse.down();
    await a.mouse.move(
      bounds.x + bounds.width / 2 + 100,
      bounds.y + bounds.height / 2,
      { steps: 5 },
    );
    await a.mouse.up();
    assert.equal(await a.locator(".warmup-count").textContent(), "3 / 10");
    for (let i = 2; i < 10; i++) {
      await a.locator(".warmup-card").click({ force: true });
      await a.locator("[data-warmup=ok]").evaluate((b) => b.onclick());
    }
    assert.equal(await a.locator(".warmup-card").isDisabled(), false);
    // A queued final double-tap cannot answer an eleventh, nonexistent card.
    await a.evaluate(() =>
      document.querySelector("[data-warmup=ok]").onclick(),
    );
    assert.equal(await a.locator(".warmup-count").textContent(), "準備完了！");
    const finishWarmup = a.getByRole("button", { name: "START", exact: true });
    await finishWarmup.waitFor();
    await a.screenshot({ path: "/tmp/warmup-start-card.png" });
    await a.evaluate(() =>
      document.documentElement.classList.add("ios-stable-rendering"),
    );
    await finishWarmup.click();
    if (process.env.REDUCED_MOTION !== "1") {
      assert.equal(await a.locator(".warmup-start-exiting").count(), 1);
      assert.equal(
        await finishWarmup.evaluate((el) => getComputedStyle(el).animationName),
        "warmupStartOpen",
      );
      assert.equal(
        await a
          .locator(".warmup-start-exiting")
          .evaluate((el) => getComputedStyle(el, "::before").animationName),
        "warmupCurtainLeft",
      );
      await a.clock.runFor(400);
      await a.screenshot({ path: "/tmp/warmup-start-opening.png" });
      assert.equal(await a.locator("#nav-vocab").isVisible(), true);
    }
    await a.clock.runFor(1200);
    await a
      .locator("dialog.flash-warmup-dialog")
      .waitFor({ state: "detached" });
    await a.waitForFunction(
      () => !document.body.classList.contains("flash-warmup-open"),
    );
    assert.equal(await a.locator("#nav-vocab").isVisible(), true);
    await a.locator("#nav-community").click();
    assert.equal(await a.locator("#view-community").isVisible(), true);
    await a.locator("#nav-vocab").click();
    await a.evaluate(() => {
      document.querySelector("#vocabLibrarySelection").hidden = true;
      document.querySelector("#vocabBookContents").hidden = false;
      renderVocabList();
    });
    assert.equal(await a.locator("[data-meaning-history]").count(), 0);
    await a.evaluate(() => {
      const key =
          "core_v4_meaning_history_" +
          myId +
          "_" +
          encodeURIComponent(currentTextbook),
        history = JSON.parse(localStorage.getItem(key) || "{}");
      for (let ago = 1; ago <= 2; ago++) {
        const d = new Date();
        d.setDate(d.getDate() - ago);
        history[StudyTimeModel.dateKey(d)] = {
          ok: 8 - ago * 3,
          so: ago + 2,
          bad: ago,
          none: 10 + ago,
          at: d.getTime(),
        };
      }
      localStorage.setItem(key, JSON.stringify(history));
      showVocabStatsPopup();
    });
    await a.getByRole("button", { name: "推移", exact: true }).click();
    await a.screenshot({ path: "/tmp/meaning-history-ui.png" });
    assert.equal(
      await a.getByRole("img", { name: "意味ごとの理解度の推移" }).count(),
      1,
    );
    assert.equal(
      await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS",
      type.name(),
      "group creation, cooperative goals, milestone reactions, no-op sync, password-free matchmaking, cleanup, durable flash resume, warm-up ratings and history",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
