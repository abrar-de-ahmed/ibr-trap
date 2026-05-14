#!/usr/bin/env node
/**
 * WebSocket Bridge Server
 * ─────────────────────────────
 * Relays messages between the Chrome extension (background.js) and
 * the social agent (social-agent.js). Runs on localhost:9876.
 *
 * Usage:
 *   node ws-bridge/ws-bridge.js [--port 9876] [--timeout 60000]
 *
 * Dependencies: npm install ws
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('crypto'); // Use crypto.randomUUID() if available

const DEFAULT_PORT = 9876;
const DEFAULT_TIMEOUT = 60000; // 60 seconds per request

// Parse CLI args
const args = process.argv.slice(2);
const port = parseInt(args[args.indexOf('--port') + 1]) || DEFAULT_PORT;
const timeout = parseInt(args[args.indexOf('--timeout') + 1]) || DEFAULT_TIMEOUT;

// ── State ──
let extensionClient = null;  // The Chrome extension's background.js
let agentClients = new Map(); // social-agent.js connections (usually 1)

// ── Generate unique request ID ──
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Node.js
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Create WebSocket server ──
const wss = new WebSocket.Server({ port });

console.log(`╔══════════════════════════════════════════╗`);
console.log(`║   WebSocket Bridge Server                ║`);
console.log(`║   Port: ${String(port).padEnd(34)}║`);
console.log(`║   Timeout: ${String(timeout + 'ms').padEnd(30)}║`);
console.log(`║   Waiting for connections...            ║`);
console.log(`╚══════════════════════════════════════════╝`);

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
    if (msg.type === 'post_request' && clientType === 'agent') {
      const { platform, payload, requestId } = msg;
      console.log(`[→] Agent requests ${platform} post (requestId: ${requestId.substring(0, 8)})`);

      if (!extensionClient || extensionClient.readyState !== WebSocket.OPEN) {
        console.log(`[!] No extension connected — rejecting ${platform} post request`);
        ws.send(JSON.stringify({
          type: 'post_result',
          platform,
          requestId,
          result: { success: false, error: 'Extension offline — no Chrome browser connected to bridge', extensionOnline: false }
        }));
        return;
      }

      // Forward to extension
      extensionClient.send(JSON.stringify({
        type: 'post_request',
        platform,
        payload,
        requestId
      }));

      // Acknowledge to agent (they'll get the result when extension responds)
      ws.send(JSON.stringify({ type: 'ack', requestId }));
      console.log(`[→] Forwarded to extension, waiting for result...`);

      // Set timeout — if no result comes back in time
      setTimeout(() => {
        // Only send timeout if we haven't already received a result
        // (The extension_result_handler below will send the actual result)
        // We track pending requests per requestId
        if (pendingRequests.has(requestId)) {
          console.log(`[!] Timeout for request ${requestId.substring(0, 8)}`);
          pendingRequests.delete(requestId);
          ws.send(JSON.stringify({
            type: 'post_result',
            platform,
            requestId,
            result: { success: false, error: `Extension timeout (${timeout}ms)` }
          }));
        }
      }, timeout);

      // Track pending request so we can clean up on timeout
      pendingRequests.set(requestId, { agentWs: ws, platform });
      return;
    }

    // Handle post_result from extension → relay to agent
    if (msg.type === 'post_result' && clientType === 'extension') {
      const { platform, requestId, result } = msg;
      console.log(`[←] Extension result for ${platform} (requestId: ${requestId.substring(0, 8)}): ${result.success ? 'SUCCESS' : 'FAIL'}`);

      // Find the agent that made this request and forward the result
      if (pendingRequests.has(requestId)) {
        const { agentWs } = pendingRequests.get(requestId);
        if (agentWs.readyState === WebSocket.OPEN) {
          agentWs.send(JSON.stringify({ type: 'post_result', platform, requestId, result }));
        }
        pendingRequests.delete(requestId);
      } else {
        // Maybe agent disconnected — just log
        console.log(`[!] No pending request found for ${requestId.substring(0, 8)} — agent may have disconnected`);
      }
      return;
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[-] Client ${clientId.substring(0, 8)} (${clientType}) disconnected: ${code} ${reason}`);

    if (clientType === 'extension') {
      extensionClient = null;
      // Notify all agents
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

  // Send welcome message
  ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0.0', port }));
});

// ── Pending request tracking (requestId → { agentWs, platform }) ──
const pendingRequests = new Map();

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
