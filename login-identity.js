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
  const api = { fold, idCandidates, pin, storedPin, matches, find, unavailableReason };
  root.LoginIdentity = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
