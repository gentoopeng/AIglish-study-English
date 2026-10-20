// A renderer termination cannot raise a JavaScript error. Keep a small checkpoint
// outside the overflow store so a separate, lightweight page can inspect it.
(function () {
  "use strict";
  const key = "__aiglish_startup_diagnostic";
  let write,
    prior = null,
    nativeError = "";
  const summary = (value) =>
    value
      ? {
          version: value.version,
          startedAt: value.startedAt,
          phase: value.phase,
          ready: value.ready,
          activity: value.activity,
          progressChars: value.progressChars,
          events: value.events,
          runtime: value.runtime,
          pendingTasks: value.pendingTasks,
          duelAnswers: value.duelAnswers,
        }
      : null;
  try {
    write = localStorage.setItem.bind(localStorage);
    prior = JSON.parse(localStorage.getItem(key) || "null");
  } catch (error) {
    nativeError = error.name || "unavailable";
  }
  const state = {
    version:
      document.querySelector("meta[name=application-version]")?.content || "",
    startedAt: new Date().toISOString(),
    phase: "document",
    ready: false,
    previous: summary(prior),
  };
  // Read the previous diagnostic before replacing the one bounded IDB record.
  // Startup itself never waits for this work.
  const previousReady = window.StartupDiagnosticStore?.read()
    .then((value) => {
      if (
        value &&
        Date.parse(value.startedAt) >
          Date.parse(prior?.startedAt || "1970-01-01") &&
        value.startedAt !== state.startedAt
      ) {
        state.previous = summary(value);
        persist();
      }
    })
    .catch(() => {});
  function persist() {
    state.updatedAt = Date.now();
    try {
      if (write) {
        write(key, JSON.stringify(state));
        nativeError = "";
      }
    } catch (error) {
      nativeError = error.name || "unavailable";
    }
    if (nativeError) state.nativeError = nativeError;
    else delete state.nativeError;
    previousReady
      ?.then(() =>
        window.StartupDiagnosticStore.write(JSON.parse(JSON.stringify(state))),
      )
      .catch(() => {});
  }
  function mark(phase) {
    state.phase = phase;
    state.ready = phase === "ready";
    persist();
  }
  function activity(kind) {
    // Fixed labels only: never retain a word, answer, account or input contents.
    if (
      !["card-flip", "card-swipe", "warmup-flip", "warmup-swipe"].includes(kind)
    )
      return;
    state.activity = { kind, at: new Date().toISOString() };
    persist();
  }
  function progress(primary, recovery) {
    // In-memory numbers only. The next ordinary checkpoint persists them.
    state.progressChars = { primary, recovery };
  }
  const events = [];
  const pendingTasks = new Set();
  const allowed =
    /^(?:hook:\d+:[a-z-]+\.js|user-stats|textbook-index|warmup|duel|save):(start|done|error|shown|closed|answer)$/;
  function event(label) {
    if (!allowed.test(label)) return;
    // Battle answers are counted in memory only; the next checkpoint stores the count.
    if (label === "duel:answer") {
      state.duelAnswers = (state.duelAnswers || 0) + 1;
      return;
    }
    if (label === "duel:start") state.duelAnswers = 0;
    events.push({ label, ms: Math.round(performance.now()) });
    if (events.length > 12) events.shift();
    state.events = events;
    const [task, status] = [
      label.slice(0, label.lastIndexOf(":")),
      label.slice(label.lastIndexOf(":") + 1),
    ];
    if (status === "start" && pendingTasks.size < 32) pendingTasks.add(task);
    else pendingTasks.delete(task);
    state.pendingTasks = [...pendingTasks];
    // Synchronous hooks are recorded by the ordinary ready checkpoint. Avoid
    // adding dozens of storage transactions to startup itself.
    // Battles and full saves happen long after startup: keep a size snapshot with them.
    if (/^(?:duel|save):/.test(label)) snapshot();
    else if (label.startsWith("warmup:") || status === "error") persist();
  }
  function snapshot() {
    // Inspect already-loaded DOM/numeric sizes only; never fetch or decode images.
    let images = 0,
      largestImagePixels = 0;
    for (const image of document.images) {
      if (image.naturalWidth) images++;
      largestImagePixels = Math.max(
        largestImagePixels,
        image.naturalWidth * image.naturalHeight,
      );
    }
    state.runtime = {
      elapsedMs: Math.round(performance.now()),
      hidden: document.hidden,
      warmup: !!document.querySelector(".flash-warmup-dialog[open]"),
      images,
      largestImagePixels,
      storage: window.AppStorage?.diagnosticSize?.(),
    };
    persist();
  }
  // Four bounded post-boot checkpoints, not a permanent polling/saving loop.
  let checkpointsStarted = false;
  function afterReady() {
    if (checkpointsStarted) return;
    checkpointsStarted = true;
    for (const delay of [5000, 15000, 30000, 60000])
      setTimeout(snapshot, delay);
  }
  window.addEventListener("learning-data-ready", afterReady);
  window.StartupMonitor = { mark, activity, progress, event };
  mark("document");
})();
