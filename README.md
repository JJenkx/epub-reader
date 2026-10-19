# EPUB speed reader

A minimal, mobile-first EPUB reader built around rapid serial visual presentation (RSVP):
words flash one at a time in the center of the screen, at a speed you control with your thumb.

Live at **https://epub.jenkx.com**

## Reading

- **Hold to read.** Press and hold the speed bar at the bottom. Where your finger sits sets the
  speed (200–800 wpm by default); slide to change it, lift to stop.
- **Quick re-press to rewind.** Lift and press again within 0.5 s to back up 15 words and replay
  at half speed until you're back where you lifted.
- **Continuous mode.** The play button reads without holding. While playing, the bar only changes
  speed, and a tap on the left side of the screen backs up 15 words.
- **Pausing** switches to a traditional page view with the current word highlighted. Tap a word to
  start from it; otherwise reading resumes at the beginning of the sentence.
- **Pictures** stay on screen for 1 second, so you can stop on one if you want.
- On desktop, holding **Space** works like holding the bar.

Timing adds short pauses at commas, sentence ends and paragraph breaks, and shows long words
(11+ letters by default) 1.5× as long. Hyphenated and dash-joined words are flashed one part at a
time.

## Settings

Speed range, rewind window, rewind distance, replay speed, long-word threshold and multiplier,
font size, focus-letter highlighting (or plain centered words), and whether to show the rest of a
hyphenated word dimmed beside each part. Light and dark mode follow the system until you toggle them.

## Storage

Everything stays in the browser. The book is kept in IndexedDB (EPUBs are often larger than
localStorage allows); settings and your place in each book are kept in localStorage. Nothing is
uploaded anywhere.

## Development

Requires Node 22.17 or newer.

```sh
npm install
npm run dev      # dev server
npm run check    # type-check
npm run build    # static site in build/
```

The app is a SvelteKit (Svelte 5) single-page app built with `adapter-static`, so `build/` can be
served by any static web server. Route unknown paths to `index.html`, e.g. for nginx:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

EPUB parsing is done in the browser with [JSZip](https://stuk.github.io/jszip/): the spine is
walked into a flat list of words and images, which both the RSVP view and the page view index into.

The repo includes Svelte's official AI tooling (`.mcp.json`, `.claude/`, `AGENTS.md`) from
`npx sv add ai-tools`, for working on it with coding agents.
