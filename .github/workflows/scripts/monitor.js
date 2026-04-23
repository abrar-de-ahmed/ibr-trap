#!/usr/bin/env node
/**
 * BG Remover Digital Smart Monitor — GitHub Actions Version
 * Runs every 12 hours permanently on GitHub's servers
 * Checks site, diagnoses, auto-fixes, emails alerts
 */

const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');

const SITE_URL = 'https://bgremoverdigital.pages.dev';
const GITHUB_REPO = 'https://github.com/abrar-de-ahmed/ibr-trap';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_PROJECT = 'bgremoverdigital';
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;
const ALERT_EMAIL = process.env.ALERT_EMAIL;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 30000 }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        log(`  Following redirect to ${res.headers.location}`);
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout after 30s')); });
  });
}

function fetchWithRetry(url, retries, delayMs) {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await fetchUrl(url);
        resolve(result);
        return;
      } catch (e) {
        log(`  Attempt ${attempt}/${retries + 1} failed: ${e.message}`);
        if (attempt <= retries) {
          log(`  Retrying in ${delayMs / 1000}s...`);
          await sleep(delayMs);
        } else {
          reject(e);
        }
      }
    }
  });
}

async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"BG Remover Digital Monitor" <${GMAIL_USER}>`,
    to: ALERT_EMAIL,
    subject: `[BG Remover Digital Monitor] ${subject}`,
    html,
  });
}

// ── Smart Diagnosis Engine ──
function diagnose(failedChecks) {
  const diagnosis = [];
  const needsOwner = [];

  for (const check of failedChecks) {
    switch (check.name) {
      case 'HTTP Status':
        if (check.detail.includes('500') || check.detail.includes('502') || check.detail.includes('503')) {
          diagnosis.push({ severity: 'HIGH', issue: 'Server error', explanation: 'Cloudflare Pages returned a server error. Build may have failed.', autoFix: 'Triggering redeployment via Cloudflare API...', fixAction: 'redeploy' });
        } else if (check.detail.includes('404')) {
          diagnosis.push({ severity: 'HIGH', issue: 'Page not found (404)', explanation: 'Deployment may have been deleted or domain misconfigured.', autoFix: 'Triggering fresh deployment...', fixAction: 'redeploy' });
        } else if (check.detail.includes('Error:')) {
          diagnosis.push({ severity: 'CRITICAL', issue: 'Site unreachable', explanation: 'Could not connect. DNS may be down or Cloudflare having outage.', autoFix: 'Will retry next cycle. No auto-fix for network issues.', fixAction: 'none', needsOwner: true });
          needsOwner.push('Site is completely unreachable. Check Cloudflare dashboard for bgremoverdigital.pages.dev status.');
        }
        break;
      case 'Content - Title':
        diagnosis.push({ severity: 'MEDIUM', issue: 'Main heading missing', explanation: '"Background Image Remover" not in HTML. Build output may be corrupted.', autoFix: 'Triggering redeployment...', fixAction: 'redeploy' });
        break;
      case 'Content - Upload Zone':
        diagnosis.push({ severity: 'MEDIUM', issue: 'Upload dropzone missing', explanation: 'Upload area not rendered. React component may have failed to hydrate.', autoFix: 'Triggering redeployment...', fixAction: 'redeploy' });
        break;
      case 'Content - CTA Button':
        diagnosis.push({ severity: 'LOW', issue: 'CTA text not found', explanation: '"500 images for just $9" missing. May be a code issue.', autoFix: 'None — requires code review.', fixAction: 'none', needsOwner: true });
        needsOwner.push('Review src/app/page.tsx — checkout integration may need updating.');
        break;
      case 'Content - Buy CTA':
        diagnosis.push({ severity: 'LOW', issue: 'Buy button missing', explanation: '"Need more" or "Buy Now" not in HTML.', autoFix: 'Triggering redeployment...', fixAction: 'redeploy' });
        break;
      case 'Response Time':
        diagnosis.push({ severity: 'MEDIUM', issue: 'Site slow', explanation: `Response took ${check.detail}. Could be cold start or heavy JS bundle.`, autoFix: 'None — monitor for consistency.', fixAction: 'none' });
        break;
      case 'SSL/HTTPS':
        diagnosis.push({ severity: 'CRITICAL', issue: 'SSL failure', explanation: 'Site unreachable over HTTPS. Visitors see security warnings.', autoFix: 'Check CF SSL settings — needs dashboard access.', fixAction: 'none', needsOwner: true });
        needsOwner.push('Check SSL/TLS in Cloudflare dashboard for bgremoverdigital.pages.dev. Set SSL mode to "Full".');
        break;
    }
  }

  return { diagnosis, needsOwner };
}

// ── Auto-Fix: Trigger CF Redeployment ──
async function triggerRedeployment() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    log('  No CF credentials — skipping auto-redeploy');
    return false;
  }
  try {
    const data = JSON.stringify({ is_manual_deploy: true });
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PROJECT}/deployments`;
    const result = await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    if (result.success) {
      log('  Redeployment triggered successfully');
      return true;
    } else {
      log(`  CF API error: ${JSON.stringify(result.errors)}`);
      return false;
    }
  } catch (e) {
    log(`  Redeploy failed: ${e.message}`);
    return false;
  }
}

// ── Run All Checks ──
async function runChecks() {
  const results = [];

  // 1. HTTP Status with retry
  log('Check 1: HTTP Status');
  try {
    const { status } = await fetchWithRetry(SITE_URL, 2, 10000);
    results.push({ name: 'HTTP Status', passed: status === 200, detail: `Status: ${status}` });
  } catch (e) {
    results.push({ name: 'HTTP Status', passed: false, detail: `Error: ${e.message}` });
  }

  // 2. Content Checks
  log('Check 2: Content');
  try {
    const { status, body } = await fetchUrl(SITE_URL);
    if (status !== 200) {
      ['Title', 'Upload Zone', 'CTA Button', 'Buy CTA'].forEach(n => {
        results.push({ name: `Content - ${n}`, passed: false, detail: `HTTP ${status}` });
      });
    } else {
      results.push({ name: 'Content - Title', passed: body.includes('Background Image Remover'), detail: body.includes('Background Image Remover') ? 'Found' : 'MISSING' });
      results.push({ name: 'Content - Upload Zone', passed: body.includes('Drop your image'), detail: body.includes('Drop your image') ? 'Found' : 'MISSING' });
      results.push({ name: 'Content - CTA Button', passed: body.includes('500 images for just $9'), detail: body.includes('500 images for just $9') ? 'Found' : 'MISSING' });
      results.push({ name: 'Content - Buy CTA', passed: body.includes('Need more') || body.includes('Buy Now'), detail: (body.includes('Need more') || body.includes('Buy Now')) ? 'Found' : 'MISSING' });
    }
  } catch (e) {
    results.push({ name: 'Content Check', passed: false, detail: `Error: ${e.message}` });
  }

  // 3. Response Time
  log('Check 3: Response Time');
  try {
    const start = Date.now();
    await fetchUrl(SITE_URL);
    const elapsed = Date.now() - start;
    results.push({ name: 'Response Time', passed: elapsed < 10000, detail: `${elapsed}ms` });
  } catch (e) {
    results.push({ name: 'Response Time', passed: false, detail: `Error: ${e.message}` });
  }

  // 4. SSL
  log('Check 4: SSL');
  try {
    const { status } = await fetchUrl(SITE_URL);
    results.push({ name: 'SSL/HTTPS', passed: status > 0, detail: status > 0 ? 'Valid' : 'Failed' });
  } catch (e) {
    results.push({ name: 'SSL/HTTPS', passed: false, detail: `Error: ${e.message}` });
  }

  return results;
}

// ── Main ──
async function main() {
  log('=== BG Remover Digital Monitor Started ===');

  // Validate env
  if (!GMAIL_USER || !GMAIL_APP_PASS || !ALERT_EMAIL) {
    log('ERROR: Missing email credentials. Set GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL secrets.');
    process.exit(1);
  }

  const checks = await runChecks();
  const failed = checks.filter(r => !r.passed);
  const allPassed = failed.length === 0;

  log(`Results: ${checks.length} checks, ${failed.length} failed`);
  checks.forEach(r => log(`  ${r.passed ? 'PASS' : 'FAIL'}: ${r.name} - ${r.detail}`));

  if (!allPassed) {
    // Smart diagnosis
    log('Running diagnosis...');
    const { diagnosis, needsOwner } = diagnose(failed);
    diagnosis.forEach(d => log(`  [${d.severity}] ${d.issue}: ${d.explanation}`));

    // Auto-fix: redeploy if needed
    let fixResults = [];
    if (diagnosis.some(d => d.fixAction === 'redeploy')) {
      log('Auto-fix: triggering redeployment...');
      const redeployed = await triggerRedeployment();
      fixResults.push({ action: 'Redeployment', status: redeployed ? 'Triggered' : 'Failed' });

      if (redeployed) {
        log('Waiting 90s for deployment, then re-checking...');
        await sleep(90000);
        log('Re-checking...');
        const recheck = await runChecks();
        const stillFailing = recheck.filter(r => !r.passed);
        log(`Re-check: ${stillFailing.length} still failing`);
        fixResults.push({
          action: 'Verification',
          status: stillFailing.length === 0 ? 'All fixed' : `${stillFailing.length} still failing`,
          stillFailing: stillFailing.map(r => `${r.name}: ${r.detail}`),
        });
      }
    }

    // Build email
    const checkRows = checks.map(r =>
      `<tr style="background:${r.passed ? '#dcfce7' : '#fee2e2'}"><td style="padding:6px 8px;border:1px solid #ddd;font-size:13px">${r.name}</td><td style="padding:6px 8px;border:1px solid #ddd;font-size:13px;color:${r.passed ? '#16a34a' : '#dc2626'};font-weight:bold">${r.passed ? 'PASS' : 'FAIL'}</td><td style="padding:6px 8px;border:1px solid #ddd;font-size:13px">${r.detail}</td></tr>`
    ).join('');

    const diagRows = diagnosis.map(d =>
      `<tr style="background:${d.severity === 'CRITICAL' ? '#fef2f2' : d.severity === 'HIGH' ? '#fff7ed' : '#fefce8'}"><td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;font-weight:bold;color:${d.severity === 'CRITICAL' ? '#dc2626' : d.severity === 'HIGH' ? '#ea580c' : '#ca8a04'}">${d.severity}</td><td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${d.issue}</td><td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${d.explanation}</td></tr>`
    ).join('');

    const fixHtml = fixResults.map(f =>
      `<li style="font-size:13px"><strong>${f.action}</strong>: ${f.status}${f.stillFailing ? '<br><span style="color:#dc2626">Still: ' + f.stillFailing.join(', ') + '</span>' : ''}</li>`
    ).join('');

    const ownerHtml = needsOwner.map(a => `<li style="font-size:13px;color:#dc2626">${a}</li>`).join('');

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<div style="background:#dc2626;color:white;padding:12px 16px;border-radius:8px 8px 0 0">
<h2 style="margin:0;font-size:18px">BG Remover Digital Monitor Alert</h2>
<p style="margin:4px 0 0;font-size:13px;opacity:0.9">${failed.length} of ${checks.length} checks failed at ${new Date().toISOString()}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
<h3 style="font-size:14px;margin:0 0 8px;color:#374151">Check Results</h3>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px">
<tr style="background:#f3f4f6"><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px">Check</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px">Status</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px">Detail</th></tr>
${checkRows}</table>
<h3 style="font-size:14px;margin:0 0 8px;color:#374151">Diagnosis</h3>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px">
<tr style="background:#f3f4f6"><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px">Severity</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px">Issue</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px">Explanation</th></tr>
${diagRows}</table>
${fixResults.length ? `<h3 style="font-size:14px;margin:0 0 8px;color:#374151">Auto-Fix Actions</h3><ul style="margin:0 0 16px;padding-left:20px">${fixHtml}</ul>` : ''}
${needsOwner.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-bottom:16px"><h3 style="font-size:14px;margin:0 0 8px;color:#dc2626">Needs Your Attention</h3><ul style="margin:0;padding-left:20px">${ownerHtml}</ul></div>` : ''}
<div style="font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px">
<p style="margin:0"><strong>Site:</strong> <a href="${SITE_URL}">${SITE_URL}</a> | <strong>GitHub:</strong> <a href="${GITHUB_REPO}">${GITHUB_REPO}</a></p>
<p style="margin:4px 0 0">Next check in 12 hours. Trigger manual run: GitHub Actions tab in repo.</p>
</div></div></div>`;

    try {
      await sendEmail(`ALERT - ${failed.length} check(s) failed + diagnosis`, html);
      log('Alert email sent.');
    } catch (e) {
      log(`Email error: ${e.message}`);
    }

  } else {
    log('All checks passed.');
    // Weekly OK on Sunday
    if (new Date().getDay() === 0) {
      try {
        await sendEmail('Weekly Status - All OK', `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px"><div style="background:#16a34a;color:white;padding:12px 16px;border-radius:8px 8px 0 0"><h2 style="margin:0;font-size:18px">BG Remover Digital Weekly Health Report</h2></div><div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px"><p style="margin:0 0 8px">All <strong>${checks.length}</strong> checks passed at <strong>${new Date().toISOString()}</strong></p><p style="margin:0;font-size:13px;color:#6b7280">Site: <a href="${SITE_URL}">${SITE_URL}</a></p></div></div>`);
        log('Weekly OK email sent.');
      } catch (e) { log(`Weekly email error: ${e.message}`); }
    }
  }

  log('=== BG Remover Digital Monitor Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
