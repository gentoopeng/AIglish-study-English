// Record local pending work continuously; cloud backups run only at explicit boundaries.
(function () {
  "use strict";
  window.endOnlyCloudSaves = true;
  const id = () => (typeof myId === "string" ? myId : "");
  let owner = id(),
    revision = 0,
    saved = 0,
    running = null;
  function changed(event) {
    const target = event?.target;
    if (
      target?.type === "password" ||
      target?.type === "search" ||
      /search|filter/i.test(target?.id || "") ||
      target?.closest?.("#backgroundAdminDialog,.admin-players-dialog")
    )
      return;
    if (owner !== id()) {
      owner = id();
      revision = 0;
      saved = 0;
    }
    revision++;
    if (owner && owner !== "GUEST-000")
      window.localStorage?.setItem("core_v4_autosave_pending_" + owner, "1");
  }
  window.queueBackgroundSave = changed;
  window.resumeBackgroundSave = function () {};
  window.noteFlashSwipe = changed;
  window.saveAfterStudy = function (reason = "end") {
    if (running) return running;
    changed();
    const account = id();
    // Defer one microtask so the synchronous close/finish handler can leave play mode.
    const task = Promise.resolve().then(async () => {
      if (id() !== account) return { cloudSaved: false };
      if (
        reason !== "sleep" &&
        (document.body?.classList.contains("in-game-active") ||
          window.WordDuel?.isPlaying?.())
      )
        return { cloudSaved: false, deferred: true };
      await window.AppStorage?.flush();
      if (!account || account === "GUEST-000")
        return { localSaved: true, cloudSaved: false };
      if (
        window.FirestoreReadGuard?.paused() ||
        (window.LearningData &&
          !window.LearningData.canSave(
            typeof currentTextbook === "string" ? currentTextbook : "default",
          ))
      )
        return { localSaved: true, cloudSaved: false };
      if (id() !== account) return { cloudSaved: false };
      const version = revision;
      try {
        await window.WordDuelProgress?.flush(account);
        if (id() !== account) return { cloudSaved: false };
        const result = await window.__backgroundSaveAll();
        if (id() === account && result.cloudSaved) {
          await window.flushWorkbookPublications?.();
          saved = version;
          if (revision === version)
            window.localStorage?.removeItem(
              "core_v4_autosave_pending_" + account,
            );
        }
        return result;
      } catch (error) {
        console.warn(
          "端末の記録を保持しています。次の学習終了時または手動セーブで再試行してください。",
          error,
        );
        return { localSaved: true, cloudSaved: false };
      }
    });
    running = task.finally(() => {
      running = null;
    });
    return running;
  };
  window.flushFlashAutosave = () => window.saveAfterStudy("flash-end");
  document.addEventListener("input", changed, { passive: true });
  document.addEventListener("change", changed, { passive: true });
  const mark = window.markVocabProgressDirty;
  if (typeof mark === "function")
    window.markVocabProgressDirty = function () {
      changed();
      return mark.apply(this, arguments);
    };
  const closeReader = window.closeReader;
  if (typeof closeReader === "function")
    window.closeReader = function () {
      const was =
        typeof currentActiveTabId === "string" &&
        currentActiveTabId === "reader" &&
        document.getElementById("text-reader-view")?.style.display !== "none";
      const result = closeReader.apply(this, arguments);
      if (was) window.saveAfterStudy("reader-end");
      return result;
    };
  let previous =
    typeof currentActiveTabId === "string" ? currentActiveTabId : "";
  window.onTabChange?.((tab) => {
    const old = previous;
    previous = tab;
    if (
      old !== tab &&
      ["vocab", "reader", "study", "community"].includes(old) &&
      (revision !== saved ||
        old === "study" ||
        window.localStorage?.getItem("core_v4_autosave_pending_" + id()))
    )
      window.saveAfterStudy("leave-study");
  });
})();
