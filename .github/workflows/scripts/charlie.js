#!/usr/bin/env node
/**
 * BG Remover Digital — Charlie Agent v2 (Lightweight)
 * The Reactive Phenotype — Frontline Security Monitor
 * Runs every 6 hours via GitHub Actions
 *
 * MISSION: Monitor live site for anomalies, tampering, and suspicious activity
 * GENETIC ALGORITHM: Speed + Mutation (Phase 1 — monitoring only, no blocking)
 *
 * Checks:
 * - Site content integrity (stable hash — ignores Next.js build changes)
 * - Injected code detection (with trusted domain whitelist)
 * - Response time anomalies (DDoS early warning)
 * - Unexpected redirects or injected content
 * - Ghost Page detection (unexpected error pages)
 * - Status code consistency
 *
 * v2 FIXES (2026-05-10):
 * - Content hash now strips Next.js dynamic chunks before hashing (prevents false positive on rebuilds)
 * - External script whitelist: googletagmanager.com, staticimgly.com (our own GA4 + IMG.LY)
 * - Fixed ghost.findings crash — checkGhostPages returns array, not object
 *
 * Future Phase 2: Deploy as Cloudflare Worker with real-time blocking
 * See SECURITY-ROADMAP.md for full upgrade path
 */

const https = require('https');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const STATE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'charlie-state.json');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();

function log(msg) {
  console.log(`[Charlie ${new Date().toISOString()}] ${msg}`);
}

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        body,
        headers: res.headers,
        responseTime: Date.now() - req.startTime,
      }));
    });
    req.startTime = Date.now();
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Trusted External Domains ──
// These are OUR OWN integrations — NOT injected code
const TRUSTED_EXTERNAL_DOMAINS = [
  'googletagmanager.com',   // Google Analytics (GA4) — our own tracking
  'www.googletagmanager.com',
  'staticimgly.com',         // IMG.LY — background removal AI model library
];

function buildTrustedRegex() {
  const escaped = TRUSTED_EXTERNAL_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|');
  return new RegExp(`(bgremoverdigital\\.craftedmindss\\.com|${escaped})`, 'i');
}

// ── Content Integrity Check ──
// Next.js embeds build-specific hashes in script/src URLs (_next/static/chunks/abc123.js),
// so every rebuild changes the full HTML hash. We strip dynamic Next.js asset references
// before hashing to detect REAL content changes only (text, structure, injected code).
function getStableContentHash(html) {
  // Strip Next.js dynamic chunk references (they change every build)
  let stable = html.replace(/<script[^>]*src=["']\/_next\/static\/[^"']*["'][^>]*>/gi, '');
  stable = stable.replace(/<link[^>]*href=["']\/_next\/static\/[^"']*["'][^>]*>/gi, '');
  // Strip dynamic build IDs in RSC payloads
  stable = stable.replace(/self\.__next_f\.push\([^)]*\)/g, '');
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function checkContentIntegrity(html, state) {
  const findings = [];
  const fullHash = crypto.createHash('sha256').update(html).digest('hex');
  const stableHash = getStableContentHash(html);

  // Check stable content hash (ignores Next.js build changes)
  const lastStableHash = state.lastKnownHashes?.homepageStable;
  if (lastStableHash && lastStableHash !== stableHash) {
    findings.push({
      severity: 'CRITICAL',
      check: 'Content Tampering',
      message: `Homepage stable content changed! Previous: ${lastStableHash.slice(0, 12)}... Current: ${stableHash.slice(0, 12)}... Possible injection or unauthorized modification.`,
    });
  } else if (lastStableHash === stableHash) {
    log('  Content integrity: OK (stable hash matches, Next.js build change ignored)');
  }

  // Check for injected scripts from UNTRUSTED domains only
  const trustedRegex = buildTrustedRegex();

  const checks = [
    { regex: /<script[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/gi, type: 'script' },
    { regex: /<iframe[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/gi, type: 'iframe' },
  ];

  for (const { regex, type } of checks) {
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      // Filter out matches from trusted domains
      const untrusted = matches.filter(m => !trustedRegex.test(m));
      if (untrusted.length > 0) {
        findings.push({
          severity: 'CRITICAL',
          check: 'Injected Code',
          message: `Suspicious ${type} detected ${untrusted.length} time(s) from untrusted sources. Examples: ${untrusted.slice(0, 2).map(m => m.slice(0, 80)).join(' | ')}. Possible XSS or code injection.`,
        });
      } else {
        log(`  External ${type} found but all from trusted domains — OK`);
      }
    }
  }

  // Check for dangerous JS patterns (always suspicious)
  const dangerousPatterns = [
    { regex: /eval\(/gi, type: 'eval()' },
    { regex: /document\.write\(/gi, type: 'document.write()' },
  ];

  for (const { regex, type } of dangerousPatterns) {
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      findings.push({
        severity: 'CRITICAL',
        check: 'Dangerous Code',
        message: `${type} detected ${matches.length} time(s). Possible code injection.`,
      });
    }
  }

  // Check for unexpected meta redirects
  const redirectMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=/i);
  if (redirectMatch) {
    findings.push({
      severity: 'HIGH',
      check: 'Meta Redirect',
      message: `Unexpected meta refresh redirect found: ${redirectMatch[0].slice(0, 100)}. Site may have been compromised.`,
    });
  }

  return { hash: fullHash, stableHash, findings };
}

// ── Response Time Analysis ──
function checkResponseTimes(responseTime, state) {
  const findings = [];
  const history = state.responseTimeHistory || [];

  // Add current reading
  history.push({ time: NOW.toISOString(), ms: responseTime });
  if (history.length > 168) history.shift(); // Keep last 7 days (28 checks x 6hr)

  // Calculate baseline average (excluding current)
  const pastReadings = history.slice(0, -1).map(h => h.ms);
  if (pastReadings.length >= 5) {
    const avg = Math.round(pastReadings.reduce((a, b) => a + b, 0) / pastReadings.length);
    const deviation = Math.round(((responseTime - avg) / avg) * 100);

    if (responseTime > 5000 && deviation > 200) {
      findings.push({
        severity: 'HIGH',
        check: 'Response Anomaly',
        message: `Response time ${responseTime}ms is ${deviation}% above average (${avg}ms). Possible DDoS or resource exhaustion.`,
      });
    } else if (responseTime > 3000) {
      findings.push({
        severity: 'MEDIUM',
        check: 'Slow Response',
        message: `Response time ${responseTime}ms (average: ${avg}ms). Monitor for degradation.`,
      });
    }
  }

  // Check for extreme spikes (potential DDoS)
  if (responseTime > 10000) {
    findings.push({
      severity: 'CRITICAL',
      check: 'DDoS Warning',
      message: `Response time ${responseTime}ms — potential DDoS attack or server overload.`,
    });
  }

  return { history, findings };
}

// ── Ghost Page Detection ──
// Returns findings array directly
function checkGhostPages(html, status) {
  const findings = [];

  // Site should never return 403, 503, or 521 for normal pages
  if (status === 403) {
    findings.push({
      severity: 'HIGH',
      check: 'Access Denied',
      message: 'Site returning 403 Forbidden. Possible WAF misconfiguration or Cloudflare block.',
    });
  }

  if (status === 503) {
    findings.push({
      severity: 'HIGH',
      check: 'Service Unavailable',
      message: 'Site returning 503. Server may be overloaded or in maintenance mode.',
    });
  }

  if (status === 521) {
    findings.push({
      severity: 'CRITICAL',
      check: 'Origin Unreachable',
      message: 'Cloudflare returning 521 — origin server is down or refusing connections.',
    });
  }

  // Check if page contains expected elements
  if (status === 200) {
    if (!html.includes('bgremoverdigital') && !html.includes('BG Remover')) {
      findings.push({
        severity: 'CRITICAL',
        check: 'Ghost Page Detected',
        message: 'Page loaded but does not contain expected branding. Possible hijacked DNS or proxy attack.',
      });
    }
  }

  // Check for Cloudflare challenge pages appearing unexpectedly
  if (html.includes('cf-browser-verification') || html.includes('cf-challenge-running')) {
    findings.push({
      severity: 'MEDIUM',
      check: 'CF Challenge Page',
      message: 'Cloudflare challenge page detected. May be blocking legitimate users or crawlers.',
    });
  }

  return findings;
}

// ── Multiple Page Check ──
async function checkMultiplePages() {
  const pages = [
    { url: '/', name: 'Homepage' },
    { url: '/remove-background/product-photos', name: 'Product Photos Page' },
    { url: '/sitemap.xml', name: 'Sitemap' },
  ];

  const results = [];
  for (const page of pages) {
    try {
      const start = Date.now();
      const { status, body, headers, responseTime } = await fetchUrl(`${SITE_URL}${page.url}`);
      results.push({
        ...page,
        status,
        responseTime: responseTime || (Date.now() - start),
        bodyLength: body.length,
        contentType: headers['content-type'] || 'unknown',
        ok: status === 200,
      });
    } catch (e) {
      results.push({
        ...page,
        status: 0,
        responseTime: 0,
        error: e.message,
        ok: false,
      });
    }
  }
  return results;
}

// ── State Management ──
function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    log(`State read error: ${e.message}`);
  }
  return {
    status: 'active',
    mode: 'monitor', // 'monitor' | 'sandbox' (Bravo can set to sandbox)
    lastKnownHashes: {},
    responseTimeHistory: [],
    alerts: [],
    checkCount: 0,
    firstCheck: TODAY,
    bravoOverride: null,
  };
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (e) {
    log(`State write error: ${e.message}`);
    return false;
  }
}

function commitState() {
  try {
    execSync('git config user.name "Charlie Agent"');
    execSync('git config user.email "charlie-agent[bot]@users.noreply.github.com"');
    execSync('git add data/charlie-state.json');
    const output = execSync('git diff --cached --stat').toString().trim();
    if (output) {
      execSync(`git commit -m "security: charlie check - ${TODAY}"`);
      execSync('git push');
      log('State committed and pushed.');
    }
  } catch (e) {
    log(`Git error: ${e.message}`);
  }
}

// ── Email ──
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"Charlie Agent" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject: `[CHARLIE SECURITY] ${subject}`,
    html,
  });
}

// ── Main ──
async function main() {
  log('=== Charlie Agent v2 Started ===');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  // Read state — check if Bravo has overridden
  const state = readState();
  if (state.mode === 'sandbox') {
    log('SANDOX MODE: Bravo has placed Charlie in sandbox. Running read-only checks only.');
    if (state.bravoOverride) {
      log(`Reason: ${state.bravoOverride.reason}`);
    }
  }

  const allFindings = [];
  let homepageHash = null;
  let homepageStableHash = null;

  // 1. Fetch homepage
  log('Step 1: Fetching homepage...');
  try {
    const { status, body, responseTime } = await fetchUrl(SITE_URL);
    log(`  Status: ${status}, Size: ${body.length} bytes, Time: ${responseTime}ms`);

    // 2. Content integrity (stable hash + trusted domain whitelist)
    log('Step 2: Content integrity check...');
    const integrity = checkContentIntegrity(body, state);
    homepageHash = integrity.hash;
    homepageStableHash = integrity.stableHash;
    allFindings.push(...integrity.findings);
    if (integrity.findings.length === 0) log('  Content integrity: OK');

    // 3. Response time analysis
    log('Step 3: Response time analysis...');
    const timing = checkResponseTimes(responseTime, state);
    state.responseTimeHistory = timing.history;
    allFindings.push(...timing.findings);
    if (timing.findings.length === 0) log(`  Response time: ${responseTime}ms — normal`);

    // 4. Ghost page detection (returns array directly, NOT object)
    log('Step 4: Ghost page detection...');
    const ghostFindings = checkGhostPages(body, status);
    allFindings.push(...ghostFindings);
    if (ghostFindings.length === 0) log('  No ghost pages detected');

    // 5. Multi-page check
    log('Step 5: Multi-page check...');
    const pageResults = await checkMultiplePages();
    const failedPages = pageResults.filter(p => !p.ok);
    if (failedPages.length > 0) {
      allFindings.push({
        severity: failedPages.some(p => p.status === 0) ? 'HIGH' : 'MEDIUM',
        check: 'Page Availability',
        message: `${failedPages.length} page(s) failed: ${failedPages.map(p => `${p.name} (${p.status || 'unreachable'})`).join(', ')}`,
      });
    }
    log(`  Pages: ${pageResults.filter(p => p.ok).length}/${pageResults.length} OK`);
  } catch (e) {
    allFindings.push({
      severity: 'CRITICAL',
      check: 'Site Unreachable',
      message: `Cannot reach site: ${e.message}. Possible outage or attack.`,
    });
  }

  // Update state with stable hash (ignores Next.js build changes)
  if (homepageStableHash) state.lastKnownHashes.homepageStable = homepageStableHash;
  if (homepageHash) state.lastKnownHashes.homepageFull = homepageHash;
  // Backward compat: keep old key pointing to stable hash
  if (homepageStableHash) state.lastKnownHashes.homepage = homepageStableHash;
  state.checkCount++;
  state.lastCheck = TODAY;

  // Save alerts
  if (allFindings.length > 0) {
    state.alerts.push({
      date: TODAY,
      time: NOW.toISOString(),
      findings: allFindings.map(f => f.check),
    });
    // Keep last 50 alerts
    if (state.alerts.length > 50) state.alerts = state.alerts.slice(-50);
  }

  // Save and commit
  writeState(state);
  commitState();

  // Email report
  const critical = allFindings.filter(f => f.severity === 'CRITICAL');
  const high = allFindings.filter(f => f.severity === 'HIGH');
  const medium = allFindings.filter(f => f.severity === 'MEDIUM');
  const hasAlert = critical.length > 0 || high.length > 0;

  log(`Results: ${allFindings.length} findings (Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length})`);

  const severityColor = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04' };
  const severityBg = { CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fefce8' };

  const rows = allFindings.length > 0
    ? allFindings.map(f => `
        <div style="background:${severityBg[f.severity]};border-left:3px solid ${severityColor[f.severity]};padding:8px 12px;margin-bottom:6px;border-radius:0 6px 6px 0">
          <div style="font-size:12px;font-weight:bold;color:${severityColor[f.severity]}">${f.check}</div>
          <div style="font-size:12px;color:#374151;margin-top:2px">${f.message}</div>
        </div>`).join('')
    : '<div style="background:#f0fdf4;padding:12px;border-radius:6px;color:#16a34a;font-weight:bold;text-align:center">All Clear — No security anomalies detected</div>';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:650px;margin:0 auto;padding:20px">
<div style="background:${hasAlert ? '#dc2626' : '#059669'};color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">CHARLIE v2 — ${hasAlert ? 'SECURITY ALERT' : 'All Clear'}</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${TODAY} | Check #${state.checkCount} | Mode: ${state.mode.toUpperCase()}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div style="flex:1;background:#fef2f2;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#dc2626">${critical.length}</div><div style="font-size:10px;color:#6b7280">Critical</div></div>
    <div style="flex:1;background:#fff7ed;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#ea580c">${high.length}</div><div style="font-size:10px;color:#6b7280">High</div></div>
    <div style="flex:1;background:#fefce8;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#ca8a04">${medium.length}</div><div style="font-size:10px;color:#6b7280">Medium</div></div>
  </div>
  <h3 style="font-size:13px;margin:0 0 8px;color:#1e293b">Findings</h3>
  ${rows}
  <div style="font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:14px">
    <p style="margin:0">Charlie Agent v2 (Lightweight) | Reactive Phenotype | Next: Phase 2 Cloudflare Worker when revenue > $50/mo</p>
    <p style="margin:3px 0 0">See SECURITY-ROADMAP.md for full Watchman Protocol upgrade path</p>
  </div>
</div></div>`;

  try {
    await sendEmail(
      hasAlert ? `ALERT: ${critical.length} critical, ${high.length} high findings` : `All Clear — Check #${state.checkCount}`,
      html
    );
    log('Email sent.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Charlie Agent v2 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
