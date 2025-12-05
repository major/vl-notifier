# 🌐 VL Notifier - Chrome Extension

Chrome Manifest V3 extension that monitors VolumeLeaders.com API and sends desktop notifications for new touches.

## Installation

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this `chrome/` directory

## Architecture

Chrome MV3 uses a different approach than Firefox since `webRequest.filterResponseData()` is unavailable:

```
┌──────────────────────────────────────────────────────────────┐
│                  volumeleaders.com page                       │
│  ┌─────────────────┐                                         │
│  │ injected-script │ ← Monkey-patches fetch/XHR              │
│  │   (page world)  │                                         │
│  └────────┬────────┘                                         │
│           │ window.postMessage                               │
│  ┌────────▼────────┐                                         │
│  │ content-script  │ ← Bridges page ↔ service worker         │
│  │ (isolated world)│                                         │
│  └────────┬────────┘                                         │
└───────────┼──────────────────────────────────────────────────┘
            │ chrome.runtime.sendMessage
┌───────────▼──────────────────────────────────────────────────┐
│          service-worker.js                                    │
│  • Processes API responses                                    │
│  • Manages seen items in chrome.storage.local                 │
│  • Shows notifications via chrome.notifications               │
│  • Plays audio via offscreen document                         │
└──────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest with permissions |
| `service-worker.js` | Main background logic |
| `content-script.js` | Bridge between page and service worker |
| `injected-script.js` | XHR/fetch interceptors (page context) |
| `offscreen.html/js` | Audio playback (SW can't use AudioContext) |
| `popup/` | Settings UI |
| `icons/` | Extension icons (16, 48, 96, 128px) |

## Building

```bash
# From project root
./build.sh --chrome
# Output: web-ext-artifacts/vl-notifier-chrome.zip
```
