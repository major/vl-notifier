/**
 * VL Notifier - Popup Script (Chrome)
 * Settings UI for configuring notification preferences
 */

const DEFAULT_SETTINGS = {
  playSound: false,
  persistentNotifications: false,
  soundFrequency: 800,
  soundDuration: 150
};

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
 * Play test notification sound
 */
function playTestSound() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = DEFAULT_SETTINGS.soundFrequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + DEFAULT_SETTINGS.soundDuration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + DEFAULT_SETTINGS.soundDuration / 1000);
  } catch (err) {
    console.error("Failed to play sound:", err);
  }
}

/**
 * Send test notification
 */
async function testNotification() {
  const notificationOptions = {
    type: "basic",
    iconUrl: "https://www.volumeleaders.com/favicon.png",
    title: "🔔 TEST touched $123.45",
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
