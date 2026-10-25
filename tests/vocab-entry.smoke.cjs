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
        viewport: { width: 393, height: 852 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem("b3_tutorial_done", "1");
      localStorage.setItem(
        "aiglish_sound_settings",
        JSON.stringify({ enabled: false }),
      );
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(() => window.VocabWordEntry);
    await page
      .getByRole("button", { name: "ゲストで試す" })
      .click();
    await page.waitForFunction(() => window.__learningBootReady === true);
    await page.locator("#nav-vocab").click();
    await page
      .getByRole("button", { name: "＋ 単語帳を作る", exact: true })
      .click();
    await page.locator("#libraryBookName").fill("直感入力");
    await page
      .locator("#libraryBookWords")
      .fill("1:既存の単語:意味:補足\n5:番号に空きがある語:答え:");
    await page
      .getByRole("button", { name: "単語帳を作る", exact: true })
      .click();
    await page
      .locator("#vocabLibraryBooks .textbook-list-item")
      .filter({ hasText: "直感入力" })
      .click();
    await page.locator("#vocabAddWord").waitFor({ state: "visible" });
    await page.evaluate(() => {
      vocabList[0].meanings[0].status = "ok";
      vocabList[0].meanings[0].history = ["bad", "ok"];
      vocabList[0].note = "消してはいけないメモ";
      vocabList[0].sticky = true;
      saveVocabProgressLocally(1);
      __captureManualVocabDraft();
    });
    const initial = await page.evaluate(() =>
      JSON.stringify(LearningData.read(currentTextbook)),
    );
    await page.locator("#vocabAddWord").click();
    assert.equal(await page.locator("#vocabEntryNumber").inputValue(), "6");
    // 16px or more, so iOS does not zoom in when the field is focused.
    assert.ok(
      parseFloat(
        await page
          .locator("#vocabEntryWord")
          .evaluate((e) => getComputedStyle(e).fontSize),
      ) >= 16,
    );
    await page.locator("#vocabEntryWord").fill("follow");
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("〜に従う");
    await page
      .getByRole("combobox", { name: "意味 1 の品詞", exact: true })
      .selectOption("動");
    await page
      .getByRole("button", { name: "＋ 意味を追加", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "意味・答え 2", exact: true })
      .fill("〜に続く");
    await page.getByText("サブ情報・番号・単元を設定", { exact: true }).click();
    await page
      .locator("#vocabEntrySub")
      .fill("例文: Follow the rules.\n規則に従いなさい。");
    await page.locator("#vocabEntryContinue").check();
    await page.screenshot({ path: "/tmp/vocab-entry-mobile.png" });
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 393, height: 852 },
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await page
          .locator(".vocab-entry-dialog")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
        false,
      );
    }
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.match(
      await page.locator(".vocab-entry-status").innerText(),
      /#6.*follow/,
    );
    assert.equal(await page.locator("#vocabEntryNumber").inputValue(), "7");
    assert.equal(await page.locator("#vocabEntryWord").inputValue(), "");
    await page.locator("#vocabEntryWord").fill("大化の改新が始まった年");
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("645年");
    await page.locator("#vocabEntryContinue").uncheck();
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    await page.locator(".vocab-entry-dialog").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => vocabList.length), 4);
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify(LearningData.read(currentTextbook)),
      ),
      initial,
      "existing canonical ratings, memo and sticky flag stay byte-for-byte intact",
    );
    const word = await page.evaluate(() => vocabList.find((w) => w.num === 6));
    assert.equal(word.meanings.length, 2);
    assert.equal(word.meanings[0].partOfSpeech, "動");
    assert.match(word.sub, /\n/);
    await page.getByText("大化の改新が始まった年", { exact: true }).waitFor();
    // A deliberate duplicate never overwrites a word, and typed fields remain after the error.
    await page.locator("#vocabAddWord").click();
    await page.locator("#vocabEntryWord").fill("置き換えてはいけない");
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("答え");
    await page.getByText("サブ情報・番号・単元を設定", { exact: true }).click();
    await page.locator("#vocabEntryNumber").fill("1");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.match(
      await page.locator(".vocab-entry-dialog [role=alert]").innerText(),
      /使用中/,
    );
    assert.equal(
      await page.locator("#vocabEntryWord").inputValue(),
      "置き換えてはいけない",
    );
    assert.equal(await page.evaluate(() => vocabList[0].word), "既存の単語");
    // Literal syntax is stored as content, not delimiter syntax or executable markup.
    await page.locator("#vocabEntryNumber").fill("8");
    await page
      .locator("#vocabEntryWord")
      .fill('<img src=x onerror="window.__badEntry=1">');
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("a:b <b>意味</b> ①補足");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__badEntry), undefined);
    assert.match(
      await page.locator("#vocabListContainer").innerText(),
      /a:b <b>意味<\/b>/,
    );
    assert.equal(
      await page.locator("#vocabListContainer img[src=x]").count(),
      0,
    );
    const book = await page.evaluate(() => currentTextbook);
    await page.reload();
    await page.waitForFunction(() => window.VocabWordEntry);
    await page.locator("#nav-vocab").click();
    await page.evaluate((book) => selectVocabLibraryBook(book), book);
    await page.waitForFunction(() => vocabList.length === 5);
    assert.equal(
      await page.evaluate(() => vocabList[0].note),
      "消してはいけないメモ",
    );
    assert.equal(
      await page.evaluate(() => vocabList[0].meanings[0].status),
      "ok",
    );
    // A newer local draft (for example another tab) is the source at save time; auto-numbering is recalculated.
    await page.locator("#vocabAddWord").click();
    await page.locator("#vocabEntryWord").fill("同時編集後");
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("保持する");
    await page.evaluate(() => {
      const d = VocabMaster.resolve(currentTextbook);
      d.master.push({ num: 9, word: "別のタブの追加", meaning: "意味" });
      d.savedAt = new Date(Date.now() + 1).toISOString();
      localStorage.setItem(
        __manualVocabLocalKey(currentTextbook),
        JSON.stringify(d),
      );
    });
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => vocabList.find((w) => w.word === "同時編集後").num,
      ),
      10,
    );
    assert.equal(
      await page.evaluate(() =>
        vocabList.some((w) => w.word === "別のタブの追加"),
      ),
      true,
    );
    // Block edits on a shared textbook without editing permission.
    await page.evaluate(() => {
      textbooksPool.push({ id: "entry-shared", name: "配信専用" });
      textbooksCacheMap["entry-shared"] = [
        { num: 1, word: "shared", meaning: "意味" },
      ];
    });
    await page.evaluate(() => selectVocabLibraryBook("entry-shared"));
    assert.equal(await page.locator("#vocabAddWord").isVisible(), false);
    await page.evaluate(() => showVocabLibrarySelection());
    await page
      .getByRole("button", { name: "＋ 単語帳を作る", exact: true })
      .click();
    await page.locator("#libraryBookName").fill("空から追加");
    await page
      .getByRole("button", { name: "単語帳を作る", exact: true })
      .click();
    await page
      .locator("#vocabLibraryBooks .textbook-list-item")
      .filter({ hasText: "空から追加" })
      .click();
    await page.locator("#vocabAddWord").click();
    assert.equal(await page.locator("#vocabEntryNumber").inputValue(), "1");
    await page.locator("#vocabEntryWord").fill("最初の語");
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("答え");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.equal(await page.evaluate(() => vocabList.length), 1);
    // Public updates use the existing publisher, and failed cloud writes never undo the local addition.
    await page.evaluate(async () => {
      myId = "entry-public";
      const record = {
        id: "entry-public-book",
        name: "公開入力",
        personal: true,
        visibility: "public",
      };
      localStorage.setItem(
        "core_v4_personal_library_entry-public",
        JSON.stringify({ books: [record], hidden: [] }),
      );
      textbooksPool = [record];
      textbooksCacheMap[record.id] = [
        { num: 1, word: "公開済み", meaning: "意味" },
      ];
      window.db = {};
      window.__entryWrites = [];
      window.fbDoc = (_, ...parts) => parts.join("/");
      window.fbCollection = window.fbDoc;
      window.fbGetDocs = async () => ({ docs: [], forEach() {} });
      window.fbGetDoc = async () => ({ exists: () => false });
      window.fbSetDoc = async (...args) => {
        window.__entryWrites.push(args);
      };
      await selectVocabLibraryBook(record.id);
    });
    await page.locator("#vocabAddWord").click();
    await page.locator("#vocabEntryWord").fill("公開追加");
    await page
      .getByRole("textbox", { name: "意味・答え 1", exact: true })
      .fill("追加した意味");
    await page.getByRole("button", { name: "追加する", exact: true }).click();
    assert.equal(
      await page.evaluate(() => __entryWrites.length),
      0,
      "entry itself performs no cloud writes",
    );
    await page.evaluate(() => {
      window.fbSetDoc = async () => {
        throw Error("quota");
      };
    });
    assert.equal(
      await page.evaluate(() => VocabWordEntry.flushPublications()),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => VocabMaster.resolve(currentTextbook).master.length,
      ),
      2,
    );
    await page.evaluate(() => {
      window.fbSetDoc = async (...args) => {
        window.__entryWrites.push(args);
      };
    });
    assert.equal(
      await page.evaluate(() => VocabWordEntry.flushPublications()),
      true,
    );
    assert.equal(
      await page.evaluate(() => VocabWordEntry.flushPublications()),
      true,
    );
    const publication = await page.evaluate(() => __entryWrites);
    assert.equal(publication.length, 1);
    assert.equal(publication[0][0], "publicTextbooks/entry-public-book");
    const publicWords = JSON.parse(publication[0][1].masterJson);
    assert.equal(publicWords[1].word, "公開追加");
    assert.equal(publicWords[1].note, undefined);
    assert.equal(publicWords[1].status, undefined);
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        type.name() +
        ": structured add, multiple meanings and POS, continuation, safe duplicate handling, literal text, restart and canonical progress preservation, fresh numbering and permissions",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
