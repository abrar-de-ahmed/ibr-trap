#!/usr/bin/env node
/**
 * BG Remover Digital — PM Agent v1
 * Runs weekly (Friday 6:00 UTC) via GitHub Actions
 * Generates: Site health report, Stripe revenue summary, deployment status,
 * agent status overview, and actionable weekly summary
 * All data is gathered via public APIs and Stripe API
 */

const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const SITE_URL = 'https://bgremoverdigital.pages.dev';
const CF_PROJECT = 'bgremoverdigital';
const GITHUB_REPO = 'abrar-de-ahmed/ibr-trap';

function log(msg) {
  console.log(`[PMAgent ${new Date().toISOString()}] ${msg}`);
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 30000, ...options }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
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
    from: `"BG Remover Digital PM" <${GMAIL_USER}>`,
    to: ALERT_EMAIL,
    subject: `[BG Remover PM] ${subject}`,
    html,
  });
}

// ── Get Stripe Revenue Data ──
async function getStripeRevenue() {
  if (!STRIPE_SECRET_KEY) {
    return { error: 'Stripe key not configured' };
  }

  try {
    // Get checkout sessions from last 7 days
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const url = `https://api.stripe.com/v1/checkout/sessions?created[gte]=${sevenDaysAgo}&payment_status=paid&limit=100`;
    const auth = Buffer.from(STRIPE_SECRET_KEY + ':').toString('base64');

    const result = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        timeout: 15000,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Stripe timeout')); });
    });

    const sessions = result.data || [];
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.amount_total || 0), 0);
    const uniqueCustomers = new Set(sessions.map(s => s.customer_details?.email || s.customer_email).filter(Boolean));

    return {
      totalSessions: sessions.length,
      totalRevenue: totalRevenue / 100,
      uniqueCustomers: uniqueCustomers.size,
      sessions: sessions.map(s => ({
        id: s.id?.slice(-8),
        email: s.customer_details?.email || s.customer_email || 'N/A',
        amount: (s.amount_total || 0) / 100,
        date: new Date(s.created * 1000).toISOString().split('T')[0],
      })),
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Get CF Deployment Status ──
async function getDeploymentStatus() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    return { error: 'CF credentials not configured' };
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PROJECT}/deployments?per_page=5`;
    const result = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
        timeout: 15000,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('CF timeout')); });
    });

    if (!result.success) return { error: 'CF API error' };

    const deployments = result.result || [];
    const latest = deployments[0];
    return {
      latestDeploy: latest ? {
        id: latest.id?.slice(-8),
        status: latest.latest_stage?.name || latest.status,
        created: latest.created_on,
        url: latest.url,
      } : null,
      totalDeployments: deployments.length,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Site Health Check ──
async function checkSiteHealth() {
  try {
    const start = Date.now();
    const { status, body } = await fetchUrl(SITE_URL);
    const loadTime = Date.now() - start;

    return {
      online: status === 200,
      statusCode: status,
      loadTime,
      hasContent: body.includes('Background Image Remover') && body.includes('Drop your image'),
    };
  } catch (e) {
    return { online: false, error: e.message };
  }
}

// ── Main ──
async function main() {
  log('=== PM Agent v1 Started ===');

  if (!GMAIL_USER || !GMAIL_APP_PASS || !ALERT_EMAIL) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  // Gather all data in parallel
  log('Gathering data...');
  const [siteHealth, stripeData, deployStatus] = await Promise.all([
    checkSiteHealth(),
    getStripeRevenue(),
    getDeploymentStatus(),
  ]);

  log(`Site: ${siteHealth.online ? 'ONLINE' : 'DOWN'}, Revenue: $${stripeData.totalRevenue || 0}, Deploy: ${deployStatus.latestDeploy?.status || 'unknown'}`);

  // Build revenue table
  let revenueHtml = '';
  if (stripeData.error) {
    revenueHtml = `<p style="color:#ca8a04;font-size:13px">Could not fetch revenue data: ${stripeData.error}. Add STRIPE_SECRET_KEY to GitHub Actions secrets.</p>`;
  } else if (stripeData.totalSessions === 0) {
    revenueHtml = `<p style="color:#6b7280;font-size:13px">No paid transactions in the last 7 days.</p>`;
  } else {
    const rows = stripeData.sessions.map(s => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px">${s.date}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px">${s.email}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px;font-weight:bold">$${s.amount.toFixed(2)}</td>
      </tr>`).join('');
    revenueHtml = `
      <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        <tr style="background:#f3f4f6"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Date</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Email</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Amount</th></tr>
        ${rows}
      </table>`;
  }

  // Agent status
  const agents = [
    { name: 'Monitor Agent', schedule: 'Every 12 hours', status: siteHealth.online ? 'Active' : 'Alerting', icon: siteHealth.online ? '🟢' : '🔴' },
    { name: 'Security Agent', schedule: 'Weekly (Monday)', status: 'Scheduled', icon: '🟢' },
    { name: 'SEO Agent', schedule: 'Weekly (Wednesday)', status: 'Scheduled', icon: '🟢' },
    { name: 'PM Agent (this report)', schedule: 'Weekly (Friday)', status: 'Running now', icon: '🔵' },
  ];
  const agentRows = agents.map(a => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:13px">${a.icon} ${a.name}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:13px">${a.schedule}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:13px;font-weight:600">${a.status}</td>
    </tr>`).join('');

  // Recommendations
  const week = new Date().getWeekNumber ? `Week ${Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 000))}` : '';
  const recommendations = [];
  if (!stripeData.error && stripeData.totalSessions === 0) {
    recommendations.push('No revenue this week. Consider: (1) Share on social media, (2) Submit to directories, (3) Start SEO content creation');
  }
  if (stripeData.totalRevenue > 0 && stripeData.totalRevenue < 50) {
    recommendations.push('Good start! Consider: (1) Optimize CTA placement, (2) Add testimonials, (3) Create comparison content for SEO');
  }
  if (stripeData.totalRevenue >= 50) {
    recommendations.push('Strong week! Consider: (1) Reinvest in ads, (2) Add more SEO pages, (3) Plan feature expansion');
  }
  if (siteHealth.loadTime > 3000) {
    recommendations.push(`Site load time is ${siteHealth.loadTime}ms. Consider optimizing assets.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Everything looks good! Focus on content creation and link building.');
  }

  const recHtml = recommendations.map(r => `<li style="font-size:13px;margin-bottom:4px">${r}</li>`).join('');

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">
<div style="background:#6d28d9;color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">BG Remover Digital - Weekly PM Report</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${new Date().toISOString().split('T')[0]} | Automated Weekly Summary</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">

  <!-- KPI Cards -->
  <div style="display:flex;gap:12px;margin-bottom:20px">
    <div style="flex:1;background:#f0fdf4;padding:14px;border-radius:8px;text-align:center;border:1px solid #bbf7d0">
      <div style="font-size:28px;font-weight:bold;color:#16a34a">${siteHealth.online ? 'UP' : 'DOWN'}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">Site Status</div>
      <div style="font-size:11px;color:#9ca3af">${siteHealth.loadTime || '?'}ms</div>
    </div>
    <div style="flex:1;background:#eff6ff;padding:14px;border-radius:8px;text-align:center;border:1px solid #bfdbfe">
      <div style="font-size:28px;font-weight:bold;color:#2563eb">$${(stripeData.totalRevenue || 0).toFixed(2)}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">Revenue (7d)</div>
      <div style="font-size:11px;color:#9ca3af">${stripeData.uniqueCustomers || 0} customer(s)</div>
    </div>
    <div style="flex:1;background:#faf5ff;padding:14px;border-radius:8px;text-align:center;border:1px solid #e9d5ff">
      <div style="font-size:28px;font-weight:bold;color:#7c3aed">${stripeData.totalSessions || 0}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">Transactions</div>
      <div style="font-size:11px;color:#9ca3af">Last 7 days</div>
    </div>
    <div style="flex:1;background:#fff7ed;padding:14px;border-radius:8px;text-align:center;border:1px solid #fed7aa">
      <div style="font-size:28px;font-weight:bold;color:#ea580c">${deployStatus.latestDeploy?.status === 'active' ? 'LIVE' : '—'}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">Deploy Status</div>
      <div style="font-size:11px;color:#9ca3af">${deployStatus.latestDeploy?.id || '?'}</div>
    </div>
  </div>

  <!-- Revenue Details -->
  <h3 style="font-size:14px;margin:0 0 8px;color:#374151">Revenue Details</h3>
  ${revenueHtml}

  <!-- Agent Status -->
  <h3 style="font-size:14px;margin:16px 0 8px;color:#374151">Agent Status Dashboard</h3>
  <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
    <tr style="background:#f3f4f6"><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Agent</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Schedule</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Status</th></tr>
    ${agentRows}
  </table>

  <!-- Recommendations -->
  <h3 style="font-size:14px;margin:0 0 8px;color:#374151">Recommendations</h3>
  <ul style="margin:0 0 16px;padding-left:20px">${recHtml}</ul>

  <div style="font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px">
    <p style="margin:0"><strong>Site:</strong> <a href="${SITE_URL}">${SITE_URL}</a> | <strong>GitHub:</strong> <a href="https://github.com/${GITHUB_REPO}">${GITHUB_REPO}</a></p>
    <p style="margin:4px 0 0">Next report: Next Friday 6:00 UTC | View agent runs: <a href="https://github.com/${GITHUB_REPO}/actions">GitHub Actions</a></p>
  </div>
</div></div>`;

  try {
    await sendEmail(`Weekly PM Report — $${(stripeData.totalRevenue || 0).toFixed(2)} revenue`, html);
    log('PM report email sent.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== PM Agent v1 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
