#!/usr/bin/env node
/**
 * BG Remover Digital — Supervisor Agent v1
 * Runs daily (7:00 UTC) via GitHub Actions
 * LIGHTWEIGHT: Pings all other agents, checks schedule compliance, monitors patterns
 *
 * Responsibilities:
 * 1. Check each agent's last run via GitHub Actions API
 * 2. Alert if any agent missed its schedule
 * 3. Quick site + API health ping
 * 4. Monitor learning patterns (response times, revenue trends)
 * 5. Notify when patterns suggest agents need to adapt
 *
 * Alert Logic:
 * - Any agent missed schedule → INSTANT ALERT
 * - Site DOWN → INSTANT ALERT
 * - All clear → Daily brief summary (always, since this IS the supervisor)
 */

const https = require('https');
const nodemailer = require('nodemailer');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'abrar-de-ahmed/ibr-trap';
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const SITE_URL = 'https://bgremoverdigital.pages.dev';

function log(msg) {
  console.log(`[Supervisor v1 ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000, headers }, (res) => {
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
    from: `"BG Remover Digital Supervisor" <${GMAIL_USER}>`,
    to: ALERT_EMAIL,
    subject: `[BG Remover Digital Supervisor] ${subject}`,
    html,
  });
}

// ── Agent Schedule Definitions ──
// Defines each agent's expected schedule and grace period
const AGENT_SCHEDULES = [
  {
    name: 'Monitor Agent',
    workflowFile: 'monitor.yml',
    schedule: 'Every 12 hours (0:00, 12:00 UTC)',
    maxAgeHours: 14, // Should run every 12h, allow 14h grace
    cronExpression: '0 0,12 * * *',
    dayOfWeek: null, // Every day
  },
  {
    name: 'Security Agent',
    workflowFile: 'security-agent.yml',
    schedule: 'Weekly Monday 6:00 UTC',
    maxAgeHours: 170, // Should run weekly, allow ~7 days + 2h grace
    cronExpression: '0 6 * * 1',
    dayOfWeek: 1, // Monday
  },
  {
    name: 'SEO Agent',
    workflowFile: 'seo-agent.yml',
    schedule: 'Weekly Wednesday 6:00 UTC',
    maxAgeHours: 170,
    cronExpression: '0 6 * * 3',
    dayOfWeek: 3, // Wednesday
  },
  {
    name: 'PM Agent',
    workflowFile: 'pm-agent.yml',
    schedule: 'Weekly Friday 6:00 UTC',
    maxAgeHours: 170,
    cronExpression: '0 6 * * 5',
    dayOfWeek: 5, // Friday
  },
  {
    name: 'Supervisor Agent',
    workflowFile: 'supervisor-agent.yml',
    schedule: 'Daily 7:00 UTC',
    maxAgeHours: 26, // Should run daily, allow 26h grace
    cronExpression: '0 7 * * *',
    dayOfWeek: null, // Every day
  },
];

// ── Check Agent Last Run via GitHub API ──
async function checkAgentStatus(agent) {
  log(`Checking ${agent.name}...`);

  if (!GITHUB_TOKEN) {
    return { ...agent, lastRun: null, status: 'UNKNOWN', error: 'GITHUB_TOKEN not available' };
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${agent.workflowFile}/runs?per_page=3`;
    const result = await fetchUrl(url, {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'BG-Remover-Supervisor',
    });

    if (result.status !== 200) {
      return { ...agent, lastRun: null, status: 'ERROR', error: `API returned ${result.status}` };
    }

    const data = JSON.parse(result.body);
    const runs = data.workflow_runs || [];

    if (runs.length === 0) {
      return { ...agent, lastRun: null, status: 'NEVER RUN', hoursSince: Infinity };
    }

    const lastRun = runs[0];
    const lastRunTime = new Date(lastRun.created_at);
    const hoursSince = (Date.now() - lastRunTime.getTime()) / (1000 * 60 * 60);
    const conclusion = lastRun.conclusion || 'unknown';
    const triggeredBy = lastRun.event || 'unknown';

    // Determine if schedule was missed
    let status = 'OK';
    let missed = false;

    // Skip check for agents that run on specific days — only check if that day has passed
    if (agent.dayOfWeek !== null) {
      const now = new Date();
      const currentDay = now.getUTCDay();
      const daysSinceScheduled = (currentDay - agent.dayOfWeek + 7) % 7;
      // If we're within the same week and the agent hasn't run, check if it's overdue
      if (daysSinceScheduled === 0 && now.getUTCHours() >= 8) {
        // It's the scheduled day, past 8:00 UTC, should have run
        if (hoursSince > 3) {
          status = 'MISSED';
          missed = true;
        }
      } else if (daysSinceScheduled > 0 && daysSinceScheduled < 7) {
        // Past the scheduled day this week
        if (hoursSince > agent.maxAgeHours) {
          status = 'MISSED';
          missed = true;
        }
      }
    } else {
      // Daily/every-12h agents
      if (hoursSince > agent.maxAgeHours) {
        status = 'MISSED';
        missed = true;
      }
    }

    // If last run failed, mark it
    if (conclusion === 'failure') {
      status = 'FAILED';
      missed = true;
    }

    return {
      ...agent,
      lastRun: lastRunTime.toISOString(),
      lastRunStatus: conclusion,
      triggeredBy,
      hoursSince: Math.round(hoursSince * 10) / 10,
      status,
      missed,
    };
  } catch (e) {
    return { ...agent, lastRun: null, status: 'ERROR', error: e.message };
  }
}

// ── Quick Site Health Ping ──
async function quickSiteHealth() {
  log('Quick site health ping...');
  try {
    const start = Date.now();
    const { status } = await fetchUrl(SITE_URL);
    const loadTime = Date.now() - start;
    return { online: status === 200, statusCode: status, loadTime };
  } catch (e) {
    return { online: false, error: e.message, statusCode: 0, loadTime: 0 };
  }
}

// ── Quick API Endpoint Checks ──
async function quickApiChecks() {
  log('Quick API endpoint checks...');
  const endpoints = [
    { name: '/api/webhook (health)', url: `${SITE_URL}/api/webhook` },
  ];
  const results = [];

  for (const ep of endpoints) {
    try {
      const start = Date.now();
      const { status } = await fetchUrl(ep.url);
      const loadTime = Date.now() - start;
      results.push({ ...ep, status, loadTime, ok: status === 200 });
    } catch (e) {
      results.push({ ...ep, status: 0, ok: false, error: e.message });
    }
  }

  return results;
}

// ── Stripe Revenue Pulse Check ──
async function stripeRevenuePulse() {
  if (!STRIPE_SECRET_KEY) return { checked: false, reason: 'No Stripe key' };

  try {
    const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
    const url = `https://api.stripe.com/v1/checkout/sessions?created[gte]=${threeDaysAgo}&payment_status=paid&limit=10`;
    const auth = Buffer.from(STRIPE_SECRET_KEY + ':').toString('base64');

    const result = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'Authorization': `Basic ${auth}` },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Stripe timeout')); });
    });

    const sessions = result.data || [];
    const revenue = sessions.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100;
    return { checked: true, transactions: sessions.length, revenue, period: '3 days' };
  } catch (e) {
    return { checked: true, error: e.message };
  }
}

// ── Learning Pattern Analysis ──
// Analyzes current data to detect trends and suggest adaptations
function analyzePatterns(agentResults, siteHealth, apiResults, stripeData) {
  const insights = [];

  // Pattern 1: Response time trend
  if (siteHealth.loadTime > 5000) {
    insights.push({
      type: 'PERFORMANCE',
      severity: 'WARNING',
      message: `Site response time is ${siteHealth.loadTime}ms (above 5s threshold). Consider: lazy loading the img.ly model, optimizing JS bundle, or CDN caching.`,
      agentAction: 'SEO Agent should prioritize performance in next weekly scan.',
    });
  } else if (siteHealth.loadTime > 3000) {
    insights.push({
      type: 'PERFORMANCE',
      severity: 'NOTICE',
      message: `Site response time is ${siteHealth.loadTime}ms. Within acceptable range but monitor for trends.`,
      agentAction: 'Track this metric over the week. If consistently above 3s, flag in next PM report.',
    });
  }

  // Pattern 2: Agent reliability
  const failedAgents = agentResults.filter(a => a.status === 'FAILED');
  if (failedAgents.length > 0) {
    insights.push({
      type: 'AGENT_RELIABILITY',
      severity: 'WARNING',
      message: `${failedAgents.length} agent(s) failed on last run: ${failedAgents.map(a => a.name).join(', ')}`,
      agentAction: 'Check GitHub Actions logs for these workflows. If recurring, investigate.',
    });
  }

  // Pattern 3: Revenue data emerging
  if (stripeData.checked && stripeData.revenue > 0) {
    insights.push({
      type: 'REVENUE',
      severity: 'POSITIVE',
      message: `Revenue detected: $${stripeData.revenue.toFixed(2)} from ${stripeData.transactions} transaction(s) in last ${stripeData.period}. Learning phase has begun!`,
      agentAction: 'PM Agent should start tracking revenue trends. SEO Agent should correlate traffic patterns with revenue. Monitor Agent should ensure uptime is 100% during peak hours.',
    });
  } else if (stripeData.checked && stripeData.revenue === 0) {
    insights.push({
      type: 'REVENUE',
      severity: 'NOTICE',
      message: 'No revenue in last 3 days. System is still in cooking phase. Focus on SEO and content.',
      agentAction: 'SEO Agent: Ensure indexation is happening (check GSC). PM Agent: Weekly report will include traffic recommendations.',
    });
  }

  // Pattern 4: All agents healthy
  const allHealthy = agentResults.every(a => a.status === 'OK');
  if (allHealthy && siteHealth.online) {
    insights.push({
      type: 'SYSTEM_HEALTH',
      severity: 'POSITIVE',
      message: 'All 5 agents running on schedule. System is fully operational.',
      agentAction: 'Continue monitoring. No action needed. First blog can be planned once Week 2 data is available.',
    });
  }

  return insights;
}

// ── Main ──
async function main() {
  log('=== Supervisor Agent v1 Started ===');

  if (!GMAIL_USER || !GMAIL_APP_PASS || !ALERT_EMAIL) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  // 1. Check all agent schedules
  log('Step 1: Checking agent schedules...');
  const agentResults = [];
  for (const agent of AGENT_SCHEDULES) {
    const result = await checkAgentStatus(agent);
    agentResults.push(result);
    log(`  ${result.name}: ${result.status} (${result.hoursSince || '?'}h since last run)`);
  }

  // 2. Quick site health
  log('Step 2: Site health ping...');
  const siteHealth = await quickSiteHealth();
  log(`  Site: ${siteHealth.online ? 'UP' : 'DOWN'} (${siteHealth.loadTime || '?'}ms)`);

  // 3. Quick API checks
  log('Step 3: API endpoint checks...');
  const apiResults = await quickApiChecks();
  apiResults.forEach(r => log(`  ${r.name}: ${r.ok ? 'OK' : 'FAIL'} (${r.status})`));

  // 4. Stripe revenue pulse
  log('Step 4: Stripe revenue pulse...');
  const stripeData = await stripeRevenuePulse();
  log(`  Stripe: ${stripeData.checked ? `$${stripeData.revenue || 0} (${stripeData.transactions || 0} tx)` : 'Not checked'}`);

  // 5. Analyze patterns
  log('Step 5: Analyzing patterns...');
  const insights = analyzePatterns(agentResults, siteHealth, apiResults, stripeData);
  insights.forEach(i => log(`  [${i.type}] ${i.severity}: ${i.message}`));

  // ── Evaluate: Any alerts needed? ──
  const missedAgents = agentResults.filter(a => a.missed);
  const failedAgents = agentResults.filter(a => a.status === 'FAILED');
  const hasAlerts = missedAgents.length > 0 || failedAgents.length > 0 || !siteHealth.online;

  // ── Build Report ──
  const severityColor = (status) => {
    if (status === 'OK') return '#16a34a';
    if (status === 'MISSED') return '#dc2626';
    if (status === 'FAILED') return '#ea580c';
    if (status === 'ERROR' || status === 'NEVER RUN') return '#dc2626';
    return '#ca8a04';
  };

  const agentRows = agentResults.map(a => `
    <tr style="background:${a.missed || a.status === 'FAILED' ? '#fef2f2' : '#f0fdf4'}">
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;font-weight:600">${a.name}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${a.schedule}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;font-weight:bold;color:${severityColor(a.status)}">${a.status}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${a.hoursSince ? `${a.hoursSince}h ago` : '--'}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:12px">${a.lastRunStatus || '--'}</td>
    </tr>`).join('');

  const insightHtml = insights.length > 0 ? insights.map(i => {
    const bg = i.severity === 'WARNING' ? '#fff7ed' : i.severity === 'POSITIVE' ? '#f0fdf4' : '#f8fafc';
    const color = i.severity === 'WARNING' ? '#ea580c' : i.severity === 'POSITIVE' ? '#16a34a' : '#475569';
    return `<div style="background:${bg};border-left:3px solid ${color};padding:10px 12px;margin-bottom:8px;border-radius:0 6px 6px 0">
      <div style="font-size:12px;font-weight:bold;color:${color};margin-bottom:4px">[${i.type}] ${i.severity}</div>
      <div style="font-size:12px;color:#374151">${i.message}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;font-style:italic">Agent Action: ${i.agentAction}</div>
    </div>`;
  }).join('') : '<p style="font-size:13px;color:#6b7280">No patterns detected yet. System is collecting baseline data.</p>';

  const headerColor = hasAlerts ? '#dc2626' : '#059669';
  const headerText = hasAlerts ? 'ALERTS FOUND' : 'All Systems Nominal';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">
<div style="background:${headerColor};color:white;padding:12px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">BG Remover Digital - Supervisor Daily Report</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${new Date().toISOString().split('T')[0]} | ${headerText}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">

  <!-- Quick Stats -->
  <div style="display:flex;gap:12px;margin-bottom:16px">
    <div style="flex:1;background:${siteHealth.online ? '#f0fdf4' : '#fef2f2'};padding:12px;border-radius:6px;text-align:center;border:1px solid ${siteHealth.online ? '#bbf7d0' : '#fca5a5'}">
      <div style="font-size:22px;font-weight:bold;color:${siteHealth.online ? '#16a34a' : '#dc2626'}">${siteHealth.online ? 'UP' : 'DOWN'}</div>
      <div style="font-size:11px;color:#6b7280">Site</div>
      <div style="font-size:10px;color:#9ca3af">${siteHealth.loadTime || '?'}ms</div>
    </div>
    <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:6px;text-align:center;border:1px solid #bbf7d0">
      <div style="font-size:22px;font-weight:bold;color:#16a34a">${agentResults.filter(a => a.status === 'OK').length}/5</div>
      <div style="font-size:11px;color:#6b7280">Agents OK</div>
    </div>
    <div style="flex:1;background:#eff6ff;padding:12px;border-radius:6px;text-align:center;border:1px solid #bfdbfe">
      <div style="font-size:22px;font-weight:bold;color:#2563eb">$${(stripeData.revenue || 0).toFixed(2)}</div>
      <div style="font-size:11px;color:#6b7280">Revenue (3d)</div>
    </div>
    <div style="flex:1;background:#faf5ff;padding:12px;border-radius:6px;text-align:center;border:1px solid #e9d5ff">
      <div style="font-size:22px;font-weight:bold;color:#7c3aed">${insights.length}</div>
      <div style="font-size:11px;color:#6b7280">Insights</div>
    </div>
  </div>

  ${hasAlerts ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-bottom:16px">
    <p style="margin:0;font-size:13px;color:#dc2626;font-weight:bold">ALERTS:</p>
    ${missedAgents.map(a => `<p style="margin:4px 0 0;font-size:12px;color:#dc2626">${a.name} MISSED its schedule (last run: ${a.hoursSince || '?'}h ago)</p>`).join('')}
    ${failedAgents.map(a => `<p style="margin:4px 0 0;font-size:12px;color:#ea580c">${a.name} FAILED on last run</p>`).join('')}
    ${!siteHealth.online ? `<p style="margin:4px 0 0;font-size:12px;color:#dc2626">Site is DOWN</p>` : ''}
  </div>` : ''}

  <!-- Agent Schedule Compliance -->
  <h3 style="font-size:14px;margin:0 0 8px;color:#374151">Agent Schedule Compliance</h3>
  <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
    <tr style="background:#f3f4f6">
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Agent</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Schedule</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Status</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Last Run</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:11px">Result</th>
    </tr>
    ${agentRows}
  </table>

  <!-- Learning Patterns -->
  <h3 style="font-size:14px;margin:0 0 8px;color:#374151">Learning Patterns & Insights</h3>
  ${insightHtml}

  <div style="font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px">
    <p style="margin:0"><strong>Site:</strong> <a href="${SITE_URL}">${SITE_URL}</a> | <strong>Actions:</strong> <a href="https://github.com/${GITHUB_REPO}/actions">GitHub Actions</a></p>
    <p style="margin:4px 0 0">Next supervisor check: Tomorrow 7:00 UTC (12:00 PM PKT) | Cross-check with your schedule below</p>
  </div>
</div></div>`;

  try {
    await sendEmail(
      hasAlerts
        ? `DAILY ALERT: ${missedAgents.length} missed, ${failedAgents.length} failed`
        : `Daily Supervisor Report - ${agentResults.filter(a => a.status === 'OK').length}/5 agents OK`,
      html
    );
    log('Supervisor report email sent.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Supervisor Agent v1 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });


