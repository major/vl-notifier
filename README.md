# VL Notifier

> These extensions are **totally unofficial** and not affiliated with VolumeLeaders.com.

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
  - Persistent notifications (Chrome only - Firefox doesn't support this)
- Smart tracking to avoid duplicate notifications
- Automatic cleanup of old data

## Installation

### Firefox

#### From Releases (Recommended)
1. Download `vl_notifier-*.zip` from the [Releases page](../../releases/latest)
2. Go to `about:addons`
3. Click the gear icon → "Install Add-on From File..."
4. Select the downloaded `.zip` file

#### Developer Install
1. Clone this repository
2. Run `npm install` then `npm run start` (or `make dev`)
   - This launches Firefox with the extension auto-loaded and hot-reloading

**Alternative (temporary install):**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `firefox/manifest.json`
4. ⚠️ Extension is removed when Firefox closes

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
| **Persistent Notifications** | Notifications stay visible until dismissed (Chrome only) |

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
./build.sh --sign-firefox
```
Get credentials at: https://addons.mozilla.org/en-US/developers/addon/api/key/

**Chrome:** Requires a private key for .crx packaging
```bash
openssl genrsa -out chrome.pem 2048
./build.sh --sign-chrome
```

## Releasing a New Version

Uses [release-it](https://github.com/release-it/release-it) to automate version bumping, tagging, and pushing:

```bash
npm run release           # Interactive (prompts for version type)
npm run release:patch     # 1.0.7 -> 1.0.8
npm run release:minor     # 1.0.7 -> 1.1.0
npm run release:major     # 1.0.7 -> 2.0.0

# Preview without making changes
npx release-it --dry-run
```

This automatically:
1. Runs lint check
2. Bumps version in `package.json`, `firefox/manifest.json`, and `chrome/manifest.json`
3. Commits with message `chore: release vX.X.X`
4. Creates git tag `vX.X.X`
5. Pushes to GitHub

GitHub Actions then builds the extensions, signs the Firefox XPI, and creates the release with all artifacts.

## License

MIT
