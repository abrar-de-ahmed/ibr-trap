#!/usr/bin/env node
/**
 * BG Remover Digital — Security Agent v2
 * Runs weekly (Monday 6:00 UTC) via GitHub Actions
 * INSTANT ALERT: If CRITICAL/HIGH found → email immediately
 * SCHEDULED: If all clear → email on scheduled Monday only (skip on manual dispatch)
 * Checks: npm audit, dependency vulnerabilities, secret scanning, config audit, security headers
 */

const https = require('https');
const { execSync } = require('child_process');
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const SITE_URL = 'https://bgremoverdigital.pages.dev';
const EVENT_NAME = process.env.GITHUB_EVENT_NAME || 'schedule'; // "schedule" or "workflow_dispatch"

function log(msg) {
  console.log(`[SecurityAgent v2 ${new Date().toISOString()}] ${msg}`);
}

// ── Run npm audit ──
function runNpmAudit() {
  log('Running npm audit...');
  try {
    const output = execSync('npm audit --json 2>/dev/null || true', {
      encoding: 'utf-8',
      timeout: 60000,
    });
    const audit = JSON.parse(output);
    return {
      vulnerabilities: audit.vulnerabilities || {},
      metadata: audit.metadata || {},
      dependencies: audit.metadata?.vulnerabilities || {},
    };
  } catch (e) {
    log(`npm audit error: ${e.message}`);
    return { vulnerabilities: {}, metadata: {}, dependencies: {}, error: e.message };
  }
}

// ── Check for secrets in code ──
function scanForSecrets() {
  log('Scanning for potential secrets...');
  const findings = [];
  const { readFileSync, readdirSync } = require('fs');
  const path = require('path');

  const secretPatterns = [
    { pattern: /sk_live_[a-zA-Z0-9]+/g, name: 'Stripe Live Secret Key' },
    { pattern: /sk_test_[a-zA-Z0-9]+/g, name: 'Stripe Test Secret Key' },
    { pattern: /rk_live_[a-zA-Z0-9]+/g, name: 'Stripe Live Publishable Key' },
    { pattern: /whsec_[a-zA-Z0-9]+/g, name: 'Stripe Webhook Secret' },
    { pattern: /AIza[0-9A-Za-z_-]{35}/g, name: 'Google API Key' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub Personal Access Token' },
    { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key' },
    { pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g, name: 'Private Key' },
  ];

  const dirsToScan = ['src', 'functions', 'scripts', '.github'];
  for (const dir of dirsToScan) {
    try {
      const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name);
        if (!['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yml', '.yaml'].includes(ext)) continue;

        try {
          const content = readFileSync(path.join(entry.path || dir, entry.name), 'utf-8');
          for (const { pattern, name } of secretPatterns) {
            if (pattern.test(content)) {
              findings.push({
                severity: 'CRITICAL',
                file: `${entry.path || dir}/${entry.name}`,
                type: name,
                message: `Potential ${name} found in source code. Move to environment variables!`,
              });
            }
            pattern.lastIndex = 0;
          }
        } catch (e) { /* skip unreadable files */ }
      }
    } catch (e) { /* dir doesn't exist */ }
  }

  return findings;
}

// ── Check .gitignore for sensitive files ──
function checkGitignore() {
  log('Checking .gitignore...');
  const findings = [];
  try {
    const gitignore = require('fs').readFileSync('.gitignore', 'utf-8');
    const required = ['.env', '.env.local', '.env.production', '*.key', '*.pem'];
    for (const pattern of required) {
      if (!gitignore.includes(pattern)) {
        findings.push({
          severity: 'MEDIUM',
          type: 'Gitignore Missing',
          message: `"${pattern}" is not in .gitignore. Sensitive files could be committed.`,
        });
      }
    }
  } catch (e) {
    findings.push({ severity: 'LOW', type: 'Gitignore Check', message: 'Could not read .gitignore' });
  }
  return findings;
}

// ── Check dependency count and outdated packages ──
function checkDependencies() {
  log('Checking dependencies...');
  const findings = [];
  try {
    const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const depCount = Object.keys(allDeps).length;
    if (depCount > 20) {
      findings.push({ severity: 'LOW', type: 'Dependency Count', message: `${depCount} dependencies. Consider pruning unused packages.` });
    }
  } catch (e) {
    findings.push({ severity: 'LOW', type: 'Dependency Check', message: 'Could not read package.json' });
  }
  return findings;
}

// ── Check Cloudflare Functions security headers ──
function checkSecurityHeaders() {
  log('Checking security headers via live site...');
  return new Promise((resolve) => {
    const req = https.get(SITE_URL, { timeout: 15000 }, (res) => {
      const findings = [];
      const headers = res.headers;

      const requiredHeaders = {
        'x-frame-options': 'DENY or SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'content-security-policy': 'Present',
      };

      for (const [header, expected] of Object.entries(requiredHeaders)) {
        if (!headers[header]) {
          findings.push({
            severity: header === 'content-security-policy' ? 'HIGH' : 'MEDIUM',
            type: 'Missing Security Header',
            message: `${header} is not set. Expected: ${expected}`,
          });
        }
      }

      resolve(findings);
    });
    req.on('error', () => resolve([{ severity: 'MEDIUM', type: 'Header Check', message: 'Could not connect to site for header check' }]));
    req.on('timeout', () => { req.destroy(); resolve([{ severity: 'MEDIUM', type: 'Header Check', message: 'Site request timed out' }]); });
  });
}

// ── Send Email ──
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"BG Remover Digital Security" <${GMAIL_USER}>`,
    to: ALERT_EMAIL,
    subject: `[BG Remover Security] ${subject}`,
    html,
  });
}

// ── Main ──
async function main() {
  log('=== Security Agent v2 Started ===');
  log(`Trigger: ${EVENT_NAME}`);

  if (!GMAIL_USER || !GMAIL_APP_PASS || !ALERT_EMAIL) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  const allFindings = [];

  // 1. npm audit
  log('Step 1: npm audit');
  const audit = runNpmAudit();
  const vulnCount = Object.keys(audit.vulnerabilities || {}).length;
  if (vulnCount > 0) {
    for (const [pkg, info] of Object.entries(audit.vulnerabilities)) {
      const via = info.via || [];
      const severity = (info.severity) || 'unknown';
      allFindings.push({
        severity: severity === 'critical' ? 'CRITICAL' : severity === 'high' ? 'HIGH' : severity === 'moderate' ? 'MEDIUM' : 'LOW',
        type: `Vulnerable Package: ${pkg}`,
        message: `Severity: ${severity}. Via: ${Array.isArray(via) ? via.map(v => typeof v === 'string' ? v : v.source || v.title || v.name).join(', ') : via}`,
      });
    }
    log(`  Found ${vulnCount} vulnerable packages`);
  } else {
    log('  No vulnerabilities found');
  }

  // 2. Secret scanning
  log('Step 2: Secret scanning');
  const secrets = scanForSecrets();
  allFindings.push(...secrets);
  log(`  Found ${secrets.length} secret findings`);

  // 3. Gitignore check
  log('Step 3: Gitignore check');
  const gitignoreIssues = checkGitignore();
  allFindings.push(...gitignoreIssues);
  log(`  Found ${gitignoreIssues.length} gitignore issues`);

  // 4. Dependency check
  log('Step 4: Dependency check');
  const depIssues = checkDependencies();
  allFindings.push(...depIssues);

  // 5. Security headers
  log('Step 5: Security headers');
  const headerIssues = await checkSecurityHeaders();
  allFindings.push(...headerIssues);
  log(`  Found ${headerIssues.length} header issues`);

  // ── Evaluate severity ──
  const critical = allFindings.filter(f => f.severity === 'CRITICAL');
  const high = allFindings.filter(f => f.severity === 'HIGH');
  const medium = allFindings.filter(f => f.severity === 'MEDIUM');
  const low = allFindings.filter(f => f.severity === 'LOW');
  const totalFindings = allFindings.length;
  const hasCriticalOrHigh = critical.length > 0 || high.length > 0;

  log(`Total findings: ${totalFindings} (Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length}, Low: ${low.length})`);

  // ── INSTANT ALERT LOGIC ──
  // CRITICAL/HIGH found → always email instantly (schedule or manual)
  // All clear → only email on scheduled Monday run (skip on manual dispatch)
  if (!hasCriticalOrHigh && EVENT_NAME === 'workflow_dispatch') {
    log('No CRITICAL/HIGH findings on manual trigger. Skipping email to avoid noise.');
    log('=== Security Agent v2 Finished ===');
    return;
  }

  const severityColor = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#2563eb' };
  const severityBg = { CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fefce8', LOW: '#eff6ff' };

  const findingsRows = allFindings.length > 0
    ? allFindings.map(f => `
        <tr style="background:${severityBg[f.severity]}">
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;font-weight:bold;color:${severityColor[f.severity]}">${f.severity}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${f.type}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${f.message}${f.file ? `<br><span style="color:#6b7280;font-size:11px">File: ${f.file}</span>` : ''}</td>
        </tr>`).join('')
    : '<tr><td colspan="3" style="padding:12px;text-align:center;color:#16a34a;font-weight:bold">No security issues found! All clear.</td></tr>';

  const statusColor = hasCriticalOrHigh ? '#dc2626' : '#16a34a';
  const statusText = hasCriticalOrHigh ? 'INSTANT ALERT - Action Required' : 'All Clear';
  const subjectPrefix = hasCriticalOrHigh ? 'INSTANT ALERT:' : '';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">
<div style="background:${statusColor};color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">${hasCriticalOrHigh ? 'SECURITY ALERT' : 'Weekly Security Report'}</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${new Date().toISOString().split('T')[0]} | ${statusText} | ${totalFindings} finding(s)</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="display:flex;gap:12px;margin-bottom:16px">
    <div style="flex:1;background:#fef2f2;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#dc2626">${critical.length}</div><div style="font-size:11px;color:#6b7280">Critical</div></div>
    <div style="flex:1;background:#fff7ed;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#ea580c">${high.length}</div><div style="font-size:11px;color:#6b7280">High</div></div>
    <div style="flex:1;background:#fefce8;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#ca8a04">${medium.length}</div><div style="font-size:11px;color:#6b7280">Medium</div></div>
    <div style="flex:1;background:#eff6ff;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#2563eb">${low.length}</div><div style="font-size:11px;color:#6b7280">Low</div></div>
  </div>
  <h3 style="font-size:14px;margin:0 0 8px;color:#374151">Detailed Findings</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr style="background:#f3f4f6"><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Severity</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Type</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Details</th></tr>
    ${findingsRows}
  </table>
  ${hasCriticalOrHigh ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-top:16px"><p style="margin:0;font-size:13px;color:#dc2626"><strong>INSTANT ALERT:</strong> Address Critical and High findings immediately. See <a href="https://github.com/abrar-de-ahmed/ibr-trap/actions">GitHub Actions</a> for details.</p></div>` : ''}
  <div style="font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px">
    <p style="margin:0">Checks: npm audit, secret scanning, gitignore audit, dependency review, security headers</p>
    <p style="margin:4px 0 0">Site: <a href="${SITE_URL}">${SITE_URL}</a> | Next scan: Next Monday 6:00 UTC</p>
  </div>
</div></div>`;

  try {
    await sendEmail(
      hasCriticalOrHigh ? `INSTANT ALERT: ${critical.length} critical, ${high.length} high findings` : 'Weekly Security Report - All Clear',
      html
    );
    log('Security report email sent.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Security Agent v2 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
