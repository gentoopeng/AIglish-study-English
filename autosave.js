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
      target?.closest?.(
        "#backgroundAdminDialog,.admin-players-dialog,.group-chat-compose",
      )
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
  // A full backup re-serializes and uploads every saved record (tens of seconds on a
  // large account). After a battle or warm-up, wait for a quiet period without a battle
  // screen so it never overlaps the next match. Answers are already stored on the device.
  const quietKinds = ["battle-end", "warmup-end"],
    quietDelay = 20000,
    quietCheck = 2000;
  let quietTimer = 0,
    lastBusyAt = 0;
  const busy = () =>
    document.body?.classList.contains("duel-screen-open") ||
    document.body?.classList.contains("in-game-active") ||
    window.WordDuel?.isPlaying?.() ||
    window.WeakReview?.isPlaying?.();
  // Sample often while waiting so a lobby opened and closed in between restarts the
  // quiet period; the backup starts only after a full 20 s without a battle screen.
  function afterQuiet(reason, account, since = Date.now()) {
    if (quietTimer) clearTimeout(quietTimer);
    lastBusyAt = Math.max(lastBusyAt, since);
    quietTimer = setTimeout(function check() {
      quietTimer = 0;
      if (id() !== account) return;
      if (busy()) lastBusyAt = Date.now();
      if (Date.now() - lastBusyAt >= quietDelay)
        window.saveAfterStudy(reason, { quiet: true });
      else quietTimer = setTimeout(check, quietCheck);
    }, quietCheck);
  }
  window.saveAfterStudy = function (reason = "end", options = {}) {
    if (quietKinds.includes(reason) && !options.quiet) {
      changed();
      window.WordDuelProgress?.flush(id()).catch(() => {});
      afterQuiet(reason, id());
      return Promise.resolve({ localSaved: true, cloudSaved: false, deferred: true });
    }
    if (running) return running;
    // This backup covers any quiet-period save still waiting.
    if (quietTimer) {
      clearTimeout(quietTimer);
      quietTimer = 0;
    }
    changed();
    const account = id();
    // Defer one microtask so the synchronous close/finish handler can leave play mode.
    const task = Promise.resolve().then(async () => {
      if (id() !== account) return { cloudSaved: false };
      if (
        reason !== "sleep" &&
        (document.body?.classList.contains("in-game-active") ||
          window.WordDuel?.isPlaying?.() ||
          window.WeakReview?.isPlaying?.())
      )
        return { cloudSaved: false, deferred: true };
      await window.AppStorage?.flush();
      if (!account || account === "GUEST-000")
        return { localSaved: true, cloudSaved: false };
      if (
        window.FirestoreReadGuard?.paused?.() ||
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
        const pointsSaved = await window.StudyPoints?.flush(account);
        const publicationsSaved =
          await window.VocabWordEntry?.flushPublications(account);
        if (id() !== account) return { cloudSaved: false };
        const result = await window.__backgroundSaveAll();
        if (id() === account && result.cloudSaved) {
          await window.flushWorkbookPublications?.();
          saved = version;
          if (
            revision === version &&
            pointsSaved !== false &&
            publicationsSaved !== false
          )
            window.localStorage?.removeItem(
              "core_v4_autosave_pending_" + account,
            );
        }
        return pointsSaved === false || publicationsSaved === false
          ? { ...result, cloudSaved: false }
          : result;
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
