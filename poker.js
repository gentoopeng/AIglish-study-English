// Texas Hold'em for points, at a table found by a 4-digit number (like the word battle).
// The table is one shared document. Each move is a transaction through PokerModel, so every
// device sees the same hand. The player who made the table deals: it shuffles, sends each player
// their two cards encrypted for them alone (ECDH + AES-GCM), and turns over the board and the
// showdown. Points move only when a hand ends: each player adds their own result to their wallet,
// once per hand, so an unfinished hand changes nothing.
(function () {
  "use strict";
  const P = window.PokerModel;
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const nameOf = () => String((typeof myName === "string" && myName) || uid()).slice(0, 24);
  const ref = (code) => window.fbDoc(window.db, "pokerRooms", code);
  const BLINDS = [[1, 2], [2, 4], [5, 10], [10, 20], [25, 50], [50, 100]],
    THINK = [15, 30, 45, 60],
    RESULT_MS = 5000;
  let screen = null,
    session = null,
    unsubscribe = null,
    ticker = null,
    busy = false,
    holes = { no: -1, cards: null };

  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const balance = () => (window.StudyPoints ? window.StudyPoints.balance() : 0);
  const fmt = (n) => Number(n || 0).toLocaleString("ja-JP");
  function connected() {
    if (uid() === "GUEST-000") throw Error("ポーカーはログインしたアカウントで遊べます。");
    if (!window.db || !window.fbRunTransaction || !window.fbOnSnapshot) throw Error("ポーカーにはクラウドへの接続が必要です。");
    if (window.FirestoreReadGuard?.paused?.()) throw Error("クラウドの利用上限に達しています。時間をおいてお試しください。");
  }

  // ---- Keys and sealed cards -------------------------------------------------------------
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const keyName = (code) => "aiglish_poker_key_" + uid() + "_" + code;
  // One key pair per table and account, kept on this device so a reload can still read the cards.
  async function myKeys(code) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(keyName(code)) || "null");
    } catch {}
    if (!saved) {
      const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
      saved = { priv: await crypto.subtle.exportKey("jwk", pair.privateKey), pub: await crypto.subtle.exportKey("jwk", pair.publicKey) };
      try {
        localStorage.setItem(keyName(code), JSON.stringify(saved));
      } catch {}
    }
    const priv = await crypto.subtle.importKey("jwk", saved.priv, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    return { priv, pub: { kty: saved.pub.kty, crv: saved.pub.crv, x: saved.pub.x, y: saved.pub.y } };
  }
  async function shared(priv, pub) {
    const key = await crypto.subtle.importKey("jwk", { ...pub, ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
    return crypto.subtle.deriveKey({ name: "ECDH", public: key }, priv, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function seal(key, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12)),
      data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
    return { iv: b64(iv), data: b64(data) };
  }
  async function unseal(key, box) {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  const random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  // The dealer's record of the hand (all hole cards and the board), on its device only.
  const dealName = (code) => "aiglish_poker_deal_" + uid() + "_" + code;
  function readDeal(code) {
    if (session?.practice && session.code === code) return session.deal;
    try {
      return JSON.parse(localStorage.getItem(dealName(code)) || "null");
    } catch {
      return null;
    }
  }

  // ---- Points ----------------------------------------------------------------------------
  // A hand's result goes into the player's own wallet once (keyed by table and hand).
  const settledName = () => "aiglish_poker_settled_" + uid();
  function settledKeys() {
    try {
      return JSON.parse(localStorage.getItem(settledName()) || "[]");
    } catch {
      return [];
    }
  }
  let settling = Promise.resolve();
  function settle(key, delta) {
    const account = uid();
    settling = settling.then(async () => {
      if (uid() !== account || settledKeys().includes(key)) return;
      const walletRef = window.fbDoc(window.db, "users", account, "learningPoints", "main");
      const next = await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(walletRef),
          wallet = snap.exists() ? snap.data() : {},
          done = wallet.poker && typeof wallet.poker === "object" ? wallet.poker : {};
        if (done[key]) return null;
        const value = { balance: Math.max(0, (Number(wallet.balance) || 0) + delta), revision: (Number(wallet.revision) || 0) + 1 };
        const kept = Object.fromEntries(Object.entries(done).sort((a, b) => b[1] - a[1]).slice(0, 199));
        tx.set(walletRef, { ...value, poker: { ...kept, [key]: Date.now() } }, { merge: true });
        tx.set(window.fbDoc(window.db, "users", account), { studyPoints: value.balance }, { merge: true });
        return value;
      });
      const keys = settledKeys().concat(key).slice(-200);
      try {
        localStorage.setItem(settledName(), JSON.stringify(keys));
      } catch {}
      if (next && uid() === account) window.StudyPoints?.restore?.({ ...next, publishedRevision: next.revision });
    }).catch((error) => console.warn("[poker] points", error));
    return settling;
  }
  const handKey = (room, no) => room.code + ":" + (room.createdAt || 0) + ":" + no;

  // ---- Table document --------------------------------------------------------------------
  function seatFor(room) {
    const taken = new Set(Object.values(room.players || {}).map((p) => p.seat));
    for (let seat = 0; seat < room.settings.seats; seat++) if (!taken.has(seat)) return seat;
    return -1;
  }
  async function update(code, change) {
    // A practice table (against the computer) lives on this device only.
    if (session?.practice && session.code === code) {
      const next = change(JSON.parse(JSON.stringify(session.room)));
      if (!next) return false;
      session.room = next;
      setTimeout(render, 0);
      return true;
    }
    return window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(ref(code));
      if (!snap.exists()) throw Error("テーブルが見つかりません。");
      const room = snap.data(),
        next = change(JSON.parse(JSON.stringify(room)));
      if (!next) return false;
      tx.set(ref(code), next);
      return true;
    });
  }
  // A finished hand writes everyone's stack back to their seat.
  function withHand(room, hand) {
    room.hand = hand;
    if (hand.street === "done") {
      for (const id of hand.seats) if (room.players[id]) room.players[id].stack = hand.stacks[id];
      room.doneAt = Date.now();
    }
    return room;
  }
  const deadlineOf = (room, hand) => (hand.toAct && room.settings.think ? Date.now() + room.settings.think * 1000 : 0);
  const say = (room, text) => {
    room.log = (room.log || []).concat(text).slice(-6);
  };
  const actionText = { fold: "フォールド", check: "チェック", call: "コール", raise: "レイズ", allin: "オールイン" };

  async function create(settings) {
    connected();
    if (balance() < settings.buyIn) throw Error("ポイントが足りません（所持 " + fmt(balance()) + "pt）。");
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(1000 + random(9000)),
        keys = await myKeys(code);
      const made = await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(ref(code));
        if (snap.exists() && snap.data().status !== "closed") return false;
        tx.set(ref(code), {
          version: 1,
          code,
          host: uid(),
          status: "waiting",
          createdAt: Date.now(),
          settings,
          handNo: 0,
          dealer: null,
          hand: null,
          log: [],
          players: { [uid()]: { name: nameOf(), seat: 0, stack: settings.buyIn, pub: keys.pub, joinedAt: Date.now() } },
        });
        return true;
      });
      if (made) return code;
    }
    throw Error("テーブル番号を作れませんでした。もう一度お試しください。");
  }
  async function join(code) {
    connected();
    if (!/^\d{4}$/.test(code)) throw Error("4桁のテーブル番号を入力してください。");
    const keys = await myKeys(code);
    await update(code, (room) => {
      if (room.status === "closed") throw Error("このテーブルは終了しています。");
      if (room.players[uid()]) {
        room.players[uid()].left = false;
        room.players[uid()].pub = keys.pub;
        return room;
      }
      if (balance() < room.settings.buyIn) throw Error("参加費 " + fmt(room.settings.buyIn) + "pt に対してポイントが足りません。");
      const seat = seatFor(room);
      if (seat < 0) throw Error("満席です。");
      room.players[uid()] = { name: nameOf(), seat, stack: room.settings.buyIn, pub: keys.pub, joinedAt: Date.now() };
      say(room, nameOf() + " が着席しました");
      return room;
    });
    return code;
  }

  // ---- Dealer (the table's creator) ------------------------------------------------------
  async function startHand(code) {
    const room = session.room;
    const ready = Object.entries(room.players)
      .filter(([, p]) => !p.left && p.stack > 0)
      .sort((a, b) => a[1].seat - b[1].seat)
      .map(([id]) => id);
    if (ready.length < 2) return;
    const keys = session.practice ? null : await myKeys(code),
      previous = room.dealer && ready.includes(room.dealer) ? ready.indexOf(room.dealer) : -1,
      dealer = ready[(previous + 1) % ready.length],
      cards = P.shuffle(P.deck(), random),
      dealt = {},
      enc = {};
    ready.forEach((id, i) => (dealt[id] = [cards[i], cards[i + ready.length]]));
    const board = cards.slice(ready.length * 2, ready.length * 2 + 5);
    const no = (room.handNo || 0) + 1;
    if (session.practice) session.deal = { no, holes: dealt, board };
    else {
      for (const id of ready) enc[id] = await seal(await shared(keys.priv, room.players[id].pub), dealt[id]);
      try {
        localStorage.setItem(dealName(code), JSON.stringify({ no, holes: dealt, board }));
      } catch {}
    }
    await update(code, (fresh) => {
      if ((fresh.handNo || 0) !== no - 1 || fresh.status === "closed") return null;
      // Players who left while a hand ran leave the table now.
      for (const [id, p] of Object.entries(fresh.players)) if (p.left) delete fresh.players[id];
      const seats = ready.filter((id) => fresh.players[id]);
      if (seats.length < 2) return null;
      const hand = P.start({
        no,
        seats,
        stacks: Object.fromEntries(seats.map((id) => [id, fresh.players[id].stack])),
        dealer: seats.includes(dealer) ? dealer : seats[0],
        smallBlind: fresh.settings.sb,
        bigBlind: fresh.settings.bb,
      });
      hand.enc = enc;
      hand.deadline = deadlineOf(fresh, hand);
      fresh.handNo = no;
      fresh.dealer = hand.dealer;
      fresh.status = "playing";
      say(fresh, "第" + no + "ハンド開始");
      return withHand(fresh, hand);
    });
  }
  // The dealer's turn of the board, showdown, timeouts and the next hand.
  async function dealerStep() {
    const room = session?.room;
    if (!room || room.host !== uid() || room.status === "closed" || busy) return;
    const code = room.code,
      h = room.hand,
      deal = readDeal(code),
      now = Date.now();
    busy = true;
    try {
      if (h && h.street !== "done" && h.needs && deal && deal.no === h.no) {
        await update(code, (fresh) => {
          const hand = fresh.hand;
          if (!hand || hand.no !== h.no || hand.needs !== h.needs) return null;
          let next;
          if (hand.needs === "showdown") {
            next = P.showdown(hand, deal.holes);
            const winners = Object.keys(next.result.won);
            say(fresh, winners.map((id) => (fresh.players[id]?.name || id) + " +" + fmt(next.result.won[id])).join("、") + "（" + (next.result.hands[winners[0]]?.name || "") + "）");
          } else {
            const given = hand.board.length,
              count = hand.needs === "flop" ? 3 : 1;
            next = P.deal(hand, deal.board.slice(given, given + count));
          }
          next.enc = hand.enc;
          next.deadline = deadlineOf(fresh, next);
          return withHand(fresh, next);
        });
      } else if (h && h.toAct && room.players[h.toAct]?.bot) {
        await botStep(room, h, now);
      } else if (h && h.toAct && ((h.deadline && now > h.deadline) || room.players[h.toAct]?.left || !room.players[h.toAct])) {
        // Time is up (or the player left): check when free, otherwise fold.
        await update(code, (fresh) => {
          const hand = fresh.hand;
          if (!hand || hand.no !== h.no || hand.toAct !== h.toAct) return null;
          const gone = !fresh.players[hand.toAct] || fresh.players[hand.toAct].left;
          if (!gone && (!hand.deadline || Date.now() <= hand.deadline)) return null;
          const o = P.options(hand, hand.toAct),
            next = o && o.check && !gone ? P.act(hand, hand.toAct, "check") : P.leave(hand, hand.toAct);
          say(fresh, (fresh.players[h.toAct]?.name || h.toAct) + "：" + (o && o.check && !gone ? "チェック（時間切れ）" : "フォールド（時間切れ）"));
          next.enc = hand.enc;
          next.deadline = deadlineOf(fresh, next);
          return withHand(fresh, next);
        });
      } else if (room.status === "playing" && (!h || (h.street === "done" && now - (room.doneAt || 0) > RESULT_MS))) {
        const ready = Object.values(room.players).filter((p) => !p.left && p.stack > 0).length,
          over = room.practice && (!(room.players[uid()]?.stack > 0) || !Object.values(room.players).some((p) => p.bot && p.stack > 0));
        if (over) {
          if (room.status !== "over") await update(code, (fresh) => ((fresh.status = "over"), fresh));
        } else if (ready >= 2) await startHand(code);
        else
          await update(code, (fresh) => {
            if (fresh.status !== "playing" || (fresh.hand && fresh.hand.street !== "done")) return null;
            fresh.status = "waiting";
            return fresh;
          });
      }
    } catch (error) {
      console.warn("[poker] dealer", error);
    } finally {
      busy = false;
    }
  }

  async function botStep(room, h, now) {
    const id = h.toAct,
      key = h.no + ":" + id + ":" + h.street + ":" + JSON.stringify(h.bet);
    if (session.botKey !== key) {
      session.botKey = key;
      session.botDue = now + 700 + random(900);
      return;
    }
    if (now < session.botDue) return;
    session.botKey = "";
    let m = null;
    try {
      m = window.PokerBot.decide(h, id, session.deal.holes[id], room.players[id].bot);
    } catch (error) {
      console.warn("[poker] computer", error);
    }
    m = m || { type: P.options(h, id)?.check ? "check" : "fold" };
    await update(room.code, (fresh) => {
      const hand = fresh.hand;
      if (!hand || hand.no !== h.no || hand.toAct !== id) return null;
      let next;
      try {
        next = P.act(hand, id, m.type, m.to);
      } catch {
        next = P.act(hand, id, P.options(hand, id)?.check ? "check" : "fold");
      }
      const shown = ["call", "raise"].includes(next.last?.type) && next.last.amount ? " " + fmt(next.last.amount) : "";
      say(fresh, fresh.players[id].name + "：" + actionText[next.last?.type || m.type] + shown);
      next.enc = hand.enc;
      next.deadline = deadlineOf(fresh, next);
      return withHand(fresh, next);
    });
  }

  // ---- Player moves ----------------------------------------------------------------------
  async function move(type, to) {
    const code = session.code,
      me = uid();
    await update(code, (room) => {
      const hand = room.hand;
      if (!hand || hand.toAct !== me) return null;
      const next = P.act(hand, me, type, to);
      const label = type === "allin" ? actionText.allin : actionText[next.last?.type || type],
        shown = ["call", "raise", "allin"].includes(type) && next.last?.amount ? " " + fmt(next.last.amount) : "";
      say(room, (room.players[me]?.name || me) + "：" + label + shown);
      next.enc = hand.enc;
      next.deadline = deadlineOf(room, next);
      return withHand(room, next);
    });
  }
  async function leaveTable() {
    const s = session;
    if (!s || s.practice) return close();
    const me = uid();
    let loss = null;
    try {
      await update(s.code, (room) => {
        loss = null;
        if (room.host === me) {
          room.status = "closed";
          say(room, "テーブルが閉じられました");
          return room;
        }
        const hand = room.hand;
        if (hand && hand.street !== "done" && hand.seats.includes(me) && !hand.folded[me]) {
          // Chips already in the pot stay there; the loss is settled now.
          const next = P.leave(hand, me);
          next.enc = hand.enc;
          next.deadline = next.toAct ? (hand.toAct === me ? Date.now() + room.settings.think * 1000 : hand.deadline) : 0;
          withHand(room, next);
          if (next.street !== "done") room.players[me].left = true;
          else delete room.players[me];
          loss = { key: handKey(room, hand.no), delta: -(hand.total[me] || 0) };
        } else delete room.players[me];
        say(room, (s.room?.players?.[me]?.name || me) + " が席を立ちました");
        return room;
      });
      if (loss && loss.delta) await settle(loss.key, loss.delta);
    } catch (error) {
      console.warn("[poker] leave", error);
    }
    close();
  }
  async function rebuy() {
    const me = uid();
    await update(session.code, (room) => {
      const p = room.players[me];
      if (!p || p.stack > 0) return null;
      if (!room.practice && balance() < room.settings.buyIn) throw Error("ポイントが足りません。");
      p.stack = room.settings.buyIn;
      say(room, p.name + " がチップを追加しました");
      return room;
    });
  }
  async function begin() {
    await update(session.code, (room) => {
      if (room.host !== uid() || room.status !== "waiting") return null;
      room.status = "playing";
      room.doneAt = 0;
      return room;
    });
  }

  // ---- Screen ----------------------------------------------------------------------------
  function close() {
    unsubscribe?.();
    unsubscribe = null;
    clearInterval(ticker);
    ticker = null;
    session = null;
    holes = { no: -1, cards: null };
    if (screen?.open) screen.close();
    screen?.remove();
    screen = null;
    document.body.classList.remove("poker-open");
  }
  function errorText(error) {
    const box = screen?.querySelector("[data-pk-status]");
    if (box) box.textContent = error?.message || String(error);
  }
  const guard = (fn) => async (...args) => {
    try {
      errorText("");
      await fn(...args);
    } catch (error) {
      errorText(error);
    }
  };
  function cardEl(card, small) {
    const el = node("span", "pk-card" + (small ? " is-small" : ""));
    if (!card) {
      el.classList.add("is-back");
      return el;
    }
    el.classList.toggle("is-red", card[1] === "h" || card[1] === "d");
    el.append(node("b", "", card[0] === "T" ? "10" : card[0]), node("i", "", { s: "♠", h: "♥", d: "♦", c: "♣" }[card[1]]));
    el.setAttribute("aria-label", P.pretty(card));
    return el;
  }

  function lobby() {
    const view = screen.querySelector("[data-pk-view]");
    view.replaceChildren();
    view.className = "pk-lobby";
    view.innerHTML =
      '<p class="pk-kicker">TEXAS HOLD’EM</p><h2>ポーカー</h2><p class="pk-balance"></p>' +
      '<section class="pk-panel"><h3>テーブルを作る</h3>' +
      '<label>参加費<span class="pk-field"><input type="number" data-pk-buyin min="20" step="10" value="100" inputmode="numeric"><em>pt</em></span></label>' +
      '<label>ブラインド<select data-pk-blinds>' + BLINDS.map(([s, b], i) => '<option value="' + i + '"' + (i ? "" : " selected") + ">" + s + " / " + b + "</option>").join("") + "</select></label>" +
      '<label>人数<select data-pk-seats>' + [2, 3, 4, 5, 6].map((n) => '<option value="' + n + '"' + (n === 6 ? " selected" : "") + ">最大" + n + "人</option>").join("") + "</select></label>" +
      '<label>持ち時間<select data-pk-think>' + THINK.map((n) => '<option value="' + n + '"' + (n === 30 ? " selected" : "") + ">" + n + "秒</option>").join("") + "</select></label>" +
      '<button type="button" class="pk-primary" data-pk-create>テーブルを作る</button></section>' +
      '<section class="pk-panel"><h3>テーブルに入る</h3><div class="pk-join"><input data-pk-code inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="0000" aria-label="テーブル番号"><button type="button" data-pk-join>参加</button></div></section>' +
      '<section class="pk-panel"><h3>コンピュータと練習</h3>' +
      '<label>相手<select data-pk-bots>' + [1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' + (n === 1 ? " selected" : "") + ">" + n + "人</option>").join("") + "</select></label>" +
      '<label>強さ<select data-pk-level><option value="easy">やさしい</option><option value="normal" selected>ふつう</option><option value="hard">つよい</option></select></label>' +
      '<button type="button" class="pk-primary" data-pk-practice>練習を始める</button><p class="pk-sub">ポイントは賭けません。チップは100枚、ブラインドは1/2です。</p></section>' +
      '<button type="button" class="pk-howto" data-pk-howto>遊び方を見る</button>' +
      '<p class="pk-note">チップは参加費の分だけ配られます。勝ち負けは1ハンドごとにポイントへ反映され、途中で終わったハンドは反映されません。カードを配るのはテーブルを作った人の端末です。</p>' +
      '<p class="pk-status" data-pk-status role="status"></p>';
    view.querySelector(".pk-balance").textContent = "所持ポイント " + fmt(balance()) + "pt";
    view.querySelector("[data-pk-create]").onclick = guard(async () => {
      const buyIn = Math.floor(Number(view.querySelector("[data-pk-buyin]").value)),
        [sb, bb] = BLINDS[Number(view.querySelector("[data-pk-blinds]").value)];
      if (!(buyIn >= 20 && buyIn <= 100000)) throw Error("参加費は20〜100,000ptで決めてください。");
      if (buyIn < bb * 10) throw Error("参加費はビッグブラインドの10倍以上にしてください（" + fmt(bb * 10) + "pt〜）。");
      const code = await create({ buyIn, sb, bb, seats: Number(view.querySelector("[data-pk-seats]").value), think: Number(view.querySelector("[data-pk-think]").value) });
      enter(code);
    });
    view.querySelector("[data-pk-join]").onclick = guard(async () => enter(await join(view.querySelector("[data-pk-code]").value.trim())));
    view.querySelector("[data-pk-practice]").onclick = () =>
      practice({ bots: Number(view.querySelector("[data-pk-bots]").value), level: view.querySelector("[data-pk-level]").value, buyIn: 100, sb: 1, bb: 2 });
    view.querySelector("[data-pk-howto]").onclick = () => window.PokerTutorial?.open({ practice: () => view.querySelector("[data-pk-practice]").click() });
  }

  // A table against the computer: the player plus 1-5 computers, practice chips only.
  const BOT_NAMES = ["ペンギン", "シロクマ", "アザラシ", "ラッコ", "キツネ"];
  function practice(settings) {
    const me = uid(),
      players = { [me]: { name: nameOf(), seat: 0, stack: settings.buyIn, joinedAt: Date.now() } };
    for (let i = 0; i < settings.bots; i++)
      players["cpu-" + i] = { name: BOT_NAMES[i], seat: i + 1, stack: settings.buyIn, bot: settings.level, joinedAt: Date.now() };
    const room = {
      version: 1,
      code: "practice",
      practice: true,
      practiceSettings: settings,
      host: me,
      status: "playing",
      createdAt: Date.now(),
      settings: { buyIn: settings.buyIn, sb: settings.sb, bb: settings.bb, seats: settings.bots + 1, think: 0 },
      handNo: 0,
      dealer: null,
      hand: null,
      doneAt: 0,
      log: [],
      players,
    };
    enter("practice", room);
  }

  function enter(code, practiceRoom) {
    window.PokerFX?.reset();
    session = { code, id: uid(), room: practiceRoom || null, practice: !!practiceRoom, deal: null };
    const view = screen.querySelector("[data-pk-view]");
    view.className = "pk-table-view";
    view.innerHTML =
      '<header class="pk-bar"><div><strong>テーブル <span data-pk-room></span></strong><small data-pk-rules></small></div><button type="button" class="pk-leave" data-pk-leave>席を立つ</button></header>' +
      '<div class="pk-felt"><div class="pk-seats"></div><div class="pk-center"><div class="pk-board"></div><p class="pk-pot"></p><p class="pk-log" aria-live="polite"></p></div></div>' +
      '<section class="pk-me"><div class="pk-hole"></div><p class="pk-hand-name"></p><div class="pk-actions"></div></section>' +
      '<p class="pk-status" data-pk-status role="status"></p>';
    view.querySelector("[data-pk-room]").textContent = practiceRoom ? "練習" : code;
    view.querySelector("[data-pk-leave]").onclick = guard(leaveTable);
    view.querySelector("[data-pk-leave]").textContent = practiceRoom ? "やめる" : "席を立つ";
    unsubscribe?.();
    unsubscribe = null;
    if (practiceRoom) {
      render();
      clearInterval(ticker);
      ticker = setInterval(() => {
        renderClock();
        dealerStep();
      }, 300);
      return;
    }
    unsubscribe = window.fbOnSnapshot(ref(code), (snap) => {
      if (!session || session.code !== code || uid() !== session.id) return;
      if (!snap.exists()) {
        errorText("テーブルが見つかりません。");
        return;
      }
      session.room = snap.data();
      render();
    });
    clearInterval(ticker);
    ticker = setInterval(() => {
      renderClock();
      dealerStep();
    }, 1000);
  }

  // Seats around the table, with the player at the bottom.
  function seatPlaces(count) {
    return Array.from({ length: count }, (_, i) => {
      const angle = Math.PI / 2 + (i * 2 * Math.PI) / count;
      return { x: 50 + 37 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
    });
  }
  async function myHoles(room) {
    const h = room.hand,
      me = uid();
    if (room.practice) return session.deal && session.deal.no === h?.no ? session.deal.holes[me] || null : null;
    if (!h || !h.enc?.[me]) return null;
    if (holes.no === h.no && holes.code === room.code) return holes.cards;
    const keys = await myKeys(room.code),
      host = room.players[room.host];
    if (!host?.pub) return null;
    try {
      const cards = await unseal(await shared(keys.priv, host.pub), h.enc[me]);
      holes = { code: room.code, no: h.no, cards };
      return cards;
    } catch {
      return null;
    }
  }
  function render() {
    const room = session?.room;
    if (!room || !screen) return;
    const view = screen.querySelector("[data-pk-view]"),
      me = uid(),
      h = room.hand,
      mine = room.players[me];
    view.querySelector("[data-pk-rules]").textContent = "ブラインド " + room.settings.sb + "/" + room.settings.bb + (room.practice ? " · 練習（ポイントは賭けません）" : " · 参加費 " + fmt(room.settings.buyIn) + "pt");
    if (room.status === "closed") {
      view.querySelector(".pk-actions").replaceChildren(node("p", "pk-wait", "テーブルは閉じられました。"));
      view.querySelector(".pk-actions").append(button("ロビーへ", () => { close(); open(); }, "pk-primary"));
      clearInterval(ticker);
      return;
    }
    if (!mine) {
      view.querySelector(".pk-actions").replaceChildren(node("p", "pk-wait", "席がありません。"));
      return;
    }
    // Seats.
    const order = Object.entries(room.players).sort((a, b) => a[1].seat - b[1].seat).map(([id]) => id),
      start = order.indexOf(me),
      ring = order.slice(start).concat(order.slice(0, start)),
      places = seatPlaces(Math.max(ring.length, 2)),
      seats = view.querySelector(".pk-seats");
    seats.replaceChildren();
    ring.forEach((id, i) => {
      const p = room.players[id],
        inHand = h && h.seats.includes(id),
        seat = node("div", "pk-seat");
      seat.style.left = places[i].x + "%";
      seat.style.top = places[i].y + "%";
      seat.classList.toggle("is-me", id === me);
      seat.classList.toggle("is-turn", !!h && h.toAct === id);
      seat.classList.toggle("is-folded", !!inHand && !!h.folded[id]);
      seat.classList.toggle("is-out", !!p.left || (!inHand && !!h && h.street !== "done"));
      seat.dataset.id = id;
      const plate = node("div", "pk-plate");
      plate.append(node("strong", "", p.name), node("span", "pk-stack", fmt(inHand ? h.stacks[id] : p.stack)));
      if (h && h.dealer === id) plate.append(node("em", "pk-dealer", "D"));
      seat.append(plate);
      if (inHand && (h.bet[id] || 0) > 0 && h.street !== "done") seat.append(node("span", "pk-bet", fmt(h.bet[id])));
      const shown = h?.street === "done" && h.result?.shown?.[id];
      if (id !== me && inHand && !h.folded[id]) {
        const cards = node("div", "pk-seat-cards");
        (shown || [null, null]).forEach((c) => cards.append(cardEl(c, true)));
        seat.append(cards);
      }
      if (h?.street === "done" && h.result) {
        const won = h.result.won?.[id];
        if (won) seat.append(node("span", "pk-won", "+" + fmt(won) + (h.result.hands?.[id] ? " " + h.result.hands[id].name : "")));
      }
      if (h && h.toAct === id) seat.append(node("span", "pk-clock", p.bot ? "考え中…" : ""));
      seats.append(seat);
    });
    // Board and pot.
    const board = view.querySelector(".pk-board");
    board.replaceChildren();
    for (let i = 0; i < 5; i++) board.append(h?.board?.[i] ? cardEl(h.board[i]) : node("span", "pk-card is-slot"));
    view.querySelector(".pk-pot").textContent = h && h.street !== "done" ? "ポット " + fmt(P.potOf(h)) : "";
    view.querySelector(".pk-log").textContent = (room.log || []).slice(-1)[0] || "";
    window.PokerFX?.decorate(view, room, ring, places, me);
    // Points: this hand's result, once.
    if (!room.practice && h?.street === "done" && h.result?.net && Object.hasOwn(h.result.net, me)) settle(handKey(room, h.no), h.result.net[me]);
    renderMine(room);
    renderClock();
  }
  function button(text, action, cls) {
    const el = node("button", cls || "", text);
    el.type = "button";
    el.onclick = guard(action);
    return el;
  }
  async function renderMine(room) {
    const view = screen?.querySelector("[data-pk-view]");
    if (!view) return;
    const me = uid(),
      h = room.hand,
      hole = view.querySelector(".pk-hole"),
      nameLine = view.querySelector(".pk-hand-name"),
      actions = view.querySelector(".pk-actions"),
      cards = h && h.seats.includes(me) ? await myHoles(room) : null;
    if (session?.room !== room) return;
    hole.replaceChildren();
    if (cards) cards.forEach((c) => hole.append(cardEl(c)));
    window.PokerFX?.hole(view, room, me);
    hole.classList.toggle("is-folded", !!h?.folded?.[me]);
    nameLine.textContent = cards ? (h.folded[me] ? "フォールド" : P.describe(cards.concat(h.board || []))) : "";
    actions.replaceChildren();
    const mine = room.players[me];
    if (room.practice && room.status === "over") {
      const won = mine && mine.stack > 0;
      actions.append(node("p", "pk-wait pk-final", won ? "勝ちました！ 全員のチップを手に入れました。" : "チップがなくなりました。"));
      const row = node("div", "pk-buttons");
      row.append(button("ロビーへ", () => { close(); open(); }), button("もう一度", () => practice(room.practiceSettings), "pk-primary"));
      actions.append(row);
      return;
    }
    if (room.status === "waiting") {
      const count = Object.values(room.players).filter((p) => !p.left).length;
      if (room.host === me) {
        actions.append(node("p", "pk-wait", "テーブル番号 " + room.code + " を伝えてください（" + count + "/" + room.settings.seats + "人）"));
        const go = button("ゲームを始める", begin, "pk-primary");
        go.disabled = count < 2;
        actions.append(go);
      } else actions.append(node("p", "pk-wait", "テーブルを作った人の開始を待っています（" + count + "人）"));
      return;
    }
    if (!room.practice && mine && mine.stack <= 0 && (!h || h.street === "done" || !h.seats.includes(me))) {
      actions.append(node("p", "pk-wait", "チップがなくなりました。"));
      const add = button("チップを追加（" + fmt(room.settings.buyIn) + "pt）", rebuy, "pk-primary");
      add.disabled = balance() < room.settings.buyIn;
      actions.append(add);
      return;
    }
    const o = h ? P.options(h, me) : null;
    if (!o) {
      actions.append(node("p", "pk-wait", !h || h.street === "done" ? "次のハンドを準備しています" : h.seats.includes(me) ? (h.folded[me] ? "このハンドは降りました" : "相手の番です") : "次のハンドから参加します"));
      return;
    }
    const row = node("div", "pk-buttons");
    row.append(button("フォールド", () => move("fold"), "pk-fold"));
    row.append(o.check ? button("チェック", () => move("check")) : button("コール " + fmt(o.call), () => move("call")));
    if (o.raise) {
      const raise = button(h.current ? "レイズ" : "ベット", () => {}, "pk-raise");
      raise.onclick = () => openRaise(o, h);
      row.append(raise);
    }
    actions.append(row);
  }
  function openRaise(o, h) {
    const actions = screen.querySelector(".pk-actions");
    actions.replaceChildren();
    const panel = node("div", "pk-raise-panel"),
      amount = node("strong", "pk-raise-amount"),
      slider = node("input");
    slider.type = "range";
    slider.min = String(o.raise.min);
    slider.max = String(o.raise.max);
    slider.step = String(Math.max(1, h.bb / 2));
    slider.value = String(o.raise.min);
    slider.setAttribute("aria-label", "レイズ額");
    const show = () => (amount.textContent = (Number(slider.value) >= o.raise.max ? "オールイン " : "") + fmt(slider.value));
    slider.oninput = show;
    show();
    const quick = node("div", "pk-quick"),
      set = (value) => {
        slider.value = String(Math.max(o.raise.min, Math.min(o.raise.max, Math.round(value))));
        show();
      };
    [["最小", o.raise.min], ["½ポット", h.current + o.pot / 2], ["ポット", h.current + o.pot], ["オールイン", o.raise.max]].forEach(([label, value]) => {
      const b = node("button", "", label);
      b.type = "button";
      b.onclick = () => set(value);
      quick.append(b);
    });
    const row = node("div", "pk-buttons");
    row.append(button("戻る", () => renderMine(session.room), "pk-fold"));
    row.append(button("決定", () => (Number(slider.value) >= o.raise.max ? move("allin") : move("raise", Number(slider.value))), "pk-primary"));
    panel.append(amount, slider, quick, row);
    actions.append(panel);
  }
  function renderClock() {
    const room = session?.room,
      h = room?.hand,
      clock = screen?.querySelector(".pk-seat.is-turn .pk-clock");
    if (!clock || !h?.deadline) return;
    const left = Math.max(0, Math.ceil((h.deadline - Date.now()) / 1000));
    clock.textContent = left + "秒";
    clock.style.setProperty("--pk-left", String(Math.min(1, left / (room.settings.think || 30))));
  }

  function open() {
    if (screen) return;
    screen = document.createElement("dialog");
    screen.className = "poker-screen";
    screen.setAttribute("aria-label", "ポーカー");
    screen.innerHTML = '<button type="button" class="pk-close" aria-label="ポーカーを閉じる">×</button><div data-pk-view></div>';
    screen.querySelector(".pk-close").onclick = () => (session ? leaveTable() : close());
    screen.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (!session) close();
    });
    document.body.append(screen);
    document.body.classList.add("poker-open");
    screen.showModal();
    lobby();
    let seen = false;
    try {
      seen = localStorage.getItem("aiglish_poker_tutorial_seen") === "1";
      localStorage.setItem("aiglish_poker_tutorial_seen", "1");
    } catch {}
    if (!seen) window.PokerTutorial?.open({ practice: () => screen?.querySelector("[data-pk-practice]")?.click() });
  }
  window.Poker = Object.freeze({ open, close, settle, practice, card: cardEl, _session: () => session });
})();
