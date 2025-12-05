/**
 * VL Notifier - Background Script
 * Monitors XHR requests to VolumeLeaders pages (Trade Level Touches, Trades, etc.)
 * and shows Firefox desktop notifications for new items.
 */

// ============================================================================
// PAGE HANDLERS - Configuration for each supported page type
// ============================================================================

/**
 * Format price with dollar sign and 2 decimal places
 */
function formatPrice(price) {
  if (typeof price !== 'number') return '$0.00';
  return `$${price.toFixed(2)}`;
}

/**
 * Format relative size to 2 decimal places
 */
function formatRelSize(relSize) {
  if (typeof relSize !== 'number') return '0.00';
  return relSize.toFixed(2);
}

/**
 * Format multiplier to 1 decimal place
 */
function formatMultiplier(multiplier) {
  if (typeof multiplier !== 'number') return '0.0';
  return multiplier.toFixed(1);
}

/**
 * Format large numbers with K/M/B suffixes
 */
function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

/**
 * Format dollar amounts with $ and K/M/B suffixes
 */
function formatDollars(num) {
  if (typeof num !== 'number') return '$0';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
  return '$' + num.toLocaleString();
}

/**
 * Format percentile (0-1) as percentage
 */
function formatPercent(pct) {
  if (typeof pct !== 'number') return '0%';
  return Math.round(pct * 100) + '%';
}

/**
 * Parse ASP.NET JSON date format "/Date(1234567890000)/" to Date object
 */
function parseAspNetDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/\/Date\((\d+)\)\//);
  if (!match) return null;
  return new Date(parseInt(match[1], 10));
}

/**
 * Calculate days between two ASP.NET date strings
 */
function calculateLevelAgeDays(minDateStr, maxDateStr) {
  const minDate = parseAspNetDate(minDateStr);
  const maxDate = parseAspNetDate(maxDateStr);
  if (!minDate || !maxDate) return null;
  const diffMs = maxDate - minDate;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get trade type symbol based on dark pool and sweep flags
 * 🔶 DP Sweep | 🟠 DP Trade | 🔷 Lit Sweep | 🔵 Lit Trade
 */
function getTradeTypeSymbol(darkPool, sweep) {
  if (darkPool) {
    return sweep ? '🔶' : '🟠';
  }
  return sweep ? '🔷' : '🔵';
}

/**
 * Check if response is from a single-ticker filtered request.
 * Single-ticker requests (e.g., from chart pages) return items with Ticker: null
 * since the ticker is implied by the request context.
 */
function isSingleTickerResponse(items) {
  if (!items || items.length === 0) return false;
  return items.every(item => item.Ticker === null);
}

const PAGE_HANDLERS = {
  tradeLevelTouches: {
    name: "Trade Level Touches",
    urlPattern: "*://www.volumeleaders.com/TradeLevelTouches/GetTradeLevelTouches*",
    pageUrlPattern: /volumeleaders\.com\/TradeLevelTouches/i,
    storagePrefix: "seenTouches",
    getItemKey: (item) => `${item.Ticker}-${item.TradeLevelRank}-${item.Date}`,
    formatNotification: (item) => {
      // Title: Ticker #Rank + Price | Line 1: Days + RS + PCT | Line 2: Sector/Industry
      // Rank > 100 means unranked
      const rank = item.TradeLevelRank <= 100 ? ` #${item.TradeLevelRank}` : '';
      const levelDays = calculateLevelAgeDays(item.MinDate, item.MaxDate);
      const daysStr = levelDays !== null ? `${levelDays.toLocaleString()} days | ` : '';
      const rs = formatRelSize(item.RelativeSize);
      const pct = formatPercent(item.CumulativeDistribution);
      const sectorParts = [item.Sector];
      if (item.Industry) sectorParts.push(item.Industry);
      return {
        title: `[VL] 🔔 ${item.Ticker}${rank} touched ${formatPrice(item.Price)}`,
        message: `${daysStr}RS ${rs}x | PCT ${pct}\n${sectorParts.join(' | ')}`
      };
    }
  },
  trades: {
    name: "Block Trades",
    urlPattern: "*://www.volumeleaders.com/Trades/GetTrades*",
    pageUrlPattern: /volumeleaders\.com\/Trades/i,
    storagePrefix: "seenTrades",
    getItemKey: (item) => `${item.TradeID}`,
    formatNotification: (item) => {
      // Rank > 100 means unranked
      const rank = (item.TradeRank && item.TradeRank <= 100) ? `#${item.TradeRank} ` : '';
      const shares = formatNumber(item.Volume);
      const dollars = formatDollars(item.Dollars);
      const rs = formatMultiplier(item.DollarsMultiplier);
      const pct = formatPercent(item.CumulativeDistribution);
      const tradeType = getTradeTypeSymbol(item.DarkPool, item.Sweep);
      const sectorParts = [item.Sector];
      if (item.Industry) sectorParts.push(item.Industry);
      return {
        title: `[VL] 💰 ${item.Ticker} ${rank}${tradeType} ${formatPrice(item.Price)}`,
        message: `RS ${rs}x | PCT ${pct}\n${shares} sh | ${dollars}\n${sectorParts.join(' | ')}`
      };
    }
  }
};

/** All URL patterns to monitor */
const ALL_URL_PATTERNS = Object.values(PAGE_HANDLERS).map(h => h.urlPattern);

/** All storage prefixes for cleanup */
const ALL_STORAGE_PREFIXES = Object.values(PAGE_HANDLERS).map(h => h.storagePrefix);

// ============================================================================
// MUTEX - Prevent race conditions in concurrent XHR processing
// ============================================================================

/**
 * Per-handler processing locks to prevent concurrent processResponse calls
 * from causing duplicate notifications
 */
const processingLocks = new Map();

/**
 * Acquire a lock for a handler, waiting if another process holds it
 * @param {string} handlerKey - The handler's storage prefix (unique identifier)
 * @returns {Promise<Function>} - Release function to call when done
 */
async function acquireLock(handlerKey) {
  // Wait for any existing lock to be released
  while (processingLocks.has(handlerKey)) {
    await processingLocks.get(handlerKey);
  }

  // Create a new lock (a promise that resolves when released)
  let releaseFn;
  const lockPromise = new Promise(resolve => {
    releaseFn = resolve;
  });
  processingLocks.set(handlerKey, lockPromise);

  // Return the release function
  return () => {
    processingLocks.delete(handlerKey);
    releaseFn();
  };
}

// ============================================================================
// SETTINGS (DEFAULT_SETTINGS loaded from shared/constants.js)
// ============================================================================

/** Cached settings */
let settings = { ...DEFAULT_SETTINGS };

/**
 * Load settings from storage
 */
async function loadSettings() {
  const stored = await browser.storage.local.get("settings");
  settings = { ...DEFAULT_SETTINGS, ...stored.settings };
  return settings;
}

/**
 * Play a notification sound using Web Audio API
 * @param {number} [frequency] - Override frequency (Hz), defaults to settings
 * @param {number} [duration] - Override duration (ms), defaults to settings
 */
function playNotificationSound(frequency, duration) {
  const freq = frequency ?? settings.soundFrequency;
  const dur = duration ?? settings.soundDuration;

  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = freq;
    oscillator.type = AUDIO_CONFIG.waveType;

    // Fade out to avoid click
    gainNode.gain.setValueAtTime(AUDIO_CONFIG.initialGain, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(AUDIO_CONFIG.fadeOutFloor, audioContext.currentTime + dur / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + dur / 1000);
  } catch (err) {
    console.error("[VL Notifier] Failed to play sound:", err);
  }
}

/**
 * Get today's date string for storage namespacing
 */
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Show a Firefox notification for a new item using the handler's format
 * @param {Object} item - The data item (touch, trade, etc.)
 * @param {Object} handler - The page handler with formatNotification function
 */
async function showNotification(item, handler) {
  const notificationId = `vl-${handler.storagePrefix}-${Date.now()}-${item.Ticker}`;
  const formatted = handler.formatNotification(item);

  try {
    const notificationOptions = {
      type: "basic",
      iconUrl: "https://www.volumeleaders.com/favicon.png",
      title: formatted.title,
      message: formatted.message
    };

    await browser.notifications.create(notificationId, notificationOptions);

    // Play sound if enabled
    if (settings.playSound) {
      playNotificationSound();
    }
  } catch (err) {
    console.error(`[VL Notifier] Failed to show notification:`, err);
  }
}

/**
 * Process the API response and show notifications for new items
 * @param {string} responseText - Raw JSON response from the API
 * @param {Object} handler - The page handler configuration
 */
async function processResponse(responseText, handler) {
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    console.error(`[VL Notifier] Failed to parse response JSON (${handler.name}):`, err);
    return;
  }

  if (!data.data || !Array.isArray(data.data)) {
    return;
  }

  const items = data.data;

  // Skip single-ticker responses (e.g., from chart pages)
  if (handler.storagePrefix === 'seenTouches' && isSingleTickerResponse(items)) {
    console.log(`[VL Notifier] Skipping single-ticker response (${items.length} items)`);
    return;
  }

  // Acquire lock to prevent race conditions with concurrent XHR responses
  // This ensures storage read-modify-write is atomic per handler
  const releaseLock = await acquireLock(handler.storagePrefix);

  try {
    const todayKey = getTodayKey();
    const storageKey = `${handler.storagePrefix}_${todayKey}`;
    const initializedKey = `${handler.storagePrefix}_initialized_${todayKey}`;

    // Get current seen items from storage
    const storage = await browser.storage.local.get([storageKey, initializedKey]);
    const seenItems = storage[storageKey] || {};
    const isInitialized = storage[initializedKey] === true;

    // Find new items
    const newItems = [];
    const updatedSeenItems = { ...seenItems };

    for (const item of items) {
      const key = handler.getItemKey(item);
      if (!seenItems[key]) {
        updatedSeenItems[key] = true;
        if (isInitialized) {
          newItems.push(item);
        }
      }
    }

    // Update storage BEFORE showing notifications
    // This prevents race conditions even if notifications take time
    await browser.storage.local.set({
      [storageKey]: updatedSeenItems,
      [initializedKey]: true
    });

    // Release lock BEFORE showing notifications (storage is already updated)
    releaseLock();

    // Show notifications for new items (outside the lock for better concurrency)
    if (newItems.length > 0) {
      for (let i = 0; i < newItems.length; i++) {
        // Small delay between notifications (200ms)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, TIMING.notificationDelay));
        }
        await showNotification(newItems[i], handler);
      }
    }
  } catch (err) {
    // Ensure lock is released even on error
    releaseLock();
    throw err;
  }
}

/**
 * Clean up old storage entries (older than 2 days) for all handler prefixes
 */
async function cleanupOldStorage() {
  const storage = await browser.storage.local.get(null);

  // Parse today's date
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - TIMING.storageCleanupDays);

  const keysToRemove = [];

  for (const key of Object.keys(storage)) {
    // Check all storage prefixes
    for (const prefix of ALL_STORAGE_PREFIXES) {
      if (key.startsWith(`${prefix}_`)) {
        // Extract date from keys like "seenTouches_2025-12-05" or "seenTouches_initialized_2025-12-05"
        const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch) {
          const keyDate = new Date(dateMatch[1]);
          if (!isNaN(keyDate.getTime()) && keyDate < twoDaysAgo) {
            keysToRemove.push(key);
          }
        }
        break; // Found matching prefix, no need to check others
      }
    }
  }

  if (keysToRemove.length > 0) {
    await browser.storage.local.remove(keysToRemove);
  }
}

/**
 * Find the handler that matches a given URL
 * @param {string} url - The request URL
 * @returns {Object|null} The matching handler or null
 */
function findHandlerForUrl(url) {
  for (const handler of Object.values(PAGE_HANDLERS)) {
    // Convert glob pattern to a simple check
    // e.g., "*://www.volumeleaders.com/Trades/GetTrades*" -> "volumeleaders.com/Trades/GetTrades"
    const patternCore = handler.urlPattern
      .replace(/^\*:\/\//, '')
      .replace(/\*/g, '');
    if (url.includes(patternCore)) {
      return handler;
    }
  }
  return null;
}

/**
 * Check if a tab URL is a chart page (where we don't want notifications)
 * @param {string} url - The tab URL
 * @returns {boolean} True if the URL is a chart page
 */
function isChartPage(url) {
  if (!url) return false;
  return /volumeleaders\.com\/Chart/i.test(url);
}

/**
 * Set up the XHR interceptor using webRequest.filterResponseData
 * Monitors all registered URL patterns
 */
browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Find the matching handler for this URL
    const handler = findHandlerForUrl(details.url);
    if (!handler) {
      console.warn(`[VL Notifier] No handler found for URL: ${details.url}`);
      return {};
    }

    // Check if request is from a chart page - skip notifications there
    // Chart pages make filtered API calls that would spam notifications
    let skipProcessing = false;
    if (details.tabId && details.tabId >= 0) {
      try {
        const tab = await browser.tabs.get(details.tabId);
        if (isChartPage(tab.url)) {
          console.log(`[VL Notifier] Skipping ${handler.name} - request from chart page`);
          skipProcessing = true;
        }
      } catch (e) {
        // Tab might not exist anymore, continue normally
      }
    }

    const filter = browser.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder("utf-8");
    let responseData = "";

    filter.ondata = (event) => {
      // Accumulate the response data
      responseData += decoder.decode(event.data, { stream: true });
      // Pass through the data unchanged
      filter.write(event.data);
    };

    filter.onstop = () => {
      // Finish decoding any remaining data
      responseData += decoder.decode();

      // Process the complete response (async, don't block) - unless from chart page
      if (!skipProcessing) {
        processResponse(responseData, handler).catch(err => {
          console.error(`[VL Notifier] Error processing response (${handler.name}):`, err);
        });
      }

      filter.close();
    };

    filter.onerror = () => {
      console.error(`[VL Notifier] Filter error (${handler.name}):`, filter.error);
    };

    return {};
  },
  { urls: ALL_URL_PATTERNS },
  ["blocking"]
);

// ============================================================================
// DYNAMIC ICON - Change icon based on current tab URL
// ============================================================================

/**
 * Check if a URL matches any supported page
 * @param {string} url - The tab URL to check
 * @returns {boolean} True if the URL is a supported VolumeLeaders page
 */
function isPageSupported(url) {
  if (!url) return false;
  return Object.values(PAGE_HANDLERS).some(h => h.pageUrlPattern.test(url));
}

/**
 * Update the extension icon based on whether the tab is on a supported page
 * @param {number} tabId - The tab ID
 * @param {string} url - The tab URL
 */
function updateIconForTab(tabId, url) {
  const supported = isPageSupported(url);
  const iconPath = supported
    ? { 48: "icons/icon-48-active.png", 96: "icons/icon-96-active.png" }
    : { 48: "icons/icon-48.png", 96: "icons/icon-96.png" };

  browser.browserAction.setIcon({ tabId, path: iconPath }).catch(err => {
    // Ignore errors for closed tabs
    if (!err.message?.includes('Invalid tab ID')) {
      console.error("[VL Notifier] Failed to set icon:", err);
    }
  });
}

// Update icon when tab URL changes
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateIconForTab(tabId, changeInfo.url);
  }
});

// Update icon when switching tabs
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab.url) {
      updateIconForTab(activeInfo.tabId, tab.url);
    }
  } catch (err) {
    // Ignore errors for closed tabs
  }
});

// ============================================================================
// PAGE NAVIGATION - Reset state on page refresh
// ============================================================================

/**
 * Find the handler that matches a page URL (not API URL)
 * @param {string} url - The page URL
 * @returns {Object|null} The matching handler or null
 */
function findHandlerForPageUrl(url) {
  if (!url) return null;
  for (const handler of Object.values(PAGE_HANDLERS)) {
    if (handler.pageUrlPattern.test(url)) {
      return handler;
    }
  }
  return null;
}

/**
 * Reset the initialized state for a handler when user navigates to the page.
 * This ensures the first XHR after a page load/refresh seeds the seen items,
 * and only subsequent XHRs trigger notifications.
 */
browser.webNavigation.onCompleted.addListener(async (details) => {
  // Only handle main frame navigation (not iframes)
  if (details.frameId !== 0) return;

  const handler = findHandlerForPageUrl(details.url);
  if (!handler) return;

  const todayKey = getTodayKey();
  const storageKey = `${handler.storagePrefix}_${todayKey}`;
  const initializedKey = `${handler.storagePrefix}_initialized_${todayKey}`;

  // Clear the initialized flag and seen items for this handler
  // This forces the first XHR to re-seed the list
  await browser.storage.local.remove([storageKey, initializedKey]);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize extension
async function initialize() {
  await loadSettings();
  await cleanupOldStorage();

  // Clean up legacy non-date-scoped initialized keys (migration from older versions)
  const legacyKeys = ALL_STORAGE_PREFIXES.map(p => `${p}_initialized`);
  await browser.storage.local.remove(legacyKeys);

}

// Listen for settings changes from popup
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
  }
});

// Listen for messages from popup (e.g., test sound)
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "playSound") {
    playNotificationSound(
      message.frequency ?? DEFAULT_SETTINGS.soundFrequency,
      message.duration ?? DEFAULT_SETTINGS.soundDuration
    );
  }
});

initialize().catch(err => {
  console.error("[VL Notifier] Error initializing:", err);
});
