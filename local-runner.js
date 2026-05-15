#!/usr/bin/env node
/**
 * BG Remover Digital — Local Runner v2.2
 * ─────────────────────────────────────────────────────────
 * PURPOSE: Run Social Agent and SM Executive from local PC
 *   instead of GitHub Actions CI. The Chrome Extension bridge
 *   (localhost:9876) works on a real browser with a real IP,
 *   bypassing the Puppeteer-detection blocks on Twitter/Pinterest.
 *
 * USAGE:
 *   node local-runner.js --agent social      # Run Social Agent
 *   node local-runner.js --agent executive   # Run SM Executive
 *
 * SCHEDULE:
 *   Mon-Fri, 1:00 PM - 5:00 PM PKT (UTC+5)
 *   Set up Windows Task Scheduler for hourly execution.
 *
 * FLOW:
 *   1. Check PKT timezone → skip weekends
 *   2. Check if ws-bridge.js is running → start if not
 *   3. Run the requested agent with --local flag
 *   4. Git push results (brain.json updates)
 *   5. Log everything to local-runner.log
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const net = require('net');

// ── Constants ──
const PROJECT_ROOT = __dirname;
const SCRIPTS_DIR = path.join(PROJECT_ROOT, '.github', 'workflows', 'scripts');
const WS_BRIDGE_SCRIPT = path.join(PROJECT_ROOT, 'ws-bridge', 'ws-bridge.js');
const WS_BRIDGE_PORT = 9876;
const LOG_FILE = path.join(PROJECT_ROOT, 'local-runner.log');
const PKT_OFFSET = 5;

// ── Parse CLI args ──
const args = process.argv.slice(2);
const agentFlag = args.find(a => a.startsWith('--agent='));
const agentName = agentFlag ? agentFlag.split('=')[1] : (args[0] === '--agent' ? args[1] : null);

const VALID_AGENTS = ['social', 'executive'];
if (!agentName || !VALID_AGENTS.includes(agentName)) {
  console.error('Usage: node local-runner.js --agent social|executive');
  process.exit(1);
}

// ── Script mapping ──
const AGENT_SCRIPTS = {
  social: path.join(SCRIPTS_DIR, 'social-agent.js'),
  executive: path.join(SCRIPTS_DIR, 'sm-executive.js'),
};

// ── Logger ──
function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[Local Runner ${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) { /* ignore log write errors */ }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get current time in PKT timezone
 */
function getPKTNow() {
  const now = new Date();
  return new Date(now.getTime() + PKT_OFFSET * 60 * 60 * 1000);
}

/**
 * Check if today is a weekend (Saturday/Sunday) in PKT
 */
function isWeekendPKT() {
  const pktNow = getPKTNow();
  const day = pktNow.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

/**
 * Check if current PKT hour is within business window (1PM-5PM PKT = 08:00-12:00 UTC)
 */
function isWithinBusinessHours() {
  const pktNow = getPKTNow();
  const hour = pktNow.getUTCHours();
  return hour >= 13 && hour < 17;
}

/**
 * Check if a TCP port is open (used to detect if ws-bridge is running)
 */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Start the ws-bridge.js as a detached background process
 */
async function startBridge() {
  if (!fs.existsSync(WS_BRIDGE_SCRIPT)) {
    log(`WARNING: ws-bridge.js not found at ${WS_BRIDGE_SCRIPT}`);
    log('  The Chrome Extension WebSocket bridge will not be available.');
    log('  Please ensure the ws-bridge is running manually.');
    return false;
  }

  log('Starting ws-bridge.js on localhost:9876...');
  const child = spawn('node', [WS_BRIDGE_SCRIPT], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  // Wait for bridge to start listening
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await isPortOpen(WS_BRIDGE_PORT)) {
      log('ws-bridge.js is now running on localhost:9876');
      return true;
    }
  }

  log('WARNING: ws-bridge.js did not start within 15 seconds.');
  log('  Agent will run in --local mode but extension calls may fail.');
  return false;
}

/**
 * Run the agent script with --local flag
 */
function runAgent(scriptPath) {
  return new Promise((resolve, reject) => {
    log(`Running: node ${scriptPath} --local`);
    const child = spawn('node', [scriptPath, '--local'], {
      cwd: PROJECT_ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      log(`Agent exited with code: ${code}`);
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      log(`Agent process error: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Git add + commit + push results
 */
function gitPushResults() {
  try {
    log('Committing and pushing results...');
    execSync(
      `cd "${PROJECT_ROOT}" && git add data/ 2>/dev/null && ` +
      `git commit -m "local-runner: ${agentName} update - ${new Date().toISOString().split('T')[0]} [skip ci]" 2>/dev/null || true`,
      { stdio: 'pipe', timeout: 30000 }
    );
    execSync(`cd "${PROJECT_ROOT}" && git push 2>/dev/null`, { stdio: 'pipe', timeout: 60000 });
    log('Git push successful.');
  } catch (e) {
    log(`Git push failed: ${e.message}`);
    log('  This is non-fatal — data is saved locally and will sync next time.');
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  log('═══════════════════════════════════════════════════');
  log(`═══ Local Runner v2.2 — Agent: ${agentName} ═══`);
  log('═══════════════════════════════════════════════════');

  // ── 1. Weekend check ──
  if (isWeekendPKT()) {
    const pktNow = getPKTNow();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    log(`Today is ${dayNames[pktNow.getUTCDay()]} (PKT) — weekend, skipping.`);
    log('Local Runner only runs Mon-Fri as per schedule.');
    return;
  }

  // ── 2. Business hours check ──
  if (!isWithinBusinessHours()) {
    const pktNow = getPKTNow();
    log(`Current PKT hour: ${pktNow.getUTCHours()} — outside 1PM-5PM window.`);
    log('Agent will still run (local mode is flexible), but engagement may be suboptimal outside peak hours.');
    // Note: We don't skip — local mode is flexible. CI mode skips but local mode runs on demand.
  }

  // ── 3. Check/start ws-bridge ──
  const bridgeRunning = await isPortOpen(WS_BRIDGE_PORT);
  if (bridgeRunning) {
    log('ws-bridge.js is already running on localhost:9876');
  } else {
    log('ws-bridge.js is NOT running — attempting to start...');
    await startBridge();
  }

  // ── 4. Verify agent script exists ──
  const scriptPath = AGENT_SCRIPTS[agentName];
  if (!fs.existsSync(scriptPath)) {
    log(`FATAL: Agent script not found at ${scriptPath}`);
    log('  Ensure the repo is cloned and .github/workflows/scripts/ exists.');
    return;
  }

  // ── 5. Run the agent with --local flag ──
  log(`Starting ${agentName} agent in --local mode...`);
  const startTime = Date.now();
  const result = await runAgent(scriptPath);
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  log(`Agent finished in ${elapsed}s (exit code: ${result.code})`);

  // ── 6. Git push results ──
  if (result.code === 0) {
    gitPushResults();
  } else {
    log('Agent exited with non-zero code — skipping git push.');
    log('  Check the agent output above for errors.');
  }

  log('═══════════════════════════════════════════════════');
  log('═══ Local Runner Complete ═══');
  log(`═══ Agent: ${agentName}, Duration: ${elapsed}s, Exit: ${result.code} ═══`);
  log('═══════════════════════════════════════════════════');
}

main().catch(e => {
  log(`FATAL: ${e.message}`);
  log(e.stack);
  process.exit(1);
});
