/**
 * VL Notifier - Service Worker (Chrome MV3)
 * Processes API responses forwarded from content script,
 * manages storage, and shows desktop notifications for new items.
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
    urlPattern: "/TradeLevelTouches/GetTradeLevelTouches",
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
        title: `🔔 ${item.Ticker}${rank} touched ${formatPrice(item.Price)}`,
        message: `${daysStr}RS ${rs}x | PCT ${pct}\n${sectorParts.join(' | ')}`
      };
    }
  },
  trades: {
    name: "Block Trades",
    urlPattern: "/Trades/GetTrades",
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
        title: `💰 ${item.Ticker} ${rank}${tradeType} ${formatPrice(item.Price)}`,
        message: `RS ${rs}x | PCT ${pct}\n${shares} sh | ${dollars}\n${sectorParts.join(' | ')}`
      };
    }
  }
};

/** All storage prefixes for cleanup */
const ALL_STORAGE_PREFIXES = Object.values(PAGE_HANDLERS).map(h => h.storagePrefix);

// ============================================================================
// MUTEX - Prevent race conditions in concurrent processing
// ============================================================================

const processingLocks = new Map();

/**
 * Acquire a lock for a handler, waiting if another process holds it
 */
async function acquireLock(handlerKey) {
  while (processingLocks.has(handlerKey)) {
    await processingLocks.get(handlerKey);
  }

  let releaseFn;
  const lockPromise = new Promise(resolve => {
    releaseFn = resolve;
  });
  processingLocks.set(handlerKey, lockPromise);

  return () => {
    processingLocks.delete(handlerKey);
    releaseFn();
  };
}

// ============================================================================
// SETTINGS
// ============================================================================

const DEFAULT_SETTINGS = {
  playSound: false,
  persistentNotifications: false,
  soundFrequency: 800,
  soundDuration: 150
};

/**
 * Load settings from storage (always read fresh - service worker can restart)
 */
async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

/**
 * Get today's date string for storage namespacing
 */
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ============================================================================
// AUDIO (via Offscreen Document)
// ============================================================================

/**
 * Play notification sound via offscreen document
 * (Service workers cannot use AudioContext directly)
 */
async function playNotificationSound(settings) {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
      // Create offscreen document for audio playback
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play notification sound'
      });
    }

    // Send message to offscreen document to play sound
    await chrome.runtime.sendMessage({
      type: 'PLAY_SOUND',
      frequency: settings.soundFrequency,
      duration: settings.soundDuration
    });
  } catch (err) {
    console.error('[VL Notifier] Failed to play sound:', err);
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Show a desktop notification for a new item
 */
async function showNotification(item, handler, settings) {
  const notificationId = `vl-${handler.storagePrefix}-${Date.now()}-${item.Ticker}`;
  const formatted = handler.formatNotification(item);

  try {
    const notificationOptions = {
      type: "basic",
      iconUrl: "https://www.volumeleaders.com/favicon.png",
      title: formatted.title,
      message: formatted.message
    };

    if (settings.persistentNotifications) {
      notificationOptions.requireInteraction = true;
    }

    await chrome.notifications.create(notificationId, notificationOptions);

    if (settings.playSound) {
      await playNotificationSound(settings);
    }
  } catch (err) {
    console.error(`[VL Notifier] Failed to show notification:`, err);
  }
}

// ============================================================================
// RESPONSE PROCESSING
// ============================================================================

/**
 * Find the handler that matches a given API URL
 */
function findHandlerForUrl(url) {
  for (const handler of Object.values(PAGE_HANDLERS)) {
    if (url.includes(handler.urlPattern)) {
      return handler;
    }
  }
  return null;
}

/**
 * Process the API response and show notifications for new items
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

  const releaseLock = await acquireLock(handler.storagePrefix);

  try {
    const todayKey = getTodayKey();
    const storageKey = `${handler.storagePrefix}_${todayKey}`;
    const initializedKey = `${handler.storagePrefix}_initialized_${todayKey}`;

    const storage = await chrome.storage.local.get([storageKey, initializedKey]);
    const seenItems = storage[storageKey] || {};
    const isInitialized = storage[initializedKey] === true;

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
    await chrome.storage.local.set({
      [storageKey]: updatedSeenItems,
      [initializedKey]: true
    });

    releaseLock();

    // Show notifications for new items
    if (newItems.length > 0) {
      const settings = await getSettings();
      for (let i = 0; i < newItems.length; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await showNotification(newItems[i], handler, settings);
      }
    }
  } catch (err) {
    releaseLock();
    throw err;
  }
}

// ============================================================================
// STORAGE CLEANUP
// ============================================================================

/**
 * Clean up old storage entries (older than 2 days)
 */
async function cleanupOldStorage() {
  const storage = await chrome.storage.local.get(null);

  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);

  const keysToRemove = [];

  for (const key of Object.keys(storage)) {
    for (const prefix of ALL_STORAGE_PREFIXES) {
      if (key.startsWith(`${prefix}_`)) {
        const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch) {
          const keyDate = new Date(dateMatch[1]);
          if (!isNaN(keyDate.getTime()) && keyDate < twoDaysAgo) {
            keysToRemove.push(key);
          }
        }
        break;
      }
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

// ============================================================================
// DYNAMIC ICON
// ============================================================================

/**
 * Check if a URL matches any supported page
 */
function isPageSupported(url) {
  if (!url) return false;
  return Object.values(PAGE_HANDLERS).some(h => h.pageUrlPattern.test(url));
}

/**
 * Update the extension icon based on whether the tab is on a supported page
 */
function updateIconForTab(tabId, url) {
  const supported = isPageSupported(url);
  const iconPath = supported
    ? { 16: "icons/icon-16-active.png", 48: "icons/icon-48-active.png", 128: "icons/icon-128-active.png" }
    : { 16: "icons/icon-16.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };

  chrome.action.setIcon({ tabId, path: iconPath }).catch(err => {
    // Ignore errors for closed tabs
  });
}

// Update icon when tab URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateIconForTab(tabId, changeInfo.url);
  }

  // Reset state on page load complete (equivalent to webNavigation.onCompleted)
  if (changeInfo.status === 'complete' && tab.url) {
    const handler = Object.values(PAGE_HANDLERS).find(h => h.pageUrlPattern.test(tab.url));
    if (handler) {
      const todayKey = getTodayKey();
      const storageKey = `${handler.storagePrefix}_${todayKey}`;
      const initializedKey = `${handler.storagePrefix}_initialized_${todayKey}`;

      chrome.storage.local.remove([storageKey, initializedKey]);
    }
  }
});

// Update icon when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      updateIconForTab(activeInfo.tabId, tab.url);
    }
  } catch (err) {
    // Ignore errors for closed tabs
  }
});

// ============================================================================
// MESSAGE LISTENER (from content script)
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_RESPONSE') {
    const handler = findHandlerForUrl(message.url);
    if (handler) {
      processResponse(message.responseText, handler).catch(err => {
        console.error(`[VL Notifier] Error processing response (${handler.name}):`, err);
      });
    }
  }

  // Handle test notification from popup
  if (message.type === 'TEST_NOTIFICATION') {
    (async () => {
      const settings = await getSettings();
      await chrome.notifications.create(`vl-test-${Date.now()}`, {
        type: "basic",
        iconUrl: "https://www.volumeleaders.com/favicon.png",
        title: "🔔 Test Notification",
        message: "VL Notifier is working!",
        requireInteraction: settings.persistentNotifications
      });
      if (settings.playSound) {
        await playNotificationSound(settings);
      }
    })();
  }

  return false; // No async response needed
});

// ============================================================================
// PERIODIC CLEANUP (via Alarms API)
// ============================================================================

chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldStorage();
  }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
  await cleanupOldStorage();

  // Clean up legacy non-date-scoped keys
  const legacyKeys = ALL_STORAGE_PREFIXES.map(p => `${p}_initialized`);
  await chrome.storage.local.remove(legacyKeys);
}

initialize().catch(err => {
  console.error("[VL Notifier] Error initializing:", err);
});
