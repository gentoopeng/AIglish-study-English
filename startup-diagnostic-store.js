// A separate, bounded diagnostic record; never opens the learning-data stores.
(function () {
  "use strict";
  let database;
  function open() {
    if (!database)
      database = new Promise((resolve, reject) => {
        let request,
          settled = false;
        const fail = (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        };
        const timer = setTimeout(
          () => fail(Error("diagnostic-store-timeout")),
          4000,
        );
        try {
          request = indexedDB.open("aiglish-startup-diagnostics", 1);
        } catch (error) {
          fail(error);
          return;
        }
        request.onupgradeneeded = () => {
          if (settled) {
            request.transaction.abort();
            return;
          }
          request.result.createObjectStore("record");
        };
        request.onerror = () => fail(request.error);
        request.onblocked = () => fail(Error("diagnostic-store-blocked"));
        request.onsuccess = () => {
          if (settled) {
            request.result.close();
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(request.result);
        };
      });
    return database;
  }
  const stamp = (value) =>
    Number(value?.updatedAt) || Date.parse(value?.startedAt || "") || 0;
  async function read() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("record", "readonly"),
        request = tx.objectStore("record").get("latest");
      const timer = setTimeout(() => {
        try {
          tx.abort();
        } catch {}
        reject(Error("diagnostic-read-timeout"));
      }, 4000);
      tx.oncomplete = () => {
        clearTimeout(timer);
        resolve(request.result || null);
      };
      tx.onabort = () => {
        clearTimeout(timer);
        reject(tx.error);
      };
      tx.onerror = () => {};
    });
  }
  async function write(value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("record", "readwrite"),
        store = tx.objectStore("record");
      const request = store.get("latest");
      request.onsuccess = () => {
        if (stamp(value) >= stamp(request.result)) store.put(value, "latest");
      };
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => {};
    });
  }
  window.StartupDiagnosticStore = { read, write, stamp };
})();
