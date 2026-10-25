const { chromium, webkit } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const type = process.env.BROWSER === "webkit" ? webkit : chromium,
    b = await type.launch(
      type === chromium
        ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
        : { executablePath: process.env.WEBKIT_EXECUTABLE_PATH },
    );
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://**/*", (r) => r.abort());
    await p.goto("http://127.0.0.1:8000");
    await p.getByRole("button", { name: "ゲストで試す" }).click();
    await p.waitForFunction(
      () => window.__learningBootReady && window.FileBackups,
    );
    await p.evaluate(() => {
      myId = "file-user";
      localStorage.setItem("core_v4_userId", "file-user");
      myName = "ファイル確認";
      StudyPoints.restore({ balance: 50, revision: 5 });
      currentTextbook = "file-book";
      textbooksPool = [
        { id: "file-book", name: "ファイル教材" },
        { id: "other-book", name: "別の教材" },
      ];
      vocabList = migrateVocabData([
        {
          num: 1,
          word: "save",
          meaning: "保存",
          meanings: [{ id: "1-0", text: "保存", status: "ok" }],
        },
      ]);
      textbooksCacheMap["file-book"] = stripVocabProgressFromWords(vocabList);
      textbooksCacheMap["other-book"] = [
        {
          num: 1,
          word: "restore",
          meaning: "復元",
          meanings: [{ id: "1-0", text: "復元" }],
        },
      ];
      LearningData.commit(
        "other-book",
        {
          1: {
            sig: "1::restore::復元",
            status: "ok",
            editedAt: 100,
            meanings: { "1-0": { status: "ok" } },
          },
        },
        1,
        true,
      );
      localStorage.setItem("core_v4_geminiKey", "secret-api-key");
      localStorage.setItem(
        "core_v4_users",
        JSON.stringify([{ id: "other", pin: "secret-pin" }]),
      );
      localStorage.setItem(
        "core_v4_user_stats_file-user_other",
        JSON.stringify({ secret: "other-account" }),
      );
      localStorage.setItem(
        "core_v4_personal_library_file-user",
        JSON.stringify({
          books: textbooksPool,
          hidden: [],
          savedAt: new Date().toISOString(),
        }),
      );
      localStorage.setItem(
        "vv4_works_file-user",
        JSON.stringify([
          {
            id: "work",
            name: "ワーク",
            units: [{ id: "1", num: 1, q: "1+1", ans: "2", status: "ok" }],
          },
        ]),
      );
      localStorage.setItem("vv4_works_file-user__ts", String(Date.now()));
      localStorage.setItem(
        "core_v4_vocab_entry_publications_file-user",
        JSON.stringify({ "other-book": "2026-10-18T00:00:00Z" }),
      );
      localStorage.setItem(
        "core_v4_vocab_note_sharing_file-user_private",
        JSON.stringify({ shared: false, savedAt: new Date().toISOString() }),
      );
      window.queueBackgroundSave = () => {};
      window.db = {};
      window.fileCloudCalls = 0;
      window.fbGetDoc =
        window.fbGetDocs =
        window.fbRunTransaction =
          async () => {
            fileCloudCalls++;
            throw Error("quota blocked");
          };
      window.saveUserStats = () => {};
      StudyTime.init();
      StudyTime.mergeCloud({
        version: 1,
        epoch: "study-reset-2.62",
        days: {},
        offset: 120000,
      });
    });
    await p.evaluate(() =>
      window.__afterAppLoadHandlers.find(
        (fn) => fn.name === "startLoginWarmup",
      )(),
    );
    await p.locator(".flash-warmup-dialog[open]").waitFor();
    await p.locator(".flash-warmup-dialog [data-library-close]").click();
    // Saving is automatic: there is no header save button, and the backup is in データとバックアップ.
    await p.evaluate(() => injectHeaderSaveButton());
    assert.equal(await p.locator("#headerSaveBtn").count(), 0);
    await p.evaluate(() => window.openCloudUsage());
    await p.locator(".cloud-usage-dialog summary", { hasText: "ファイルにバックアップ" }).click();
    await p.getByRole("button", { name: "書き出す", exact: true }).waitFor();
    const downloaded = p.waitForEvent("download", { timeout: 15000 });
    downloaded.catch(() => {});
    await p.getByRole("button", { name: "書き出す", exact: true }).click();
    const download = await downloaded,
      raw = fs.readFileSync(await download.path(), "utf8"),
      backup = JSON.parse(raw);
    assert.equal(backup.owner, "file-user");
    assert.equal(
      JSON.parse(backup.data.localStorage["core_v4_study_points_file-user"])
        .balance,
      50,
    );
    assert.ok(backup.data.memory.vocabBooks["other-book"]);
    assert.equal(
      JSON.parse(
        backup.data.localStorage["core_v4_vocab_entry_publications_file-user"],
      )["other-book"],
      "2026-10-18T00:00:00Z",
    );
    assert.equal(
      JSON.parse(
        backup.data.localStorage[
          "core_v4_vocab_note_sharing_file-user_private"
        ],
      ).shared,
      false,
    );
    for (const secret of ["secret-api-key", "secret-pin", "other-account"])
      assert.equal(raw.includes(secret), false);
    assert.equal(await p.evaluate(() => fileCloudCalls), 0);
    await p.evaluate(() => {
      const w = vocabList[0];
      w.meanings[0].status = "bad";
      w.status = "bad";
      w.note = "新しいメモ";
      saveVocabProgressLocally(w.num);
      delete textbooksCacheMap["other-book"];
      delete __manualVocabDrafts["other-book"];
      for (const key of [
        "core_v4_cache_other-book",
        "core_v4_custom_words_file-user_other-book",
        "core_v4_user_vocab_progress_file-user_other-book",
        "aiglish_learning_recovery_file-user_other-book",
      ])
        localStorage.removeItem(key);
      StudyTime.mergeCloud({
        version: 1,
        epoch: "study-reset-2.62",
        days: {},
        offset: 180000,
      });
    });
    // Both invalid accounts and damaged files are rejected before changing storage.
    const before = await p.evaluate(() =>
      localStorage.getItem(getVocabProgressStorageKey("file-book")),
    );
    await p.evaluate((backup) => {
      for (const value of [
        { ...backup, owner: "another-user" },
        { ...backup, checksum: "broken" },
      ]) {
        let rejected = false;
        try {
          FileBackups.validate(value, myId);
        } catch {
          rejected = true;
        }
        if (!rejected) throw Error("invalid file accepted");
      }
    }, backup);
    assert.equal(
      await p.evaluate(() =>
        localStorage.getItem(getVocabProgressStorageKey("file-book")),
      ),
      before,
    );
    await p.locator(".file-backup-actions input[type=file]").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    });
    await p
      .getByRole("button", { name: "この内容を復元する", exact: true })
      .click();
    await p
      .getByText(
        "端末への復元が完了しました。クラウド同期は接続後に行います。",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await p.evaluate(
        () => LearningData.read("file-book")[1].meanings["1-0"].status,
      ),
      "bad",
    );
    assert.equal(
      await p.evaluate(() => LearningData.read("file-book")[1].note),
      "新しいメモ",
    );
    assert.equal(
      await p.evaluate(
        () => LearningData.read("other-book")[1].meanings["1-0"].status,
      ),
      "ok",
    );
    assert.equal(
      await p.evaluate(() => VocabMaster.resolve("other-book").master[0].word),
      "restore",
    );
    assert.ok(
      (await p.evaluate(() => StudyTimeModel.total(StudyTime.snapshot()))) >=
        180000,
    );
    assert.equal(
      await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("vv4_works_file-user"))[0].units[0]
            .ans,
      ),
      "2",
    );
    assert.equal(await p.evaluate(() => fileCloudCalls), 0);
    await p.evaluate(() => {
      window.sharedFiles = 0;
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          if (data.files[0].type !== "application/json")
            throw Error("unexpected file");
          sharedFiles++;
        },
      });
    });
    await p.getByRole("button", { name: "書き出す", exact: true }).click();
    await p
      .getByRole("button", { name: "ファイルに保存・共有", exact: true })
      .waitFor();
    assert.equal(await p.evaluate(() => sharedFiles), 0);
    await p
      .getByRole("button", { name: "ファイルに保存・共有", exact: true })
      .click();
    await p.waitForFunction(() => sharedFiles === 1);
    await p.evaluate(() => {
      localStorage.setItem("core_v4_userId", "file-user");
      return AppStorage.flush();
    });
    await p.reload();
    await p.waitForFunction(
      () => window.__learningBootReady && myId === "file-user",
    );
    assert.equal(
      await p.evaluate(
        () => LearningData.read("file-book")[1].meanings["1-0"].status,
      ),
      "bad",
    );
    assert.equal(
      await p.evaluate(
        () => LearningData.read("other-book")[1].meanings["1-0"].status,
      ),
      "ok",
    );
    assert.equal(
      await p.evaluate(() => VocabMaster.resolve("other-book").master[0].word),
      "restore",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS",
      type.name(),
      "file download/preview/restore with zero cloud reads, account and checksum checks, credentials excluded, multiple books and work preserved, newer ratings/notes/study time retained",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
