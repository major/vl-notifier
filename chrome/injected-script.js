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
   * Check if POST body indicates a chart page request.
   * Chart pages have Sort=Dollars parameter.
   * @param {string} body - The POST body (URL-encoded form data)
   * @returns {boolean} True if this is a chart page request
   */
  function isChartPageRequest(body) {
    if (!body || typeof body !== 'string') return false;
    // Chart pages sort by Dollars - check for Sort=Dollars in form data
    // Handle both raw and URL-encoded forms
    return body.includes('Sort=Dollars') || body.includes('Sort%3DDollars');
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
      // Check POST body for chart page indicator
      const options = typeof args[0] === 'string' ? args[1] : args[0];
      const body = options?.body;

      // Skip chart page requests (identified by Sort=Dollars in POST body)
      if (isChartPageRequest(body)) {
        return response;
      }

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
    const body = args[0]; // POST body is first argument

    if (shouldIntercept(url)) {
      // Skip chart page requests (identified by Sort=Dollars in POST body)
      if (isChartPageRequest(body)) {
        return originalXHRSend.apply(this, args);
      }

      this.addEventListener('load', function() {
        if (this.status >= 200 && this.status < 300) {
          sendToContentScript(url, this.responseText);
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };
})();
