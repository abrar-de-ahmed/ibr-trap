#!/usr/bin/env node
/**
 * BG Remover Digital — Growth Agent v1
 * Runs daily (8:00 UTC / 1:00 PM PKT) via GitHub Actions
 *
 * MISSION: Drive 5 paid users before May 31, 2026
 * SELF-SUFFICIENT: Tracks revenue, site health, progress, learns weekly
 * DAILY EMAIL: Progress report with data, trends, and action items
 *
 * Data Sources:
 * - Stripe API (revenue, paid users, transactions)
 * - Site health checks (all pages live, response times)
 * - Historical data (growth-metrics.json for trend analysis)
 * - Time math (days remaining, users/day needed)
 */

const https = require('https');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════

const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const TARGET_PAID_USERS = 5;
const TARGET_DATE = new Date('2026-05-31T23:59:59Z');
const START_DATE = new Date('2026-05-08T00:00:00Z');
const PRICE_PER_USER = 9.00;
const METRICS_FILE = path.join(__dirname, '..', '..', '..', 'data', 'growth-metrics.json');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function log(msg) {
  console.log(`[Growth Agent v1 ${new Date().toISOString()}] ${msg}`);
}

function daysBetween(a, b) {
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

function progressBar(current, total, width = 20) {
  const filled = Math.round((current / total) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${current}/${total} (${Math.round((current / total) * 100)}%)`;
}

function fetchHttps(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000, ...options }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHttps(res.headers.location, options).then(resolve).catch(reject);
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

// ═══════════════════════════════════════════════
// STRIPE DATA
// ═══════════════════════════════════════════════

async function getStripeData() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: 'No Stripe key', totalPaidUsers: 0, totalRevenue: 0, revenue7d: 0, revenue30d: 0, uniqueCustomers: 0, firstSaleDate: null, recentTransactions: [], allTransactions: [] };
  }

  try {
    const auth = Buffer.from(process.env.STRIPE_SECRET_KEY + ':').toString('base64');
    const result = await fetchHttps('https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete', {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (result.status !== 200) {
      return { error: `Stripe API ${result.status}`, totalPaidUsers: 0, totalRevenue: 0, revenue7d: 0, revenue30d: 0, uniqueCustomers: 0, firstSaleDate: null, recentTransactions: [], allTransactions: [] };
    }

    const data = JSON.parse(result.body);
    const sessions = (data.data || []).filter(s => s.payment_status === 'paid');

    // All-time metrics
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100;
    const uniqueEmails = new Set(sessions.map(s => s.customer_details?.email).filter(Boolean));
    const uniqueCustomers = uniqueEmails.size || sessions.length;

    // First sale date
    const firstSaleDate = sessions.length > 0
      ? new Date(Math.min(...sessions.map(s => new Date(s.created).getTime()))).toISOString().split('T')[0]
      : null;

    // 7-day revenue
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const recent7 = sessions.filter(s => parseInt(s.created) >= sevenDaysAgo);
    const revenue7d = recent7.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100;

    // 30-day revenue
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const recent30 = sessions.filter(s => parseInt(s.created) >= thirtyDaysAgo);
    const revenue30d = recent30.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100;

    return {
      totalPaidUsers: sessions.length,
      totalRevenue,
      revenue7d,
      revenue30d,
      uniqueCustomers,
      firstSaleDate,
      recentTransactions: recent7,
      allTransactions: sessions
    };
  } catch (err) {
    return { error: err.message, totalPaidUsers: 0, totalRevenue: 0, revenue7d: 0, revenue30d: 0, uniqueCustomers: 0, firstSaleDate: null, recentTransactions: [], allTransactions: [] };
  }
}

// ═══════════════════════════════════════════════
// SITE HEALTH
// ═══════════════════════════════════════════════

async function checkSiteHealth() {
  log('Checking site health...');

  const pages = [
    { url: '/', name: 'Homepage' },
    { url: '/remove-background/product-photos', name: 'Product Photos' },
    { url: '/remove-background/shoes', name: 'Shoes' },
    { url: '/remove-background/jewelry', name: 'Jewelry' },
    { url: '/remove-background/clothing', name: 'Clothing' },
    { url: '/remove-background/watches', name: 'Watches' },
    { url: '/remove-background/electronics', name: 'Electronics' },
    { url: '/remove-background/amazon-listings', name: 'Amazon Listings' },
    { url: '/remove-background/etsy-shop', name: 'Etsy Shop' },
    { url: '/remove-background/ebay-photos', name: 'eBay Photos' },
    { url: '/remove-background/shopify-store', name: 'Shopify Store' },
    { url: '/remove-background/furniture', name: 'Furniture' },
    { url: '/remove-background/bags', name: 'Bags' },
    { url: '/remove-background/cosmetics', name: 'Cosmetics' },
    { url: '/remove-background/car-photos', name: 'Car Photos' },
    { url: '/remove-background/food', name: 'Food' },
    { url: '/remove-background/toys', name: 'Toys' },
    { url: '/remove-background/sports-equipment', name: 'Sports Equipment' },
    { url: '/remove-background/books', name: 'Books' },
    { url: '/remove-background/pets', name: 'Pets' },
    { url: '/privacy-policy', name: 'Privacy Policy' },
    { url: '/terms-of-service', name: 'Terms of Service' },
  ];

  const results = [];
  let totalResponseTime = 0;
  let pagesOk = 0;

  // Check pages in batches of 5 to avoid overwhelming
  for (let i = 0; i < pages.length; i += 5) {
    const batch = pages.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map(async (page) => {
      try {
        const start = Date.now();
        const { status } = await fetchHttps(`${SITE_URL}${page.url}`);
        const responseTime = Date.now() - start;
        return { ...page, status, responseTime, ok: status === 200 };
      } catch (e) {
        return { ...page, status: 0, responseTime: 0, ok: false, error: e.message };
      }
    }));
    results.push(...batchResults);
  }

  results.forEach(r => {
    totalResponseTime += r.responseTime;
    if (r.ok) pagesOk++;
  });

  const avgResponse = results.length > 0 ? Math.round(totalResponseTime / results.length) : 0;
  const failedPages = results.filter(r => !r.ok);

  return { pagesTotal: results.length, pagesOk, avgResponse, failedPages, results };
}

// ═══════════════════════════════════════════════
// METRICS STORAGE
// ═══════════════════════════════════════════════

function readMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }
  } catch (e) {
    log(`Metrics read error: ${e.message}`);
  }
  return {
    target: { paid_users: TARGET_PAID_USERS, target_date: '2026-05-31', start_date: '2026-05-08', price_per_user: PRICE_PER_USER, status: 'in_progress' },
    milestones: { first_sale: null, half_target: null, target_reached: null },
    daily_snapshots: [],
    recommendations_log: [],
    learning_notes: []
  };
}

function writeMetrics(metrics) {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
    return true;
  } catch (e) {
    log(`Metrics write error: ${e.message}`);
    return false;
  }
}

function commitMetrics() {
  try {
    execSync('git config user.name "Growth Agent"');
    execSync('git config user.email "growth-agent[bot]@users.noreply.github.com"');
    execSync('git add data/growth-metrics.json');
    const output = execSync('git diff --cached --stat').toString().trim();
    if (output) {
      execSync(`git commit -m "growth: daily metrics - ${TODAY}"`);
      execSync('git push');
      log('Metrics committed and pushed.');
      return true;
    } else {
      log('No changes to commit.');
      return false;
    }
  } catch (e) {
    log(`Git commit error: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════
// TREND ANALYSIS
// ═══════════════════════════════════════════════

function analyzeTrends(metrics) {
  const snapshots = metrics.daily_snapshots || [];
  const todaySnapshot = snapshots[snapshots.length - 1];
  const lastWeek = snapshots.length >= 8 ? snapshots[snapshots.length - 8] : null;

  const trends = {
    daysActive: snapshots.length,
    revenueTrend: 'flat',
    userTrend: 'flat',
    weekOverWeekRevenue: null,
    weekOverWeekUsers: null,
    avgDailyResponse: 0,
    bestDay: null,
    consistency: 0,
  };

  if (snapshots.length > 0) {
    const avgResponse = snapshots.reduce((sum, s) => sum + (s.avgResponse || 0), 0) / snapshots.length;
    trends.avgDailyResponse = Math.round(avgResponse);

    // Best day (lowest response time)
    const byResponse = [...snapshots].sort((a, b) => (a.avgResponse || 9999) - (b.avgResponse || 9999));
    trends.bestDay = byResponse[0]?.date || null;

    // Consistency (% of days all pages were healthy)
    const healthyDays = snapshots.filter(s => s.pagesOk === s.pagesTotal).length;
    trends.consistency = Math.round((healthyDays / snapshots.length) * 100);

    // Week-over-week comparison
    if (lastWeek) {
      trends.weekOverWeekRevenue = (todaySnapshot?.totalRevenue || 0) - (lastWeek.totalRevenue || 0);
      trends.weekOverWeekUsers = (todaySnapshot?.totalPaidUsers || 0) - (lastWeek.totalPaidUsers || 0);

      if (trends.weekOverWeekRevenue > 0) trends.revenueTrend = 'up';
      else if (trends.weekOverWeekRevenue < 0) trends.revenueTrend = 'down';

      if (trends.weekOverWeekUsers > 0) trends.userTrend = 'up';
      else if (trends.weekOverWeekUsers < 0) trends.userTrend = 'down';
    }
  }

  return trends;
}

// ═══════════════════════════════════════════════
// RECOMMENDATIONS ENGINE
// ═══════════════════════════════════════════════

function generateRecommendations(stripeData, healthData, trends, metrics) {
  const recs = [];
  const daysSinceStart = daysBetween(START_DATE, NOW);
  const daysRemaining = Math.max(0, daysBetween(NOW, TARGET_DATE));
  const paidUsers = stripeData.totalPaidUsers;
  const usersNeeded = Math.max(0, TARGET_PAID_USERS - paidUsers);
  const usersPerDay = daysRemaining > 0 ? (usersNeeded / daysRemaining).toFixed(2) : 'IMPOSSIBLE';

  // ── CRITICAL: Target at risk ──
  if (paidUsers === 0 && daysRemaining <= 10) {
    recs.push({ priority: 'CRITICAL', emoji: '🔴', text: `Only ${daysRemaining} days left, ZERO sales. URGENT: Submit to Product Hunt, Reddit r/Entrepreneur, share on Twitter/X. Consider lowering price to $4.99 temporarily.` });
  }

  if (paidUsers === 0 && daysSinceStart >= 14) {
    recs.push({ priority: 'CRITICAL', emoji: '🔴', text: `No sales after ${daysSinceStart} days. The tool works but nobody is finding it. ACTION: Share on 3 social platforms today. Post in relevant Facebook groups, Reddit communities, and WhatsApp groups.` });
  }

  // ── HIGH: Acceleration needed ──
  if (usersPerDay > 0.5 && daysRemaining < 20) {
    recs.push({ priority: 'HIGH', emoji: '🟠', text: `Need ${usersPerDay} users/day to hit target. Current rate is too slow. ACTION: Manually share the tool link on Twitter, Reddit, Facebook groups daily until first sale.` });
  }

  if (paidUsers >= 1 && paidUsers < TARGET_PAID_USERS) {
    recs.push({ priority: 'HIGH', emoji: '🟠', text: `${paidUsers}/${TARGET_PAID_USERS} users acquired. Keep the momentum. First sale is proof the product works. Double down on whatever channel brought the first user.` });
  }

  // ── MEDIUM: SEO focus ──
  if (healthData.failedPages.length > 0) {
    recs.push({ priority: 'MEDIUM', emoji: '🟡', text: `${healthData.failedPages.length} pages failing: ${healthData.failedPages.map(p => p.name).join(', ')}. Fix immediately — dead pages hurt SEO.` });
  }

  if (daysSinceStart <= 14) {
    recs.push({ priority: 'MEDIUM', emoji: '🟡', text: `Still in early indexing phase. Keep submitting 2-3 pages/day in GSC. Focus on completing all keyword page indexing before Week 3.` });
  }

  // ── LOW: General optimization ──
  if (healthData.pagesOk === healthData.pagesTotal) {
    recs.push({ priority: 'LOW', emoji: '🟢', text: `All ${healthData.pagesTotal} pages live and healthy. Site is technically solid. Now focus on distribution (sharing, directories, social).` });
  }

  if (healthData.avgResponse > 3000) {
    recs.push({ priority: 'LOW', emoji: '🟢', text: `Avg response time ${healthData.avgResponse}ms is above 3s. Not urgent but monitor — slow sites get penalized by Google over time.` });
  }

  // ── MILESTONE TRACKING ──
  if (paidUsers >= 1 && !metrics.milestones.first_sale) {
    recs.push({ priority: 'MILESTONE', emoji: '🎉', text: `FIRST SALE ACHIEVED! Date: ${stripeData.firstSaleDate}. This proves the product converts. Analyze how this user found you and double down on that channel.` });
  }

  if (paidUsers >= 3 && !metrics.milestones.half_target) {
    recs.push({ priority: 'MILESTONE', emoji: '🚀', text: `HALF TARGET REACHED! ${paidUsers}/${TARGET_PAID_USERS}. Accelerate — you're on track to hit the goal.` });
  }

  if (paidUsers >= TARGET_PAID_USERS && !metrics.milestones.target_reached) {
    recs.push({ priority: 'MILESTONE', emoji: '🏆', text: `TARGET REACHED! ${paidUsers} paid users! Mission accomplished. Time to set the next target.` });
  }

  return recs;
}

// ═══════════════════════════════════════════════
// EMAIL
// ═══════════════════════════════════════════════

async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"BG Remover Growth Agent" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject: subject,
    html,
  });
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  log('=== Growth Agent v1 Started ===');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials');
    process.exit(1);
  }

  // 1. Get Stripe data
  log('Step 1: Fetching Stripe data...');
  const stripeData = await getStripeData();
  log(`  Paid users: ${stripeData.totalPaidUsers}, Revenue: $${stripeData.totalRevenue.toFixed(2)}`);

  // 2. Check site health
  log('Step 2: Checking site health...');
  const healthData = await checkSiteHealth();
  log(`  Pages: ${healthData.pagesOk}/${healthData.pagesTotal} OK, Avg: ${healthData.avgResponse}ms`);

  // 3. Read historical metrics
  log('Step 3: Reading historical data...');
  const metrics = readMetrics();
  const trends = analyzeTrends(metrics);

  // 4. Calculate progress
  const daysSinceStart = daysBetween(START_DATE, NOW);
  const daysRemaining = Math.max(0, daysBetween(NOW, TARGET_DATE));
  const usersNeeded = Math.max(0, TARGET_PAID_USERS - stripeData.totalPaidUsers);
  const usersPerDay = daysRemaining > 0 ? (usersNeeded / daysRemaining).toFixed(2) : 'N/A';
  const revenueNeeded = usersNeeded * PRICE_PER_USER;

  // 5. Generate recommendations
  log('Step 4: Generating recommendations...');
  const recommendations = generateRecommendations(stripeData, healthData, trends, metrics);

  // 6. Update milestones
  if (stripeData.firstSaleDate && !metrics.milestones.first_sale) {
    metrics.milestones.first_sale = stripeData.firstSaleDate;
  }
  if (stripeData.totalPaidUsers >= Math.ceil(TARGET_PAID_USERS / 2) && !metrics.milestones.half_target) {
    metrics.milestones.half_target = TODAY;
  }
  if (stripeData.totalPaidUsers >= TARGET_PAID_USERS && !metrics.milestones.target_reached) {
    metrics.milestones.target_reached = TODAY;
    metrics.target.status = 'completed';
  }

  // 7. Save today's snapshot
  const snapshot = {
    date: TODAY,
    totalPaidUsers: stripeData.totalPaidUsers,
    totalRevenue: stripeData.totalRevenue,
    revenue7d: stripeData.revenue7d,
    revenue30d: stripeData.revenue30d,
    uniqueCustomers: stripeData.uniqueCustomers,
    firstSaleDate: stripeData.firstSaleDate,
    pagesTotal: healthData.pagesTotal,
    pagesOk: healthData.pagesOk,
    avgResponse: healthData.avgResponse,
    daysSinceStart,
    daysRemaining,
    usersPerDayNeeded: parseFloat(usersPerDay),
    recommendationsCount: recommendations.length,
    hasCritical: recommendations.some(r => r.priority === 'CRITICAL'),
  };
  metrics.daily_snapshots.push(snapshot);

  // Save recommendations log
  metrics.recommendations_log.push({
    date: TODAY,
    count: recommendations.length,
    priorities: recommendations.map(r => r.priority),
  });

  // 8. Save and commit metrics
  log('Step 5: Saving metrics...');
  writeMetrics(metrics);
  commitMetrics();

  // 9. Build email
  log('Step 6: Building email report...');

  const urgency = stripeData.totalPaidUsers === 0 && daysRemaining <= 10 ? 'URGENT' :
                 stripeData.totalPaidUsers === 0 ? 'BUILDING' :
                 stripeData.totalPaidUsers < TARGET_PAID_USERS ? 'GROWING' : 'WON';

  const headerColor = urgency === 'URGENT' ? '#dc2626' :
                      urgency === 'WON' ? '#16a34a' :
                      urgency === 'GROWING' ? '#2563eb' : '#7c3aed';

  const trendArrow = (trend) => trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  const recsHtml = recommendations.map(r => {
    const bg = r.priority === 'CRITICAL' ? '#fef2f2' :
               r.priority === 'HIGH' ? '#fff7ed' :
               r.priority === 'MEDIUM' ? '#fffbeb' :
               r.priority === 'MILESTONE' ? '#f0fdf4' : '#f8fafc';
    const border = r.priority === 'CRITICAL' ? '#dc2626' :
                   r.priority === 'HIGH' ? '#ea580c' :
                   r.priority === 'MEDIUM' ? '#ca8a04' :
                   r.priority === 'MILESTONE' ? '#16a34a' : '#94a3b8';
    return `<div style="background:${bg};border-left:3px solid ${border};padding:10px 12px;margin-bottom:6px;border-radius:0 6px 6px 0">
      <div style="font-size:12px;font-weight:bold">${r.emoji} ${r.priority}</div>
      <div style="font-size:12px;color:#374151;margin-top:4px">${r.text}</div>
    </div>`;
  }).join('');

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">

<!-- Header -->
<div style="background:${headerColor};color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:20px">Growth Agent — Daily Report</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Day ${daysSinceStart} | ${TODAY} | ${urgency}</p>
</div>

<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">

<!-- Target Tracker -->
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px">
  <div style="font-size:14px;font-weight:bold;color:#1e293b;margin-bottom:8px">TARGET: ${TARGET_PAID_USERS} Paid Users by May 31</div>
  <div style="font-family:monospace;font-size:14px;color:${headerColor};margin-bottom:8px">${progressBar(stripeData.totalPaidUsers, TARGET_PAID_USERS)}</div>
  <div style="display:flex;gap:16px;font-size:12px;color:#64748b">
    <span>Days left: <strong>${daysRemaining}</strong></span>
    <span>Users needed: <strong>${usersNeeded}</strong></span>
    <span>Rate needed: <strong>${usersPerDay}/day</strong></span>
    <span>Revenue needed: <strong>$${revenueNeeded.toFixed(0)}</strong></span>
  </div>
</div>

<!-- KPI Cards -->
<div style="display:flex;gap:10px;margin-bottom:14px">
  <div style="flex:1;background:#eff6ff;padding:12px;border-radius:6px;text-align:center;border:1px solid #bfdbfe">
    <div style="font-size:24px;font-weight:bold;color:#2563eb">${stripeData.totalPaidUsers}</div>
    <div style="font-size:11px;color:#64748b">Paid Users</div>
  </div>
  <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:6px;text-align:center;border:1px solid #bbf7d0">
    <div style="font-size:24px;font-weight:bold;color:#16a34a">$${stripeData.totalRevenue.toFixed(2)}</div>
    <div style="font-size:11px;color:#64748b">Total Revenue</div>
  </div>
  <div style="flex:1;background:#faf5ff;padding:12px;border-radius:6px;text-align:center;border:1px solid #e9d5ff">
    <div style="font-size:24px;font-weight:bold;color:#7c3aed">$${stripeData.revenue7d.toFixed(2)}</div>
    <div style="font-size:11px;color:#64748b">Last 7 Days</div>
  </div>
  <div style="flex:1;background:${healthData.pagesOk === healthData.pagesTotal ? '#f0fdf4' : '#fef2f2'};padding:12px;border-radius:6px;text-align:center;border:1px solid ${healthData.pagesOk === healthData.pagesTotal ? '#bbf7d0' : '#fca5a5'}">
    <div style="font-size:24px;font-weight:bold;color:${healthData.pagesOk === healthData.pagesTotal ? '#16a34a' : '#dc2626'}">${healthData.pagesOk}/${healthData.pagesTotal}</div>
    <div style="font-size:11px;color:#64748b">Pages Live</div>
  </div>
</div>

<!-- Trend Data -->
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:8px">Trends (Week-over-Week)</div>
  <div style="display:flex;gap:20px;font-size:12px">
    <span>Revenue: <strong style="color:${trends.revenueTrend === 'up' ? '#16a34a' : trends.revenueTrend === 'down' ? '#dc2626' : '#64748b'}">${trendArrow(trends.revenueTrend)} $${Math.abs(trends.weekOverWeekRevenue || 0).toFixed(2)}</strong></span>
    <span>Users: <strong style="color:${trends.userTrend === 'up' ? '#16a34a' : trends.userTrend === 'down' ? '#dc2626' : '#64748b'}">${trendArrow(trends.userTrend)} ${trends.weekOverWeekUsers || 0}</strong></span>
    <span>Site avg: <strong>${trends.avgDailyResponse}ms</strong></span>
    <span>Uptime: <strong>${trends.consistency}%</strong></span>
    <span>Days tracked: <strong>${trends.daysActive}</strong></span>
  </div>
</div>

${stripeData.error ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:10px;margin-bottom:14px;font-size:12px;color:#dc2626">Stripe Error: ${stripeData.error}</div>` : ''}

${healthData.failedPages.length > 0 ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:10px;margin-bottom:14px;font-size:12px;color:#dc2626">Failed pages: ${healthData.failedPages.map(p => p.name).join(', ')}</div>` : ''}

<!-- Recommendations -->
<h3 style="font-size:14px;margin:0 0 8px;color:#1e293b">Action Items (${recommendations.length})</h3>
${recsHtml}

<!-- Footer -->
<div style="font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:14px">
  <p style="margin:0">Growth Agent v1 | Self-sufficient daily tracker | Data stored in data/growth-metrics.json</p>
  <p style="margin:4px 0 0">Next report: Tomorrow 8:00 UTC (1:00 PM PKT)</p>
</div>

</div></div>`;

  // 10. Send email
  log('Step 7: Sending email...');
  const emailSubject = urgency === 'URGENT'
    ? `URGENT | Day ${daysSinceStart} | ${stripeData.totalPaidUsers}/${TARGET_PAID_USERS} users | ${daysRemaining}d left`
    : urgency === 'WON'
    ? `TARGET REACHED | ${stripeData.totalPaidUsers} users | $${stripeData.totalRevenue.toFixed(2)} revenue`
    : `Day ${daysSinceStart} | ${stripeData.totalPaidUsers}/${TARGET_PAID_USERS} users | $${stripeData.totalRevenue.toFixed(2)} | ${urgency}`;

  try {
    await sendEmail(emailSubject, html);
    log('Email sent successfully.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  // 11. Log learning notes
  if (stripeData.totalPaidUsers > 0 && !metrics.learning_notes.find(n => n.type === 'first_sale_analysis')) {
    metrics.learning_notes.push({
      type: 'first_sale_analysis',
      date: TODAY,
      note: `First ${stripeData.totalPaidUsers} user(s) acquired after ${daysSinceStart} days. Revenue: $${stripeData.totalRevenue.toFixed(2)}. Channel analysis needed.`
    });
    writeMetrics(metrics);
  }

  log('=== Growth Agent v1 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
