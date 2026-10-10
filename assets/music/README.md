User-supplied music, served as static assets (no Firestore reads/writes)

All seven MP3 entries from the four supplied ZIPs are retained as selectable tracks. Source metadata is removed; files are stereo 44.1 kHz / 128 kbps MP3 with seek/duration headers. ZIPs are not deployed.

| Asset | Supplied entry |
| --- | --- |
| hitohira.mp3 | sokoniai wo hitohira.mp3 |
| in-that-mood.mp3 | In That Mood.mp3 |
| in-that-mood-narr.mp3 | In That Mood-Narr.mp3 |
| let-it-happen.mp3 | Let It Happen.mp3 |
| let-it-happen-narr.mp3 | Let It Happen-Narr.mp3 |
| haru-slow.mp3 | Haru_Ha_Utatane-1(Slow).mp3 |
| haru-fast.mp3 | Haru_Ha_Utatane-2(Fast).mp3 |

BGM defaults to off / 20% volume. Track, enable and volume preferences persist in `aiglish_music_settings` through the existing durable storage shim and integrated save. Saved-enabled playback starts on the next user click, not startup. Only the selected track is fetched, via one reusable looping media element (not a decoded song buffer). It shares the effect AudioContext and has its own GainNode for iOS volume. Effects and music mute independently. Hidden/pagehide pauses both channels, removes their sources and suspends the context; the next user click restarts selected enabled music. There are no timers, eager downloads, background playback or parallel song players. Playback rejection cannot interrupt learning or saving.
