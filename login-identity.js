(function (root) {
  "use strict";
  // NFKC folds full-width letters/digits typed through Japanese IMEs.
  function fold(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, "");
  }
  // Issued IDs are upper case; try the typed form first so legacy IDs still match.
  function idCandidates(value) {
    const raw = fold(value),
      upper = raw.toUpperCase();
    if (!raw || raw.includes("/")) return [];
    return raw === upper ? [raw] : [raw, upper];
  }
  function pin(value) {
    return fold(value);
  }
  function storedPin(user) {
    return user && user.pin !== undefined && user.pin !== null
      ? String(user.pin)
      : "";
  }
  // An account without a stored PIN never matches.
  function matches(user, ids, typedPin) {
    const expected = storedPin(user);
    return (
      !!user && ids.includes(user.id) && expected !== "" && expected === typedPin
    );
  }
  function find(users, ids, typedPin) {
    return (
      (Array.isArray(users) ? users : []).find((user) =>
        matches(user, ids, typedPin),
      ) || null
    );
  }
  function unavailableReason(error) {
    const text = String(error?.code || "") + " " + String(error?.message || "");
    if (/resource-exhausted|quota|429/i.test(text)) return "quota";
    if (/timeout/i.test(text)) return "timeout";
    return "network";
  }
  // PINs are stored as a slow, salted digest ("p1$…"), never as the digits themselves, so the
  // shared account list and user documents no longer show anyone's PIN. The salt is the account ID.
  const DIGEST = "p1$",
    ROUNDS = 120000;
  function isDigest(value) {
    return typeof value === "string" && value.startsWith(DIGEST);
  }
  const cache = new Map();
  async function digest(id, typed) {
    const key = id + "\n" + typed;
    if (cache.has(key)) return cache.get(key);
    const subtle = (root.crypto || globalThis.crypto).subtle,
      encode = (text) => new TextEncoder().encode(text),
      material = await subtle.importKey("raw", encode(String(typed)), "PBKDF2", false, ["deriveBits"]),
      bits = await subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: encode("aiglish-pin:" + id), iterations: ROUNDS },
        material,
        256,
      ),
      bytes = new Uint8Array(bits);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const value = DIGEST + btoa(binary);
    if (cache.size > 50) cache.clear();
    cache.set(key, value);
    return value;
  }
  // The form to store: a digest stays as it is; legacy digits become a digest.
  async function protect(id, stored) {
    const value = stored == null ? "" : String(stored);
    return !value || isDigest(value) ? value : digest(id, value);
  }
  // Like matches(), for digests as well as legacy digits.
  async function verify(user, ids, typedPin) {
    const expected = storedPin(user);
    if (!user || !ids.includes(user.id) || expected === "" || !typedPin) return false;
    return isDigest(expected) ? (await digest(user.id, typedPin)) === expected : expected === typedPin;
  }
  async function findVerified(users, ids, typedPin) {
    for (const user of Array.isArray(users) ? users : [])
      if (user && ids.includes(user.id) && (await verify(user, ids, typedPin))) return user;
    return null;
  }
  // The shared account list carries only what login needs: no real name or age.
  function publicEntry(user) {
    const entry = { ...user };
    delete entry.realName;
    delete entry.age;
    return entry;
  }
  const api = {
    fold,
    idCandidates,
    pin,
    storedPin,
    matches,
    find,
    unavailableReason,
    digest,
    isDigest,
    protect,
    verify,
    findVerified,
    publicEntry,
  };
  root.LoginIdentity = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
