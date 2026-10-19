# EPUB speed reader

A minimal, mobile-first EPUB reader built around rapid serial visual presentation (RSVP):
words flash one at a time in the center of the screen, at a speed you control with your thumb.

Live at **https://epub.jenkx.com**

## Reading

- **Hold to read.** Press and hold the speed bar at the bottom. Where your finger sits sets the
  speed (200–800 wpm by default); slide to change it, lift to stop.
- **Quick re-press to rewind.** Lift and press again within 0.5 s to back up 15 words and replay
  at half speed until you're back where you lifted.
- **Continuous mode.** The big play/pause button (it fills the bottom quarter of a phone screen)
  reads without holding. While playing, the bar only changes speed.
- **Rewind.** The button left of play backs up 15 words, or optionally to the start of the
  sentence (or the one before, if you're near the start or the sentence is very short), with
  minimum and maximum jumps.
- **Pausing** switches to a traditional page view with the current word highlighted. Tap a word to
  start from it; otherwise reading resumes at the beginning of the sentence.
- **Pictures** stay on screen for 1 second, so you can stop on one if you want.
- On desktop, holding **Space** works like holding the bar.
- **Books.** Keep several books open; each remembers its place. Switching between recent books is
  instant.
- **Dictionary.** Look up the current word (definitions from Wiktionary). Every lookup is saved
  for offline use, with the sentence it came from, and the list exports as an Anki deck.

Timing adds pauses at commas, sentence ends and paragraph breaks, and shows long words (11+ letters
by default) 1.5× as long. Hyphenated and dash-joined words are flashed one part at a time.

## Settings

- **Speed range** for the bar.
- **Display:** font size, focus-letter highlighting (or plain centered words), and whether to show
  the rest of a hyphenated word dimmed beside each part.
- **Timing:** every timing rule is adjustable: the multipliers for sentence ends, commas/colons/dashes
  and paragraph ends, the long-word threshold and multiplier, and how long pictures stay up.
- **Experimental: time by word length.** Replaces the long-word rule with a curve you shape by
  dragging the control points of a cubic Bézier that starts at (1 letter, 1×) (multiplier 1–3×
  over 1–20 letters). The curve is sampled into a `[length, multiplier]` table whenever it
  changes, so reading only does a lookup.
- **Rewind:** by words or to the sentence start (with minimum and maximum jumps), the re-press
  window, and the replay speed.

Light and dark mode follow the system until you toggle them.

## Install and updates

Read is a PWA: install it from the browser (Chrome/Android offer an Install button; on iOS use
Share → Add to Home Screen) and it works offline. New versions install in the background and
the app reloads onto them right away, waiting if you're in the middle of reading.

## Storage

Everything stays in the browser. Books and saved dictionary words are kept in IndexedDB (EPUBs
are often larger than localStorage allows); settings and your place in each book are kept in
localStorage. Updates only replace the service worker's own cache, never this data. Nothing is
uploaded anywhere; the only network requests are dictionary lookups to Wiktionary.

## Development

Requires Node 22.17 or newer.

```sh
npm install
npm run dev      # dev server
npm run check    # type-check
npm run build    # static site in build/
```

The app is a SvelteKit (Svelte 5) single-page app built with `adapter-static`, so `build/` can be
served by any static web server. Route unknown paths to `index.html`, and don't let browsers
cache the service worker or manifest, e.g. for nginx:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}

location = /service-worker.js {
    add_header Cache-Control "no-cache";
}

location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
}
```

EPUB parsing is done in the browser with [JSZip](https://stuk.github.io/jszip/): the spine is
walked into a flat list of words and images, which both the RSVP view and the page view index into.

The repo includes Svelte's official AI tooling (`.mcp.json`, `.claude/`, `AGENTS.md`) from
`npx sv add ai-tools`, for working on it with coding agents.

## License

[GPL-3.0-or-later](LICENSE)
