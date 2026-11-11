// Lending points between users: lend, ask to borrow, ask to be paid back (請求), repay, give
// (あげる) and ask to be given (もらう), and the history of all of it, per pair of people.
//
// Cloud: pointLoans/{a__b} holds the pair's entries (the shared history) and which money
// entries the receiver has already added to their wallet. pointLoanInbox/{id} lists the pairs a
// person has, with the time of the newest change, so one read shows what is new.
//
// Points move inside one transaction with the record: the sender's wallet goes down with the
// entry written, and the receiver's goes up when their device marks the entry claimed. Nothing
// can be paid twice, and no wallet is ever written by anyone but its owner.
//
// record.read[id] is the time of the newest line from the other side that `id` has seen (the
// 既読 under a line); it is the only thing a screen writes outside a transaction.
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
  // Nothing is given to, or asked of, the casino or the 運営: they never collect or answer.
  const notGiven = (other, kind) => {
    if ((kind === "give" || kind === "ask-give") && (other === CASINO || other === ADMIN)) throw Error("この相手にはあげたりもらったりできません。");
  };
  async function send(other, otherName, amount, kind, note, request, rate = 0) {
    ready();
    notGiven(other, kind);
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
    notGiven(other, kind);
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
  // The borrower accepts a loan offered with interest; the points reach them when they are collected.
  async function acceptOffer(other, otherName, id) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    const written = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      if (!snap.exists()) throw Error("記録が見つかりません。");
      const record = shell(L.accept(snap.data(), { id, by: me, at }), me, other, otherName);
      tx.set(pairRef(key), record);
      touch(tx, me, other, otherName, key, at);
      return record;
    });
    remember(key, written);
  }
  // Adds what was sent to me into my wallet, once.
  async function claim(key, since) {
    const me = uid();
    let got = [],
      latest = null;
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const [walletSnap, pairSnap] = [await tx.get(walletRef(me)), await tx.get(pairRef(key))];
      got = [];
      latest = null;
      if (!pairSnap.exists()) return null;
      const record = pairSnap.data(),
        due = L.unclaimed(record, me);
      latest = record;
      remember(key, record);
      if (!due.length) return null;
      // (refund: my own loan offer came back, refused or taken back.)
      got = due.map((e) => (e.from === me && e.to !== me ? { amount: e.amount, name: record.names?.[e.to] || e.to, kind: e.kind, refund: true } : { amount: e.amount, name: record.names?.[e.from] || e.from, kind: e.kind }));
      // Money and gifts add; a charge from the 運営 takes away, never below 0.
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        claimed = { ...(record.claimed || {}) };
      for (const e of due) claimed[e.id] = Date.now();
      tx.set(pairRef(key), { claimed }, { merge: true });
      remember(key, { ...record, claimed });
      return walletWrite(tx, me, wallet, Math.max(0, (Number(wallet.balance) || 0) + due.reduce((a, e) => a + L.change(e), 0)));
    });
    after(value);
    // What the other side wrote since `since` (a line, a request, an offer), for a notice: the points are
    // announced on their own. (An array with a `news` list; callers that only want the points ignore it.)
    if (since !== undefined && latest) got.news = news(latest, me, since).map((e) => ({ ...e, name: latest.names?.[e.from] || e.from }));
    return got;
  }
  // The lines of a record that the other side added after `since` and that are not money moving (that is said
  // as points received): their words, requests and offers.
  const NEWS = new Set(["message", "stamp", "ask-lend", "ask-give", "ask-repay", "lend-offer"]);
  function news(record, me, since) {
    return (record.entries || []).filter((e) => e.from !== me && NEWS.has(e.kind) && (e.at || 0) > since);
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
      record = L.ask(record, { id: newId(), from: CASINO, to: me, amount: Math.min(L.MAX_AMOUNT, L.net(record, CASINO)), kind: "ask-repay", note, at });
      tx.set(pairRef(key), remember(key, { ...record, people: [me, CASINO].sort(), names: { ...(record.names || {}), [me]: myNameNow(), [CASINO]: CASINO_NAME } }));
      tx.set(inboxRef(me), { pairs: { [key]: { other: CASINO, name: CASINO_NAME, at } } }, { merge: true });
    });
  }
  // Pays `other` exactly `amount` (a settlement after a game, 大富豪): out of the wallet, and when the
  // wallet is short the rest is borrowed from the casino, as in すごろくビンゴ (a loan spent at once, with
  // one 請求 for everything owed). The payment is a "give" in the pair's record, which `other` collects
  // like any gift. `id` makes it happen once: a second call with the same id changes nothing.
  // Returns { paid: from the wallet, borrowed: from the casino, again: it had been paid before }.
  async function pay(other, otherName, amount, note, id) {
    ready();
    notGiven(other, "give");
    if (!id) throw Error("支払いの番号がありません。");
    const me = uid(),
      key = L.pairKey(me, other),
      casinoKey = L.pairKey(me, CASINO),
      at = Date.now(),
      n = L.amountOf(amount);
    let result = null;
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const [walletSnap, pairSnap, casinoSnap] = [await tx.get(walletRef(me)), await tx.get(pairRef(key)), await tx.get(pairRef(casinoKey))];
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        have = Number(wallet.balance) || 0,
        record = pairSnap.exists() ? pairSnap.data() : null;
      if ((record?.entries || []).some((e) => e.id === id)) {
        result = { paid: 0, borrowed: 0, again: true };
        return null;
      }
      const short = Math.max(0, n - Math.max(0, have));
      if (short) {
        const lend = id + "-casino";
        let debt = L.send(casinoSnap.exists() ? casinoSnap.data() : null, { id: lend, from: CASINO, to: me, amount: short, kind: "lend", note, at });
        debt.claimed = { ...(debt.claimed || {}), [lend]: at };
        for (const e of debt.entries) if (e.status === "open" && e.kind === "ask-repay" && e.from === CASINO) Object.assign(e, { status: "cancelled", resolvedAt: at });
        debt = L.ask(debt, { id: id + "-ask", from: CASINO, to: me, amount: Math.min(L.MAX_AMOUNT, L.net(debt, CASINO)), kind: "ask-repay", note, at });
        tx.set(pairRef(casinoKey), remember(casinoKey, { ...debt, people: [me, CASINO].sort(), names: { ...(debt.names || {}), [me]: myNameNow(), [CASINO]: CASINO_NAME } }));
        tx.set(inboxRef(me), { pairs: { [casinoKey]: { other: CASINO, name: CASINO_NAME, at } } }, { merge: true });
      }
      const next = shell(L.send(record, { id, from: me, to: other, amount: n, kind: "give", note, at }), me, other, otherName);
      tx.set(pairRef(key), next);
      touch(tx, me, other, otherName, key, at);
      result = { paid: n - short, borrowed: short, again: false };
      return walletWrite(tx, me, wallet, Math.max(0, have - (n - short)));
    });
    after(value);
    return result;
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
  // A stamp as a line of talk (the picture itself is read from the stamp).
  async function sendStamp(other, otherName, stampId) {
    ready();
    const me = uid(),
      key = L.pairKey(me, other),
      at = Date.now();
    const written = await window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(pairRef(key));
      const record = shell(L.stamp(snap.exists() ? snap.data() : null, { id: newId(), from: me, to: other, stamp: stampId, at }), me, other, otherName);
      tx.set(pairRef(key), record);
      touch(tx, me, other, otherName, key, at);
      return record;
    });
    remember(key, written);
  }
  // Buying a stamp is one transaction: the stamp, the buyer's wallet and box, the maker's account and the pair are read;
  // then the points leave the buyer as a "give" to the maker (the maker takes them in as with any gift), the stamp is
  // added to the buyer's box and its sales go up by one. `seen`: the price the buyer was shown (refused if it changed).
  async function buyStamp(stampId, seen) {
    ready();
    const SM = window.StampsModel;
    if (!SM) throw Error("スタンプを使えません。");
    const me = uid(),
      at = Date.now();
    let written = null,
      key = "",
      ids = [];
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const stampDoc = window.fbDoc(window.db, "stamps", stampId),
        boxDoc = window.fbDoc(window.db, "users", me, "stampBox", "main");
      const stampSnap = await tx.get(stampDoc);
      const stamp = stampSnap.exists() ? SM.clean(stampSnap.data(), stampId) : null;
      const [boxSnap, walletSnap] = [await tx.get(boxDoc), await tx.get(walletRef(me))];
      // A maker whose account is gone cannot take the points in: nothing is sold on their behalf.
      const ownerSnap = stamp ? await tx.get(window.fbDoc(window.db, "users", stamp.ownerId)) : null;
      const owned = SM.box(boxSnap.exists() ? boxSnap.data().ids : []),
        wallet = walletSnap.exists() ? walletSnap.data() : {},
        have = Number(wallet.balance) || 0;
      const price = SM.checkBuy({ stamp, id: stampId, me, owned, seen, balance: have, ownerGone: !ownerSnap || !ownerSnap.exists() || !!ownerSnap.data()?.deleted });
      let paid = null;
      if (price > 0) {
        key = L.pairKey(me, stamp.ownerId);
        const pairSnap = await tx.get(pairRef(key));
        const record = L.send(pairSnap.exists() ? pairSnap.data() : null, { id: newId(), from: me, to: stamp.ownerId, amount: price, kind: "give", note: "スタンプ「" + stamp.name + "」", at });
        written = shell(record, me, stamp.ownerId, stamp.ownerName);
        tx.set(pairRef(key), written);
        touch(tx, me, stamp.ownerId, stamp.ownerName, key, at);
        paid = walletWrite(tx, me, wallet, have - price);
      }
      ids = [...owned, stampId];
      tx.set(boxDoc, { ids, updatedAt: at }, { merge: true });
      tx.set(stampDoc, { sales: stamp.sales + 1 }, { merge: true });
      return paid;
    });
    if (written) remember(key, written);
    after(value);
    window.Stamps?.remember?.(ids);
  }
  // ---- Stamp approval ---------------------------------------------------------------------------------
  // Sending a stamp in for approval (new, or a changed picture / a higher price) holds the cost: the part of the price not
  // paid yet leaves the maker's wallet at once, as a "give" to the 運営 (which nobody collects). If the 運営 approves it stays
  // paid (feePaid); if it is turned down or withdrawn it comes back as a gift from the 運営, once (feeHeld).
  // `input`: { isNew, doc (new only), name, price, image, base, design } — image/design: the picture waiting for approval.
  async function submitStamp(id, input) {
    ready();
    const SM = window.StampsModel;
    if (!SM) throw Error("スタンプを使えません。");
    const me = uid(),
      at = Date.now(),
      key = L.pairKey(ADMIN, me);
    let kept = null;
    const value = await window.fbRunTransaction(window.db, async (tx) => {
      const stampDoc = window.fbDoc(window.db, "stamps", id),
        draftDoc = window.fbDoc(window.db, "stampDrafts", id),
        boxDoc = window.fbDoc(window.db, "users", me, "stampBox", "main");
      const stampSnap = await tx.get(stampDoc);
      const walletSnap = await tx.get(walletRef(me));
      const boxSnap = input.isNew ? await tx.get(boxDoc) : null;
      const pairSnap = await tx.get(pairRef(key));
      const wallet = walletSnap.exists() ? walletSnap.data() : {},
        have = Number(wallet.balance) || 0;
      let stamp, plan;
      if (input.isNew) {
        if (stampSnap.exists()) throw Error("このスタンプは作ってあります。");
        stamp = SM.clean(input.doc, id);
        plan = { name: stamp.name, price: stamp.price, review: true, next: null, hold: stamp.price };
      } else {
        stamp = stampSnap.exists() ? SM.clean(stampSnap.data(), id) : null;
        if (!stamp || stamp.ownerId !== me) throw Error("自分のスタンプだけ変えられます。");
        plan = SM.planEdit(stamp, { name: input.name, price: input.price, picture: !!input.image });
        if (!plan.review) throw Error("審査に出す変更ではありません。");
      }
      const hold = plan.hold;
      if (hold > have) throw Error("審査のための費用 " + hold + "pt が足りません（所持 " + have + "pt）。");
      let record = pairSnap.exists() ? pairSnap.data() : null,
        paid = null;
      if (hold > 0) record = L.send(record, { id: newId(), from: me, to: ADMIN, amount: hold, kind: "give", note: "スタンプ審査費「" + stamp.name + "」", at });
      if (hold < 0) record = L.gift(record, { id: newId(), from: ADMIN, to: me, amount: -hold, note: "スタンプ審査費の差額「" + stamp.name + "」", at });
      if (hold) {
        kept = { ...record, people: [ADMIN, me].sort(), names: { ...(record.names || {}), [ADMIN]: ADMIN_NAME, [me]: myNameNow() } };
        tx.set(pairRef(key), kept);
        tx.set(inboxRef(me), { pairs: { [key]: { other: ADMIN, name: ADMIN_NAME, at } } }, { merge: true });
        paid = hold > 0 ? walletWrite(tx, me, wallet, have - hold) : null;
      }
      const feeHeld = (input.isNew ? 0 : stamp.feeHeld) + hold;
      const picture = input.image ? { image: input.image, base: input.base || null, design: input.design || null, ownerId: me, at } : null;
      if (input.isNew || stamp.status === "pending" || stamp.status === "rejected") {
        const base = input.isNew ? input.doc : {};
        tx.set(stampDoc, { ...base, name: plan.name ?? stamp.name, price: plan.price, status: "pending", feeHeld, rejectReason: "", draft: input.isNew ? true : stamp.draft || !!picture, submittedAt: at }, { merge: true });
      } else {
        tx.set(stampDoc, { ...(plan.name !== undefined ? { name: plan.name } : {}), review: "pending", next: plan.next, feeHeld, reviewNote: "", draft: stamp.draft || !!picture, submittedAt: at }, { merge: true });
      }
      if (picture) tx.set(draftDoc, picture);
      if (input.isNew) {
        const ids = SM.box(boxSnap.exists() ? boxSnap.data().ids : []);
        tx.set(boxDoc, { ids: [...ids, id], updatedAt: at }, { merge: true });
      }
      return paid;
    });
    if (kept) remember(key, kept);
    after(value);
  }
  // The 運営 approves (decision "approve"), turns down ("reject", with a reason) — or the maker withdraws ("withdraw").
  // Approving only changes the stamp: the picture waiting is put in place, the price asked for is on sale, and what was
  // held becomes paid. Turning down or withdrawing gives the held points back to the maker, once.
  async function reviewStamp(id, decision, reason = "") {
    ready();
    const SM = window.StampsModel;
    if (!SM) throw Error("スタンプを使えません。");
    const me = uid(),
      at = Date.now();
    if (decision === "approve" || decision === "reject") {
      if (window.isAdmin !== true) throw Error("運営だけができます。");
    } else if (decision !== "withdraw") throw Error("不明な操作です。");
    let dropped = false;
    await window.fbRunTransaction(window.db, async (tx) => {
      const stampDoc = window.fbDoc(window.db, "stamps", id),
        draftDoc = window.fbDoc(window.db, "stampDrafts", id);
      const stampSnap = await tx.get(stampDoc);
      const stamp = stampSnap.exists() ? SM.clean(stampSnap.data(), id) : null;
      if (!stamp) throw Error("このスタンプは見つかりません。");
      const first = stamp.status === "pending";
      if (!first && stamp.review !== "pending") throw Error("このスタンプは確認待ちではありません。");
      if (decision === "approve" && stamp.ownerId === me) throw Error("自分のスタンプは承認できません。");
      if (decision === "withdraw" && stamp.ownerId !== me) throw Error("自分のスタンプだけ取り下げられます。");
      const draftSnap = stamp.draft ? await tx.get(draftDoc) : null;
      if (decision === "approve") {
        const draft = draftSnap?.exists() ? draftSnap.data() : null;
        if (stamp.draft && !SM.imageOk(draft?.image)) throw Error("審査中の画像が見つかりません。作った人に作り直してもらってください。");
        const price = first ? stamp.price : stamp.next?.price ?? stamp.price;
        const done = { price, feePaid: Math.max(stamp.feePaid, price), feeHeld: 0, approvedAt: at, review: "", next: null, draft: false, reviewNote: "", rejectReason: "" };
        if (first) done.status = "on";
        if (draft) {
          done.imageV = stamp.imageV + 1;
          tx.set(window.fbDoc(window.db, "stampImages", id), { image: draft.image, base: draft.base || null, design: draft.design || null, ownerId: stamp.ownerId });
          dropped = true;
        }
        tx.set(stampDoc, done, { merge: true });
        return;
      }
      // Turned down or withdrawn: what was held goes back (when the maker's account is still there).
      const ownerSnap = await tx.get(window.fbDoc(window.db, "users", stamp.ownerId));
      const key = L.pairKey(ADMIN, stamp.ownerId),
        pairSnap = stamp.feeHeld > 0 ? await tx.get(pairRef(key)) : null;
      if (stamp.feeHeld > 0 && ownerSnap.exists() && !ownerSnap.data()?.deleted) {
        const record = L.gift(pairSnap.exists() ? pairSnap.data() : null, { id: newId(), from: ADMIN, to: stamp.ownerId, amount: stamp.feeHeld, note: "スタンプ審査費の返金「" + stamp.name + "」", at });
        tx.set(pairRef(key), { ...record, people: [ADMIN, stamp.ownerId].sort(), names: { ...(record.names || {}), [ADMIN]: ADMIN_NAME, [stamp.ownerId]: String(stamp.ownerName || stamp.ownerId).slice(0, 24) } });
        tx.set(inboxRef(stamp.ownerId), { pairs: { [key]: { other: ADMIN, name: ADMIN_NAME, at } } }, { merge: true });
      }
      const why = SM.text(decision === "withdraw" ? "取り下げました" : reason, 100) || "運営の基準に合いませんでした";
      tx.set(stampDoc, first ? { status: "rejected", rejectReason: why, feeHeld: 0, draft: false } : { review: "", next: null, feeHeld: 0, draft: false, reviewNote: why }, { merge: true });
      dropped = !!stamp.draft;
    });
    if (dropped && window.fbDeleteDoc) window.fbDeleteDoc(window.fbDoc(window.db, "stampDrafts", id)).catch(() => {});
    window.Stamps?.forget?.(id);
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
    // A notice only for what is new and recent (not the whole of an old talk on the first look), and never for the
    // talk that is open on screen: it shows there.
    const fresh = Date.now() - 10 * 60e3,
      said = [];
    for (const [key, pair] of Object.entries(pairs)) {
      if ((pair.at || 0) <= (last[key] || 0)) continue;
      const lines = await claim(key, Math.max(last[key] || 0, fresh));
      got.push(...lines);
      if (key !== openKey) for (const e of lines.news || []) said.push({ key, e, name: e.name });
      markSeen(key, pair.at || Date.now());
    }
    for (const { key, e, name } of said.slice(-3)) {
      const who = (name || "相手").replace(/さん$/, "") + "さん";
      window.showToast?.(
        e.kind === "message" ? who + "：" + String(e.text || "").slice(0, 40) : e.kind === "stamp" ? who + "：スタンプ" : e.kind === "lend-offer" ? who + "から 貸し出しの提案が届きました" : who + "から お願いが届きました",
        "info",
      );
    }
    for (const g of got)
      window.showToast?.(
        g.refund
          ? g.name + "さんに出した利子つきの貸し出しが戻りました　" + fmt(g.amount) + "pt"
          : (g.kind === "gift" || g.kind === "charge" ? g.name + "から " : g.name + "さんから ") + fmt(g.amount) + "pt " + (g.kind === "repay" ? "返ってきました" : g.kind === "charge" ? "引かれました" : "届きました"),
        g.kind === "charge" ? "info" : "success",
      );
    return got;
  }

  // ---- Screen ----------------------------------------------------------------------------
  let dialog = null,
    openKey = "";
  function closeDialog() {
    openKey = "";
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
    body.append(list, node("p", "loans-hint", "相手のプロフィールの「貸す」「あげる」「借りたいと頼む」「もらいたいと頼む」から始められます。"));
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
          n = rec ? L.net(rec, me) : null,
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
        if (line) b.append(node("small", "loans-last", line.kind === "message" ? line.text : line.kind === "stamp" ? "スタンプ" : line.kind === "gift" ? fmt(line.amount) + "pt 届きました" : line.kind === "give" ? fmt(line.amount) + "pt " + (line.from === me ? "あげました" : "もらいました") : fmt(line.amount) + "pt の記録"));
        if (line) b.append(node("time", "loans-time", dayOf(line.at) === dayOf(Date.now()) ? clock(line.at) : dayOf(line.at)));
        // New lines from the other side since I last looked, as a count (a record not read yet: 新着).
        const fresher = rec ? rec.entries.filter((e) => e.from !== me && (e.at || 0) > (last[key] || 0)).length : 0;
        if (asks) b.append(node("em", "loans-badge", "返事待ち " + asks));
        else if (fresher || (!rec && (pair.at || 0) > (last[key] || 0))) b.append(node("em", "loans-badge", fresher ? "新着 " + fresher : "新着"));
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
  // Line icons (24x24, drawn in the text colour), one per kind of move or request.
  const PATHS = {
    lend: "M7 17L17 7M8 7h9v9",
    repay: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
    give: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z",
    borrow: "M12 3v12M7 10l5 5 5-5M4 21h16",
    claim: "M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7",
    "ask-give": "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z",
    charge: "M5 12h14",
  };
  // Which icon a line of the talk gets.
  const KIND_ICON = { lend: "lend", "lend-offer": "lend", repay: "repay", give: "give", gift: "give", charge: "charge", "ask-lend": "borrow", "ask-repay": "claim", "ask-give": "ask-give" };
  function svgIcon(name) {
    const NS = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(NS, "svg"),
      path = document.createElementNS(NS, "path");
    for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(k, v);
    path.setAttribute("d", PATHS[name] || "");
    svg.append(path);
    return svg;
  }
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
    openKey = key;
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
    // The tray of stamps (what the player has, and the way to the store) opens above the line to write.
    const trayBox = node("div", "talk-tray");
    trayBox.hidden = true;
    dialog.append(head, standingBar, status, log, sheet, trayBox, compose);
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
    plus.onclick = () => {
      trayBox.hidden = true;
      stampBtn.setAttribute("aria-expanded", "false");
      toggleSheet(sheet.hidden);
    };
    const text = node("input");
    Object.assign(text, { type: "text", maxLength: L.MAX_TEXT, placeholder: "メッセージを入力", enterKeyHint: "send" });
    text.setAttribute("aria-label", "メッセージ");
    const sendText = node("button", "talk-send", "送信");
    sendText.type = "submit";
    compose.append(plus);
    const stampBtn = node("button", "talk-stamp-btn", "☺");
    stampBtn.type = "button";
    stampBtn.setAttribute("aria-label", "スタンプ");
    stampBtn.setAttribute("aria-expanded", "false");
    stampBtn.dataset.talk = "stamp";
    const showTray = () => {
      window.Stamps?.tray(trayBox, {
        onPick: async (id) => {
          status.textContent = "";
          try {
            await sendStamp(other, name, id);
            current = known(key) || current;
            trayBox.hidden = true;
            stampBtn.setAttribute("aria-expanded", "false");
            paint();
          } catch (error) {
            status.textContent = error?.message || "送れませんでした。";
          }
        },
        onStore: () => window.Stamps.store(() => showTray()),
      });
    };
    stampBtn.onclick = () => {
      const on = trayBox.hidden;
      trayBox.hidden = !on;
      stampBtn.setAttribute("aria-expanded", String(on));
      if (on) {
        if (!sheet.hidden) toggleSheet(false);
        showTray();
      }
    };
    if (!casino && !admin) compose.append(stampBtn, text, sendText);
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
        owe = L.owedBy(rec, me),
        lent = Math.max(0, L.net(rec, me));
      sheet.replaceChildren();
      // The casino only takes repayments, the 運営 only gives; 返す needs a debt, 請求 a loan.
      // Each is a button with its icon, like the menu under a LINE talk.
      const modes = casino
        ? [["repay", "返す", !owe]]
        : admin
          ? []
          : [["lend", "貸す", false], ["repay", "返す", !owe], ["give", "あげる", false], ["borrow", "借りる", false], ["claim", "請求", !lent], ["ask-give", "もらう", false]];
      if (!modes.length) {
        sheet.append(node("p", "loans-hint", "運営から届いたポイントは、自動で所持ポイントに入ります。"));
        return;
      }
      // A mode that cannot be used now is dropped; the casino has only one, so it is chosen.
      if (form.mode && modes.find((m) => m[0] === form.mode)?.[2]) form.mode = null;
      if (!form.mode && casino && !modes[0][2]) form.mode = modes[0][0];
      const panel = node("div", "loans-form");
      const tabs = node("div", "loans-tabs");
      tabs.setAttribute("role", "tablist");
      for (const [mode, label, off] of modes) {
        const t = node("button", "loans-tab");
        const icon = node("span", "loans-tab-icon");
        icon.append(svgIcon(mode));
        t.append(icon, node("span", "loans-tab-label", label));
        t.type = "button";
        t.setAttribute("role", "tab");
        t.setAttribute("aria-selected", String(form.mode === mode));
        t.disabled = off;
        t.onclick = () => {
          Object.assign(form, { mode: form.mode === mode ? null : mode, request: null });
          drawSheet();
        };
        tabs.append(t);
      }
      if (!form.mode) {
        sheet.append(tabs, node("p", "loans-hint", "やりたいことを選んでください。"));
        return;
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
      const go = node("button", "loans-primary loans-go", { lend: "貸す", repay: "返す", give: "あげる", borrow: "借りたいと頼む", claim: "返してと請求", "ask-give": "もらいたいと頼む" }[form.mode] || "");
      go.type = "button";
      const preview = () => {
        const v = Math.floor(Number(amount.value));
        line.textContent =
          form.mode === "lend" && v >= 1
            ? "返してもらう額 " + fmt(v + Math.round((v * Math.round(form.rate * 100)) / 100)) + "pt" + (form.rate ? "（利子 " + fmt(Math.round((v * Math.round(form.rate * 100)) / 100)) + "pt）　相手が受けると成立します。断られると戻ります" : "")
            : form.mode === "repay" && v >= 1
              ? "返したあと 残り " + fmt(Math.max(0, owe - v)) + "pt"
              : form.mode === "give" && v >= 1
                ? "あげたポイントは返してもらえません。あげたあと 所持 " + fmt(Math.max(0, (window.StudyPoints?.balance() || 0) - v)) + "pt"
                : form.mode === "borrow"
                  ? name + "さんに頼みます。利子は貸す人が決めます。"
                  : form.mode === "ask-give"
                    ? name + "さんに頼みます。あげるかどうかは相手が決めます。"
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
      // Interest, for a loan only: quick choices, or any whole percent up to 100.
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
        const own = node("input");
        Object.assign(own, { type: "number", min: 0, max: L.MAX_RATE * 100, step: 1, inputMode: "numeric", placeholder: "自由", value: L.RATES.includes(form.rate) ? "" : String(Math.round(form.rate * 100)) });
        own.setAttribute("aria-label", "利子を自由に入れる（%）");
        own.dataset.loanRate = "";
        own.oninput = () => {
          const n = Number(own.value);
          form.rate = own.value !== "" && Number.isInteger(n) && n >= 0 && n <= L.MAX_RATE * 100 ? n / 100 : form.rate;
          rates.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("aria-label") === "利子 " + RATE_TEXT(form.rate))));
          preview();
        };
        rates.append(own, node("span", "", "%"));
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
        else if (form.mode === "give") await send(other, name, v, "give", t);
        else if (form.mode === "borrow") await ask(other, name, v, "ask-lend", t);
        else if (form.mode === "ask-give") await ask(other, name, v, "ask-give", t);
        else await ask(other, name, v, "ask-repay", t);
        Object.assign(form, { amount: "", note: "", rate: 0, request: null });
        toggleSheet(false);
      });
      preview();
      if (form.request) panel.append(node("p", "loans-hint", name + "さんの頼みに応えて貸します。利子は自由に決められますが、相手が受けたときだけ成立します。"));
      panel.append(amountRow, quick, rates, note, line, go);
      sheet.append(tabs, panel);
    }
    // The talk: bubbles, oldest first, with a line for each new day.
    // What a line says (for the screen reader the amount comes first; on screen it is the big
    // number on the card).
    const label = (e) => {
      const mine = e.from === me;
      if (e.kind === "gift") return mine ? "送った" : "届いた";
      if (e.kind === "charge") return "引かれた";
      if (e.kind === "lend-offer") return (mine ? "貸したい" : "貸してくれる") + "（利子" + RATE_TEXT(e.rate) + "・返す額" + fmt(e.due) + "pt）・" + ({ open: mine ? "返事待ち" : "受けるか決めてください", done: "成立", declined: mine ? "断られた" : "断った", cancelled: "取り消し" }[e.status] || "");
      if (e.kind === "lend") {
        const terms = e.rate ? "（利子" + RATE_TEXT(e.rate) + "・返す額" + fmt(e.due) + "pt）" : "";
        return (mine ? "貸した" : "借りた") + terms;
      }
      if (e.kind === "repay") return mine ? "返した" : "返ってきた";
      if (e.kind === "give") return mine ? "あげた" : "もらった";
      const what = { "ask-lend": mine ? "借りたいと頼んだ" : "借りたいと頼まれた", "ask-give": mine ? "もらいたいと頼んだ" : "もらいたいと頼まれた", "ask-repay": mine ? "請求した" : "請求された" }[e.kind] || "";
      const state = { open: "返事待ち", done: "済み", declined: "断られた", cancelled: "取り消し" }[e.status] || "";
      return what + "・" + (e.status === "declined" && !mine ? "断った" : state);
    };
    function paint() {
      if (dialog !== shown) return;
      const rec = current,
        n = L.net(rec, me);
      // Where we stand, in one line.
      standingBar.className = "loans-summary is-" + (n > 0 ? "lent" : n < 0 ? "owe" : "even");
      standingBar.replaceChildren(node("strong", "", fmt(Math.abs(n)) + "pt"), node("p", "", standing(n, name)));
      if (!fresh) standingBar.append(node("p", "loans-loading", "最新の記録を確かめています…"));
      const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      log.replaceChildren();
      let lastDay = "",
        lastFrom = "";
      const readAt = rec.read?.[other] || 0,
        seenLine = casino || admin ? null : [...rec.entries].reverse().find((e) => e.from === me && (e.at || 0) <= readAt);
      for (const e of rec.entries) {
        const day = dayOf(e.at);
        if (day !== lastDay) {
          log.append(node("li", "talk-day", day));
          lastDay = day;
          lastFrom = "";
        }
        const mine = e.from === me,
          li = node("li", "talk-row is-" + (mine ? "mine" : "theirs") + " is-" + e.kind + (L.isMoney(e) || e.kind === "give" || e.kind === "gift" ? (mine ? " is-out" : " is-in") : e.kind === "charge" ? " is-out" : ""));
        const bubble = e.kind === "stamp" ? window.Stamps?.bubble(e.stamp) || node("div", "talk-card", "スタンプ") : node("div", e.kind === "message" ? "talk-bubble" : "talk-card");
        if (e.kind === "message") bubble.textContent = e.text;
        else if (e.kind === "stamp") {
          // (the picture is the whole line)
        } else {
          // A card like a LINE Pay one: the kind's icon, the amount big, then what happened.
          const icon = node("i", "card-icon");
          icon.append(svgIcon(KIND_ICON[e.kind]));
          const big = node("strong", "card-amount", fmt(e.amount) + "pt");
          big.setAttribute("aria-hidden", "true");
          const words = node("span", "card-words");
          words.append(node("b", "card-sr", fmt(e.amount) + "pt "), label(e));
          bubble.append(node("div", "card-head", ""), words);
          bubble.firstChild.append(icon, big);
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
            // What each kind of request is answered with.
            const yes = node("button", "loans-primary", { "lend-offer": "この条件で借りる", "ask-lend": "条件を決めて貸す", "ask-give": "あげる", "ask-repay": "払う" }[e.kind] || "答える");
            yes.type = "button";
            yes.onclick =
              e.kind === "lend-offer"
                ? act(async () => {
                    await acceptOffer(other, name, e.id);
                    current = known(key) || current;
                    await take();
                  })
                : e.kind === "ask-lend"
                ? () => {
                    Object.assign(form, { mode: "lend", amount: String(e.amount), request: e.id });
                    toggleSheet(true);
                  }
                : e.kind === "ask-give"
                  ? act(() => send(other, name, e.amount, "give", "", e.id))
                  : act(() => send(other, name, Math.min(e.amount, L.owedBy(current, me)), "repay", "", e.id));
            row.append(yes);
            bubble.classList.add("loans-request");
            bubble.append(row);
          } else if (e.status === "open" && mine) {
            const undo = node("button", "", "取り消す");
            undo.type = "button";
            // (A loan offer taken back: its points come back to my wallet at once.)
            undo.onclick = act(async () => {
              await closeRequest(other, name, e.id);
              current = known(key) || current;
              await take();
            });
            bubble.classList.add("loans-request", "is-mine");
            bubble.append(undo);
          }
        }
        // Under my newest line the other has seen: 既読, then the time, as in LINE.
        const meta = node("div", "talk-meta");
        if (mine && e === seenLine) meta.append(node("span", "talk-read", "既読"));
        meta.append(node("time", "", clock(e.at)));
        // As in LINE: their icon beside the first line of a run of theirs (the others keep its place).
        if (!mine && !casino && !admin) {
          const first = lastFrom !== e.from;
          const icon = first
            ? window.RankingVisuals?.avatar
              ? window.RankingVisuals.avatar(window.People?.preview?.(other)?.avatar || "", name)
              : node("span", "talk-initial", String(name).slice(0, 1))
            : node("span", "talk-avatar-gap");
          icon.classList.add("talk-line-avatar");
          li.append(icon);
        }
        lastFrom = e.from;
        li.append(bubble, meta);
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
      got.forEach((g) => window.showToast?.(g.refund ? "利子つきの貸し出しが戻りました　" + fmt(g.amount) + "pt" : fmt(g.amount) + "pt 受け取りました", "success"));
      current = known(key) || current;
      paint();
    };
    const seenNow = () => markSeen(key, current.updatedAt || Date.now());
    // 既読: tell the other side I have seen their newest line. The time written is the line's
    // own, never this device's clock, and nothing is written when there is nothing new, so the
    // write that comes back through the live record ends it.
    let sentRead = 0;
    const markRead = () => {
      if (casino || admin || document.hidden || typeof window.fbSetDoc !== "function") return;
      const latest = Math.max(0, ...current.entries.filter((e) => e.from === other).map((e) => e.at || 0));
      if (latest <= Math.max(current.read?.[me] || 0, sentRead)) return;
      sentRead = latest;
      Promise.resolve(window.fbSetDoc(pairRef(key), { read: { [me]: latest } }, { merge: true })).catch(() => {
        sentRead = 0;
      });
    };
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
              markRead();
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
        markRead();
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
  // Live: while the app is in front, the player's list (one document) is followed, so a request, a loan, a repayment
  // or a line in a talk shows up as it is written, with no extra read (the change itself is the read). The 10-minute
  // look above stays as the fallback. Nothing is followed in the background or while the cloud quota is paused.
  let inboxStop = null,
    inboxOwner = "",
    collecting = Promise.resolve();
  function stopInbox() {
    try {
      if (inboxStop) inboxStop();
    } catch {}
    inboxStop = null;
    inboxOwner = "";
  }
  function inboxLive() {
    const account = uid();
    if (inboxStop && inboxOwner !== account) stopInbox();
    if (inboxStop || account === "GUEST-000" || document.hidden || !window.db || typeof window.fbOnSnapshot !== "function" || window.FirestoreReadGuard?.paused?.()) return;
    try {
      inboxOwner = account;
      inboxStop = window.fbOnSnapshot(
        inboxRef(account),
        (snap) => {
          if (uid() !== account) return stopInbox();
          const pairs = snap.exists() ? snap.data().pairs || {} : {};
          try {
            localStorage.setItem(inboxName(), JSON.stringify(pairs));
          } catch {}
          lastCollect = Date.now();
          // One at a time, so two quick changes never claim the same line twice.
          collecting = collecting.then(() => collect(pairs)).catch((error) => console.warn("[loans] live collect", error));
        },
        () => stopInbox(),
      );
    } catch (error) {
      console.warn("[loans] live", error);
      stopInbox();
    }
  }
  window.onAppLoaded?.(() => {
    const start = Date.now();
    const first = () => {
      if (uid() !== "GUEST-000") {
        inboxLive();
        return collectSoon(true);
      }
      if (Date.now() - start < 600e3) setTimeout(first, 5000);
    };
    setTimeout(first, 1500);
    setInterval(() => collectSoon(true), 600e3);
    // (a different account, or the cloud back after a pause, starts the follow again)
    setInterval(inboxLive, 30e3);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return stopInbox();
      inboxLive();
      collectSoon(false);
    });
    window.addEventListener("cloud-quota-paused", stopInbox);
  });
  window.PointLoans = Object.freeze({ open, person, send, ask, talk, sendStamp, buyStamp, submitStamp, reviewStamp, pay, grant, adminLedger, adminHistory, closeRequest, claim, collect, owe, CASINO, ADMIN, close: closeDialog });
})();
