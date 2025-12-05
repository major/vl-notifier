/**
 * VL Notifier - Popup Script
 * Settings UI for configuring notification preferences
 * (DEFAULT_SETTINGS loaded from ../shared/constants.js)
 */

const playSoundEl = document.getElementById("playSound");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");

/**
 * Load settings from storage and update UI
 */
async function loadSettings() {
  const stored = await browser.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  playSoundEl.checked = settings.playSound;
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const settings = {
    playSound: playSoundEl.checked,
    soundFrequency: DEFAULT_SETTINGS.soundFrequency,
    soundDuration: DEFAULT_SETTINGS.soundDuration
  };

  await browser.storage.local.set({ settings });
  showStatus("Settings saved!");
}

/**
 * Show status message briefly
 */
function showStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
}

/**
 * Send test notification and optionally play sound via background script
 */
async function testNotification() {
  const notificationOptions = {
    type: "basic",
    iconUrl: "https://www.volumeleaders.com/favicon.png",
    title: "\u{1F514} TEST touched $123.45",
    message: "Rank 1 | Technology | RS: 2.50"
  };

  await browser.notifications.create(`test-${Date.now()}`, notificationOptions);

  if (playSoundEl.checked) {
    // Use background script's audio playback (single source of truth)
    browser.runtime.sendMessage({ action: "playSound" });
  }

  showStatus("Test notification sent!");
}

// Event listeners
playSoundEl.addEventListener("change", saveSettings);
testBtn.addEventListener("click", testNotification);

// Initialize
loadSettings();
