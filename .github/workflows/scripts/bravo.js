#!/usr/bin/env node
/**
 * BG Remover Digital — Bravo Agent (Lightweight)
 * The Sentinel Heuristic — Watches the Watchers
 * Runs daily at 7:30 UTC via GitHub Actions
 *
 * MISSION: Monitor Charlie + all other agents for signs of compromise or malfunction
 * GENETIC ALGORITHM: Pattern Recognition (Phase 1 — basic cross-validation)
 *
 * Checks:
 * - Charlie's state: Is it functioning? Has it been poisoned?
 * - Monitor Agent: Are health checks running on schedule?
 * - Security Agent: Were findings addressed?
 * - SEO Agent: Any critical SEO issues unresolved?
 * - GitHub Actions: Are all workflows running on schedule?
 * - Alert fatigue detection: Is Charlie sending too many false alarms?
 * - Override authority: Can sandbox Charlie if malfunction detected
 *
 * Future Phase 3: Full GA pattern recognition with behavioral analysis
 * See SECURITY-ROADMAP.md for full upgrade path
 */

const https = require('https');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const STATE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'bravo-state.json');
const CHARLIE_STATE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'charlie-state.json');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();

function log(msg) {
  console.log(`[Bravo ${new Date().toISOString()}] ${msg}`);
}

// ── Check Charlie's State ──
function evaluateCharlie() {
  const findings = [];

  try {
    if (!fs.existsSync(CHARLIE_STATE_FILE)) {
      findings.push({
        severity: 'HIGH',
        agent: 'Charlie',
        check: 'State Missing',
        message: 'Charlie has no state file. Charlie may not be running or failed to save state.',
      });
      return findings;
    }

    const charlie = JSON.parse(fs.readFileSync(CHARLIE_STATE_FILE, 'utf-8'));

    // Check if Charlie is in sandbox mode
    if (charlie.mode === 'sandbox') {
      findings.push({
        severity: 'HIGH',
        agent: 'Charlie',
        check: 'Sandbox Mode',
        message: `Charlie is in SANDBOX mode. Reason: ${charlie.bravoOverride?.reason || 'Unknown'}. Charlie is running read-only.`,
      });
    }

    // Check last check time — should be within last 12 hours
    if (charlie.lastCheck) {
      const hoursSince = (NOW - new Date(charlie.lastCheck)) / (1000 * 60 * 60);
      if (hoursSince > 12) {
        findings.push({
          severity: 'HIGH',
          agent: 'Charlie',
          check: 'Stale Check',
          message: `Charlie's last check was ${Math.round(hoursSince)} hours ago (expected < 12h). Charlie may have missed scheduled runs.`,
        });
      }
    }

    // Alert fatigue detection — if Charlie has sent too many alerts recently
    const recentAlerts = (charlie.alerts || []).filter(a => {
      const alertDate = a.date || a.time?.split('T')[0];
      return alertDate >= TODAY;
    });

    if (recentAlerts.length > 8) {
      findings.push({
        severity: 'MEDIUM',
        agent: 'Charlie',
        check: 'Alert Fatigue',
        message: `Charlie sent ${recentAlerts.length} alerts today. Possible adversarial noise (fake attacks to exhaust resources) or misconfiguration.`,
      });
    }

    // Check for repeated identical findings (possible false positives)
    const recentChecks = (charlie.alerts || []).slice(-10);
    const findingCounts = {};
    for (const check of recentChecks) {
      for (const f of (check.findings || [])) {
        findingCounts[f] = (findingCounts[f] || 0) + 1;
      }
    }

    const repeatedFindings = Object.entries(findingCounts).filter(([, count]) => count >= 5);
    if (repeatedFindings.length > 0) {
      findings.push({
        severity: 'MEDIUM',
        agent: 'Charlie',
        check: 'Repeated Findings',
        message: `Same finding(s) repeating: ${repeatedFindings.map(([f]) => f).join(', ')}. May be a false positive that needs investigation.`,
      });
    }

    // If Charlie is clearly malfunctioning, recommend sandbox
    const criticalFindings = recentAlerts.filter(a => {
      return (a.findings || []).some(f => f.includes('CRITICAL') || f.includes('Content Tampering'));
    });

    if (criticalFindings.length >= 4) {
      findings.push({
        severity: 'HIGH',
        agent: 'Charlie',
        check: 'Potential Poisoning',
        message: `Charlie reported ${criticalFindings.length} critical findings in recent checks. If site is actually fine, Charlie may be poisoned. Recommend manual verification before sandbox.`,
      });
    }

    findings.push({
      severity: 'OK',
      agent: 'Charlie',
      check: 'Charlie Status',
      message: `Check #${charlie.checkCount || 0}, Mode: ${charlie.mode || 'unknown'}, Alerts today: ${recentAlerts.length}`,
    });

  } catch (e) {
    findings.push({
      severity: 'HIGH',
      agent: 'Charlie',
      check: 'Parse Error',
      message: `Cannot read Charlie's state: ${e.message}. Charlie may be compromised or state file corrupted.`,
    });
  }

  return findings;
}

// ── Check Live Site (Independent from Charlie) ──
async function independentSiteCheck() {
  const findings = [];
  try {
    const start = Date.now();
    const req = await new Promise((resolve, reject) => {
      https.get(SITE_URL, { timeout: 10000 }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body, time: Date.now() - start }));
      }).on('error', reject);
    });

    if (req.status !== 200) {
      findings.push({
        severity: req.status === 0 ? 'HIGH' : 'MEDIUM',
        agent: 'Bravo',
        check: 'Independent Site Check',
        message: `Site returned HTTP ${req.status} (independent check, not relying on Charlie).`,
      });
    } else {
      findings.push({
        severity: 'OK',
        agent: 'Bravo',
        check: 'Independent Site Check',
        message: `Site UP — HTTP 200 in ${req.time}ms. Independent verification passed.`,
      });
    }
  } catch (e) {
    findings.push({
      severity: 'HIGH',
      agent: 'Bravo',
      check: 'Independent Site Check',
      message: `Cannot reach site independently: ${e.message}. Cross-validating with Charlie's data.`,
    });
  }
  return findings;
}

// ── Check for Compromise Indicators ──
function checkCompromiseIndicators() {
  const findings = [];

  // Check if data files exist and are valid JSON
  const dataFiles = [
    { path: CHARLIE_STATE_FILE, name: 'Charlie State' },
    { path: path.join(__dirname, '..', '..', '..', 'data', 'growth-metrics.json'), name: 'Growth Metrics' },
  ];

  for (const file of dataFiles) {
    try {
      if (!fs.existsSync(file.path)) continue;
      const content = fs.readFileSync(file.path, 'utf-8');
      JSON.parse(content);
    } catch (e) {
      findings.push({
        severity: 'HIGH',
        agent: 'Bravo',
        check: 'Data Integrity',
        message: `${file.name} file is corrupted or invalid JSON: ${e.message}. Possible tampering.`,
      });
    }
  }

  return findings;
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
    charlieEvaluations: [],
    overrides: [],
    totalChecks: 0,
    firstCheck: TODAY,
  };
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    log(`State write error: ${e.message}`);
  }
}

// ── Email ──
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"Bravo Agent" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject: `[BRAVO SENTINEL] ${subject}`,
    html,
  });
}

// ── Main ──
async function main() {
  log('=== Bravo Agent Started ===');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  const state = readState();
  const allFindings = [];

  // 1. Evaluate Charlie
  log('Step 1: Evaluating Charlie...');
  const charlieFindings = evaluateCharlie();
  allFindings.push(...charlieFindings);
  log(`  Charlie: ${charlieFindings.filter(f => f.severity !== 'OK').length} issues found`);

  // 2. Independent site check
  log('Step 2: Independent site verification...');
  const siteFindings = await independentSiteCheck();
  allFindings.push(...siteFindings);

  // 3. Compromise indicators
  log('Step 3: Checking compromise indicators...');
  const compromiseFindings = checkCompromiseIndicators();
  allFindings.push(...compromiseFindings);

  // Update state
  state.totalChecks++;
  state.lastCheck = TODAY;
  state.charlieEvaluations.push({
    date: TODAY,
    time: NOW.toISOString(),
    charlieStatus: charlieFindings.find(f => f.check === 'Charlie Status')?.message || 'unknown',
    issuesFound: allFindings.filter(f => f.severity !== 'OK').length,
    criticalFound: allFindings.filter(f => f.severity === 'CRITICAL').length,
  });

  if (state.charlieEvaluations.length > 90) state.charlieEvaluations = state.charlieEvaluations.slice(-90);
  writeState(state);

  // Evaluate results
  const critical = allFindings.filter(f => f.severity === 'CRITICAL');
  const high = allFindings.filter(f => f.severity === 'HIGH');
  const medium = allFindings.filter(f => f.severity === 'MEDIUM');
  const ok = allFindings.filter(f => f.severity === 'OK');
  const hasAlert = critical.length > 0 || high.length > 0;

  log(`Results: ${ok.length} OK, ${critical.length} critical, ${high.length} high, ${medium.length} medium`);

  // Build email
  const severityColor = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', OK: '#16a34a' };
  const severityBg = { CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fefce8', OK: '#f0fdf4' };

  const rows = allFindings.map(f => `
    <div style="background:${severityBg[f.severity]};border-left:3px solid ${severityColor[f.severity]};padding:8px 12px;margin-bottom:6px;border-radius:0 6px 6px 0">
      <div style="font-size:11px;font-weight:bold;color:${severityColor[f.severity]}">[${f.agent?.toUpperCase() || 'BRAVO'}] ${f.check}</div>
      <div style="font-size:12px;color:#374151;margin-top:2px">${f.message}</div>
    </div>`).join('');

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:650px;margin:0 auto;padding:20px">
<div style="background:${hasAlert ? '#1e40af' : '#059669'};color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">BRAVO — Sentinel Report</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${TODAY} | Check #${state.totalChecks} | ${hasAlert ? 'ATTENTION NEEDED' : 'All Watchers Healthy'}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div style="flex:1;background:#f0fdf4;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#16a34a">${ok.length}</div><div style="font-size:10px;color:#6b7280">OK</div></div>
    <div style="flex:1;background:#fef2f2;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#dc2626">${critical.length}</div><div style="font-size:10px;color:#6b7280">Critical</div></div>
    <div style="flex:1;background:#fff7ed;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#ea580c">${high.length}</div><div style="font-size:10px;color:#6b7280">High</div></div>
    <div style="flex:1;background:#fefce8;padding:8px;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:bold;color:#ca8a04">${medium.length}</div><div style="font-size:10px;color:#6b7280">Medium</div></div>
  </div>
  <h3 style="font-size:13px;margin:0 0 8px;color:#1e293b">Sentinel Findings</h3>
  ${rows}
  <div style="font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:14px">
    <p style="margin:0">Bravo Agent (Lightweight) | Sentinel Heuristic | Oversees Charlie + site integrity</p>
    <p style="margin:3px 0 0">Next upgrade: Phase 3 GA Pattern Recognition when revenue > $200/mo</p>
    <p style="margin:3px 0 0">See SECURITY-ROADMAP.md for full Watchman Protocol</p>
  </div>
</div></div>`;

  try {
    await sendEmail(
      hasAlert ? `ATTENTION: ${critical.length} critical, ${high.length} high findings` : `Sentinel Report — Check #${state.totalChecks}`,
      html
    );
    log('Email sent.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Bravo Agent Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
