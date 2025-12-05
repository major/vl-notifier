/**
 * VL Notifier - Injected Script (Page Context)
 * Monkey-patches fetch/XHR to capture API responses and forward to content script.
 * This runs in the page's JavaScript context, not the extension's isolated world.
 */
(function() {
  'use strict';

  const TARGET_PATTERNS = [
    '/TradeLevelTouches/GetTradeLevelTouches',
    '/Trades/GetTrades'
  ];

  /**
   * Check if a URL should be intercepted
   */
  function shouldIntercept(url) {
    if (!url) return false;
    return TARGET_PATTERNS.some(pattern => url.includes(pattern));
  }

  /**
   * Send intercepted response to content script via postMessage
   */
  function sendToContentScript(url, responseText) {
    window.postMessage({
      type: 'VL_NOTIFIER_RESPONSE',
      url: url,
      responseText: responseText
    }, '*');
  }

  // ========== Intercept fetch() ==========
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    // Determine URL from arguments
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

    if (shouldIntercept(url)) {
      // Clone response so we can read body without consuming the original
      const clone = response.clone();
      clone.text().then(text => {
        sendToContentScript(url, text);
      }).catch(err => {
        console.error('[VL Notifier] Failed to read fetch response:', err);
      });
    }

    return response;
  };

  // ========== Intercept XMLHttpRequest ==========
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    // Store URL for later use in send()
    this._vlNotifierUrl = url;
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const url = this._vlNotifierUrl;

    if (shouldIntercept(url)) {
      this.addEventListener('load', function() {
        if (this.status >= 200 && this.status < 300) {
          sendToContentScript(url, this.responseText);
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };

  console.log('[VL Notifier] XHR/fetch interceptors installed');
})();
