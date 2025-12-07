# VL Touch Notify

Browser extension (Firefox MV2 + Chrome MV3) that monitors VolumeLeaders.com APIs and sends desktop notifications for new Trade Level Touches and Block Trades.

## Commands
```bash
# Build
./build.sh              # Build both Firefox + Chrome
./build.sh -f           # Firefox only
./build.sh -c           # Chrome only
make build              # Build both (Makefile shortcut)
make clean              # Remove build artifacts

# Sign
./build.sh --sign-firefox  # Sign Firefox (requires Mozilla API creds)
./build.sh --sign-chrome   # Sign Chrome .crx (requires private key)
make sign-firefox       # Sign Firefox (Makefile shortcut)
make sign-chrome        # Sign Chrome (Makefile shortcut)

# Development
npm run start           # Dev: hot reload Firefox
make dev                # Same as above (Makefile shortcut)
npm run lint            # Lint Firefox
make lint               # Same as above (Makefile shortcut)

# Releases (via release-it)
npm run release         # Interactive release
npm run release:patch   # Bump patch version (1.0.7 → 1.0.8)
npm run release:minor   # Bump minor version (1.0.7 → 1.1.0)
npm run release:major   # Bump major version (1.0.7 → 2.0.0)
```

**Release:** `npm run release:patch` bumps version in all manifests, commits, tags, pushes tag → GitHub Actions builds + signs + publishes release

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
