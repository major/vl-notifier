# VL Notifier - Chrome Extension

Desktop notifications when new Trade Level Touches or Block Trades appear on VolumeLeaders.com.

---

## Easy Installation (5 steps)

### Step 1: Download the Extension

Download and **unzip** the `vl-notifier-chrome.zip` file to a folder you'll remember (like your Desktop or Documents).

> **Important:** Don't delete this folder after installing! Chrome needs it to stay there.

### Step 2: Open Chrome Extensions Page

Copy and paste this into your Chrome address bar:

```
chrome://extensions
```

Then press **Enter**.

### Step 3: Enable Developer Mode

Look for the **"Developer mode"** toggle in the **top-right corner** of the page.

Click it to turn it **ON** (it should turn blue).

```
[ OFF ]  -->  [ ON ]
```

### Step 4: Load the Extension

Click the **"Load unpacked"** button that appears (top-left area).

A file picker will open. Navigate to the **chrome** folder you unzipped and click **"Select Folder"**.

### Step 5: You're Done!

You should see "VL Notifier" appear in your extensions list with a bell icon.

**Pin it for easy access:**
1. Click the puzzle piece icon in Chrome's toolbar (top-right)
2. Find "VL Notifier" and click the pin icon next to it

---

## Using the Extension

1. **Go to VolumeLeaders.com** and open the Trade Level Touches or Trades page
2. **The icon turns colored** when you're on a supported page
3. **New items trigger desktop notifications** automatically!
4. **Click the extension icon** to toggle sound on/off

---

## FAQ

### "This extension is not from the Chrome Web Store"

This is normal! Since this is a personal extension loaded from your computer, Chrome shows this warning. It's safe to use.

### The extension disappeared after restarting Chrome

Make sure you didn't delete the unzipped folder. Chrome needs the original files to stay in place.

### I don't see notifications

1. Make sure Chrome has permission to show notifications (check your system settings)
2. Make sure you're on a VolumeLeaders page (Touches or Trades)
3. Notifications only appear for **new** items, not ones already on the page

### The icon is grayed out

The icon only turns colored when you're on a supported VolumeLeaders page (Trade Level Touches or Trades).

---

## Technical Details

<details>
<summary>Click to expand architecture info</summary>

Chrome MV3 uses a different approach than Firefox since `webRequest.filterResponseData()` is unavailable:

```
Page XHR/fetch
      |
      v
injected-script.js (monkey-patches fetch/XHR)
      |
      v (postMessage)
content-script.js (bridge)
      |
      v (chrome.runtime.sendMessage)
service-worker.js (processes data, shows notifications)
```

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest with permissions |
| `service-worker.js` | Main background logic |
| `content-script.js` | Bridge between page and service worker |
| `injected-script.js` | XHR/fetch interceptors (page context) |
| `offscreen.html/js` | Audio playback (SW can't use AudioContext) |
| `popup/` | Settings UI |

</details>
