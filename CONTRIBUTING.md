# Contributing to VL Notifier

## Development Setup

### Prerequisites
- Node.js 20+
- npm

### Install Dependencies
```bash
npm install
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Development

### Firefox
```bash
npm run start           # Launch Firefox with hot reload
npm run lint            # Run linter
```

For temporary manual testing:
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `firefox/manifest.json`
4. ⚠️ Extension is removed when Firefox closes

### Chrome
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `chrome/` directory

## Building

```bash
./build.sh              # Build both Firefox + Chrome
./build.sh -f           # Firefox only
./build.sh -c           # Chrome only

# Or use Makefile shortcuts
make build              # Build both
make build-firefox      # Firefox only
make build-chrome       # Chrome only
make clean              # Remove build artifacts
```

Output goes to `web-ext-artifacts/`:
- Firefox: `vl_notifier-<version>.zip`
- Chrome: `vl-notifier-chrome.zip`

## Signing

### Firefox

Requires [Mozilla API credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/):

```bash
export WEB_EXT_API_KEY='your-jwt-issuer'
export WEB_EXT_API_SECRET='your-jwt-secret'
./build.sh --sign-firefox
```

Produces signed `.xpi` file in `web-ext-artifacts/`

### Chrome

Requires a private key for `.crx` packaging:

```bash
openssl genrsa -out chrome.pem 2048
./build.sh --sign-chrome
```

## Releasing a New Version

Uses [release-it](https://github.com/release-it/release-it) to automate version bumping, tagging, and pushing:

```bash
npm run release         # Interactive (prompts for version type)
npm run release:patch   # 1.0.7 -> 1.0.8
npm run release:minor   # 1.0.7 -> 1.1.0
npm run release:major   # 1.0.7 -> 2.0.0

# Preview changes first
npx release-it --dry-run
```

This automatically:
1. Runs lint check
2. Bumps version in `package.json`, `firefox/manifest.json`, and `chrome/manifest.json`
3. Commits with message `chore: release vX.X.X`
4. Creates git tag `vX.X.X`
5. Pushes commit and tag to GitHub

**Important:** The GitHub Actions workflow only creates releases when you push a **tag**. Running `npm run release:*` pushes both the commit and tag, triggering the workflow to build, sign, and publish the release with all artifacts.

## GitHub Actions Workflow

The `.github/workflows/build-release.yml` workflow:
- Triggers on tag pushes (`v*`)
- Builds Firefox and Chrome extensions
- Signs Firefox `.xpi` (using repository secrets)
- Creates GitHub release with all artifacts

### Required Secrets

Set these in your repository settings:
- `FIREFOX_API_KEY` - Mozilla JWT issuer
- `FIREFOX_API_SECRET` - Mozilla JWT secret

## File Structure

```
firefox/               # Firefox MV2 extension
  background.js        # XHR interceptor via webRequest
  manifest.json        # MV2 manifest
  popup/               # Settings UI
  shared/              # Shared code with Chrome

chrome/                # Chrome MV3 extension
  service-worker.js    # Background service worker
  content-script.js    # Bridge between page and worker
  injected-script.js   # Monkey-patches fetch/XHR
  offscreen.html/js    # Audio playback (service workers can't play audio)
  manifest.json        # MV3 manifest
  popup/               # Settings UI
  shared/              # Shared code with Firefox
```

## License

MIT
