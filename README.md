# Pitch Pipe

A simple installable chromatic pitch pipe PWA. Press and hold a note to hear a
sustained reference tone (C4-B4, A4 = 440Hz).

## Run locally

Service workers require `https://` or `localhost`, so open the app through a
local server rather than a `file://` URL:

```sh
npx http-server -c-1 .
```

Then visit the printed `http://localhost:...` URL. On Android, connect your
phone to the same Wi-Fi network and visit your machine's local IP instead to
test install/offline behavior on-device.

## Icons

`icons/icon-192.png`, `icons/icon-512.png`, and `icons/icon-512-maskable.png`
were generated with ImageMagick from a simple vector note glyph (see git
history for the generation script). Regenerate or replace them with any image
tool if you want a different look — just keep the same filenames/sizes
referenced in `manifest.webmanifest`.

## Deploying

The app is fully static (no build step). Any static host works (GitHub
Pages, Netlify, etc.). If deployed under a subpath, double check that
`manifest.webmanifest`'s `start_url`/`scope` and `sw.js`'s registration path
still resolve correctly.

Every deploy that changes a cached file needs a cache-name bump in `sw.js`
(`CACHE_NAME`), or installed clients will keep serving stale assets.
