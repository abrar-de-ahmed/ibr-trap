#!/usr/bin/env node
/**
 * WebSocket Bridge Server v1.1
 * ─────────────────────────────
 * Relays messages between the Chrome extension (background.js) and
 * the social agent (social-agent.js / sm-executive.js).
 * Runs on localhost:9876.
 *
 * Supported message types (all use post_request / post_result envelope):
 *
 *   Posting actions:
 *     platform: 'twitter'    → payload.action: null  (or 'twitter_post')
 *     platform: 'pinterest'  → payload.action: null  (or 'pinterest_post')
 *
 *   Engagement actions:
 *     platform: 'twitter'    → payload.action: 'twitter_follow' | 'twitter_like' | 'twitter_comment' | 'twitter_reply'
 *     platform: 'pinterest'  → payload.action: 'pinterest_follow' | 'pinterest_comment' | 'pinterest_reply'
 *     platform: 'reddit'     → payload.action: 'reddit_comment' | 'reddit_reply' | 'reddit_upvote'
 *
 * Usage:
 *   node ws-bridge/ws-bridge.js [--port 9876] [--timeout 60000]
 *
 * Dependencies: npm install ws
 */

const WebSocket = require('ws');

const DEFAULT_PORT = 9876;
const DEFAULT_TIMEOUT = 60000; // 60 seconds per request

// Parse CLI args
const args = process.argv.slice(2);
const port = parseInt(args[args.indexOf('--port') + 1]) || DEFAULT_PORT;
const timeout = parseInt(args[args.indexOf('--timeout') + 1]) || DEFAULT_TIMEOUT;

// ── Known actions for logging ──
const KNOWN_ACTIONS = [
  'twitter_post', 'twitter_follow', 'twitter_like', 'twitter_comment', 'twitter_reply',
  'pinterest_post', 'pinterest_follow', 'pinterest_comment', 'pinterest_reply',
  'reddit_comment', 'reddit_reply', 'reddit_upvote'
];

// ── Action → display name ──
const ACTION_NAMES = {
  twitter_post:      'Tweet Post',
  twitter_follow:    'Twitter Follow',
  twitter_like:      'Twitter Like',
  twitter_comment:   'Twitter Comment',
  twitter_reply:     'Twitter Reply',
  pinterest_post:    'Pinterest Pin Create',
  pinterest_follow:  'Pinterest Follow',
  pinterest_comment: 'Pinterest Comment',
  pinterest_reply:   'Pinterest Reply',
  reddit_comment:    'Reddit Comment',
  reddit_reply:      'Reddit Reply',
  reddit_upvote:     'Reddit Upvote'
};

// ── State ──
let extensionClient = null;  // The Chrome extension's background.js
let agentClients = new Map(); // social-agent.js connections (usually 1)
const pendingRequests = new Map(); // requestId → { agentWs, platform, action }

// ── Generate unique request ID ──
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Create WebSocket server ──
const wss = new WebSocket.Server({ port });

console.log(`╔══════════════════════════════════════════════╗`);
console.log(`║   WebSocket Bridge Server v1.1              ║`);
console.log(`║   Port: ${String(port).padEnd(38)}║`);
console.log(`║   Timeout: ${String(timeout + 'ms').padEnd(34)}║`);
console.log(`║   Actions: posting + engagement             ║`);
console.log(`║   Waiting for connections...                ║`);
console.log(`╚══════════════════════════════════════════════╝`);

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  let clientType = 'unknown';
  let clientId = generateId();

  console.log(`[+] New connection from ${clientIp} (id: ${clientId.substring(0, 8)})`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.log(`[!] Invalid JSON from ${clientId.substring(0, 8)}: ${raw.toString().substring(0, 100)}`);
      return;
    }

    // Handle registration
    if (msg.type === 'register') {
      clientType = msg.clientType || 'unknown';
      console.log(`[*] Client ${clientId.substring(0, 8)} registered as: ${clientType}`);

      if (clientType === 'extension') {
        extensionClient = ws;
        // Notify all waiting agents
        for (const [aid, agent] of agentClients) {
          try {
            agent.send(JSON.stringify({ type: 'extension_status', extensionOnline: true }));
          } catch (e) {}
        }
      } else if (clientType === 'agent') {
        agentClients.set(clientId, ws);
        // Send current extension status
        ws.send(JSON.stringify({
          type: 'extension_status',
          extensionOnline: extensionClient !== null && extensionClient.readyState === WebSocket.OPEN
        }));
      }
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

    // Handle post_request from agent → relay to extension
    // This handles BOTH posting and engagement actions (same protocol)
    if (msg.type === 'post_request' && clientType === 'agent') {
      const { platform, payload, requestId } = msg;
      const action = payload?.action || `${platform}_post`;

      // Log with descriptive action name
      const actionName = ACTION_NAMES[action] || action;
      const shortId = requestId.substring(0, 8);
      console.log(`[→] Agent → ${actionName} (${platform}) [${shortId}]`);

      if (!extensionClient || extensionClient.readyState !== WebSocket.OPEN) {
        console.log(`[!] No extension connected — rejecting ${actionName}`);
        ws.send(JSON.stringify({
          type: 'post_result',
          platform,
          requestId,
          result: { success: false, error: 'Extension offline — no Chrome browser connected to bridge', extensionOnline: false }
        }));
        return;
      }

      // Validate action
      if (action && !KNOWN_ACTIONS.includes(action) && !action.includes('_')) {
        console.log(`[!] Unknown action: ${action} — forwarding anyway`);
      }

      // Forward to extension (same protocol, extension background.js routes by platform)
      extensionClient.send(JSON.stringify({
        type: 'post_request',
        platform,
        payload,
        requestId
      }));

      // Acknowledge to agent
      ws.send(JSON.stringify({ type: 'ack', requestId }));
      console.log(`[→] Forwarded to extension, waiting for result...`);

      // Set timeout — if no result comes back in time
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          console.log(`[!] Timeout for ${actionName} [${shortId}]`);
          pendingRequests.delete(requestId);
          ws.send(JSON.stringify({
            type: 'post_result',
            platform,
            requestId,
            result: { success: false, error: `Extension timeout (${timeout}ms)` }
          }));
        }
      }, timeout);

      // Track pending request
      pendingRequests.set(requestId, { agentWs: ws, platform, action });
      return;
    }

    // Handle post_result from extension → relay to agent
    if (msg.type === 'post_result' && clientType === 'extension') {
      const { platform, requestId, result } = msg;
      const shortId = requestId.substring(0, 8);

      // Look up the action for better logging
      const pending = pendingRequests.get(requestId);
      const actionName = pending?.action ? (ACTION_NAMES[pending.action] || pending.action) : platform;

      const status = result?.success ? 'SUCCESS' : 'FAIL';
      const detail = result?.error ? ` — ${result.error}` : '';
      console.log(`[←] ${status}: ${actionName} [${shortId}]${detail}`);

      // Find the agent that made this request and forward
      if (pendingRequests.has(requestId)) {
        const { agentWs } = pendingRequests.get(requestId);
        if (agentWs.readyState === WebSocket.OPEN) {
          agentWs.send(JSON.stringify({ type: 'post_result', platform, requestId, result }));
        }
        pendingRequests.delete(requestId);
      } else {
        console.log(`[!] No pending request for [${shortId}] — agent may have disconnected`);
      }
      return;
    }

    // Unknown message type — log and ignore
    console.log(`[?] Unknown message type from ${clientId.substring(0, 8)}: ${msg.type}`);
  });

  ws.on('close', (code, reason) => {
    console.log(`[-] Client ${clientId.substring(0, 8)} (${clientType}) disconnected: ${code} ${reason}`);

    if (clientType === 'extension') {
      extensionClient = null;
      for (const [aid, agent] of agentClients) {
        try {
          agent.send(JSON.stringify({ type: 'extension_status', extensionOnline: false }));
        } catch (e) {}
      }
    } else if (clientType === 'agent') {
      agentClients.delete(clientId);
    }
  });

  ws.on('error', (err) => {
    console.log(`[!] Error from ${clientId.substring(0, 8)}: ${err.message}`);
  });

  // Send welcome
  ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.1.0', port }));
});

// ── Graceful shutdown ──
process.on('SIGINT', () => {
  console.log('\n[*] Shutting down bridge...');
  for (const [id, ws] of agentClients) {
    try { ws.close(); } catch (e) {}
  }
  if (extensionClient) {
    try { extensionClient.close(); } catch (e) {}
  }
  wss.close(() => {
    console.log('[*] Bridge stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[*] Received SIGTERM, shutting down...');
  wss.close(() => process.exit(0));
});
