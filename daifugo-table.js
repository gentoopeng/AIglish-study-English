// 大富豪 at a table: the shared room, the dealer, and the settlement. No screen here (daifugo.js).
//
// A table is one document, pokerRooms/{4 digits} with kind "daifugo" (the same numbers and the same
// expiry as the other card tables). The player who made it is the dealer: its device holds the
// whole game (every hand), applies each player's move, and writes back only what everyone may see
// (the field, how many cards each player holds, whose turn). Each player's own cards are written
// sealed for that player alone (ECDH + AES-GCM, like the poker table). A move is a line in
// room.moves[uid] that the dealer picks up. A table against the computer is the same thing on
// this device only, with no points.
//
// Points move once, at the very end (after one game, or after a set of four): each player who
// owes (the lower half of the standing) pays the one paired with them, "give" through
// PointLoans.pay, from the wallet and, when that is short, from a casino loan.
(function () {
  "use strict";
  const D = window.DaifugoModel;
  const uid = () => (typeof myId === "string" && myId ? myId : "GUEST-000");
  const nameOf = () => String((typeof myName === "string" && myName) || uid()).slice(0, 24);
  const ref = (code) => window.fbDoc(window.db, "pokerRooms", code);
  const KIND = "daifugo",
    THINK = [15, 30, 45, 60],
    EXCHANGE_MS = 30000,
    BETWEEN_MS = 9000,
    BOT_MS = [650, 1200];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const fraction = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

  // ---- Keys and sealed hands (as in poker.js) ----------------------------------------------
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const keyName = (code) => "aiglish_df_key_" + uid() + "_" + code;
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

  // ---- The session on this device ----------------------------------------------------------
  // session: { code, practice, room, me, host (is this device the dealer), keys, hand, listeners }
  let session = null,
    unsubscribe = null,
    ticker = null,
    stepping = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(view()));
  const hostName = (code) => "aiglish_df_host_" + uid() + "_" + code;
  function loadHost(code) {
    if (session?.practice && session.code === code) return session.hostState;
    try {
      return JSON.parse(localStorage.getItem(hostName(code)) || "null");
    } catch {
      return null;
    }
  }
  function saveHost(code, hs) {
    if (session?.practice && session.code === code) {
      session.hostState = hs;
      return;
    }
    try {
      localStorage.setItem(hostName(code), JSON.stringify(hs));
    } catch {}
  }
  function connected() {
    if (uid() === "GUEST-000") throw Error("大富豪のテーブルはログインしたアカウントで使えます。");
    if (!window.db || !window.fbRunTransaction || !window.fbOnSnapshot) throw Error("テーブルにはクラウドへの接続が必要です。");
    if (window.FirestoreReadGuard?.paused?.()) throw Error("クラウドの利用上限に達しています。時間をおいてお試しください。");
  }
  async function update(code, change) {
    if (session?.practice && session.code === code) {
      const next = change(clone(session.room));
      if (!next) return false;
      session.room = next;
      setTimeout(() => {
        emit();
        step();
      }, 0);
      return true;
    }
    return window.fbRunTransaction(window.db, async (tx) => {
      const snap = await tx.get(ref(code));
      if (!snap.exists()) throw Error("テーブルが見つかりません。");
      const next = change(clone(snap.data()));
      if (!next) return false;
      tx.set(ref(code), next);
      return true;
    });
  }

  // ---- What everyone may see of a game ---------------------------------------------------
  function publicOf(state, picks) {
    const counts = Object.fromEntries(state.ids.map((id) => [id, state.hands[id].length]));
    return {
      n: state.n,
      ids: state.ids,
      turn: state.turn,
      field: state.field,
      lock: state.lock,
      rev: state.rev,
      passed: state.passed,
      legal: state.legal,
      illegal: state.illegal,
      fallen: state.fallen,
      counts,
      phase: state.phase,
      ranking: state.ranking,
      top: state.top,
      log: state.log.slice(-12),
      seq: state.log.length,
      ex: state.exchange ? { pairs: state.exchange.pairs, waiting: state.exchange.pairs.filter((p) => !picks?.[p.high]).map((p) => p.high) } : null,
    };
  }
  // Points so far in the set (6/4/2/0 a game, 2 more for the best of the last game of the set).
  const totalsOf = (ids, games, of = 1) => {
    const total = Object.fromEntries(ids.map((id) => [id, 0]));
    games.forEach((ranking, g) => ranking.forEach((id, i) => (total[id] += D.gamePoints(ids.length, i + 1, of > 1 && g === of - 1))));
    return total;
  };
  // The player a seat belongs to, in the order the game uses.
  const seatOrder = (room) => Object.entries(room.players).sort((a, b) => a[1].seat - b[1].seat).map(([id]) => id);

  // ---- The dealer ------------------------------------------------------------------------
  // The dealer plays by the settings it started with (a player cannot change them in the document).
  const cfg = (room, hs) => (hs && hs.settings) || room.settings;
  const thinkMs = (room, hs) => (cfg(room, hs).think || 30) * 1000;
  const botDelay = () => BOT_MS[0] + fraction() * (BOT_MS[1] - BOT_MS[0]);
  function newGame(room, hs) {
    const ids = hs.ids,
      prev = hs.games.length ? { ranking: hs.games[hs.games.length - 1] } : null;
    hs.state = D.start({ ids, rand: fraction, prev, opts: { miyakoochi: !!cfg(room, hs).miyakoochi } });
    hs.picks = {};
    hs.got = null;
    hs.deadline = hs.state.phase === "exchange" ? Date.now() + EXCHANGE_MS : Date.now() + thinkMs(room, hs);
    hs.actAt = 0;
    hs.nextAt = 0;
    hs.no = hs.games.length + 1;
    return hs;
  }
  function autoPicks(state, picks) {
    const out = { ...picks };
    for (const pair of state.exchange.pairs) {
      if (out[pair.high]) continue;
      // The weakest cards (jokers and 2s are kept).
      out[pair.high] = state.hands[pair.high].slice().sort((a, b) => D.cardsByStrength(a, b, false)).slice(0, pair.count);
    }
    return out;
  }
  // What the player holds is sealed for them; `got` are the cards they received in an exchange.
  async function boxes(room, hs, ids, got) {
    const out = {},
      hostPub = room.players[room.host]?.pub;
    for (const id of ids) {
      const player = room.players[id],
        pub = hs.pubs?.[id];
      if (!player || player.bot || id === room.host || !pub) continue;
      const key = await shared(session.keys.priv, pub);
      out[id] = await seal(key, { no: hs.no, seq: hs.state.log.length, hand: hs.state.hands[id], got: got?.[id] || [] });
    }
    return out;
  }
  // One decision of the dealer. Returns true when it wrote something.
  async function step() {
    if (!session || !session.host || stepping) return false;
    const code = session.code;
    let room = session.room;
    if (!room || room.status !== "playing") return false;
    stepping = true;
    try {
      let hs = loadHost(code);
      const now = Date.now();
      let changed = false,
        sealIds = [],
        got = null;
      if (!hs || !hs.state) {
        const ids = seatOrder(room);
        hs = newGame(room, { ids, games: [], lastSeq: {}, picks: {}, settings: clone(room.settings), pubs: Object.fromEntries(ids.map((id) => [id, room.players[id].pub || null])) });
        changed = true;
        sealIds = hs.ids;
      } else if (hs.state.phase === "done") {
        // Between games: the next one starts after a pause, or the table is finished.
        if (!hs.finishedGame) {
          hs.games.push(hs.state.ranking);
          hs.finishedGame = true;
          hs.nextAt = now + (hs.games.length >= cfg(room, hs).games ? 0 : typeof window.__dfBetween === "number" ? window.__dfBetween : BETWEEN_MS); // (the number can be set by a test)
          changed = true;
        } else if (now >= hs.nextAt) {
          if (hs.games.length >= cfg(room, hs).games) return await finish(room, hs, session);
          hs.finishedGame = false;
          hs = newGame(room, hs);
          changed = true;
          sealIds = hs.ids;
        }
      } else if (hs.state.phase === "exchange") {
        const waiting = hs.state.exchange.pairs.filter((p) => !hs.picks[p.high]);
        // Moves of type "give" are the picks of the upper players.
        for (const [id, move] of Object.entries(room.moves || {})) {
          if (!move || move.seq <= (hs.lastSeq[id] || 0) || move.seq > now + 60000) continue;
          hs.lastSeq[id] = move.seq;
          const pair = hs.state.exchange.pairs.find((p) => p.high === id);
          if (move.type === "give" && pair && Array.isArray(move.cards) && move.cards.length === pair.count && move.cards.every((c) => hs.state.hands[id].includes(c)) && new Set(move.cards).size === pair.count) {
            hs.picks[id] = move.cards;
            changed = true;
          }
        }
        const botsOrAway = hs.state.exchange.pairs.filter((p) => !hs.picks[p.high] && (room.players[p.high]?.bot || room.players[p.high]?.left));
        if (botsOrAway.length) for (const p of botsOrAway) hs.picks[p.high] = autoPicks(hs.state, hs.picks)[p.high], (changed = true);
        if (hs.state.exchange.pairs.every((p) => hs.picks[p.high]) || now >= hs.deadline) {
          const picks = autoPicks(hs.state, hs.picks);
          const before = hs.state;
          hs.state = D.exchange(hs.state, picks);
          // Who got what: the lower players got the picks, the upper ones their strongest.
          got = {};
          for (const [id, cards] of Object.entries(hs.state.exchange.given)) {
            const pair = before.exchange.pairs.find((p) => p.low === id || p.high === id);
            const other = pair.low === id ? pair.high : pair.low;
            got[other] = cards;
          }
          hs.deadline = now + thinkMs(room, hs);
          hs.actAt = 0;
          hs.got = got;
          sealIds = hs.ids;
          changed = true;
        } else if (waiting.length && !changed) return false;
      } else {
        const state = hs.state,
          turn = state.turn,
          player = room.players[turn];
        let move = null;
        const queued = room.moves?.[turn];
        // (A move stamped in the future is a forgery: it would lock the player out of every later move.)
        if (queued && queued.seq > (hs.lastSeq[turn] || 0) && queued.seq <= now + 60000) {
          hs.lastSeq[turn] = queued.seq;
          move = queued;
          changed = true;
        } else if (player?.bot || player?.left) {
          if (!hs.actAt) {
            hs.actAt = now + (player.bot ? botDelay() : 900);
            saveHost(code, hs);
            return false;
          }
          if (now >= hs.actAt) move = { auto: true };
        } else if (now >= hs.deadline) move = { auto: true };
        // Moves of players who are not on turn are dropped (their screen shows why).
        for (const [id, other] of Object.entries(room.moves || {})) if (id !== turn && other && other.seq > (hs.lastSeq[id] || 0) && other.seq <= now + 60000) hs.lastSeq[id] = other.seq;
        if (!move) {
          if (changed) saveHost(code, hs);
          return false;
        }
        let next = state,
          rejected = null;
        try {
          if (move.auto) {
            const cards = D.choose(state, turn, fraction);
            next = cards ? D.play(state, turn, cards) : state.field ? D.pass(state, turn) : D.play(state, turn, D.plays(state, turn)[0]);
          } else if (move.type === "pass") next = D.pass(state, turn);
          else next = D.play(state, turn, move.cards);
        } catch (error) {
          rejected = String(error?.message || error);
        }
        if (rejected) {
          // The player is told why; the turn stays.
          saveHost(code, hs);
          await update(code, (r) => {
            r.rej = { ...(r.rej || {}), [turn]: { seq: queued?.seq || 0, text: rejected } };
            return r;
          });
          return true;
        }
        hs.state = next;
        hs.actAt = 0;
        hs.deadline = now + thinkMs(room, hs);
        sealIds = [turn];
        changed = true;
      }
      if (!changed) return false;
      // Written to the table first: if that fails, the saved game has not moved and the step is tried again.
      await publish(session, room, hs, sealIds, got);
      saveHost(code, hs);
      return true;
    } catch (error) {
      console.warn("[daifugo] dealer", error);
      return false;
    } finally {
      stepping = false;
    }
  }
  async function publish(s, room, hs, sealIds, got) {
    if (session !== s) return;
    const sealed = sealIds.length && !s.practice ? await boxes(room, hs, sealIds, got) : {};
    if (session !== s) return;
    const totals = totalsOf(hs.ids, hs.games, cfg(room, hs).games);
    await update(s.code, (r) => {
      r.g = publicOf(hs.state, hs.picks);
      r.gNo = hs.no;
      r.games = hs.games.map((ranking) => ({ r: ranking })); // (a list inside a list cannot be stored)
      r.totals = totals;
      r.deadline = hs.state.phase === "done" ? 0 : hs.deadline;
      r.betweenAt = hs.state.phase === "done" && hs.nextAt ? hs.nextAt : 0;
      r.acked = hs.lastSeq;
      r.enc = { ...(r.enc || {}), ...sealed };
      return r;
    });
  }
  // The end: the standing of the set. (Who pays whom is worked out on each device, from the stake it
  // agreed to when it sat down; see payments().)
  async function finish(room, hs, s) {
    if (session !== s) return false;
    const order = D.standing(hs.ids, hs.games);
    await update(s.code, (r) => {
      if (r.status !== "playing") return null;
      r.status = "finished";
      r.final = { order, at: Date.now() };
      return r;
    });
    return true;
  }

  // ---- Making and joining a table ------------------------------------------------------
  const pendingName = () => "aiglish_df_due_" + uid();
  function pendingList() {
    try {
      return JSON.parse(localStorage.getItem(pendingName()) || "[]");
    } catch {
      return [];
    }
  }
  const setPending = (list) => {
    try {
      localStorage.setItem(pendingName(), JSON.stringify(list.slice(-10)));
    } catch {}
  };
  // What this device agreed to when it sat down: the stake and when the table was made. Payments are
  // worked out from this, never from what the document says later.
  const addPending = (code, createdAt, stake) => {
    const old = pendingList().find((p) => p.code === code && (!createdAt || !p.createdAt || p.createdAt === createdAt));
    if (old && old.stake) return;
    setPending([...pendingList().filter((p) => p.code !== code), { code, createdAt: createdAt || old?.createdAt || null, stake: stake || old?.stake || 0 }]);
  };
  const agreedFor = (room) => pendingList().find((p) => p.code === room.code && p.createdAt === room.createdAt && p.stake > 0) || null;
  const dropPending = (code) => setPending(pendingList().filter((p) => p.code !== code));
  const cleanSettings = (s) => ({
    stake: Math.max(1, Math.min(100000, Math.floor(Number(s.stake)) || 1)),
    games: s.games === 4 ? 4 : 1,
    seats: [3, 4, 5].includes(s.seats) ? s.seats : 4,
    think: THINK.includes(s.think) ? s.think : 30,
    miyakoochi: !!s.miyakoochi,
  });
  const avatarOf = () => {
    try {
      const a = localStorage.getItem("core_v4_user_avatar_" + uid()) || "";
      return a.length <= 20000 ? a : "";
    } catch {
      return "";
    }
  };
  const playerEntry = (seat, keys) => ({ name: nameOf(), seat, pub: keys.pub, joinedAt: Date.now(), avatar: avatarOf() });
  async function createTable(settings) {
    connected();
    const clean = cleanSettings(settings);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(1000 + random(9000)),
        keys = await myKeys(code),
        createdAt = Date.now();
      const made = await window.fbRunTransaction(window.db, async (tx) => {
        const snap = await tx.get(ref(code));
        // A finished or closed table, or one nobody has touched for 6 hours, can be taken over.
        // A closed table, or one nobody has touched for 6 hours, can be taken over; a finished one stays for a day so everybody can settle.
        if (snap.exists()) {
          const old = snap.data(),
            quiet = Date.now() - Math.max(old.createdAt || 0, old.final?.at || 0);
          if (old.status === "finished" ? quiet < 24 * 3600 * 1000 : old.status !== "closed" && quiet < 6 * 3600 * 1000) return false;
        }
        tx.set(ref(code), { kind: KIND, version: 1, code, host: uid(), status: "waiting", createdAt, settings: clean, players: { [uid()]: playerEntry(0, keys) } });
        return true;
      });
      if (made) {
        addPending(code, createdAt, clean.stake);
        return enter(code, { host: true, keys });
      }
    }
    throw Error("テーブル番号を作れませんでした。もう一度お試しください。");
  }
  async function joinTable(code) {
    connected();
    if (!/^\d{4}$/.test(code)) throw Error("4桁のテーブル番号を入れてください。");
    const keys = await myKeys(code);
    let agreed = null;
    await update(code, (room) => {
      if (room.kind !== KIND) throw Error("この番号は大富豪のテーブルではありません。");
      if (room.status === "closed" || room.status === "finished") throw Error("このテーブルは終わっています。");
      agreed = { createdAt: room.createdAt, stake: room.settings.stake };
      const mine = room.players[uid()];
      if (mine) {
        mine.left = false;
        mine.pub = keys.pub;
        return room;
      }
      if (room.status !== "waiting") throw Error("もう始まっています。");
      const taken = new Set(Object.values(room.players).map((p) => p.seat));
      let seat = 0;
      while (taken.has(seat)) seat++;
      if (seat >= room.settings.seats) throw Error("満席です。");
      room.players[uid()] = playerEntry(seat, keys);
      return room;
    });
    if (agreed) addPending(code, agreed.createdAt, agreed.stake);
    return enter(code, { host: false, keys });
  }
  // A table against the computer: this device only, no points.
  function practice(count) {
    const n = [3, 4, 5].includes(count) ? count : 4,
      code = "0000",
      me = uid();
    const players = { [me]: { name: nameOf(), seat: 0, avatar: avatarOf(), joinedAt: Date.now() } };
    const names = ["CPU ア", "CPU イ", "CPU ウ", "CPU エ"];
    for (let i = 1; i < n; i++) players["cpu" + i] = { name: names[i - 1], seat: i, bot: true, joinedAt: Date.now() };
    close();
    session = {
      code,
      practice: true,
      host: true,
      me,
      keys: null,
      hostState: null,
      room: { kind: KIND, version: 1, code, host: me, status: "playing", createdAt: Date.now(), settings: { stake: 0, games: 1, seats: n, think: 45, miyakoochi: false, practice: true }, players },
    };
    ticker = setInterval(tick, 400);
    setTimeout(() => {
      emit();
      step();
    }, 0);
    return code;
  }
  async function enter(code, { host, keys }) {
    close();
    session = { code, practice: false, host, me: uid(), keys, room: null, hand: null, handBox: null };
    try {
      await new Promise((resolve, reject) => {
      unsubscribe = window.fbOnSnapshot(
        ref(code),
        (snap) => {
          if (!snap.exists()) return reject(Error("テーブルが見つかりません。"));
          session.room = snap.data();
          // The dealer is whoever made the table: also after this device was reloaded.
          session.host = session.room.host === uid();
          onRoom();
          resolve();
        },
        (error) => reject(error),
      );
    });
    } catch (error) {
      unsubscribe?.();
      unsubscribe = null;
      session = null;
      throw error;
    }
    ticker = setInterval(tick, 1000);
    return code;
  }
  async function onRoom() {
    emit();
    if (!session) return;
    await refreshHand();
    emit();
    step();
    settleIfFinished();
  }
  function tick() {
    if (!session) return;
    step();
    if (session.room?.status === "finished") settleIfFinished();
    emit();
  }
  async function start() {
    return update(session.code, (room) => {
      if (room.host !== uid() || room.status !== "waiting") return null;
      if (Object.keys(room.players).filter((id) => !room.players[id].left).length < 3) throw Error("3人以上そろってから始められます。");
      // The table is as large as the people sitting at it.
      room.settings.seats = Object.keys(room.players).length;
      room.status = "playing";
      room.startedAt = Date.now();
      return room;
    });
  }
  async function leave() {
    if (!session) return;
    const { code, practice: local, host } = session;
    if (!local && session.room) {
      const room = session.room;
      try {
        if (host && room.status === "waiting") await update(code, (r) => ((r.status = "closed"), r));
        else if (host && room.status === "playing") await update(code, (r) => ((r.status = "closed"), (r.abandoned = true), r));
        else if (room.status === "playing" || room.status === "waiting") await update(code, (r) => (r.players[uid()] && (r.players[uid()].left = true), r));
      } catch (error) {
        console.warn("[daifugo] leave", error);
      }
    }
    close();
  }
  function close() {
    unsubscribe?.();
    unsubscribe = null;
    clearInterval(ticker);
    ticker = null;
    session = null;
    emit();
  }

  // ---- My side -------------------------------------------------------------------------
  async function refreshHand() {
    const s = session;
    if (!s || !s.room) return;
    if (s.host) {
      const hs = loadHost(s.code);
      s.hand = hs?.state ? { no: hs.no, hand: hs.state.hands[s.me] || [], got: hs.got?.[s.me] || [] } : null;
      return;
    }
    const box = s.room.enc?.[s.me];
    if (!box) {
      s.hand = null;
      return;
    }
    if (s.handBox && s.handBox.iv === box.iv) return;
    try {
      const key = await shared(s.keys.priv, s.room.players[s.room.host].pub);
      s.hand = await unseal(key, box);
      s.handBox = box;
    } catch (error) {
      console.warn("[daifugo] hand", error);
    }
  }
  async function submit(type, cards) {
    if (!session) return;
    const room = session.room;
    if (session.host && session.practice) {
      // On this device: no waiting for a snapshot.
      await update(session.code, (r) => ((r.moves = { ...(r.moves || {}), [session.me]: { seq: Date.now(), type, cards: cards || null } }), r));
      return;
    }
    await update(session.code, (r) => ((r.moves = { ...(r.moves || {}), [session.me]: { seq: Date.now(), type, cards: cards || null } }), r));
    void room;
  }
  // The room as a screen needs it.
  function view() {
    if (!session) return null;
    const room = session.room;
    // The dealer's device reads its own cards from the game it holds.
    if (session.host && room?.status === "playing") {
      const hs = loadHost(session.code);
      session.hand = hs?.state ? { no: hs.no, hand: hs.state.hands[session.me] || [], got: hs.got?.[session.me] || [] } : null;
    }
    return { code: session.code, practice: session.practice, host: session.host, me: session.me, room, hand: session.hand, now: Date.now() };
  }

  // ---- Settlement -----------------------------------------------------------------------
  const paidName = () => "aiglish_df_paid_" + uid();
  const paidMap = () => {
    try {
      return JSON.parse(localStorage.getItem(paidName()) || "{}");
    } catch {
      return {};
    }
  };
  const markPaid = (id, value) => {
    try {
      const map = paidMap();
      map[id] = value;
      const keys = Object.keys(map);
      for (const old of keys.slice(0, Math.max(0, keys.length - 60))) delete map[old];
      localStorage.setItem(paidName(), JSON.stringify(map));
    } catch {}
  };
  let settling = false;
  // Who pays whom, from the order the table ended in and the stake this device agreed to. The ids are
  // made here, so a rewritten document cannot make a second payment.
  function payments(room) {
    const agreed = agreedFor(room),
      stake = room.settings?.practice ? 0 : agreed ? agreed.stake : Number(room.settings?.stake) || 0;
    // The order is the one first seen on this device: a document rewritten afterwards changes nothing.
    let order = agreed?.order || room.final?.order || [];
    if (agreed && !agreed.order && room.status === "finished" && room.final?.order) {
      setPending(pendingList().map((p) => (p.code === room.code && p.createdAt === room.createdAt ? { ...p, order: room.final.order } : p)));
      order = room.final.order;
    }
    const ids = Object.keys(room.players || {});
    if (!stake || order.length < 3 || order.length > 5 || new Set(order).size !== order.length || !order.every((id) => ids.includes(id))) return { pays: [], agreed: !!agreed };
    return { pays: D.payouts(order, stake).map((p) => ({ ...p, id: ["df", room.code, room.createdAt, p.from, p.to].join("-") })), agreed: !!agreed };
  }
  // Pays what this player owes (once for the table), and brings in what is owed to them.
  async function settle(room) {
    const { pays, agreed } = payments(room);
    const mine = pays.filter((p) => p.from === uid()),
      owed = pays.filter((p) => p.to === uid());
    const results = [],
      once = ["df", room.code, room.createdAt, uid()].join("-");
    // Only with the stake agreed to on this device, and only once for a table.
    if (agreed && mine.length && !paidMap()[once]?.ok) {
      const p = mine[0];
      const to = room.players[p.to];
      const outcome = await window.PointLoans.pay(p.to, to?.name || p.to, p.amount, "大富豪の精算", p.id);
      markPaid(once, { ok: true, at: Date.now() });
      markPaid(p.id, { ok: true, paid: outcome.paid, borrowed: outcome.borrowed, at: Date.now() });
      results.push({ ...p, ...outcome });
    }
    if (owed.length && Date.now() - (session?.collectedAt || 0) > 8000) {
      if (session) session.collectedAt = Date.now();
      try {
        await window.PointLoans.collect();
      } catch (error) {
        console.warn("[daifugo] collect", error);
      }
    }
    return results;
  }
  async function settleIfFinished() {
    const room = session?.room;
    if (!room || room.status !== "finished" || settling || session.practice) return;
    settling = true;
    try {
      const results = await settle(room);
      if (results.length) {
        for (const r of results) window.showToast?.((r.borrowed ? "足りない " + r.borrowed.toLocaleString("ja-JP") + "pt はカジノから借りて、" : "") + (room.players[r.to]?.name || "相手") + "さんに " + r.amount.toLocaleString("ja-JP") + "pt 支払いました", r.borrowed ? "info" : "success");
        window.StudyPoints?.refreshUI?.();
      }
      dropPending(session.code);
      emit();
    } catch (error) {
      console.warn("[daifugo] settle", error);
    } finally {
      settling = false;
    }
  }
  // On start: a table I left (or lost the connection to) may have finished since: pay what I owe.
  async function settlePending() {
    if (uid() === "GUEST-000" || !window.db || !window.fbGetDoc || !window.PointLoans) return;
    for (const p of pendingList()) {
      if (session?.code === p.code) continue;
      try {
        const snap = await window.fbGetDoc(ref(p.code));
        if (!snap.exists()) {
          dropPending(p.code);
          continue;
        }
        const room = snap.data();
        // Another table has taken the number since.
        if (room.kind !== KIND || (p.createdAt && room.createdAt !== p.createdAt) || !room.players?.[uid()]) {
          dropPending(p.code);
          continue;
        }
        if (room.status === "closed") dropPending(p.code);
        else if (room.status === "finished") {
          await settle(room);
          dropPending(p.code);
        }
      } catch (error) {
        console.warn("[daifugo] pending", error);
      }
    }
  }
  if (typeof window.onAppLoaded === "function") window.onAppLoaded(() => setTimeout(settlePending, 4000));

  const api = {
    THINK,
    EXCHANGE_MS,
    createTable,
    joinTable,
    practice,
    start,
    leave,
    close,
    submit,
    view,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    settlePending,
    paid: (id) => paidMap()[id] || null,
    payments,
    seatOrder,
    totalsOf,
    _session: () => session,
  };
  window.DaifugoTable = Object.freeze(api);
})();
