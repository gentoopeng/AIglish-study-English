// The analysis of a published passage is shared too, so a person without an API key can read it: written once with the publish (no
// word-book parts, no < >), flagged on the passage ("解析あり"), opened with one read and no AI.
const { chromium } = require("playwright"), assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }), errors = [];
    let aiCalls = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (r) => r.abort());
    await page.route("https://generativelanguage.googleapis.com/**", (r) => { aiCalls++; r.abort(); });
    await page.addInitScript(() => { localStorage.setItem("b3_tutorial_done", "1"); localStorage.setItem("aiglish_sound_settings", JSON.stringify({ enabled: false })); });
    await page.goto("http://127.0.0.1:8000");
    await page.getByRole("button", { name: "ゲストで試す" }).click();
    await page.waitForFunction(() => window.__learningBootReady === true && window.ReaderShared && window.renderBookshelf);
    await page.evaluate(() => {
      window.__docs = new Map(); window.__reads = 0;
      window.db = {};
      window.fbDoc = (_, ...p) => ({ path: p.join("/") });
      window.fbCollection = window.fbDoc;
      window.fbOrderBy = (field, dir) => ({ order: [field, dir] });
      window.fbLimit = (n) => ({ limit: n });
      window.fbStartAfter = (d) => ({ after: d });
      window.fbQuery = (ref, ...c) => ({ ref, c });
      const snapOf = (path) => ({ id: path.split("/").pop(), data: () => structuredClone(__docs.get(path)), exists: () => __docs.has(path) });
      window.fbGetDoc = async (ref) => { if (/^sharedReaderAnalyses/.test(ref.path)) __reads++; return snapOf(ref.path); };
      window.fbGetDocs = async (q) => {
        const ref = q.ref || q, cs = q.c || [];
        let paths = [...__docs.keys()].filter((p) => p.startsWith(ref.path + "/") && p.split("/").length === ref.path.split("/").length + 1);
        for (const c of cs) { if (c.order) paths.sort((a, b) => __docs.get(b)[c.order[0]] - __docs.get(a)[c.order[0]]); if (c.limit) paths = paths.slice(0, c.limit); }
        return { docs: paths.map((p) => ({ ...snapOf(p), ref: { path: p } })) };
      };
      window.fbRunTransaction = async (_, cb) => cb({ get: async (ref) => snapOf(ref.path), set: (ref, value, options) => { __docs.set(ref.path, options && options.merge ? { ...(__docs.get(ref.path) || {}), ...value } : structuredClone(value)); } });
      window.fbDeleteDoc = async (ref) => { __docs.delete(ref.path); };
      window.__as = (id, name) => { myId = id; myName = name; ["aiglish_reader_shared_hidden", "aiglish_reader_texts_mine", "aiglish_reader_analysis_shared"].forEach((k) => localStorage.removeItem(k)); };
    });
    const only = (re) => page.evaluate((src) => [...__docs.entries()].filter(([k]) => new RegExp(src).test(k)), re.source);
    const TEXT = "Plastic waste is a serious problem in the ocean. Many animals suffer from it.";
    const analysis = {
      fullSummaryAbstract: "海のプラスチックごみの問題。",
      sentences: [
        { text: "Plastic waste is a serious problem in the ocean.", translation: "プラスチックごみは海の深刻な問題だ。<img src=x onerror=window.__xss=1>", grammarHighlights: [{ phrase: "a serious problem", label: "名詞句", meaning: "深刻な問題" }], vocab: [{ book: "mine", num: "1", meaning: 1 }] },
        { text: "Many animals suffer from it.", translation: "多くの動物が苦しんでいる。", grammarHighlights: [], vocab: [] },
      ],
      vocabChecked: true, vocabBooks: ["mine"],
    };
    await page.locator("#nav-reader").click();
    await page.locator("#readerTabBtnBookshelf").click();

    // U1 saves the analysed passage and publishes it: the passage, and its analysis once.
    await page.evaluate(() => __as("U1", "たろう"));
    await page.evaluate(([text, a]) => window.showCustomSaveBookshelfPrompt(text, "第1問 環境", a), [TEXT, analysis]);
    await page.locator("#confirmSaveBookshelfBtn").click();
    await page.locator("dialog.app-alert button").first().click();
    await page.waitForFunction(() => [...__docs.keys()].some((k) => /^sharedReaderAnalyses\//.test(k)));
    const [[, doc]] = await only(/^sharedReaderAnalyses\//);
    const shared = JSON.parse(doc.json);
    assert.deepEqual([doc.v, doc.by, doc.name], [1, "U1", "たろう"]);
    assert.equal(shared.sentences.length, 2);
    assert.deepEqual(shared.sentences.map((x) => x.vocab), [[], []], "word-book parts are personal and stay out");
    assert.equal(shared.vocabChecked, false);
    assert.equal(/[<>]/.test(doc.json), false, "no < or >");
    const [[, text]] = await only(/^sharedReaderTexts\//);
    assert.equal(text.hasAnalysis, true);

    // U2: the list says 解析あり; one read opens it, without the AI; the page shows the sentences as text.
    await page.evaluate(() => { __as("U2", "はなこ"); currentShelfView = "shared"; window.renderBookshelf(); });
    await page.getByRole("button", { name: "みんなの長文を読み込む" }).click();
    const row = page.locator("#myBookshelfContainer .shelf-entry", { hasText: "第1問 環境" });
    await row.waitFor();
    assert.match(await row.innerText(), /解析あり/);
    await row.locator(".textbook-list-item").click();
    const before = await page.evaluate(() => __reads);
    await page.getByRole("button", { name: "みんなの解析で開く" }).click();
    await page.locator(".sentence-ja", { hasText: "多くの動物が苦しんでいる。" }).waitFor({ timeout: 10000 });
    assert.equal(await page.evaluate(() => __reads), before + 1, "one read");
    assert.equal(aiCalls, 0, "no AI");
    assert.equal(await page.evaluate(() => window.__xss === 1), false);
    assert.equal(await page.locator("#summaryJaContainer img, .sentence-ja img").count(), 0);
    assert.equal(await page.locator(".grammar-span").count(), 1, "the grammar point is there");
    assert.deepEqual(errors, []);
    console.log("reader shared analysis smoke passed");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
