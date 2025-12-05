# VL Notifier

Browser extensions that monitor [VolumeLeaders.com](https://www.volumeleaders.com) and send desktop notifications when new Trade Level Touches or Block Trades appear.

| Browser | Status | Manifest | Directory |
|---------|--------|----------|-----------|
| 🦊 Firefox | ✅ Available | V2 | `firefox/` |
| 🌐 Chrome | ✅ Available | V3 | `chrome/` |

## Features

- Real-time monitoring of Trade Level Touches and Block Trades pages
- Desktop notifications for new items with key details:
  - Ticker symbol and price
  - Rank and sector
  - Trade type indicators (🔶 DP Sweep, 🟠 DP Trade, 🔷 Lit Sweep, 🔵 Lit Trade)
- **Configurable settings:**
  - Optional sound alerts
  - Persistent notifications (stay until dismissed)
- Smart tracking to avoid duplicate notifications
- Automatic cleanup of old data

## Installation

### Firefox

#### From Releases (Recommended)
1. Download `vl_notifier-*.zip` from the [Releases page](../../releases/latest)
2. Go to `about:addons`
3. Click the gear icon → "Install Add-on From File..."
4. Select the downloaded `.zip` file

#### Developer Install (Temporary)
1. Clone this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select `firefox/manifest.json`

### Chrome

#### From Releases
1. Download `vl-notifier-chrome.zip` from the [Releases page](../../releases/latest)
2. Extract the zip to a folder
3. Go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" → select the extracted folder

#### Developer Install
1. Clone this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" → select the `chrome/` directory

## Usage

1. Install the extension
2. Navigate to [Trade Level Touches](https://www.volumeleaders.com/TradeLevelTouches) or [Trades](https://www.volumeleaders.com/Trades) on VolumeLeaders
3. The extension automatically monitors for new items and sends notifications

## Configuration

Click the extension icon in the toolbar to access settings:

| Setting | Description |
|---------|-------------|
| **Play Sound** | Enable audio alerts for new items |
| **Persistent Notifications** | Notifications stay visible until dismissed |

Use the "Test Notification" button to preview your settings.

## Requirements

- **Firefox:** 91.0 or later
- **Chrome:** 102 or later (MV3 support)
- A VolumeLeaders account with access to Trade Level Touches

## Building

```bash
# Using Makefile (recommended)
make build              # Build both browsers
make build-firefox      # Firefox only
make build-chrome       # Chrome only

# Or use build.sh directly
./build.sh              # Build both
./build.sh -f           # Firefox only
./build.sh -c           # Chrome only

# Signed builds
make sign-firefox       # Sign Firefox (requires Mozilla API creds)
make sign-chrome        # Sign Chrome .crx (requires private key)

# Development
make dev                # Start Firefox with hot reload
make lint               # Lint Firefox extension
make clean              # Remove build artifacts
```

Output goes to `web-ext-artifacts/`:
- `vl_notifier-<version>.zip` (Firefox)
- `vl-notifier-chrome.zip` (Chrome)

### Signing

**Firefox:** Requires Mozilla API credentials
```bash
export WEB_EXT_API_KEY='your-jwt-issuer'
export WEB_EXT_API_SECRET='your-jwt-secret'
./build.sh -s
```
Get credentials at: https://addons.mozilla.org/en-US/developers/addon/api/key/

**Chrome:** Requires a private key for .crx packaging
```bash
openssl genrsa -out chrome.pem 2048
./build.sh --sign-chrome
```

## Releasing a New Version

```bash
# Bump version, commit, and create tag
make release VERSION=1.3

# Push the tag to trigger GitHub Actions release
git push origin v1.3
```

This automatically updates `firefox/manifest.json`, `chrome/manifest.json`, and `package.json`, then creates a git tag. GitHub Actions builds and publishes the release.

## License

MIT
