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
  window.StartupMonitor = { mark, activity, progress };
  mark("document");
})();
