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
    const value = { balance, revision: (Number(wallet.revision) || 0) + 1 },
      moved = balance - (Number(wallet.balance) || 0),
      P = window.StudyPointPolicy;
    // Lending, paying back, gifts and charges: the day's line in the points history.
    if (moved && P?.addDaily) value.daily = P.addDaily(wallet.daily, P.day(), "loan", moved);
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
  // The last 30 are also kept on this device, so a talk opened after a restart shows at once.
  const records = new Map();
  const recordName = (key) => "aiglish_loans_record_" + uid() + "_" + key;
  const indexName = () => "aiglish_loans_records_" + uid();
  function remember(key, record) {
    records.set(uid() + "\n" + key, record);
    try {
      const index = JSON.parse(localStorage.getItem(indexName()) || "[]").filter((k) => k !== key);
      index.push(key);
      for (const old of index.splice(0, Math.max(0, index.length - 30))) localStorage.removeItem(recordName(old));
      localStorage.setItem(recordName(key), JSON.stringify(record));
      localStorage.setItem(indexName(), JSON.stringify(index));
    } catch {}
    return record;
  }
  function known(key) {
    const kept = records.get(uid() + "\n" + key);
    if (kept) return kept;
    try {
      const saved = JSON.parse(localStorage.getItem(recordName(key)) || "null");
      if (saved && Array.isArray(saved.entries)) {
        records.set(uid() + "\n" + key, saved);
        return saved;
      }
    } catch {}
    return null;
  }
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
      // Money and gifts add; a charge from the 運営 takes away, never below 0.
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        claimed = { ...(record.claimed || {}) };
      for (const e of due) claimed[e.id] = Date.now();
      tx.set(pairRef(key), { claimed }, { merge: true });
      remember(key, { ...record, claimed });
      return walletWrite(tx, me, wallet, Math.max(0, (Number(wallet.balance) || 0) + due.reduce((a, e) => a + L.change(e), 0)));
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
  // A line of talk to `other`; both see it in the pair's record.
  async function talk(other, otherName, text) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    const written = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      const record = shell(L.say(snap.exists() ? snap.data() : null, { id: newId(), from: me, to: other, text, at }), me, other, otherName);
      tx.set(pairRef(key), record);
      touch(tx, me, other, otherName, key, at);
      return record;
    });
    remember(key, written);
  }
  // Points from the 運営 (the administrator's tool): a gift in the record between the 運営 and the
  // player, collected into the player's wallet like a loan, owed by nobody.
  const ADMIN = "ADMIN",
    ADMIN_NAME = "運営";
  // kind "charge": the 運営 takes `amount` back instead (taken from the wallet when collected).
  async function grant(to, toName, amount, note, kind = "gift") {
    if (!window.db || !window.fbRunTransaction) throw Error("クラウドにつながっていません。");
    const key = L.pairKey(ADMIN, to),
      at = Date.now();
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      const record = L.gift(snap.exists() ? snap.data() : null, { id: newId(), from: ADMIN, to, amount, note, at, kind });
      tx.set(pairRef(key), { ...record, people: [ADMIN, to].sort(), names: { ...(record.names || {}), [ADMIN]: ADMIN_NAME, [to]: String(toName || to).slice(0, 24) } });
      tx.set(inboxRef(to), { pairs: { [key]: { other: ADMIN, name: ADMIN_NAME, at } } }, { merge: true });
    });
  }
  // For the administrator's tool: what the 運営 sent a player, each with whether the player's
  // device has taken it in yet, and the wallet as last written.
  async function adminLedger(to) {
    if (!window.db || !window.fbGetDoc) throw Error("クラウドにつながっていません。");
    const [pair, wallet] = await Promise.all([window.fbGetDoc(pairRef(L.pairKey(ADMIN, to))), window.fbGetDoc(walletRef(to))]);
    const record = pair.exists() ? pair.data() : { entries: [] };
    return {
      balance: wallet.exists() ? Number(wallet.data().balance) || 0 : null,
      entries: (record.entries || []).filter((e) => e.kind === "gift" || e.kind === "charge").map((e) => ({ ...e, taken: !!record.claimed?.[e.id] })),
    };
  }
  // For the administrator's tool: everything the 運営 has sent anyone, newest first, each with the
  // player and whether their device has taken it in. One query over the 運営's records.
  async function adminHistory(limit = 100) {
    if (!window.db || !window.fbGetDocs || !window.fbQuery) throw Error("クラウドにつながっていません。");
    const snap = await window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, "pointLoans"), window.fbWhere("people", "array-contains", ADMIN), window.fbLimit(limit)));
    return snap.docs
      .flatMap((doc) => {
        const record = doc.data(),
          to = (record.people || []).find((id) => id !== ADMIN) || "";
        return (record.entries || []).filter((e) => e.kind === "gift" || e.kind === "charge").map((e) => ({ ...e, to, name: record.names?.[to] || to, taken: !!record.claimed?.[e.id] }));
      })
      .sort((a, b) => (b.at || 0) - (a.at || 0));
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
    for (const g of got)
      window.showToast?.(
        (g.kind === "gift" || g.kind === "charge" ? g.name + "から " : g.name + "さんから ") + fmt(g.amount) + "pt " + (g.kind === "repay" ? "返ってきました" : g.kind === "charge" ? "引かれました" : "届きました"),
        g.kind === "charge" ? "info" : "success",
      );
    return got;
  }

  // ---- Screen ----------------------------------------------------------------------------
  let dialog = null;
  function closeDialog() {
    dialog?._stop?.();
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
        // The last line of the talk, as in a chat list.
        const line = rec?.entries?.[rec.entries.length - 1];
        if (line) b.append(node("small", "loans-last", line.kind === "message" ? line.text : line.kind === "gift" ? fmt(line.amount) + "pt 届きました" : fmt(line.amount) + "pt の記録"));
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

  // One person, as a talk (like LINE): a header with their icon and name, where we stand, the
  // history as bubbles (talk, points and requests; mine on the right) and at the bottom a line
  // to talk, with a ＋ that opens the points form (tabs: 貸す / 返す / 借りる / 請求) over it.
  // It comes up at once from the record as last seen and follows the record while it is open.
  const RATE_TEXT = (rate) => (rate ? Math.round(rate * 100) + "%" : "なし");
  const dayOf = (at) => new Date(at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
  const clock = (at) => new Date(at).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  async function person(other, name, choice) {
    closeDialog();
    const me = uid(),
      key = L.pairKey(me, other),
      casino = other === CASINO,
      admin = other === ADMIN,
      who = casino || admin ? name : name + "さん";
    dialog = node("dialog", "study-points-dialog loans-dialog is-talk");
    dialog.setAttribute("aria-label", who + "とのトーク");
    const shown = dialog;
    // Header: back to the list, their icon and name, their profile, close.
    const head = node("header", "talk-head");
    const back = node("button", "talk-back", "‹");
    back.type = "button";
    back.setAttribute("aria-label", "一覧へ");
    back.onclick = open;
    const face = window.RankingVisuals?.avatar ? window.RankingVisuals.avatar(window.People?.preview?.(other)?.avatar || "", name) : node("span", "talk-initial", String(name).slice(0, 1));
    face.classList.add("talk-avatar");
    const title = node("h2", "", who);
    const close = node("button", "loans-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "トークを閉じる");
    close.onclick = closeDialog;
    head.append(back, face, title);
    if (!casino && !admin) {
      const profile = node("button", "talk-profile", "プロフィール");
      profile.type = "button";
      profile.onclick = () => window.People?.open?.(other, { profile: true });
      head.append(profile);
    }
    head.append(close);
    const standingBar = node("div", "loans-summary"),
      status = errorLine(),
      log = node("ol", "talk-log loans-history"),
      sheet = node("div", "talk-sheet"),
      compose = node("form", "talk-compose");
    log.setAttribute("aria-label", "トーク");
    sheet.hidden = true;
    dialog.append(head, standingBar, status, log, sheet, compose);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
    document.body.append(dialog);
    dialog.showModal();
    try {
      ready();
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    const act = (fn) => async () => {
      status.textContent = "";
      try {
        await fn();
        current = known(key) || current;
        paint();
      } catch (error) {
        status.textContent = error?.message || "うまくいきませんでした。もう一度お試しください。";
      }
    };
    // The line to talk (not to the casino or the 運営), and the ＋ for points.
    const plus = node("button", "talk-plus", "＋");
    plus.type = "button";
    plus.setAttribute("aria-label", "ポイント");
    plus.setAttribute("aria-expanded", "false");
    plus.onclick = () => toggleSheet(sheet.hidden);
    const text = node("input");
    Object.assign(text, { type: "text", maxLength: L.MAX_TEXT, placeholder: "メッセージを入力", enterKeyHint: "send" });
    text.setAttribute("aria-label", "メッセージ");
    const sendText = node("button", "talk-send", "送信");
    sendText.type = "submit";
    compose.append(plus);
    if (!casino && !admin) compose.append(text, sendText);
    compose.onsubmit = (event) => {
      event.preventDefault();
      const line = text.value.trim();
      if (!line) return;
      text.value = "";
      act(() => talk(other, name, line))();
    };
    // What the points form is set to, kept across redraws.
    const form = { mode: choice?.mode || null, amount: choice?.amount || "", rate: 0, note: "", request: choice?.request || null };
    const toggleSheet = (on) => {
      sheet.hidden = !on;
      plus.setAttribute("aria-expanded", String(on));
      if (on) drawSheet();
    };
    let current = known(key) || { entries: [] },
      fresh = false;
    function drawSheet() {
      if (sheet.hidden) return;
      const rec = current,
        owe = L.owedBy(rec.entries, me),
        lent = Math.max(0, L.net(rec.entries, me));
      sheet.replaceChildren();
      // The casino only takes repayments, the 運営 only gives; 返す needs a debt, 請求 a loan.
      const modes = casino
        ? [["repay", "返す", !owe]]
        : admin
          ? []
          : [["lend", "貸す", false], ["repay", "返す", !owe], ["borrow", "借りる", false], ["claim", "請求", !lent]];
      if (!modes.length) {
        sheet.append(node("p", "loans-hint", "運営から届いたポイントは、自動で所持ポイントに入ります。"));
        return;
      }
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
          drawSheet();
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
      for (const [label, v] of [["10", 10], ["50", 50], ["100", 100], ["500", 500], ...(all ? [["全部（" + fmt(all) + "）", all]] : [])]) {
        const q = node("button", "", label);
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
            drawSheet();
          };
          rates.append(r);
        }
      }
      const note = node("input");
      Object.assign(note, { type: "text", maxLength: 60, placeholder: "ひとこと（任意）", value: form.note });
      note.setAttribute("aria-label", "ひとこと");
      note.oninput = () => (form.note = note.value);
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
        Object.assign(form, { amount: "", note: "", rate: 0, request: null });
        toggleSheet(false);
      });
      preview();
      if (form.request) panel.append(node("p", "loans-hint", name + "さんの頼みに応えて貸します。利子を選んでください。"));
      panel.append(tabs, amountRow, quick, rates, note, line, go);
      sheet.append(panel);
    }
    // The talk: bubbles, oldest first, with a line for each new day.
    const label = (e) => {
      const mine = e.from === me,
        amountText = fmt(e.amount) + "pt";
      if (e.kind === "gift") return (mine ? amountText + " 送った" : amountText + " 届いた");
      if (e.kind === "charge") return amountText + " 引かれた";
      if (e.kind === "lend") return (mine ? amountText + " 貸した" : amountText + " 借りた") + (e.rate ? "（利子" + RATE_TEXT(e.rate) + "・返す額" + fmt(e.due) + "pt）" : "");
      if (e.kind === "repay") return mine ? amountText + " 返した" : amountText + " 返ってきた";
      const what = e.kind === "ask-lend" ? (mine ? amountText + " 借りたいと頼んだ" : amountText + " 借りたいと頼まれた") : mine ? amountText + " 請求した" : amountText + " 請求された";
      const state = { open: "返事待ち", done: "済み", declined: "断られた", cancelled: "取り消し" }[e.status] || "";
      return what + "・" + (e.status === "declined" && !mine ? "断った" : state);
    };
    function paint() {
      if (dialog !== shown) return;
      const rec = current,
        n = L.net(rec.entries, me);
      // Where we stand, in one line.
      standingBar.className = "loans-summary is-" + (n > 0 ? "lent" : n < 0 ? "owe" : "even");
      standingBar.replaceChildren(node("strong", "", fmt(Math.abs(n)) + "pt"), node("p", "", standing(n, name)));
      if (!fresh) standingBar.append(node("p", "loans-loading", "最新の記録を確かめています…"));
      const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      log.replaceChildren();
      let lastDay = "";
      for (const e of rec.entries) {
        const day = dayOf(e.at);
        if (day !== lastDay) {
          log.append(node("li", "talk-day", day));
          lastDay = day;
        }
        const mine = e.from === me,
          li = node("li", "talk-row is-" + (mine ? "mine" : "theirs") + " is-" + e.kind + (L.isMoney(e) || e.kind === "gift" ? (mine ? " is-out" : " is-in") : e.kind === "charge" ? " is-out" : ""));
        const bubble = node("div", e.kind === "message" ? "talk-bubble" : "talk-card");
        if (e.kind === "message") bubble.textContent = e.text;
        else {
          bubble.append(node("span", "", label(e)));
          if (e.note) bubble.append(node("small", "", "「" + e.note + "」"));
          // A request waiting for my answer carries the answers.
          if (e.status === "open" && e.to === me) {
            const row = node("div", "loans-actions");
            if (!casino) {
              const no = node("button", "", "断る");
              no.type = "button";
              no.onclick = act(() => closeRequest(other, name, e.id));
              row.append(no);
            }
            const yes = node("button", "loans-primary", e.kind === "ask-lend" ? "条件を決めて貸す" : "払う");
            yes.type = "button";
            yes.onclick =
              e.kind === "ask-lend"
                ? () => {
                    Object.assign(form, { mode: "lend", amount: String(e.amount), request: e.id });
                    toggleSheet(true);
                  }
                : act(() => send(other, name, Math.min(e.amount, L.owedBy(current.entries, me)), "repay", "", e.id));
            row.append(yes);
            bubble.classList.add("loans-request");
            bubble.append(row);
          } else if (e.status === "open" && mine) {
            const undo = node("button", "", "取り消す");
            undo.type = "button";
            undo.onclick = act(() => closeRequest(other, name, e.id));
            bubble.classList.add("loans-request", "is-mine");
            bubble.append(undo);
          }
        }
        li.append(bubble, node("time", "", clock(e.at)));
        log.append(li);
      }
      if (!rec.entries.length) log.append(node("li", "loans-empty", fresh ? (casino || admin ? "まだ記録はありません。" : "まだトークはありません。メッセージや「＋」から始められます。") : "読み込んでいます…"));
      if (near || !paint.done) log.scrollTop = log.scrollHeight;
      paint.done = true;
      drawSheet();
    }
    paint();
    if (choice?.mode || choice?.request) toggleSheet(true);
    // Anything sent to me in this record comes into the wallet.
    const take = async () => {
      if (!L.unclaimed(current, me).length) return;
      const got = await claim(key);
      got.forEach((g) => window.showToast?.(fmt(g.amount) + "pt 受け取りました", "success"));
      current = known(key) || current;
      paint();
    };
    const seenNow = () => markSeen(key, current.updatedAt || Date.now());
    try {
      if (typeof window.fbOnSnapshot === "function") {
        // Live while open: the other side's lines and answers come in as they are written.
        await new Promise((resolve, reject) => {
          shown._stop = window.fbOnSnapshot(
            pairRef(key),
            (snap) => {
              current = remember(key, snap.exists() ? snap.data() : { entries: [] });
              fresh = true;
              seenNow();
              paint();
              take().catch((error) => (status.textContent = error?.message || ""));
              resolve();
            },
            reject,
          );
        });
      } else {
        current = await record(key);
        fresh = true;
        seenNow();
        paint();
        await take();
      }
    } catch (error) {
      fresh = true;
      paint();
      status.textContent = error?.message || "読み込めませんでした。";
    }
  }

  // Points sent to this player (loans, repayments, gifts from the 運営) come in without opening
  // anything: once the player is signed in after start (the app may still be logging in when it
  // loads), every 10 minutes, and when the app comes back to the front (at most every 2 minutes).
  // Each look is one read of the player's list.
  let lastCollect = 0;
  function collectSoon(force) {
    if (uid() === "GUEST-000" || (!force && Date.now() - lastCollect < 120e3)) return;
    lastCollect = Date.now();
    collect().catch((error) => console.warn("[loans] collect", error));
  }
  window.onAppLoaded?.(() => {
    const start = Date.now();
    const first = () => {
      if (uid() !== "GUEST-000") return collectSoon(true);
      if (Date.now() - start < 600e3) setTimeout(first, 5000);
    };
    setTimeout(first, 1500);
    setInterval(() => collectSoon(true), 600e3);
    document.addEventListener("visibilitychange", () => !document.hidden && collectSoon(false));
  });
  window.PointLoans = Object.freeze({ open, person, send, ask, talk, grant, adminLedger, adminHistory, closeRequest, claim, collect, owe, CASINO, ADMIN, close: closeDialog });
})();
