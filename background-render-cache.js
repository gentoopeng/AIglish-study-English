// Full-screen photo backgrounds are decoded at their stored resolution. A 12 MP
// JPEG is about 48 MB once decoded; downscale it once to what the screen can show
// and keep that copy in a device-only cache so later launches never decode the
// original. Never part of saves or backups; the stored photo is not changed.
(function () {
  "use strict";
  const name = "aiglish-background-render-cache",
    limit = 4;
  let database = null;
  function open() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("images");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(Error("blocked"));
      }).catch((error) => {
        database = null;
        throw error;
      });
    return database;
  }
  function run(mode, work) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction("images", mode),
            result = work(tx.objectStore("images"));
          tx.oncomplete = () => resolve(result.result);
          tx.onabort = tx.onerror = () => reject(tx.error);
        }),
    );
  }
  // Cover in either orientation needs the short side to reach the long screen edge.
  function longEdge() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    return Math.ceil(
      Math.max(screen.width || 0, screen.height || 0, innerWidth, innerHeight) *
        ratio,
    );
  }
  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 7) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(36) + "_" + text.length.toString(36);
  }
  function blobOf(data) {
    const binary = atob(data.slice(data.indexOf(",") + 1)),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  }
  async function downscale(original, edge) {
    const bitmap = await createImageBitmap(original);
    try {
      const scale = Math.min(1, edge / Math.min(bitmap.width, bitmap.height));
      if (scale >= 0.95) return null;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      canvas.width = canvas.height = 0;
      return blob;
    } finally {
      bitmap.close?.();
    }
  }
  // Resolves to an object URL owned by the caller (revoke it when replaced).
  async function url(data) {
    const edge = longEdge(),
      key = hash(data) + "@" + edge;
    try {
      const cached = await run("readonly", (store) => store.get(key));
      if (cached instanceof Blob) return URL.createObjectURL(cached);
    } catch {}
    const original = blobOf(data);
    let small = null;
    try {
      small = await downscale(original, edge);
    } catch {
      return URL.createObjectURL(original);
    }
    try {
      await run("readwrite", (store) => {
        const request = store.getAllKeys();
        request.onsuccess = () => {
          const stale = request.result.filter((k) => k !== key);
          stale.slice(0, Math.max(0, stale.length - (limit - 1))).forEach((k) =>
            store.delete(k),
          );
        };
        // Photos that are already small are cached as-is to skip the check next time.
        return store.put(small || original, key);
      });
    } catch {}
    return URL.createObjectURL(small || original);
  }
  window.BackgroundRenderCache = { url, longEdge };
})();
