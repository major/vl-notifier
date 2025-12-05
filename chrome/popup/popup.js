/**
 * VL Notifier - Popup Script (Chrome)
 * Settings UI for configuring notification preferences
 * (DEFAULT_SETTINGS and AUDIO_CONFIG loaded from ../shared/constants.js)
 */

const playSoundEl = document.getElementById("playSound");
const persistentEl = document.getElementById("persistentNotifications");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");

/**
 * Load settings from storage and update UI
 */
async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...stored.settings };

  playSoundEl.checked = settings.playSound;
  persistentEl.checked = settings.persistentNotifications;
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const settings = {
    playSound: playSoundEl.checked,
    persistentNotifications: persistentEl.checked,
    soundFrequency: DEFAULT_SETTINGS.soundFrequency,
    soundDuration: DEFAULT_SETTINGS.soundDuration
  };

  await chrome.storage.local.set({ settings });
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
 * Play test notification sound using shared audio config
 */
function playTestSound() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = DEFAULT_SETTINGS.soundFrequency;
    oscillator.type = AUDIO_CONFIG.waveType;

    gainNode.gain.setValueAtTime(AUDIO_CONFIG.initialGain, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      AUDIO_CONFIG.fadeOutFloor,
      audioContext.currentTime + DEFAULT_SETTINGS.soundDuration / 1000
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + DEFAULT_SETTINGS.soundDuration / 1000);
  } catch (err) {
    console.error("[VL Notifier] Failed to play sound:", err);
  }
}

/**
 * Send test notification
 */
async function testNotification() {
  const notificationOptions = {
    type: "basic",
    iconUrl: "https://www.volumeleaders.com/favicon.png",
    title: "\u{1F514} TEST touched $123.45",
    message: "Rank 1 | Technology | RS: 2.50"
  };

  if (persistentEl.checked) {
    notificationOptions.requireInteraction = true;
  }

  await chrome.notifications.create(`test-${Date.now()}`, notificationOptions);

  if (playSoundEl.checked) {
    playTestSound();
  }

  showStatus("Test notification sent!");
}

// Event listeners
playSoundEl.addEventListener("change", saveSettings);
persistentEl.addEventListener("change", saveSettings);
testBtn.addEventListener("click", testNotification);

// Initialize
loadSettings();
