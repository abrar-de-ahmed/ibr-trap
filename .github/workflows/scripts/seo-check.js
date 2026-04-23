#!/usr/bin/env node
/**
 * BG Remover Digital — SEO Agent v2
 * Runs weekly (Wednesday 6:00 UTC) via GitHub Actions
 * INSTANT ALERT: If CRITICAL/HIGH found → email immediately
 * SCHEDULED: If all clear → email on scheduled Wednesday only (skip on manual dispatch)
 * Checks: indexability, meta tags, structured data, robots.txt, sitemap, performance
 */

const https = require('https');
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const SITE_URL = 'https://bgremoverdigital.pages.dev';
const EVENT_NAME = process.env.GITHUB_EVENT_NAME || 'schedule';

function log(msg) {
  console.log(`[SEOAuth v2 ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"BG Remover Digital SEO" <${GMAIL_USER}>`,
    to: ALERT_EMAIL,
    subject: `[BG Remover SEO] ${subject}`,
    html,
  });
}

// ── Check meta tags ──
function checkMetaTags(html) {
  const findings = [];

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title.length > 60) findings.push({ severity: 'MEDIUM', check: 'Title Length', message: `Title is ${title.length} chars (max 60 recommended for SERPs). Current: "${title}"` });
    else if (title.length < 30) findings.push({ severity: 'MEDIUM', check: 'Title Length', message: `Title is ${title.length} chars (too short, aim for 40-60). Current: "${title}"` });
    else findings.push({ severity: 'OK', check: 'Title Length', message: `Title is ${title.length} chars - optimal range.` });
  } else {
    findings.push({ severity: 'HIGH', check: 'Title Tag', message: 'Missing <title> tag! Critical for SEO.' });
  }

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    const desc = descMatch[1].trim();
    if (desc.length > 160) findings.push({ severity: 'MEDIUM', check: 'Meta Description', message: `Description is ${desc.length} chars (max 155-160). Truncated in SERPs.` });
    else if (desc.length < 120) findings.push({ severity: 'LOW', check: 'Meta Description', message: `Description is ${desc.length} chars. Could be more descriptive (aim 120-155).` });
    else findings.push({ severity: 'OK', check: 'Meta Description', message: `Description is ${desc.length} chars - optimal range.` });
  } else {
    findings.push({ severity: 'HIGH', check: 'Meta Description', message: 'Missing meta description! Search engines will auto-generate one.' });
  }

  if (!html.includes('viewport')) {
    findings.push({ severity: 'HIGH', check: 'Viewport Meta', message: 'Missing viewport meta tag. Mobile-first indexing requires it.' });
  } else {
    findings.push({ severity: 'OK', check: 'Viewport Meta', message: 'Viewport meta tag present.' });
  }

  if (!html.includes('rel="canonical"')) {
    findings.push({ severity: 'MEDIUM', check: 'Canonical URL', message: 'Missing canonical URL. Add to prevent duplicate content issues.' });
  } else {
    findings.push({ severity: 'OK', check: 'Canonical URL', message: 'Canonical URL present.' });
  }

  const ogTags = ['og:title', 'og:description', 'og:image', 'og:url'];
  const missingOg = ogTags.filter(t => !html.includes(`property="${t}"`) && !html.includes(`property='${t}'`));
  if (missingOg.length > 0) {
    findings.push({ severity: 'MEDIUM', check: 'Open Graph Tags', message: `Missing OG tags: ${missingOg.join(', ')}. Affects social media sharing.` });
  } else {
    findings.push({ severity: 'OK', check: 'Open Graph Tags', message: 'All major OG tags present.' });
  }

  if (!html.includes('twitter:card')) {
    findings.push({ severity: 'LOW', check: 'Twitter Card', message: 'Missing Twitter Card meta. Add for better Twitter/X previews.' });
  } else {
    findings.push({ severity: 'OK', check: 'Twitter Card', message: 'Twitter Card present.' });
  }

  if (!html.includes('application/ld+json')) {
    findings.push({ severity: 'MEDIUM', check: 'Structured Data', message: 'Missing JSON-LD structured data. Add WebApplication or SoftwareApplication schema.' });
  } else {
    findings.push({ severity: 'OK', check: 'Structured Data', message: 'JSON-LD structured data present.' });
  }

  return findings;
}

// ── Check robots.txt ──
async function checkRobotsTxt() {
  const findings = [];
  try {
    const { status, body } = await fetchUrl(`${SITE_URL}/robots.txt`);
    if (status !== 200) {
      findings.push({ severity: 'HIGH', check: 'robots.txt', message: `robots.txt returned HTTP ${status}. Expected 200.` });
    } else {
      if (!body.includes('Sitemap:')) {
        findings.push({ severity: 'MEDIUM', check: 'robots.txt', message: 'robots.txt does not declare sitemap location.' });
      }
      if (body.includes('Disallow: /')) {
        findings.push({ severity: 'CRITICAL', check: 'robots.txt', message: 'robots.txt has "Disallow: /" — entire site is blocked from crawlers!' });
      }
      if (body.includes('User-agent: *') && body.includes('Allow: /')) {
        findings.push({ severity: 'OK', check: 'robots.txt', message: 'robots.txt properly allows crawling.' });
      }
    }
  } catch (e) {
    findings.push({ severity: 'MEDIUM', check: 'robots.txt', message: `Could not fetch robots.txt: ${e.message}` });
  }
  return findings;
}

// ── Check sitemap.xml ──
async function checkSitemap() {
  const findings = [];
  try {
    const { status, body } = await fetchUrl(`${SITE_URL}/sitemap.xml`);
    if (status !== 200) {
      findings.push({ severity: 'HIGH', check: 'Sitemap', message: `sitemap.xml returned HTTP ${status}. Expected 200.` });
    } else {
      const urlCount = (body.match(/<loc>/g) || []).length;
      if (urlCount === 0) {
        findings.push({ severity: 'HIGH', check: 'Sitemap', message: 'Sitemap has zero URLs.' });
      } else {
        findings.push({ severity: 'OK', check: 'Sitemap', message: `Sitemap contains ${urlCount} URL(s).` });
      }
      if (!body.includes('bgremoverdigital.pages.dev')) {
        findings.push({ severity: 'MEDIUM', check: 'Sitemap', message: 'Sitemap URLs may not match live domain.' });
      }
    }
  } catch (e) {
    findings.push({ severity: 'MEDIUM', check: 'Sitemap', message: `Could not fetch sitemap: ${e.message}` });
  }
  return findings;
}

// ── Check page size and performance hints ──
function checkPerformance(html) {
  const findings = [];
  const htmlSize = Buffer.byteLength(html, 'utf-8');

  if (htmlSize > 500_000) {
    findings.push({ severity: 'HIGH', check: 'HTML Size', message: `HTML is ${(htmlSize / 1024).toFixed(0)}KB. Google prefers under 100KB for initial HTML.` });
  } else if (htmlSize > 100_000) {
    findings.push({ severity: 'MEDIUM', check: 'HTML Size', message: `HTML is ${(htmlSize / 1024).toFixed(0)}KB. Acceptable but could be optimized.` });
  } else {
    findings.push({ severity: 'OK', check: 'HTML Size', message: `HTML is ${(htmlSize / 1024).toFixed(0)}KB — good size for initial load.` });
  }

  const scriptTags = (html.match(/<script/g) || []).length;
  if (scriptTags > 15) {
    findings.push({ severity: 'MEDIUM', check: 'Scripts', message: `${scriptTags} script tags found. Consider code splitting for better Core Web Vitals.` });
  }

  return findings;
}

// ── Main ──
async function main() {
  log('=== SEO Agent v2 Started ===');
  log(`Trigger: ${EVENT_NAME}`);

  if (!GMAIL_USER || !GMAIL_APP_PASS || !ALERT_EMAIL) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  const allFindings = [];

  // 1. Fetch main page
  log('Step 1: Fetching main page...');
  let pageHtml = '';
  try {
    const { status, body } = await fetchUrl(SITE_URL);
    if (status !== 200) {
      allFindings.push({ severity: 'CRITICAL', check: 'Site Availability', message: `Site returned HTTP ${status}. SEO checks cannot continue.` });
      // INSTANT ALERT: Site down is always critical
      try {
        const alertHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#dc2626;color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">INSTANT ALERT - Site Down</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${new Date().toISOString()}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <p style="margin:0;font-size:14px;color:#dc2626"><strong>Site returned HTTP ${status}.</strong> SEO Agent cannot complete checks. Monitor Agent will auto-redeploy if needed.</p>
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">Site: <a href="${SITE_URL}">${SITE_URL}</a></p>
</div></div>`;
        await sendEmail('INSTANT ALERT: Site is DOWN (HTTP ' + status + ')', alertHtml);
        log('Instant alert sent: site down');
      } catch (e) { log(`Alert email error: ${e.message}`); }
      log('=== SEO Agent v2 Finished ===');
      return;
    }
    pageHtml = body;
  } catch (e) {
    allFindings.push({ severity: 'CRITICAL', check: 'Site Availability', message: `Cannot reach site: ${e.message}` });
    // INSTANT ALERT
    try {
      const alertHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#dc2626;color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">INSTANT ALERT - Site Unreachable</h2>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <p style="margin:0;color:#dc2626"><strong>${e.message}</strong></p>
</div></div>`;
      await sendEmail('INSTANT ALERT: Site unreachable', alertHtml);
      log('Instant alert sent: site unreachable');
    } catch (emailErr) { log(`Alert email error: ${emailErr.message}`); }
    return;
  }

  // 2-5. Run checks
  log('Step 2: Checking meta tags...');
  allFindings.push(...checkMetaTags(pageHtml));

  log('Step 3: Checking robots.txt...');
  allFindings.push(...await checkRobotsTxt());

  log('Step 4: Checking sitemap...');
  allFindings.push(...await checkSitemap());

  log('Step 5: Checking performance...');
  allFindings.push(...checkPerformance(pageHtml));

  // ── Evaluate severity ──
  const issues = allFindings.filter(f => f.severity !== 'OK');
  const ok = allFindings.filter(f => f.severity === 'OK');
  const critical = issues.filter(f => f.severity === 'CRITICAL');
  const high = issues.filter(f => f.severity === 'HIGH');
  const hasCriticalOrHigh = critical.length > 0 || high.length > 0;

  log(`Results: ${ok.length} OK, ${issues.length} issues (Critical: ${critical.length}, High: ${high.length})`);

  // ── INSTANT ALERT LOGIC ──
  // CRITICAL/HIGH found → always email instantly
  // All clear → only email on scheduled Wednesday run
  if (!hasCriticalOrHigh && EVENT_NAME === 'workflow_dispatch') {
    log('No CRITICAL/HIGH findings on manual trigger. Skipping email.');
    log('=== SEO Agent v2 Finished ===');
    return;
  }

  const severityColor = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#2563eb', OK: '#16a34a' };
  const severityBg = { CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fefce8', LOW: '#eff6ff', OK: '#f0fdf4' };

  const rows = allFindings.map(f => `
    <tr style="background:${severityBg[f.severity]}">
      <td style="padding:5px 8px;border:1px solid #ddd;font-size:12px;font-weight:bold;color:${severityColor[f.severity]}">${f.severity}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-size:12px;font-weight:600">${f.check}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-size:12px">${f.message}</td>
    </tr>`).join('');

  const statusColor = hasCriticalOrHigh ? '#ea580c' : '#16a34a';
  const statusText = hasCriticalOrHigh ? 'INSTANT ALERT - Needs Attention' : 'Healthy';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">
<div style="background:${statusColor};color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">${hasCriticalOrHigh ? 'SEO ALERT' : 'Weekly SEO Report'}</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${new Date().toISOString().split('T')[0]} | ${ok.length} passing, ${issues.length} issue(s)</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="display:flex;gap:12px;margin-bottom:16px">
    <div style="flex:1;background:#f0fdf4;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#16a34a">${ok.length}</div><div style="font-size:11px;color:#6b7280">Passing</div></div>
    <div style="flex:1;background:#fef2f2;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#dc2626">${critical.length}</div><div style="font-size:11px;color:#6b7280">Critical</div></div>
    <div style="flex:1;background:#fff7ed;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#ea580c">${high.length}</div><div style="font-size:11px;color:#6b7280">High</div></div>
    <div style="flex:1;background:#fefce8;padding:10px;border-radius:6px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#ca8a04">${issues.length - critical.length - high.length}</div><div style="font-size:11px;color:#6b7280">Medium/Low</div></div>
  </div>
  <h3 style="font-size:14px;margin:0 0 8px;color:#374151">All Checks</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr style="background:#f3f4f6"><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Status</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Check</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Details</th></tr>
    ${rows}
  </table>
  ${hasCriticalOrHigh ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:12px;margin-top:16px"><p style="margin:0;font-size:13px;color:#ea580c"><strong>INSTANT ALERT:</strong> Critical or High SEO issues need your attention immediately.</p></div>` : ''}
  <div style="font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px">
    <p style="margin:0">Checks: Title, Description, Viewport, Canonical, OG Tags, Twitter, JSON-LD, robots.txt, Sitemap, Performance</p>
    <p style="margin:4px 0 0">Site: <a href="${SITE_URL}">${SITE_URL}</a> | Next scan: Next Wednesday 6:00 UTC</p>
  </div>
</div></div>`;

  try {
    await sendEmail(
      hasCriticalOrHigh ? `INSTANT ALERT: ${issues.length} SEO issue(s) (${critical.length} critical)` : 'Weekly SEO Report - All Clear',
      html
    );
    log('SEO report email sent.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== SEO Agent v2 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
