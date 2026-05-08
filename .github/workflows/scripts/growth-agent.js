#!/usr/bin/env node
/**
 * BG Remover Digital - Growth Agent v2
 * Daily SEO Intelligence Engine with GA Evolution, Self-Rebuilding, Mitigation Rules
 * Runs daily at 8:00 UTC via GitHub Actions
 *
 * Reads: brain.json, config.json, keywords.json, growth-metrics.json
 * Writes: brain.json, config.json, keywords.json
 * Commits + pushes changes, sends daily email report
 */

const https = require('https');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════
const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();
const DAY_OF_WEEK = NOW.getUTCDay(); // 0=Sun, 1=Mon, ...

function log(msg) {
  console.log(`[Growth Agent v2 ${new Date().toISOString()}] ${msg}`);
}

// ═══════════════════════════════════════════════════════
// DATA I/O
// ═══════════════════════════════════════════════════════
function readJSON(file) {
  try {
    const p = path.join(DATA_DIR, file);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { log(`Read error ${file}: ${e.message}`); }
  return null;
}

function writeJSON(file, data) {
  try {
    const p = path.join(DATA_DIR, file);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { log(`Write error ${file}: ${e.message}`); return false; }
}

// ═══════════════════════════════════════════════════════
// HTTP HELPER
// ═══════════════════════════════════════════════════════
function fetchUrl(url, opts = {}) {
  const timeout = typeof opts === 'number' ? opts : (opts.timeout || 15000);
  const headers = (typeof opts === 'object' && opts.headers) ? opts.headers : {};
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout, headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, opts).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ═══════════════════════════════════════════════════════
// STRIPE DATA
// ═══════════════════════════════════════════════════════
async function getStripeData() {
  if (!process.env.STRIPE_SECRET_KEY) return { totalPaidUsers: 0, totalRevenue: 0, revenue7d: 0 };
  try {
    const auth = Buffer.from(process.env.STRIPE_SECRET_KEY + ':').toString('base64');
    const r = await fetchUrl('https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete', {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    if (r.status !== 200) return { totalPaidUsers: 0, totalRevenue: 0, revenue7d: 0 };
    const data = JSON.parse(r.body);
    const sessions = (data.data || []).filter(s => s.payment_status === 'paid');
    const totalRevenue = sessions.reduce((s, x) => s + (x.amount_total || 0), 0) / 100;
    const uniqueEmails = new Set(sessions.map(s => s.customer_details?.email).filter(Boolean));
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const recent7 = sessions.filter(s => parseInt(s.created) >= sevenDaysAgo);
    const revenue7d = recent7.reduce((s, x) => s + (x.amount_total || 0), 0) / 100;
    return { totalPaidUsers: uniqueEmails.size || sessions.length, totalRevenue, revenue7d };
  } catch (e) {
    return { totalPaidUsers: 0, totalRevenue: 0, revenue7d: 0 };
  }
}

// ═══════════════════════════════════════════════════════
// SITE HEALTH CHECK
// ═══════════════════════════════════════════════════════
async function checkSiteHealth() {
  try {
    const start = Date.now();
    const { status } = await fetchUrl(SITE_URL);
    return { online: status === 200, statusCode: status, loadTime: Date.now() - start };
  } catch (e) {
    return { online: false, error: e.message, statusCode: 0, loadTime: 0 };
  }
}

// ═══════════════════════════════════════════════════════
// COMPETITOR ANALYSIS
// ═══════════════════════════════════════════════════════
async function analyzeCompetitors(brain) {
  const competitors = ['https://www.remove.bg', 'https://remover.io', 'https://www.slazzer.com'];
  const results = {};
  for (const url of competitors) {
    try {
      const { status, body } = await fetchUrl(url);
      const titleMatch = body.match(/<title[^>]*>(.*?)<\/title>/i);
      results[url] = {
        online: status === 200,
        statusCode: status,
        title: titleMatch ? titleMatch[1].substring(0, 100) : 'N/A',
        checked: TODAY
      };
    } catch (e) {
      results[url] = { online: false, error: e.message, checked: TODAY };
    }
  }
  brain.competitors = results;
  return results;
}

// ═══════════════════════════════════════════════════════
// KEYWORD CONTENT GENERATOR
// ═══════════════════════════════════════════════════════
function generateKeywordContent(keyword, slug, existingSlugs) {
  const kw = keyword.toLowerCase();
  const brandName = 'BG Remover Digital';
  const siteUrl = SITE_URL;

  // Pick related slugs from existing
  const related = existingSlugs.filter(s => s !== slug).slice(0, 3);

  // Generate unique content based on keyword
  const introTemplates = [
    `Removing backgrounds from ${kw.replace(/background remover for |remove background from |background remover /g, '')} is a task that many people assume requires expensive software or advanced editing skills. In reality, ${brandName} makes the entire process effortless by running advanced AI technology directly in your web browser. Whether you are preparing images for an online store, social media profile, or professional presentation, this free tool delivers pixel-perfect cutouts in seconds without requiring any signup or payment. Simply upload your image, and the AI identifies the subject with remarkable precision, separating it from the background automatically. Everything happens on your device, so your images remain completely private throughout the process.`,
    `If you have ever spent hours manually erasing backgrounds in Photoshop or wrestling with clunky online tools, ${brandName} is about to save you a tremendous amount of time. This free, browser-based tool uses cutting-edge AI to handle the entire background removal process for ${kw.replace(/background remover for |remove background from |background remover /g, '')} automatically. The technology runs entirely in your browser, meaning there are no uploads to external servers, no accounts to create, and no hidden fees. You get professional-quality results that preserve fine details like hair strands, transparent edges, and complex outlines. It works with PNG, JPG, and WEBP formats, handling images up to 4096 pixels across.`
  ];
  const intro = introTemplates[Math.floor(Math.random() * introTemplates.length)];

  const whyMatters = [
    `Professional-looking images with clean backgrounds instantly elevate the perceived quality of whatever you are presenting. When ${kw.replace(/background remover for |remove background from |background remover /g, '')} have distracting or inconsistent backgrounds, viewers focus on the noise rather than the subject. Studies across ecommerce, social media, and digital marketing consistently show that clean, uniform backgrounds increase engagement rates, click-through rates, and conversion rates. For sellers on platforms like Amazon, eBay, Etsy, and Shopify, this translates directly into more sales and higher average order values.`,
    `The time savings alone justify switching to an automated solution. Manually removing backgrounds from a single image can take anywhere from five to twenty minutes depending on complexity. When you are dealing with dozens or hundreds of images for a product catalog, marketing campaign, or social media content calendar, those minutes add up to hours of tedious work. ${brandName} processes each image in seconds, freeing you to focus on the creative and strategic aspects of your business rather than repetitive editing tasks.`,
    `Versatility is another major advantage. When you have a transparent-background image, you can place it on any backdrop, layer it into composite designs, or use it across multiple channels without re-editing. A single product photo can serve as a marketplace listing image, a social media graphic, a banner ad element, and an email newsletter feature, all without additional background work. This multiplies the return on every photo you take and dramatically reduces your content production costs.`
  ];

  const howTo = [
    {
      title: 'Upload Your Image',
      description: `Drag and drop your ${kw.replace(/background remover for |remove background from |background remover /g, '')} image into the upload zone on ${brandName}, or click the browse button to select a file from your device. The tool accepts PNG, JPG, and WEBP formats up to 20 MB. You can process one image at a time on the free plan or batch-upload up to 30 images simultaneously with the Pro plan.`
    },
    {
      title: 'AI Removes the Background Automatically',
      description: `Once uploaded, ${brandName}'s AI analyzes the image, identifies the main subject, and precisely separates it from the background. The entire process runs in your browser using client-side AI technology, so your images stay private and secure. You will see a progress indicator while the tool works.`
    },
    {
      title: 'Download Your Clean Cutout',
      description: `After processing completes, your image with the background removed is ready to download as a transparent PNG. The cutout preserves fine edges and details, ready for use on any background you choose. Click the download button and the file saves instantly to your device.`
    }
  ];

  const faqs = [
    {
      question: `Is this ${kw} tool really free?`,
      answer: `Yes, ${brandName} offers 2 free image removals with no signup required. After that, the Pro plan gives you 500 images for a one-time payment of $9. There are no subscriptions or recurring charges.`
    },
    {
      question: `Do my images get uploaded to a server?`,
      answer: `No. All background removal happens locally in your browser using client-side AI technology. Your images never leave your device, which means complete privacy and faster processing since there is no upload or download wait.`
    },
    {
      question: `What image formats does the tool support?`,
      answer: `${brandName} supports PNG, JPG, and WEBP formats. Images can be up to 20 MB in size and up to 4096 pixels on their longest side. Larger images are automatically resized while maintaining quality.`
    },
    {
      question: `Can I use the transparent images commercially?`,
      answer: `Absolutely. The images you process with ${brandName} are yours to use however you like, including for commercial purposes, online stores, social media, marketing materials, and more.`
    }
  ];

  return { slug, keyword, title: '', description: '', h1: '', intro, why_matters: whyMatters, how_to_steps: howTo, faqs, related_slugs: related };
}

// ═══════════════════════════════════════════════════════
// CREATE NEW KEYWORD PAGES
// ═══════════════════════════════════════════════════════
function createNewKeywords(config, brain, keywords) {
  const phase = brain.current_phase || 'week1_baby_steps';
  const weekNum = brain.week || 1;
  const limits = config.mitigation[`week${weekNum}`] || config.mitigation.week1;
  const maxNew = limits.daily_new_pages || 2;

  // Check how many already exist
  const existingSlugs = new Set(keywords.map(k => k.slug));

  // Get candidates that don't exist yet
  const candidates = (config.keyword_candidates || []).filter(c => !existingSlugs.has(c.slug) && c.status !== 'created');

  if (candidates.length === 0) return { created: 0, newEntries: [] };

  // Respect limit
  const toCreate = candidates.slice(0, maxNew);
  const newEntries = [];

  for (const candidate of toCreate) {
    const entry = generateKeywordContent(candidate.keyword, candidate.slug, keywords.map(k => k.slug));

    // Apply title format (80/20 rule)
    const formats = config.seo.title_formats || {};
    const bestFormat = config.seo.title_strategy || 'format_B';
    const useExperiment = Math.random() < 0.2;
    const chosenFormat = useExperiment
      ? Object.keys(formats).find(f => f !== bestFormat) || 'format_A'
      : bestFormat;
    const template = formats[chosenFormat] || formats.format_B;
    entry.title = template.replace('[keyword]', candidate.keyword).replace(/[—|]/g, (m) => m === '|' ? ' | ' : ' \u2014 ');
    entry.description = `Remove backgrounds from ${candidate.keyword.toLowerCase()} instantly with AI. Get clean, professional transparent backgrounds in seconds. Free to try, no signup required.`;
    entry.h1 = `Background Remover for ${candidate.keyword.replace(/remove background from |background remover for |background remover /gi, '').replace(/^\w/, c => c.toUpperCase())}`;

    newEntries.push(entry);

    // Mark candidate as created
    candidate.status = 'created';

    // Track in brain
    brain.seo.pages_created_total = (brain.seo.pages_created_total || 0) + 1;
    if (brain.seo.title_strategies[chosenFormat]) {
      brain.seo.title_strategies[chosenFormat].used += 1;
    }
  }

  return { created: newEntries.length, newEntries };
}

// ═══════════════════════════════════════════════════════
// SUNDAY EVOLUTION CYCLE
// ═══════════════════════════════════════════════════════
function runEvolution(brain, config) {
  log('Running Sunday Evolution Cycle...');

  const weekNum = brain.week || 1;
  const evolutionEntry = {
    date: TODAY,
    week: weekNum,
    decisions: [],
    data_snapshot: {
      pages_created: brain.seo.pages_created_total || 0,
      total_posts: brain.social?.total_posts || 0,
      backlinks_created: brain.backlinks?.total_created || 0,
      blog_posts: brain.content?.blog_posts?.total || 0,
      paid_users: brain.paid_users || 0
    }
  };

  // Advance week
  const newWeek = Math.min(weekNum + 1, 4);
  brain.week = newWeek;

  // Update phase
  if (newWeek <= 1) brain.current_phase = 'week1_baby_steps';
  else if (newWeek === 2) brain.current_phase = 'week2_walking';
  else if (newWeek === 3) brain.current_phase = 'week3_running';
  else brain.current_phase = 'week4_sprinting';

  // Find best title format
  const strategies = brain.seo.title_strategies || {};
  let bestFormat = config.seo.title_strategy;
  let bestScore = -Infinity;
  for (const [key, val] of Object.entries(strategies)) {
    if (val.avg_rank_change > bestScore && val.used > 0) {
      bestScore = val.avg_rank_change;
      bestFormat = key;
    }
  }
  if (bestFormat) {
    config.seo.title_strategy = bestFormat;
    evolutionEntry.decisions.push(`Best title format: ${bestFormat} (score: ${bestScore})`);
  }

  // Check budget scaling
  const paidUsers = brain.paid_users || 0;
  const scaling = config.budget.scaling || [];
  for (const tier of scaling) {
    if (paidUsers >= tier.users) {
      config.budget.ads_enabled = true;
      config.growth.current_paid_users = paidUsers;
    }
  }

  // Update config with new phase limits
  config.growth.current_week = newWeek;
  config.growth.current_phase = brain.current_phase;

  // Log evolution
  evolutionEntry.decisions.push(`Advanced to Week ${newWeek} (${brain.current_phase})`);
  evolutionEntry.decisions.push(`Budget scaling: ${config.budget.ads_enabled ? 'ACTIVE' : 'inactive'} (${paidUsers} paid users)`);
  brain.evolution_log.push(evolutionEntry);
  config.last_evolution = TODAY;

  log(`Evolution complete: Week ${weekNum} -> Week ${newWeek}`);
  return evolutionEntry;
}

// ═══════════════════════════════════════════════════════
// GIT OPERATIONS
// ═══════════════════════════════════════════════════════
function gitCommitAndPush() {
  try {
    execSync('git config user.name "Growth Agent v2"');
    execSync('git config user.email "growth-agent[bot]@users.noreply.github.com"');
    execSync('git add data/');
    const diff = execSync('git diff --cached --stat').toString().trim();
    if (diff) {
      execSync(`git commit -m "growth-agent-v2: daily update - ${TODAY}"`);
      execSync('git push');
      log('Changes committed and pushed.');
      return true;
    }
    log('No changes to commit.');
    return false;
  } catch (e) {
    log(`Git error: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// EMAIL
// ═══════════════════════════════════════════════════════
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });
  await transporter.sendMail({
    from: `"Growth Agent v2" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject, html,
  });
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  log('=== Growth Agent v2 Started ===');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials'); process.exit(1);
  }

  // Load shared data
  let brain = readJSON('brain.json');
  let config = readJSON('config.json');
  let keywords = readJSON('keywords.json') || [];
  let metrics = readJSON('growth-metrics.json');

  // Initialize defaults
  if (!brain) brain = { version: '1.0', emergency: { brake_active: false, deindexed_count: 0 }, seo: {}, content: {}, social: {}, backlinks: {}, week: 1, current_phase: 'week1_baby_steps', evolution_log: [], paid_users: 0 };
  if (!config) config = { site: { url: SITE_URL }, mitigation: { week1: { daily_new_pages: 2 }, week2: { daily_new_pages: 3 }, week3: { daily_new_pages: 5 }, week4: { daily_new_pages: 7 } }, seo: {}, growth: {} };
  if (!Array.isArray(keywords)) keywords = [];

  let pagesCreated = 0;
  let evolutionResult = null;
  let brakeActive = brain.emergency?.brake_active || false;
  let emergencyAlert = false;

  // ── EMERGENCY BRAKE CHECK ──
  log(`Emergency brake: ${brakeActive ? 'ACTIVE' : 'inactive'}`);
  if (brain.emergency.deindexed_count >= 3) {
    brain.emergency.brake_active = true;
    brakeActive = true;
    emergencyAlert = true;
    log('EMERGENCY BRAKE ACTIVATED: 3+ deindexed pages');
  }

  // ── STRIPE DATA ──
  log('Fetching Stripe data...');
  const stripe = await getStripeData();
  brain.paid_users = stripe.totalPaidUsers;
  config.growth.current_paid_users = stripe.totalPaidUsers;

  // ── SITE HEALTH ──
  log('Checking site health...');
  const health = await checkSiteHealth();
  log(`Site: ${health.online ? 'UP' : 'DOWN'} (${health.loadTime}ms)`);

  // ── KEYWORD RANKING TRACKER ──
  log('Tracking keyword rankings...');
  const rankingSnapshot = {};
  for (const kw of keywords.slice(0, 10)) {
    rankingSnapshot[kw.slug] = { keyword: kw.keyword, date: TODAY, note: 'GSC API pending - using baseline tracking' };
  }
  brain.seo.keyword_rankings = rankingSnapshot;
  brain.seo.keywords_tracked = keywords.map(k => ({ slug: k.slug, keyword: k.keyword }));

  // ── COMPETITOR ANALYSIS ──
  log('Analyzing competitors...');
  const competitors = await analyzeCompetitors(brain);

  // ── CREATE NEW KEYWORD PAGES (if brake not active) ──
  if (!brakeActive) {
    log('Creating new keyword pages...');
    const result = createNewKeywords(config, brain, keywords);
    pagesCreated = result.created;
    if (result.created > 0) {
      keywords.push(...result.newEntries);
      log(`Created ${result.created} new keyword pages`);
    }
  } else {
    log('SKIPPING page creation - emergency brake active');
  }

  // ── SUNDAY EVOLUTION ──
  if (DAY_OF_WEEK === 0) {
    log('Sunday detected - running evolution cycle');
    evolutionResult = runEvolution(brain, config);
  }

  // ── SAVE DATA ──
  brain.last_updated = TODAY;
  writeJSON('brain.json', brain);
  writeJSON('config.json', config);
  writeJSON('keywords.json', keywords);

  // ── GIT COMMIT + PUSH ──
  log('Committing changes...');
  const committed = gitCommitAndPush();

  // ── BUILD EMAIL REPORT ──
  log('Building email report...');

  const weekNum = brain.week || 1;
  const phase = brain.current_phase || 'week1_baby_steps';
  const totalKeywords = keywords.length;
  const headerColor = emergencyAlert ? '#dc2626' : brakeActive ? '#ea580c' : '#059669';
  const headerText = emergencyAlert ? 'EMERGENCY BRAKE' : brakeActive ? 'BRAKE ACTIVE' : 'All Systems Go';

  const newPagesHtml = pagesCreated > 0
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:bold;color:#16a34a">New Pages Created: ${pagesCreated}</div>
        ${keywords.slice(-pagesCreated).map(k => `<div style="font-size:12px;color:#374151;margin-top:4px">&bull; ${k.slug} - ${k.keyword}</div>`).join('')}
      </div>`
    : '';

  const evolutionHtml = evolutionResult
    ? `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:10px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:bold;color:#7c3aed">Sunday Evolution Cycle</div>
        ${evolutionResult.decisions.map(d => `<div style="font-size:12px;color:#374151;margin-top:4px">&bull; ${d}</div>`).join('')}
      </div>`
    : '';

  const brakeHtml = brakeActive
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-bottom:12px">
        <div style="font-size:14px;font-weight:bold;color:#dc2626">EMERGENCY BRAKE ACTIVE</div>
        <div style="font-size:12px;color:#7f1d1d;margin-top:4px">All content creation paused. Deindexed pages: ${brain.emergency.deindexed_count}. Reason: ${brain.emergency.brake_reason || '3+ pages deindexed in 48 hours'}</div>
      </div>`
    : '';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:700px;margin:0 auto;padding:20px">
<div style="background:${headerColor};color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:18px">Growth Agent v2 - Daily Report</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${TODAY} | Week ${weekNum} | ${phase.replace(/_/g, ' ')} | ${headerText}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">

  ${brakeHtml}

  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div style="flex:1;background:${health.online ? '#f0fdf4' : '#fef2f2'};padding:12px;border-radius:6px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:${health.online ? '#16a34a' : '#dc2626'}">${health.online ? 'UP' : 'DOWN'}</div>
      <div style="font-size:11px;color:#6b7280">Site (${health.loadTime}ms)</div>
    </div>
    <div style="flex:1;background:#eff6ff;padding:12px;border-radius:6px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#2563eb">${totalKeywords}</div>
      <div style="font-size:11px;color:#6b7280">Total Pages</div>
    </div>
    <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:6px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#16a34a">${stripe.totalPaidUsers}</div>
      <div style="font-size:11px;color:#6b7280">Paid Users</div>
    </div>
    <div style="flex:1;background:#faf5ff;padding:12px;border-radius:6px;text-align:center">
      <div style="font-size:22px;font-weight:bold;color:#7c3aed">$${stripe.totalRevenue.toFixed(2)}</div>
      <div style="font-size:11px;color:#6b7280">Revenue</div>
    </div>
  </div>

  ${newPagesHtml}
  ${evolutionHtml}

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:6px">Mitigation Status (Week ${weekNum})</div>
    <div style="font-size:12px;color:#64748b">Max new pages/day: ${(config.mitigation[`week${weekNum}`] || config.mitigation.week1).daily_new_pages} | Phase: ${phase.replace(/_/g, ' ')}</div>
    <div style="font-size:12px;color:#64748b">Brake: ${brakeActive ? 'ACTIVE' : 'inactive'} | Experiment rate: ${config.experiment_rate || 0.2}</div>
  </div>

  <div style="font-size:11px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:10px;margin-top:14px">
    <p style="margin:0">Growth Agent v2 | SEO Intelligence Engine | Brain: brain.json | Config: config.json</p>
    <p style="margin:4px 0 0">Next run: Tomorrow 8:00 UTC | ${DAY_OF_WEEK === 0 ? 'EVOLUTION DAY' : 'Standard run'}</p>
  </div>
</div></div>`;

  // ── SEND EMAIL ──
  try {
    const subject = emergencyAlert
      ? `EMERGENCY | Growth Agent v2 | Brake Active | ${TODAY}`
      : `Growth Agent v2 | Day Report | ${totalKeywords} pages | $${stripe.totalRevenue.toFixed(2)} revenue`;
    await sendEmail(subject, html);
    log('Email sent successfully.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Growth Agent v2 Finished ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
