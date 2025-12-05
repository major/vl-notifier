/**
 * VL Notifier - Offscreen Document Script
 * Handles audio playback since service workers cannot use AudioContext.
 */

/**
 * Play a notification sound using Web Audio API
 */
function playSound(frequency, duration) {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    // Fade out to avoid click
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (err) {
    console.error("[VL Notifier Offscreen] Failed to play sound:", err);
  }
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PLAY_SOUND') {
    playSound(message.frequency || 800, message.duration || 150);
  }
  return false;
});

console.log('[VL Notifier] Offscreen document ready');
