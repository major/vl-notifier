#!/usr/bin/env bash
set -euo pipefail

show_help() {
    cat << EOF
Usage: ./build.sh [OPTION]

Build the VL Notifier browser extension.

Options:
  -h, --help         Show this help message
  -f, --firefox      Build Firefox extension only
  -c, --chrome       Build Chrome extension only
  -s, --sign         Build and sign Firefox extension (requires Mozilla API credentials)
  --sign-chrome      Build signed Chrome .crx file (requires private key)
  (no option)        Build both Firefox and Chrome extensions

Environment variables:
  Firefox signing:
    WEB_EXT_API_KEY       Mozilla API key (JWT issuer)
    WEB_EXT_API_SECRET    Mozilla API secret

  Chrome signing:
    CHROME_PRIVATE_KEY    Path to private key .pem file (default: chrome.pem)

Get Firefox API credentials at: https://addons.mozilla.org/en-US/developers/addon/api/key/
Generate Chrome key with: openssl genrsa -out chrome.pem 2048
EOF
}

build_firefox() {
    echo "🦊 Building Firefox extension..."
    npx web-ext build --source-dir firefox --overwrite-dest
    echo "✅ Firefox: web-ext-artifacts/vl_notifier-*.zip"
}

build_chrome() {
    echo "🌐 Building Chrome extension..."
    mkdir -p web-ext-artifacts
    cd chrome
    zip -r ../web-ext-artifacts/vl-notifier-chrome.zip . -x "*.DS_Store"
    cd ..
    echo "✅ Chrome: web-ext-artifacts/vl-notifier-chrome.zip"
}

build_signed() {
    if [[ -z "${WEB_EXT_API_KEY:-}" ]] || [[ -z "${WEB_EXT_API_SECRET:-}" ]]; then
        echo "❌ Error: Signing requires WEB_EXT_API_KEY and WEB_EXT_API_SECRET"
        echo ""
        echo "Set them via environment variables or create a .env file:"
        echo "  export WEB_EXT_API_KEY='your-jwt-issuer'"
        echo "  export WEB_EXT_API_SECRET='your-jwt-secret'"
        echo ""
        echo "Get credentials at: https://addons.mozilla.org/en-US/developers/addon/api/key/"
        exit 1
    fi

    echo "🔏 Building and signing Firefox extension..."
    npx web-ext sign \
        --source-dir firefox \
        --api-key="$WEB_EXT_API_KEY" \
        --api-secret="$WEB_EXT_API_SECRET" \
        --channel=unlisted

    echo "✅ Signed Firefox extension in web-ext-artifacts/"
}

build_chrome_signed() {
    local key_file="${CHROME_PRIVATE_KEY:-chrome.pem}"

    if [[ ! -f "$key_file" ]]; then
        echo "❌ Error: Private key not found: $key_file"
        echo ""
        echo "Generate a private key with:"
        echo "  openssl genrsa -out chrome.pem 2048"
        echo ""
        echo "Or set CHROME_PRIVATE_KEY to your existing key path."
        exit 1
    fi

    echo "🔏 Building signed Chrome extension..."
    mkdir -p web-ext-artifacts

    # Build the unsigned zip first
    local zip_file="web-ext-artifacts/vl-notifier-chrome.zip"
    cd chrome
    zip -r "../$zip_file" . -x "*.DS_Store" -q
    cd ..

    # Get version from manifest
    local version
    version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' chrome/manifest.json | cut -d'"' -f4)
    local crx_file="web-ext-artifacts/vl-notifier-chrome-${version}.crx"

    # Create CRX3 format using openssl
    # CRX3 header: "Cr24" + version(4) + header_len(4) + header + signature + zip
    local pub_key_der
    pub_key_der=$(openssl rsa -in "$key_file" -pubout -outform DER 2>/dev/null | base64 -w0)

    # Extract public key for ID calculation
    local pub_key_bytes
    pub_key_bytes=$(openssl rsa -in "$key_file" -pubout -outform DER 2>/dev/null)

    # Sign the zip file
    local signature
    signature=$(openssl dgst -sha256 -sign "$key_file" "$zip_file" | base64 -w0)

    # For simplicity, use Chrome itself if available, otherwise create basic CRX
    if command -v google-chrome &> /dev/null; then
        google-chrome --pack-extension="$(pwd)/chrome" --pack-extension-key="$key_file" --no-message-box 2>/dev/null || true
        if [[ -f "chrome.crx" ]]; then
            mv chrome.crx "$crx_file"
            echo "✅ Signed Chrome extension: $crx_file"
            return
        fi
    fi

    if command -v chromium-browser &> /dev/null; then
        chromium-browser --pack-extension="$(pwd)/chrome" --pack-extension-key="$key_file" --no-message-box 2>/dev/null || true
        if [[ -f "chrome.crx" ]]; then
            mv chrome.crx "$crx_file"
            echo "✅ Signed Chrome extension: $crx_file"
            return
        fi
    fi

    # Fallback: just output the zip with instructions
    echo "⚠️  Chrome/Chromium not found for CRX packing."
    echo "✅ Unsigned zip ready: $zip_file"
    echo ""
    echo "To create .crx manually, run Chrome with:"
    echo "  chrome --pack-extension=$(pwd)/chrome --pack-extension-key=$key_file"
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -f|--firefox)
        build_firefox
        ;;
    -c|--chrome)
        build_chrome
        ;;
    -s|--sign)
        build_signed
        ;;
    --sign-chrome)
        build_chrome_signed
        ;;
    "")
        build_firefox
        build_chrome
        echo ""
        echo "📦 All builds complete!"
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_help
        exit 1
        ;;
esac
