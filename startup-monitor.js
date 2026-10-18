// A renderer termination cannot raise a JavaScript error. Keep a small checkpoint
// outside the overflow store so a separate, lightweight page can inspect it.
(function () {
  "use strict";
  const key = "__aiglish_startup_diagnostic";
  let read, write, state;
  try {
    read = localStorage.getItem.bind(localStorage);
    write = localStorage.setItem.bind(localStorage);
    const prior = JSON.parse(read(key) || "null");
    state = {
      version:
        document.querySelector("meta[name=application-version]")?.content || "",
      startedAt: new Date().toISOString(),
      phase: "document",
      ready: false,
      previous: prior
        ? {
            version: prior.version,
            startedAt: prior.startedAt,
            phase: prior.phase,
            ready: prior.ready,
          }
        : null,
    };
  } catch {
    return;
  }
  function mark(phase) {
    state.phase = phase;
    state.ready = phase === "ready";
    try {
      write(key, JSON.stringify(state));
    } catch {
      /* Never block startup. */
    }
  }
  window.StartupMonitor = { mark };
  mark("document");
})();
