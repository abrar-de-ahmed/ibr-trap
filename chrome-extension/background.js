/**
 * Background Service Worker — WebSocket Relay Hub
 * Connects to ws-bridge on localhost:9876 and routes
 * posting instructions and engagement actions to the correct content script tab.
 *
 * Supported actions:
 *   Posting:      twitter_post, pinterest_post  (→ twitter.js, pinterest.js)
 *   Engagement:   twitter_follow, twitter_like, twitter_comment, twitter_reply  (→ twitter-engage.js)
 *                 pinterest_follow, pinterest_comment, pinterest_reply  (→ pinterest-engage.js)
 *                 reddit_comment, reddit_reply, reddit_upvote  (→ reddit.js)
 *
 * All messages use the same protocol: post_request / post_result with platform + requestId.
 */

const WS_URL = 'ws://localhost:9876';
const RECONNECT_BASE = 1000;  // 1s
const RECONNECT_MAX = 30000;  // 30s
const HEARTBEAT_INTERVAL = 30000; // 30s
const REQUEST_TIMEOUT = 65000; // 65s (bridge has 60s internal)

let ws = null;
let reconnectDelay = RECONNECT_BASE;
let reconnectTimer = null;
let heartbeatTimer = null;
let pendingRequests = {};  // requestId → { resolve, reject, timer }
let extensionOnline = false;

// ── Platform → URL pattern mapping ──
const PLATFORM_URLS = {
  twitter:   '*://x.com/*',
  pinterest: '*://*.pinterest.com/*',
  reddit:    '*://*.reddit.com/*'
};

// ── Platform → default tab URL (for creating new tabs) ──
const PLATFORM_DEFAULT_URLS = {
  twitter:   'https://x.com/compose/post',
  pinterest: 'https://www.pinterest.com/pin-creation-tool/',
  reddit:    'https://www.reddit.com/'
};

// ── Action → platform mapping (for routing when only action is specified) ──
const ACTION_PLATFORM_MAP = {
  twitter_follow:  'twitter',
  twitter_like:    'twitter',
  twitter_comment: 'twitter',
  twitter_reply:   'twitter',
  twitter_post:    'twitter',
  pinterest_follow:  'pinterest',
  pinterest_comment: 'pinterest',
  pinterest_reply:   'pinterest',
  pinterest_post:    'pinterest',
  reddit_comment: 'reddit',
  reddit_reply:   'reddit',
  reddit_upvote:  'reddit'
};

// ── Storage helpers ──
function setStatus(status) {
  chrome.storage.local.set({ connectionStatus: status });
}

function setLastPost(result) {
  chrome.storage.local.set({ lastPostResult: result });
}

// ── WebSocket connection ──
function connect() {
  setStatus('connecting');

  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.log('[BG] WebSocket creation failed:', e.message);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[BG] Connected to ws-bridge');
    extensionOnline = true;
    reconnectDelay = RECONNECT_BASE;
    setStatus('connected');

    // Register as extension client
    ws.send(JSON.stringify({
      type: 'register',
      clientType: 'extension',
      version: '1.1.0'
    }));

    startHeartbeat();
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.log('[BG] Non-JSON message:', event.data);
      return;
    }

    // Handle heartbeat
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    if (msg.type === 'pong') {
      return;
    }

    // Handle post request from agent (posting + engagement actions)
    if (msg.type === 'post_request') {
      handlePostRequest(msg);
      return;
    }

    // Handle post result confirmation (echo back from bridge)
    if (msg.type === 'ack') {
      return;
    }
  };

  ws.onclose = (event) => {
    console.log('[BG] Disconnected from ws-bridge:', event.code, event.reason);
    extensionOnline = false;
    setStatus('disconnected');
    stopHeartbeat();
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.log('[BG] WebSocket error');
    extensionOnline = false;
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    console.log(`[BG] Reconnecting in ${reconnectDelay}ms...`);
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ── Route post request to content script ──
async function handlePostRequest(msg) {
  const { platform, payload, requestId } = msg;
  const action = payload?.action || null;

  console.log(`[BG] Received request: platform=${platform}, action=${action}, requestId=${requestId}`);

  // Resolve platform from action if not explicitly set
  const resolvedPlatform = platform || (action ? ACTION_PLATFORM_MAP[action] : null);

  if (!resolvedPlatform) {
    sendResult(requestId, resolvedPlatform || 'unknown', { success: false, error: `Cannot determine platform for action: ${action}` });
    return;
  }

  // Get URL pattern for this platform
  const urlPattern = PLATFORM_URLS[resolvedPlatform];
  if (!urlPattern) {
    sendResult(requestId, resolvedPlatform, { success: false, error: `Unknown platform: ${resolvedPlatform}` });
    return;
  }

  try {
    // Find or create the right tab
    const tab = await findOrCreateTab(resolvedPlatform, urlPattern);
    if (!tab) {
      sendResult(requestId, resolvedPlatform, { success: false, error: 'Could not open tab for platform' });
      return;
    }

    // Send message to content script with timeout
    const result = await sendToContentScript(tab.id, requestId, resolvedPlatform, payload);
    sendResult(requestId, resolvedPlatform, result);

    // Store in storage for popup display
    setLastPost({
      platform: resolvedPlatform,
      action,
      timestamp: new Date().toISOString(),
      ...result
    });

  } catch (e) {
    console.error('[BG] Error handling request:', e.message);
    sendResult(requestId, resolvedPlatform, { success: false, error: e.message });
  }
}

function sendResult(requestId, platform, result) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'post_result',
      platform,
      requestId,
      result
    }));
  }
}

// ── Tab management ──
async function findOrCreateTab(platform, urlPattern) {
  // First try to find an existing matching tab
  try {
    const tabs = await chrome.tabs.query({ url: urlPattern });
    if (tabs.length > 0) {
      // Bring the tab's window to front
      const tab = tabs[0];
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tab.id, { active: true });
      // Small delay for tab to be ready
      await sleep(500);
      return tab;
    }
  } catch (e) {
    // Fall through to create
  }

  // Create a new tab
  const createUrl = PLATFORM_DEFAULT_URLS[platform];
  if (!createUrl) return null;

  try {
    const tab = await chrome.tabs.create({ url: createUrl, active: true });
    // Wait for the page to load and content script to inject
    // Pinterest pin-creation-tool needs extra time to load
    await sleep(platform === 'pinterest' ? 6000 : 3000);
    return tab;
  } catch (e) {
    console.error('[BG] Error creating tab:', e.message);
    return null;
  }
}

// ── Send message to content script with timeout ──
function sendToContentScript(tabId, requestId, platform, payload) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve({ success: false, error: 'Content script timeout (65s)' });
    }, REQUEST_TIMEOUT);

    // Set up one-time listener for the response
    const listener = (message, sender, sendResponse) => {
      if (sender.tab && sender.tab.id === tabId &&
          message.type === 'post_result' && message.requestId === requestId) {
        chrome.runtime.onMessage.removeListener(listener);
        clearTimeout(timer);
        resolve(message.result);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Send the instruction to the content script
    chrome.tabs.sendMessage(tabId, {
      type: 'post_request',
      platform,
      requestId,
      payload
    }).catch((e) => {
      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timer);
      resolve({ success: false, error: `Content script not ready: ${e.message}` });
    });
  });
}

// ── Utility ──
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Manual reconnect from popup ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'reconnect') {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      try { ws.close(); } catch (e) {}
    }
    reconnectDelay = RECONNECT_BASE;
    connect();
    sendResponse({ status: 'reconnecting' });
  }
  if (message.type === 'getStatus') {
    chrome.storage.local.get(['connectionStatus', 'lastPostResult'], (data) => {
      sendResponse({
        connectionStatus: data.connectionStatus || 'disconnected',
        lastPostResult: data.lastPostResult || null,
        extensionOnline
      });
    });
    return true; // async response
  }
});

// ── Start ──
connect();
