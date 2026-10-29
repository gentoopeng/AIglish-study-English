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
  async function send(other, otherName, amount, kind, note, request) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const [walletSnap, pairSnap] = [await tx.get(walletRef(me)), await tx.get(pairRef(key))];
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        have = Number(wallet.balance) || 0,
        n = L.amountOf(amount);
      if (have < n) throw Error("ポイントが足りません（所持 " + fmt(have) + "pt）。");
      const record = L.send(pairSnap.exists() ? pairSnap.data() : null, { id: newId(), from: me, to: other, amount: n, kind, note, at, request });
      tx.set(pairRef(key), shell(record, me, other, otherName));
      touch(tx, me, other, otherName, key, at);
      return walletWrite(tx, me, wallet, have - n);
    });
    after(value);
  }
  async function ask(other, otherName, amount, kind, note) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      const record = L.ask(snap.exists() ? snap.data() : null, { id: newId(), from: me, to: other, amount, kind, note, at });
      tx.set(pairRef(key), shell(record, me, other, otherName));
      touch(tx, me, other, otherName, key, at);
    });
  }
  async function closeRequest(other, otherName, id) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      if (!snap.exists()) throw Error("記録が見つかりません。");
      tx.set(pairRef(key), shell(L.close(snap.data(), { id, by: me, at }), me, other, otherName));
      touch(tx, me, other, otherName, key, at);
    });
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
      if (!due.length) return null;
      got = due.map((e) => ({ amount: e.amount, name: record.names?.[e.from] || e.from, kind: e.kind }));
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        claimed = { ...(record.claimed || {}) };
      for (const e of due) claimed[e.id] = Date.now();
      tx.set(pairRef(key), { claimed }, { merge: true });
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
      tx.set(pairRef(key), { ...record, people: [me, CASINO].sort(), names: { ...(record.names || {}), [me]: myNameNow(), [CASINO]: CASINO_NAME } });
      tx.set(inboxRef(me), { pairs: { [key]: { other: CASINO, name: CASINO_NAME, at } } }, { merge: true });
    });
  }
  async function inbox() {
    const snap = await window.fbGetDoc(inboxRef(uid()));
    return snap.exists() ? snap.data().pairs || {} : {};
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
  async function collect() {
    try {
      ready();
    } catch {
      return [];
    }
    const pairs = await inbox(),
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
  const guarded = (line, fn) => async () => {
    line.textContent = "";
    try {
      await fn();
    } catch (error) {
      line.textContent = error?.message || "うまくいきませんでした。もう一度お試しください。";
    }
  };
  const when = (at) => (at ? new Date(at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const standing = (n, name) => (n > 0 ? name + "さんに " + fmt(n) + "pt 貸しています" : n < 0 ? name + "さんから " + fmt(-n) + "pt 借りています" : "貸し借りはありません");

  // The list of people, newest change first.
  async function open() {
    const body = frame("ポイントの貸し借り");
    const status = errorLine();
    body.append(node("p", "loans-balance", "所持ポイント " + fmt(window.StudyPoints?.balance() || 0) + "pt"), status);
    try {
      ready();
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    const list = node("ul", "loans-people");
    body.append(node("p", "loans-hint", "相手のプロフィールの「貸す」「借りたいと頼む」から始められます。"), list);
    list.append(node("li", "loans-empty", "読み込んでいます…"));
    try {
      await collect();
      const pairs = Object.entries(await inbox()).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      list.replaceChildren();
      if (!pairs.length) list.append(node("li", "loans-empty", "まだ貸し借りはありません。"));
      const last = seen();
      for (const [key, pair] of pairs) {
        const snap = await window.fbGetDoc(pairRef(key));
        const record = snap.exists() ? snap.data() : { entries: [] },
          name = record.names?.[pair.other] || pair.name || pair.other,
          n = L.net(record.entries, uid()),
          asks = L.openFor(record, uid()).length;
        const b = node("button", "loans-person");
        b.type = "button";
        b.append(node("b", "", name), node("span", "loans-standing is-" + (n > 0 ? "lent" : n < 0 ? "owe" : "even"), standing(n, name).replace(name + "さん", "")));
        if (asks) b.append(node("em", "loans-badge", "返事待ち " + asks));
        else if ((pair.at || 0) > (last[key] || 0)) b.append(node("em", "loans-badge", "新着"));
        b.onclick = () => person(pair.other, name);
        const li = node("li");
        li.append(b);
        list.append(li);
      }
    } catch (error) {
      status.textContent = error?.message || "読み込めませんでした。";
    }
  }

  // One person: where we stand, their requests to me, the actions, and the history.
  async function person(other, name) {
    const body = frame(name + "さんとの貸し借り");
    const status = errorLine();
    body.append(status);
    let record;
    try {
      ready();
      await claim(L.pairKey(uid(), other)).then((got) => got.forEach((g) => window.showToast?.(fmt(g.amount) + "pt 受け取りました", "success")));
      const snap = await window.fbGetDoc(pairRef(L.pairKey(uid(), other)));
      record = snap.exists() ? snap.data() : { entries: [] };
      markSeen(L.pairKey(uid(), other), record.updatedAt || Date.now());
    } catch (error) {
      status.textContent = error?.message || "読み込めませんでした。";
      return;
    }
    const me = uid(),
      n = L.net(record.entries, me),
      redraw = () => person(other, name);
    const summary = node("div", "loans-summary is-" + (n > 0 ? "lent" : n < 0 ? "owe" : "even"));
    summary.append(node("small", "", n > 0 ? "貸している" : n < 0 ? "借りている" : "いまの貸し借り"), node("strong", "", fmt(Math.abs(n)) + "pt"), node("p", "", standing(n, name)));
    body.append(summary, node("p", "loans-balance", "所持ポイント " + fmt(window.StudyPoints?.balance() || 0) + "pt"));
    // Requests waiting for my answer.
    for (const e of L.openFor(record, me)) {
      const card = node("div", "loans-request");
      card.append(node("p", "", e.kind === "ask-lend" ? name + "さんが " + fmt(e.amount) + "pt 借りたいそうです" : name + "さんから " + fmt(e.amount) + "pt の請求です"));
      if (e.note) card.append(node("small", "", "「" + e.note + "」"));
      const row = node("div", "loans-actions");
      const yes = node("button", "loans-primary", e.kind === "ask-lend" ? "貸す" : "払う");
      yes.type = "button";
      yes.onclick = guarded(status, async () => {
        await send(other, name, e.kind === "ask-repay" ? Math.min(e.amount, L.owedBy(record.entries, me)) : e.amount, e.kind === "ask-lend" ? "lend" : "repay", "", e.id);
        redraw();
      });
      const no = node("button", "", "断る");
      no.type = "button";
      no.onclick = guarded(status, async () => {
        await closeRequest(other, name, e.id);
        redraw();
      });
      // A 請求 from the casino cannot be declined.
      if (other !== CASINO) row.append(no);
      row.append(yes);
      card.append(row);
      body.append(card);
    }
    // What I can do.
    const form = node("div", "loans-form");
    const amount = node("input");
    Object.assign(amount, { type: "number", min: 1, step: 1, inputMode: "numeric", placeholder: "ポイント" });
    amount.setAttribute("aria-label", "ポイント");
    amount.dataset.loanAmount = "";
    const note = node("input");
    Object.assign(note, { type: "text", maxLength: 60, placeholder: "ひとこと（任意）" });
    note.setAttribute("aria-label", "ひとこと");
    const quick = node("div", "loans-quick");
    for (const v of [10, 50, 100, 500]) {
      const q = node("button", "", fmt(v));
      q.type = "button";
      q.onclick = () => (amount.value = String(v));
      quick.append(q);
    }
    const owe = L.owedBy(record.entries, me),
      lent = Math.max(0, n);
    if (owe) {
      const all = node("button", "", "全部（" + fmt(owe) + "）");
      all.type = "button";
      all.onclick = () => (amount.value = String(owe));
      quick.append(all);
    }
    const actions = node("div", "loans-actions is-grid");
    const act = (text, fn, primary, disabled) => {
      const b = node("button", primary ? "loans-primary" : "", text);
      b.type = "button";
      b.disabled = !!disabled;
      b.onclick = guarded(status, async () => {
        await fn(amount.value, note.value);
        redraw();
      });
      actions.append(b);
    };
    // The casino only takes repayments.
    if (other !== CASINO) act("貸す", (v, t) => send(other, name, v, "lend", t), !owe);
    act("返す", (v, t) => send(other, name, v, "repay", t), !!owe, !owe);
    if (other !== CASINO) {
      act("借りたいと頼む", (v, t) => ask(other, name, v, "ask-lend", t));
      act("返してと請求", (v, t) => ask(other, name, v, "ask-repay", t), false, !lent);
    }
    form.append(amount, quick, note, actions);
    body.append(form);
    // My own open requests can be taken back.
    for (const e of record.entries.filter((x) => x.status === "open" && x.from === me)) {
      const card = node("div", "loans-request is-mine");
      card.append(node("p", "", (e.kind === "ask-lend" ? fmt(e.amount) + "pt 借りたいと頼んでいます" : fmt(e.amount) + "pt を請求しています") + "（返事待ち）"));
      const undo = node("button", "", "取り消す");
      undo.type = "button";
      undo.onclick = guarded(status, async () => {
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
      if (e.kind === "lend") return mine ? amountText + " 貸した" : amountText + " 借りた";
      if (e.kind === "repay") return mine ? amountText + " 返した" : amountText + " 返ってきた";
      const what = e.kind === "ask-lend" ? (mine ? amountText + " 借りたいと頼んだ" : amountText + " 借りたいと頼まれた") : mine ? amountText + " 請求した" : amountText + " 請求された";
      const state = { open: "返事待ち", done: "済み", declined: "断られた", cancelled: "取り消し" }[e.status] || "";
      return what + "・" + (e.status === "declined" && !mine ? "断った" : state);
    };
    for (const e of record.entries.slice().reverse()) {
      const li = node("li", "is-" + e.kind + (L.isMoney(e) ? (e.from === me ? " is-out" : " is-in") : ""));
      li.append(node("span", "", label(e)), node("time", "", when(e.at)));
      if (e.note) li.append(node("small", "", "「" + e.note + "」"));
      history.append(li);
    }
    if (!record.entries.length) history.append(node("li", "loans-empty", "まだ記録はありません。"));
    const back = node("button", "loans-back", "‹ 一覧へ");
    back.type = "button";
    back.onclick = open;
    body.append(node("h3", "loans-title", "履歴"), history, back);
  }

  window.onAppLoaded?.(() => setTimeout(() => collect().catch(() => {}), 1500));
  window.PointLoans = Object.freeze({ open, person, send, ask, closeRequest, claim, collect, owe, CASINO, close: closeDialog });
})();
