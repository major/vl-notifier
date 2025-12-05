# VL Touch Notify

Browser extension (Firefox MV2 + Chrome MV3) that monitors VolumeLeaders.com APIs and sends desktop notifications for new Trade Level Touches and Block Trades.

## Commands
```bash
./build.sh              # Build both Firefox + Chrome
./build.sh -f           # Firefox only
./build.sh -c           # Chrome only
./build.sh --sign-firefox  # Sign Firefox (requires Mozilla API creds)
./build.sh --sign-chrome # Sign Chrome .crx (requires private key)
npm run start           # Dev: hot reload Firefox
npm run lint            # Lint Firefox
```

**Release:** Bump version in `firefox/manifest.json` + `chrome/manifest.json`, tag + push → GitHub Actions builds release

## Architecture

### Firefox (`firefox/`)
- `background.js` - Intercepts XHR via `webRequest.filterResponseData`, tracks seen items in `browser.storage.local`, fires notifications
- `popup/` - Settings UI (sound toggle)
- `manifest.json` - MV2 with `webRequest`, `webRequestBlocking`, `storage`, `notifications`

### Chrome (`chrome/`)
- `service-worker.js` - Background logic (MV3 service worker)
- `injected-script.js` - Monkey-patches fetch/XHR in page context (no `filterResponseData` in Chrome)
- `content-script.js` - Bridge between page and service worker
- `offscreen.html/js` - Audio playback (service workers can't use AudioContext)
- `popup/` - Settings UI
- `manifest.json` - MV3 with `storage`, `notifications`, `offscreen`

### Data Flow (Chrome)
```
Page XHR → injected-script → postMessage → content-script → chrome.runtime.sendMessage → service-worker
```
