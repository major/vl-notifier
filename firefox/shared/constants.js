/**
 * VL Notifier - Shared Constants
 * Single source of truth for configuration values used across background and popup scripts
 */

/** Default settings for notification preferences */
const DEFAULT_SETTINGS = {
  playSound: false,
  soundFrequency: 800,   // Hz - tone frequency
  soundDuration: 150     // ms - how long the beep plays
};

/** Audio playback configuration */
const AUDIO_CONFIG = {
  initialGain: 0.3,      // Starting volume (0-1)
  fadeOutFloor: 0.01,    // Volume to fade to (avoids click)
  waveType: "sine"       // Oscillator wave shape
};

/** Timing constants */
const TIMING = {
  notificationDelay: 200,  // ms - delay between multiple notifications
  storageCleanupDays: 2    // Days to keep seen items in storage
};
