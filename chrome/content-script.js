/**
 * VL Notifier - Content Script (Isolated World)
 * Bridges between the page context (injected-script.js) and the service worker.
 * Runs at document_start to inject before page scripts execute.
 */

// Inject the page-context script immediately (before page JS runs)
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected-script.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected script (via window.postMessage)
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Only handle our specific message type
  if (event.data?.type !== 'VL_NOTIFIER_RESPONSE') return;

  // Forward to service worker
  chrome.runtime.sendMessage({
    type: 'API_RESPONSE',
    url: event.data.url,
    responseText: event.data.responseText
  }).catch(err => {
    // Service worker might be inactive, that's okay
    if (!err.message?.includes('Receiving end does not exist')) {
      console.error('[VL Notifier] Failed to send to service worker:', err);
    }
  });
});

console.log('[VL Notifier] Content script loaded');
