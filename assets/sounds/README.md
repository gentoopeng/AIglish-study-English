UI sound effects supplied by the user

The seven supplied MP3s are converted to mono 44.1 kHz / 96 kbps MP3 with seek/duration headers and no source metadata. Total asset size: 99,676 bytes. Artwork/audio is served directly as static files, never stored in Firestore.

| Asset | Original supplied file | Use |
| --- | --- | --- |
| tap.mp3 | 決定ボタンを押す22.mp3 | General buttons, understanding buttons |
| confirm.mp3 | 決定ボタンを押す29.mp3 | Confirm, save, register, start |
| back.mp3 | 決定ボタンを押す2.mp3 | Close/back and flashcard flip |
| navigate.mp3 | 決定ボタンを押す40.mp3 | Tab/background change and upward flashcard skip |
| swipe-right.mp3 | 決定ボタンを押す51.mp3 | Flashcard right swipe (learned) |
| swipe-left.mp3 | 決定ボタンを押す34.mp3 | Flashcard left swipe (not learned) |
| open.mp3 | 説明ウィンドウが開く.mp3 | Menu, background picker, flashcard settings/details and profile details |

The runtime starts only on interaction, defaults to 30% gain and supports mute/volume in the sidebar. One reusable HTML media element and a single lazy AudioContext/GainNode serve all sounds; overlapping effects are interrupted and bursts are throttled. Only a selected sound is fetched. Hidden pages suspend playback. No BGM or looping audio is included.
