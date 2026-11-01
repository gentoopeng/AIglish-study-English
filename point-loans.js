// Lending points between users: send or lend, ask to borrow, ask to be paid back (請求), repay,
// and the history of all of it, per pair of people.
//
// Cloud: pointLoans/{a__b} holds the pair's entries (the shared history) and which money
// entries the receiver has already added to their wallet. pointLoanInbox/{id} lists the pairs a
// person has, with the time of the newest change, so one read shows what is new.
//
// Points move inside one transaction with the record: the sender's wallet goes down with the
// entry written, and the receiver's goes up when their device marks the entry claimed. Nothing
// can be paid twice, and no wallet is ever written by anyone but its owner.
(function () {
  "use strict";
  const L = window.PointLoansModel;
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const myNameNow = () => String((typeof myName === "string" && myName) || uid()).slice(0, 24);
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const newId = () => Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const pairRef = (key) => window.fbDoc(window.db, "pointLoans", key);
  const inboxRef = (id) => window.fbDoc(window.db, "pointLoanInbox", id);
  const walletRef = (id) => window.fbDoc(window.db, "users", id, "learningPoints", "main");
  function ready() {
    if (uid() === "GUEST-000") throw Error("ポイントの貸し借りはログインしたアカウントで使えます。");
    if (!window.db || !window.fbRunTransaction || !window.fbGetDoc) throw Error("クラウドにつながっていません。");
    if (window.FirestoreReadGuard?.paused?.()) throw Error("クラウドの利用上限に達しています。時間をおいてお試しください。");
  }
  function walletWrite(tx, id, wallet, balance) {
    const value = { balance, revision: (Number(wallet.revision) || 0) + 1 };
    tx.set(walletRef(id), value, { merge: true });
    tx.set(window.fbDoc(window.db, "users", id), { studyPoints: balance }, { merge: true });
    return value;
  }
  // Both inboxes learn about the change; the record keeps both names for the history.
  function touch(tx, me, other, otherName, key, at) {
    tx.set(inboxRef(other), { pairs: { [key]: { other: me, name: myNameNow(), at } } }, { merge: true });
    tx.set(inboxRef(me), { pairs: { [key]: { other, name: otherName, at } } }, { merge: true });
  }
  const shell = (record, me, other, otherName) => ({ ...(record || {}), people: [me, other].sort(), names: { ...(record?.names || {}), [me]: myNameNow(), [other]: otherName } });
  const after = (value) => {
    if (value) window.StudyPoints?.restore?.({ ...value, publishedRevision: value.revision });
  };

  // ---- Moves -----------------------------------------------------------------------------
  // Pair records as last read or written, so a screen can come up at once and refresh behind.
  const records = new Map();
  const remember = (key, record) => (records.set(uid() + "\n" + key, record), record);
  const known = (key) => records.get(uid() + "\n" + key) || null;
  // rate: interest on a loan (one of PointLoansModel.RATES).
  async function send(other, otherName, amount, kind, note, request, rate = 0) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    let written = null;
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const [walletSnap, pairSnap] = [await tx.get(walletRef(me)), await tx.get(pairRef(key))];
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        have = Number(wallet.balance) || 0,
        n = L.amountOf(amount);
      if (have < n) throw Error("ポイントが足りません（所持 " + fmt(have) + "pt）。");
      const record = L.send(pairSnap.exists() ? pairSnap.data() : null, { id: newId(), from: me, to: other, amount: n, kind, note, at, request, rate: kind === "lend" ? rate : 0 });
      written = shell(record, me, other, otherName);
      tx.set(pairRef(key), written);
      touch(tx, me, other, otherName, key, at);
      return walletWrite(tx, me, wallet, have - n);
    });
    remember(key, written);
    after(value);
  }
  async function ask(other, otherName, amount, kind, note) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    const written = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      const record = shell(L.ask(snap.exists() ? snap.data() : null, { id: newId(), from: me, to: other, amount, kind, note, at }), me, other, otherName);
      tx.set(pairRef(key), record);
      touch(tx, me, other, otherName, key, at);
      return record;
    });
    remember(key, written);
  }
  async function closeRequest(other, otherName, id) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    const written = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      if (!snap.exists()) throw Error("記録が見つかりません。");
      const record = shell(L.close(snap.data(), { id, by: me, at }), me, other, otherName);
      tx.set(pairRef(key), record);
      touch(tx, me, other, otherName, key, at);
      return record;
    });
    remember(key, written);
  }
  // Adds what was sent to me into my wallet, once.
  async function claim(key) {
    const me = uid();
    let got = [];
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const [walletSnap, pairSnap] = [await tx.get(walletRef(me)), await tx.get(pairRef(key))];
      got = [];
      if (!pairSnap.exists()) return null;
      const record = pairSnap.data(),
        due = L.unclaimed(record, me);
      remember(key, record);
      if (!due.length) return null;
      got = due.map((e) => ({ amount: e.amount, name: record.names?.[e.from] || e.from, kind: e.kind }));
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        claimed = { ...(record.claimed || {}) };
      for (const e of due) claimed[e.id] = Date.now();
      tx.set(pairRef(key), { claimed }, { merge: true });
      remember(key, { ...record, claimed });
      return walletWrite(tx, me, wallet, (Number(wallet.balance) || 0) + due.reduce((a, e) => a + e.amount, 0));
    });
    after(value);
    return got;
  }
  // The casino as the other side: a loss that goes past the wallet (an accident in すごろくビンゴ)
  // is a loan from the casino that was spent at once (marked claimed, so it never reaches the
  // wallet), with one 請求 for everything owed. It is paid back like any other debt.
  const CASINO = "CASINO",
    CASINO_NAME = "カジノ";
  async function owe(amount, note) {
    ready();
    const me = uid(),
      key = L.pairKey(me, CASINO),
      at = Date.now();
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key)),
        lend = newId();
      let record = L.send(snap.exists() ? snap.data() : null, { id: lend, from: CASINO, to: me, amount, kind: "lend", note, at });
      record.claimed = { ...(record.claimed || {}), [lend]: at };
      for (const e of record.entries) if (e.status === "open" && e.kind === "ask-repay" && e.from === CASINO) Object.assign(e, { status: "cancelled", resolvedAt: at });
      record = L.ask(record, { id: newId(), from: CASINO, to: me, amount: Math.min(L.MAX_AMOUNT, L.net(record.entries, CASINO)), kind: "ask-repay", note, at });
      tx.set(pairRef(key), remember(key, { ...record, people: [me, CASINO].sort(), names: { ...(record.names || {}), [me]: myNameNow(), [CASINO]: CASINO_NAME } }));
      tx.set(inboxRef(me), { pairs: { [key]: { other: CASINO, name: CASINO_NAME, at } } }, { merge: true });
    });
  }
  // The pairs a person has. The last list read is kept on this device so the list screen can
  // come up at once.
  const inboxName = () => "aiglish_loans_inbox_" + uid();
  function inboxKept() {
    try {
      return JSON.parse(localStorage.getItem(inboxName()) || "null");
    } catch {
      return null;
    }
  }
  async function inbox() {
    const snap = await window.fbGetDoc(inboxRef(uid()));
    const pairs = snap.exists() ? snap.data().pairs || {} : {};
    try {
      localStorage.setItem(inboxName(), JSON.stringify(pairs));
    } catch {}
    return pairs;
  }
  async function record(key) {
    const snap = await window.fbGetDoc(pairRef(key));
    return remember(key, snap.exists() ? snap.data() : { entries: [] });
  }
  const seenName = () => "aiglish_loans_seen_" + uid();
  function seen() {
    try {
      return JSON.parse(localStorage.getItem(seenName()) || "{}");
    } catch {
      return {};
    }
  }
  function markSeen(key, at) {
    try {
      localStorage.setItem(seenName(), JSON.stringify({ ...seen(), [key]: at }));
    } catch {}
  }
  // On start: collect anything sent to me since the last look and say so.
  // `given`: the pairs when they were just read.
  async function collect(given) {
    try {
      ready();
    } catch {
      return [];
    }
    const pairs = given || (await inbox()),
      last = seen(),
      got = [];
    for (const [key, pair] of Object.entries(pairs)) {
      if ((pair.at || 0) <= (last[key] || 0)) continue;
      got.push(...(await claim(key)));
      markSeen(key, pair.at || Date.now());
    }
    for (const g of got) window.showToast?.(g.name + "さんから " + fmt(g.amount) + "pt " + (g.kind === "repay" ? "返ってきました" : "届きました"), "success");
    return got;
  }

  // ---- Screen ----------------------------------------------------------------------------
  let dialog = null;
  function closeDialog() {
    dialog?.close();
    dialog?.remove();
    dialog = null;
  }
  function frame(title) {
    closeDialog();
    // The same frame as the points dialog it opens from.
    dialog = node("dialog", "study-points-dialog loans-dialog");
    dialog.setAttribute("aria-label", title);
    const head = node("header", "loans-head");
    const back = node("button", "loans-close", "×");
    back.type = "button";
    back.setAttribute("aria-label", "貸し借りを閉じる");
    back.onclick = closeDialog;
    head.append(node("h2", "", title), back);
    const body = node("div", "loans-body");
    dialog.append(head, body);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
    document.body.append(dialog);
    dialog.showModal();
    return body;
  }
  const errorLine = () => {
    const p = node("p", "loans-error");
    p.setAttribute("role", "status");
    return p;
  };
  const when = (at) => (at ? new Date(at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const standing = (n, name) => (n > 0 ? name + "さんに " + fmt(n) + "pt 貸しています" : n < 0 ? name + "さんから " + fmt(-n) + "pt 借りています" : "貸し借りはありません");

  // The list of people, newest change first. It comes up at once from the list and records kept
  // on this device; the cloud's copies (read side by side, not one after another) follow, and
  // anything sent to this player is collected behind them.
  async function open() {
    const body = frame("ポイントの貸し借り");
    const status = errorLine();
    const balance = node("p", "loans-balance");
    const showBalance = () => (balance.textContent = "所持ポイント " + fmt(window.StudyPoints?.balance() || 0) + "pt");
    showBalance();
    body.append(balance, status);
    try {
      ready();
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    const list = node("ul", "loans-people");
    body.append(list, node("p", "loans-hint", "相手のプロフィールの「貸す」「借りたいと頼む」から始められます。"));
    const me = uid(),
      shown = dialog;
    const draw = (pairs, loading) => {
      if (dialog !== shown) return;
      const rows = Object.entries(pairs || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)),
        last = seen();
      list.replaceChildren();
      if (!rows.length) list.append(node("li", "loans-empty", loading ? "読み込んでいます…" : "まだ貸し借りはありません。"));
      for (const [key, pair] of rows) {
        const rec = known(key),
          name = rec?.names?.[pair.other] || pair.name || pair.other,
          n = rec ? L.net(rec.entries, me) : null,
          asks = rec ? L.openFor(rec, me).length : 0;
        const b = node("button", "loans-person");
        b.type = "button";
        const side = n === null ? "" : n > 0 ? "lent" : n < 0 ? "owe" : "even";
        b.append(
          node("b", "", name),
          node("span", "loans-standing" + (side ? " is-" + side : ""), n === null ? "…" : n > 0 ? fmt(n) + "pt 貸しています" : n < 0 ? fmt(-n) + "pt 借りています" : "貸し借りはありません"),
        );
        if (asks) b.append(node("em", "loans-badge", "返事待ち " + asks));
        else if ((pair.at || 0) > (last[key] || 0)) b.append(node("em", "loans-badge", "新着"));
        b.onclick = () => person(pair.other, name);
        const li = node("li");
        li.append(b);
        list.append(li);
      }
    };
    draw(inboxKept(), true);
    try {
      const pairs = await inbox();
      draw(pairs);
      await Promise.all(Object.keys(pairs).map((key) => record(key).catch(() => null)));
      draw(pairs);
      // Anything sent to me since the last look comes into the wallet.
      const got = await collect(pairs);
      if (got.length) {
        showBalance();
        draw(pairs);
      }
    } catch (error) {
      status.textContent = error?.message || "読み込めませんでした。";
    }
  }

  // One person: where we stand, their requests to me, one form for what I can do (chosen with
  // tabs: 貸す / 返す / 借りる / 請求), my own open requests, and the history. It comes up at once
  // from the record as last seen and is drawn again when the cloud's copy is in.
  const RATE_TEXT = (rate) => (rate ? Math.round(rate * 100) + "%" : "なし");
  async function person(other, name, choice) {
    const body = frame(name + "さんとの貸し借り");
    const me = uid(),
      key = L.pairKey(me, other),
      shown = dialog,
      casino = other === CASINO;
    try {
      ready();
    } catch (error) {
      const status = errorLine();
      status.textContent = error.message;
      body.append(status);
      return;
    }
    // What the form is set to, kept across redraws.
    const form = { mode: choice?.mode || null, amount: choice?.amount || "", rate: 0, note: "", request: choice?.request || null };
    const draw = (rec, loading) => {
      if (dialog !== shown) return;
      body.replaceChildren();
      const status = errorLine();
      const n = L.net(rec.entries, me),
        owe = L.owedBy(rec.entries, me),
        lent = Math.max(0, n),
        redraw = (next) => person(other, name, next);
      // Where we stand.
      const summary = node("div", "loans-summary is-" + (n > 0 ? "lent" : n < 0 ? "owe" : "even"));
      summary.append(node("small", "", n > 0 ? name + "さんに貸している" : n < 0 ? name + "さんから借りている" : "いまの貸し借り"), node("strong", "", fmt(Math.abs(n)) + "pt"), node("p", "", standing(n, name)));
      if (loading) summary.append(node("p", "loans-loading", "最新の記録を確かめています…"));
      body.append(summary, node("p", "loans-balance", "所持ポイント " + fmt(window.StudyPoints?.balance() || 0) + "pt"), status);
      const act = (fn) => async () => {
        status.textContent = "";
        try {
          await fn();
        } catch (error) {
          status.textContent = error?.message || "うまくいきませんでした。もう一度お試しください。";
        }
      };
      // Requests waiting for my answer.
      for (const e of L.openFor(rec, me)) {
        const card = node("div", "loans-request");
        card.append(node("p", "", e.kind === "ask-lend" ? name + "さんが " + fmt(e.amount) + "pt 借りたいそうです" : name + "さんから " + fmt(e.amount) + "pt の請求です"));
        if (e.note) card.append(node("small", "", "「" + e.note + "」"));
        const row = node("div", "loans-actions");
        const no = node("button", "", "断る");
        no.type = "button";
        no.onclick = act(async () => {
          await closeRequest(other, name, e.id);
          redraw();
        });
        // A 請求 from the casino cannot be declined.
        if (!casino) row.append(no);
        if (e.kind === "ask-lend") {
          // Lending against a request: the form opens with the amount, to choose the interest.
          const yes = node("button", "loans-primary", "条件を決めて貸す");
          yes.type = "button";
          yes.onclick = () => Object.assign(form, { mode: "lend", amount: String(e.amount), request: e.id }) && paint();
          row.append(yes);
        } else {
          const yes = node("button", "loans-primary", "払う");
          yes.type = "button";
          yes.onclick = act(async () => {
            await send(other, name, Math.min(e.amount, L.owedBy(rec.entries, me)), "repay", "", e.id);
            redraw();
          });
          row.append(yes);
        }
        card.append(row);
        body.append(card);
      }
      // What I can do: the casino only takes repayments; 返す needs a debt, 請求 a loan.
      const modes = casino
        ? [["repay", "返す", !owe]]
        : [["lend", "貸す", false], ["repay", "返す", !owe], ["borrow", "借りる", false], ["claim", "請求", !lent]];
      if (!form.mode || modes.find((m) => m[0] === form.mode)?.[2]) form.mode = (modes.find((m) => !m[2]) || modes[0])[0];
      const panel = node("div", "loans-form");
      const tabs = node("div", "loans-tabs");
      tabs.setAttribute("role", "tablist");
      for (const [mode, label, off] of modes) {
        const t = node("button", "loans-tab", label);
        t.type = "button";
        t.setAttribute("role", "tab");
        t.setAttribute("aria-selected", String(form.mode === mode));
        t.disabled = off;
        t.onclick = () => {
          Object.assign(form, { mode, request: null });
          paint();
        };
        tabs.append(t);
      }
      const amount = node("input");
      Object.assign(amount, { type: "number", min: 1, step: 1, inputMode: "numeric", placeholder: "0", value: form.amount });
      amount.setAttribute("aria-label", "ポイント");
      amount.dataset.loanAmount = "";
      const amountRow = node("label", "loans-amount");
      amountRow.append(amount, node("span", "", "pt"));
      const quick = node("div", "loans-quick");
      const all = form.mode === "repay" ? owe : form.mode === "claim" ? lent : 0;
      for (const [text, v] of [["10", 10], ["50", 50], ["100", 100], ["500", 500], ...(all ? [["全部（" + fmt(all) + "）", all]] : [])]) {
        const q = node("button", "", text);
        q.type = "button";
        q.onclick = () => {
          form.amount = amount.value = String(v);
          preview();
        };
        quick.append(q);
      }
      // Interest, for a loan only.
      const rates = node("div", "loans-rates");
      if (form.mode === "lend") {
        rates.append(node("span", "", "利子"));
        for (const rate of L.RATES) {
          const r = node("button", "", RATE_TEXT(rate));
          r.type = "button";
          r.setAttribute("aria-pressed", String(form.rate === rate));
          r.setAttribute("aria-label", "利子 " + RATE_TEXT(rate));
          r.onclick = () => {
            form.rate = rate;
            paint();
          };
          rates.append(r);
        }
      }
      const note = node("input");
      Object.assign(note, { type: "text", maxLength: 60, placeholder: "ひとこと（任意）", value: form.note });
      note.setAttribute("aria-label", "ひとこと");
      note.oninput = () => (form.note = note.value);
      const line = node("p", "loans-preview");
      const go = node("button", "loans-primary loans-go", { lend: "貸す", repay: "返す", borrow: "借りたいと頼む", claim: "返してと請求" }[form.mode]);
      go.type = "button";
      const preview = () => {
        const v = Math.floor(Number(amount.value));
        line.textContent =
          form.mode === "lend" && v >= 1
            ? "返してもらう額 " + fmt(v + Math.round(v * form.rate)) + "pt" + (form.rate ? "（利子 " + fmt(Math.round(v * form.rate)) + "pt）" : "")
            : form.mode === "repay" && v >= 1
              ? "返したあと 残り " + fmt(Math.max(0, owe - v)) + "pt"
              : form.mode === "borrow"
                ? name + "さんに頼みます。利子は貸す人が決めます。"
                : form.mode === "claim"
                  ? "貸している " + fmt(lent) + "pt まで請求できます。"
                  : "";
        go.disabled = !(v >= 1);
      };
      amount.oninput = () => {
        form.amount = amount.value;
        preview();
      };
      go.onclick = act(async () => {
        const v = amount.value,
          t = note.value;
        if (form.mode === "lend") await send(other, name, v, "lend", t, form.request, form.rate);
        else if (form.mode === "repay") await send(other, name, v, "repay", t);
        else if (form.mode === "borrow") await ask(other, name, v, "ask-lend", t);
        else await ask(other, name, v, "ask-repay", t);
        redraw({ mode: form.mode });
      });
      preview();
      panel.append(tabs, amountRow, quick, rates, note, line, go);
      if (form.request) panel.prepend(node("p", "loans-hint", name + "さんの頼みに応えて貸します。利子を選んでください。"));
      body.append(panel);
      // My own open requests can be taken back.
      for (const e of rec.entries.filter((x) => x.status === "open" && x.from === me)) {
        const card = node("div", "loans-request is-mine");
        card.append(node("p", "", (e.kind === "ask-lend" ? fmt(e.amount) + "pt 借りたいと頼んでいます" : fmt(e.amount) + "pt を請求しています") + "（返事待ち）"));
        const undo = node("button", "", "取り消す");
        undo.type = "button";
        undo.onclick = act(async () => {
          await closeRequest(other, name, e.id);
          redraw();
        });
        card.append(undo);
        body.append(card);
      }
      // History, newest first.
      const history = node("ol", "loans-history");
      history.setAttribute("aria-label", "履歴");
      const label = (e) => {
        const mine = e.from === me,
          amountText = fmt(e.amount) + "pt";
        if (e.kind === "lend") return (mine ? amountText + " 貸した" : amountText + " 借りた") + (e.rate ? "（利子" + RATE_TEXT(e.rate) + "・返す額" + fmt(e.due) + "pt）" : "");
        if (e.kind === "repay") return mine ? amountText + " 返した" : amountText + " 返ってきた";
        const what = e.kind === "ask-lend" ? (mine ? amountText + " 借りたいと頼んだ" : amountText + " 借りたいと頼まれた") : mine ? amountText + " 請求した" : amountText + " 請求された";
        const state = { open: "返事待ち", done: "済み", declined: "断られた", cancelled: "取り消し" }[e.status] || "";
        return what + "・" + (e.status === "declined" && !mine ? "断った" : state);
      };
      for (const e of rec.entries.slice().reverse()) {
        const li = node("li", "is-" + e.kind + (L.isMoney(e) ? (e.from === me ? " is-out" : " is-in") : ""));
        li.append(node("span", "", label(e)), node("time", "", when(e.at)));
        if (e.note) li.append(node("small", "", "「" + e.note + "」"));
        history.append(li);
      }
      if (!rec.entries.length) history.append(node("li", "loans-empty", "まだ記録はありません。"));
      const back = node("button", "loans-back", "‹ 一覧へ");
      back.type = "button";
      back.onclick = open;
      body.append(node("h3", "loans-title", "履歴"), history, back);
    };
    let current = known(key) || { entries: [] },
      fresh = false;
    const paint = () => draw(current, !fresh);
    paint();
    try {
      current = await record(key);
      fresh = true;
      markSeen(key, current.updatedAt || Date.now());
      paint();
      // Anything sent to me in this record comes into the wallet.
      if (L.unclaimed(current, me).length) {
        const got = await claim(key);
        got.forEach((g) => window.showToast?.(fmt(g.amount) + "pt 受け取りました", "success"));
        current = known(key) || current;
        paint();
      }
    } catch (error) {
      fresh = true;
      paint();
      const status = body.querySelector(".loans-error");
      if (status) status.textContent = error?.message || "読み込めませんでした。";
    }
  }

  window.onAppLoaded?.(() => setTimeout(() => collect().catch(() => {}), 1500));
  window.PointLoans = Object.freeze({ open, person, send, ask, closeRequest, claim, collect, owe, CASINO, close: closeDialog });
})();
