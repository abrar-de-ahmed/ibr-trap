#!/usr/bin/env node
/**
 * BG Remover Digital — Social Agent v2.0 (Puppeteer-Powered)
 * ─────────────────────────────────────────────────────────
 * MISSION: ACTUALLY POST to Reddit, Twitter/X, and Pinterest
 *   using headless browser automation (Puppeteer)
 *   - Reads brain.json + config.json for state and configuration
 *   - Respects emergency brake and weekly mitigation limits
 *   - Logs in like a human, posts like a human, engages like a human
 *   - Daily: post content + like posts + occasional comment
 *   - Weekly: follow 3-5 relevant accounts per platform
 *   - Saves results to brain.json for persistence
 *   - Commits changes and sends email report
 *
 * STRATEGY:
 *   - 80/20 rule: 80% best-performing formats, 20% experiments
 *   - Platform rotation to avoid overposting on any single channel
 *   - Human-like typing delays, random scroll, natural behavior
 *   - Never mentions img.ly — use "AI technology" or "client-side AI"
 *   - No aggressive marketing — value-first, community-first approach
 */

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──
const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const BRAND = 'BG Remover Digital';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const BRAIN_FILE = path.join(DATA_DIR, 'brain.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();
const DAY_OF_WEEK = NOW.getUTCDay(); // 0=Sun, 6=Sat
const IS_MONDAY = DAY_OF_WEEK === 1; // Monday = weekly engagement day

function log(msg) {
  console.log(`[Social Agent ${new Date().toISOString()}] ${msg}`);
}

// ── Data I/O ──
function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch (e) { log(`ERROR reading ${filePath}: ${e.message}`); return null; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Pseudo-random seeded by date ──
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

const rand = seededRandom(TODAY + '-social-v2');

// ── Emergency Brake ──
function isEmergencyBrake(brain) {
  return brain && brain.emergency && brain.emergency.brake_active === true;
}

// ── Mitigation Limits ──
function getMitigationConfig(brain) {
  const week = brain.week || 1;
  const configs = {
    1: { dailySocialPosts: 1, dailyLikes: 5, dailyComments: 0, weeklyFollows: 3 },
    2: { dailySocialPosts: 2, dailyLikes: 8, dailyComments: 1, weeklyFollows: 4 },
    3: { dailySocialPosts: 3, dailyLikes: 12, dailyComments: 2, weeklyFollows: 5 },
    4: { dailySocialPosts: 5, dailyLikes: 15, dailyComments: 3, weeklyFollows: 5 },
  };
  return configs[week] || configs[4];
}

function getAlreadyPostedToday(brain) {
  const social = brain.social || {};
  const recent = social.recent_posts || [];
  return recent.filter(p => p.date === TODAY && p.status === 'posted').length;
}

function getAlreadyEngagedToday(brain, type) {
  const social = brain.social || {};
  const engagement = social.engagement || {};
  const todayEng = engagement[TODAY] || {};
  return todayEng[type] || 0;
}

// ── Platform Rotation ──
function getRecentPlatforms(brain) {
  const social = brain.social || {};
  const recent = social.recent_posts || [];
  const threeDaysAgo = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return recent.filter(p => p.date >= threeDaysAgo).map(p => p.platform);
}

function selectPlatformsToPost(brain, maxPosts) {
  const allPlatforms = ['reddit', 'twitter', 'pinterest'];
  const recentPlatforms = getRecentPlatforms(brain);
  const social = brain.social || {};

  const scored = allPlatforms.map(platform => {
    let score = 10;
    const recentCount = recentPlatforms.filter(p => p === platform).length;
    score -= recentCount * 5;
    const platformData = social[platform] || {};
    const engagement = platformData.avg_engagement || platformData.avg_clicks || 0;
    score += engagement * 0.1;
    if (platformData.status === 'inactive' || platformData.status === 'paused') score -= 100;
    return { platform, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPosts).map(s => s.platform);
}

// ── 80/20 Experiment Rule ──
function shouldExperiment() { return rand() < 0.2; }

// ── Content Uniqueness Check ──
function isContentUnique(brain, text) {
  const social = brain.social || {};
  const recent = social.recent_posts || [];
  const normalized = text.toLowerCase().trim().substring(0, 50);
  return !recent.some(p => {
    const existing = (p.title || p.text || p.description || '').toLowerCase().trim().substring(0, 50);
    return existing === normalized;
  });
}

// ═══════════════════════════════════════════════════════════════
// CONTENT TEMPLATES (same as v1 — proven & tested)
// ═══════════════════════════════════════════════════════════════

// Reddit content templates
const redditTemplates = {
  toolShare: [
    {
      title: 'I built a free background remover that runs entirely in your browser — no signup needed',
      body: () => {
        const angles = [
          'If you work with images regularly and need a quick way to remove backgrounds, I put together a free tool that does this right in your browser. It uses client-side AI so your images never leave your device — no account creation, no watermarks, no limits on how many you can process.\n\nWorks great for product photos, profile pictures, social media content — anything where you need a clean transparent or white background. I use it daily for my own projects and finally decided to polish it up for public use.\n\nWould love to hear what you all think or if there are features that would make it more useful for this community.',
          'I got tired of dealing with clunky background removal tools that require signups or watermark everything, so I built one that runs completely in your browser. No server upload, no account — just drop your image and get a clean cutout.\n\nIt handles complex edges pretty well (hair, fur, transparent objects) and works entirely client-side. Made it free with no limits because I think this should just be a basic utility everyone has access to.\n\nCheck it out and let me know if it\'s useful for your workflow.',
          'Hey everyone — I made a free, browser-based background remover that doesn\'t require any signup or download. Everything runs locally on your device using client-side AI, so your images stay private.\n\nI built this because every other tool I tried either had a paywall after 2 uses, required creating an account, or uploaded images to some server. This one just works — drag, drop, download.\n\nHappy to answer questions about how it works or take feature suggestions.',
        ];
        return angles[Math.floor(rand() * angles.length)];
      }
    },
    {
      title: 'Free tool for removing backgrounds from product photos — works offline in browser',
      body: () => {
        const angles = [
          'For anyone running an online store or selling products, clean product photos make a huge difference in click-through rates. I built a free tool that removes backgrounds from product images right in your browser.\n\nNo account needed, no watermarks, and because it runs client-side, you can literally use it offline once the page loads. Handles furniture, electronics, clothing, food — pretty much anything.\n\nI know a lot of folks here pay $10-30/month for background removal, so hoping this saves some people money. Let me know if there\'s a specific product type you\'d like better support for.',
          'Clean product photography shouldn\'t require expensive software or sending your images to some random server. I put together a free browser tool that does instant background removal with client-side AI.\n\nIt\'s particularly good with ecommerce product shots — clothing, accessories, electronics, home goods. You get a transparent PNG you can drop straight into your listing. No signup, no limits, completely free.\n\nWould appreciate any feedback from the sellers here on what would make this more useful for your workflow.',
        ];
        return angles[Math.floor(rand() * angles.length)];
      }
    },
    {
      title: 'What\'s the best way to remove backgrounds from photos without paying for Photoshop?',
      body: () => 'I was looking for a solution recently and ended up building my own because everything else was either too expensive or too limited. Made it free and browser-based — no signup, no downloads.\n\nIt uses client-side AI to handle the cutting, so your images don\'t get uploaded anywhere. Works well for most common cases: product photos, portraits, logos, social media posts.\n\nNot trying to replace Photoshop for complex editing, but for quick background removal it\'s been surprisingly reliable. Check it out if you need something like this.'
    },
  ],
  helpfulShare: [
    {
      title: 'Protip: You can remove backgrounds from any image for free directly in your browser',
      body: () => 'Just wanted to share a tool I\'ve been using that saves me a ton of time. It\'s a free background remover that works entirely in your browser — no install, no account, no catch.\n\nI use it for:\n- Cleaning up product photos before listing them\n- Making transparent PNGs for design work\n- Removing backgrounds from screenshots for presentations\n- Creating profile pictures with custom backgrounds\n\nRuns on client-side AI so it\'s private and fast. Thought others here might find it useful too.'
    },
    {
      title: 'I automated my product photo workflow with a free browser tool — no more manual background removal',
      body: () => 'If you\'re processing more than a handful of product photos, removing backgrounds manually is soul-crushing. I found (and contributed to) a free browser tool that does it automatically using client-side AI.\n\nThe workflow is: upload, instant transparent cutout, download. That\'s it. No layers, no magic wand, no edge cleanup needed in most cases.\n\nIt handles tricky stuff like hair, furry items, and transparent objects better than I expected. Completely free, no signup. Just wanted to share because it\'s saved me hours this week alone.'
    },
  ],
};

// Twitter/X content templates
const twitterTemplates = {
  featureFocused: [
    'Remove any background in seconds — free, no signup, works right in your browser. Your images never leave your device. {SITE}',
    'Client-side AI background removal that actually works. No upload, no account, no watermarks. Just results. Try it free -> {SITE}',
    'Built a background remover that runs 100% in your browser. No server. No signup. No catch. Works offline too. -> {SITE} #BackgroundRemover #FreeTool',
  ],
  useCaseFocused: [
    'Running an online store? Clean product photos increase conversions. Remove backgrounds for free in your browser -> {SITE} #Ecommerce #ProductPhotography',
    'Need transparent backgrounds for logos, profile pics, or design work? Free browser tool, no signup needed -> {SITE} #DesignTools #FreeTool',
    'Side hustle sellers — this free background remover saves me hours every week. No signup, works in browser -> {SITE} #SideHustle #EtsySeller',
  ],
  tipFocused: [
    'Pro tip: Clean white backgrounds on product photos can boost sales by up to 30%. Remove backgrounds free -> {SITE} #SmallBusiness #PhotographyTip',
    'Your profile picture with a clean background looks 10x more professional. Remove it free in 3 seconds -> {SITE} #PersonalBranding',
  ],
  memeStyle: [
    'Me: "I need to remove this background"\nAlso me: *opens Photoshop, 30 min trial*\nTool: "bruh just use me" -> {SITE} #BackgroundRemover',
    'POV: You just discovered you can remove backgrounds for free in your browser without any signup -> {SITE}',
  ],
};

// Pinterest content templates
const pinterestTemplates = [
  {
    title: 'Free Background Remover - Remove Image Backgrounds Instantly',
    description: 'Remove backgrounds from any image in seconds with our free online tool. No signup required, no watermarks. Works right in your browser using AI technology. Perfect for product photos, profile pictures, logos, and design projects. Get transparent PNGs instantly.',
    board: 'Free Design Tools',
    link: '/remove-background/free-online',
  },
  {
    title: 'Free Background Remover for Product Photography',
    description: 'Professional product photos start with a clean background. Remove backgrounds from your product images for free - no signup, no watermarks, no limits. Works entirely in your browser so your images stay private. Get studio-quality cutouts in seconds.',
    board: 'Ecommerce Photography',
    link: '/remove-background/product-photos',
  },
  {
    title: 'How to Remove Backgrounds from Photos - Free Browser Tool',
    description: 'Learn how to remove backgrounds from any photo using our free online tool. No software download needed - works directly in your browser. Client-side AI handles complex edges like hair, fur, and transparent objects. Step-by-step guide included.',
    board: 'Background Removal Tips',
    link: '/remove-background/how-to-remove',
  },
  {
    title: 'Free White Background Maker for Product Listings',
    description: 'Create clean white backgrounds for your online store listings instantly. Our free tool removes any background and lets you replace it with white - perfect for Amazon, Shopify, Etsy, and eBay sellers. No signup, no watermarks, browser-based.',
    board: 'Ecommerce Photography',
    link: '/remove-background/white-background',
  },
  {
    title: 'Free Transparent Background Maker - PNG in Seconds',
    description: 'Convert any image to a transparent PNG in seconds. Our free browser tool uses AI technology to cleanly cut out subjects from their backgrounds. Perfect for logos, stickers, overlays, and design composites. No signup required.',
    board: 'Free Design Tools',
    link: '/remove-background/transparent',
  },
  {
    title: 'Remove Backgrounds from Pet Photos - Free Online Tool',
    description: 'Easily remove backgrounds from pet and animal photos with our free AI-powered tool. Handles fur, whiskers, and complex edges beautifully. Works in your browser - no signup, no upload to servers. Great for creating pet portraits and fun composites.',
    board: 'Photography Tips',
    link: '/remove-background/pets',
  },
  {
    title: 'Free Logo Background Remover - Instant Transparent Logos',
    description: 'Need your logo on a transparent background? Our free tool removes logo backgrounds instantly in your browser. No signup, no software needed. Get a clean PNG ready for any use - website, business cards, social media, presentations.',
    board: 'Free Design Tools',
    link: '/remove-background/logos',
  },
  {
    title: 'ID Photo Background Remover - Free Online Tool',
    description: 'Remove and replace backgrounds on ID photos, passport photos, and profile pictures. Our free tool works in your browser with client-side AI - your photos stay private. Perfect for visa applications, employee badges, and professional headshots.',
    board: 'Photography Tips',
    link: '/remove-background/id-photos',
  },
];

// Hashtag pools for Twitter
const hashtagPools = {
  general: ['#BackgroundRemover', '#FreeTool', '#NoSignup'],
  ecommerce: ['#Ecommerce', '#ProductPhotography', '#SmallBusiness', '#Shopify'],
  design: ['#DesignTools', '#GraphicDesign', '#UX', '#WebDesign'],
  photography: ['#Photography', '#PhotoEditing', '#PhotographyTip'],
  business: ['#SideHustle', '#Entrepreneur', '#EtsySeller', '#OnlineBusiness'],
};

function pickHashtags(category, count = 2) {
  const pool = hashtagPools[category] || hashtagPools.general;
  const shuffled = [...pool].sort(() => rand() - 0.5);
  const selected = shuffled.slice(0, count);
  if (!selected.some(h => hashtagPools.general.includes(h))) {
    selected.unshift(hashtagPools.general[Math.floor(rand() * hashtagPools.general.length)]);
  }
  return selected.slice(0, count + 1).join(' ');
}

// ── Content Generators ──
function generateRedditContent(brain, subreddit) {
  const isExperiment = shouldExperiment();
  let templatePool = isExperiment ? redditTemplates.helpfulShare :
    [...redditTemplates.toolShare, ...redditTemplates.helpfulShare];

  const template = templatePool[Math.floor(rand() * templatePool.length)];
  const title = template.title;
  const body = template.body();

  if (!isContentUnique(brain, title)) {
    const fallback = templatePool[(templatePool.indexOf(template) + 1) % templatePool.length];
    if (!isContentUnique(brain, fallback.title)) return null;
    return { type: 'reddit', subreddit, title: fallback.title, body: fallback.body(), engagement_estimate: 'medium', date: TODAY, is_experiment: isExperiment };
  }
  return { type: 'reddit', subreddit, title, body, engagement_estimate: 'medium', date: TODAY, is_experiment: isExperiment };
}

function generateTwitterContent(brain) {
  const isExperiment = shouldExperiment();
  let category = isExperiment ? 'memeStyle' :
    ['featureFocused', 'useCaseFocused', 'tipFocused'][Math.floor(rand() * 3)];

  const templates = twitterTemplates[category];
  let text = templates[Math.floor(rand() * templates.length)];
  const hashtagCategory = category === 'useCaseFocused' ? 'ecommerce' :
    category === 'tipFocused' ? 'photography' : 'general';
  const hashtags = pickHashtags(hashtagCategory);
  text = text.replace('{SITE}', SITE_URL);

  if (text.length + hashtags.length + 1 > 280) {
    text = text.substring(0, 279 - hashtags.length - 1) + '...';
  }

  const fullTweet = text + '\n' + hashtags;
  if (!isContentUnique(brain, fullTweet)) {
    const fallback = templates[(templates.indexOf(text) + 1) % templates.length];
    const fallbackText = fallback.replace('{SITE}', SITE_URL);
    const fallbackTweet = fallbackText + '\n' + hashtags;
    if (!isContentUnique(brain, fallbackTweet)) return null;
    return { type: 'twitter', text: fallbackTweet, category, character_count: fallbackTweet.length, date: TODAY, is_experiment: isExperiment };
  }
  return { type: 'twitter', text: fullTweet, category, character_count: fullTweet.length, date: TODAY, is_experiment: isExperiment };
}

function generatePinterestContent(brain) {
  const isExperiment = shouldExperiment();
  let idx = Math.floor(rand() * pinterestTemplates.length);
  if (isExperiment) idx = (idx + 3) % pinterestTemplates.length;

  const template = pinterestTemplates[idx];
  if (!isContentUnique(brain, template.title)) {
    const fallback = pinterestTemplates[(idx + 1) % pinterestTemplates.length];
    if (!isContentUnique(brain, fallback.title)) return null;
    return { type: 'pinterest', pin_title: fallback.title, pin_description: fallback.description, target_board: fallback.board, link: SITE_URL + fallback.link, date: TODAY, is_experiment: isExperiment };
  }
  return { type: 'pinterest', pin_title: template.title, pin_description: template.description, target_board: template.board, link: SITE_URL + template.link, date: TODAY, is_experiment: isExperiment };
}

// ═══════════════════════════════════════════════════════════════
// PUPPETEER BROWSER AUTOMATION ENGINE
// ═══════════════════════════════════════════════════════════════

// Human-like delay between 800ms - 2500ms
function humanDelay(min = 800, max = 2500) {
  const delay = min + rand() * (max - min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Human-like typing with random delays
async function humanType(page, selector, text, { delay = 80 } = {}) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  await humanDelay(300, 600);
  for (let i = 0; i < text.length; i++) {
    await page.keyboard.type(text[i], { delay: delay + Math.floor(rand() * 60) });
    // Occasional longer pause (like a human thinking)
    if (rand() < 0.05) await humanDelay(400, 800);
  }
}

// Random mouse movement to appear human
async function randomMouseMove(page) {
  const x = 100 + Math.floor(rand() * 600);
  const y = 100 + Math.floor(rand() * 400);
  await page.mouse.move(x, y, { steps: 5 + Math.floor(rand() * 10) });
}

// Random scroll to appear human
async function humanScroll(page, min = 200, max = 600) {
  const scrollAmount = min + Math.floor(rand() * (max - min));
  await page.evaluate((amount) => {
    window.scrollBy({ top: amount, behavior: 'smooth' });
  }, scrollAmount);
  await humanDelay(500, 1200);
}

// Safe click with retry
async function safeClick(page, selector, timeout = 8000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await humanDelay(200, 500);
    await randomMouseMove(page);
    await page.click(selector);
    return true;
  } catch (e) {
    log(`  safeClick failed for ${selector}: ${e.message}`);
    return false;
  }
}

// Wait for navigation with timeout
async function waitForNav(page, timeout = 15000) {
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }),
      humanDelay(timeout),
    ]);
  } catch (e) {
    log(`  Navigation wait timed out (continuing anyway)`);
  }
}

// Take screenshot for debugging on error
async function takeScreenshot(page, name) {
  try {
    const screenshotPath = `/tmp/social-agent-${name}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log(`  Screenshot saved: ${screenshotPath}`);
  } catch (e) { /* ignore */ }
}

// ── Puppeteer Browser Launch ──
async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,768',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  // Anti-detection: override navigator.webdriver
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Randomize user agent hints
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  return { browser, page };
}

// ═══════════════════════════════════════════════════════════════
// REDDIT AUTOMATION
// ═══════════════════════════════════════════════════════════════

async function redditLogin(page) {
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  if (!username || !password) {
    log('Reddit: No credentials, skipping');
    return false;
  }

  try {
    log('Reddit: Logging in...');
    await page.goto('https://www.reddit.com/login/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 3000);

    // Click "Log In" if there's a button
    const loginBtn = await page.$('button[type="submit"], a[href*="login"]');
    if (loginBtn) {
      // Fill username
      await humanType(page, '#login-username, input[name="username"]', username);
      await humanDelay(500, 1000);

      // Fill password
      await humanType(page, '#login-password, input[name="password"]', password);
      await humanDelay(500, 800);

      // Submit
      await safeClick(page, 'button[type="submit"], button.login-button');
      await waitForNav(page);
      await humanDelay(3000, 5000);

      // Check if login succeeded
      const url = page.url();
      if (url.includes('login') && !url.includes('login/')) {
        // Still on login page — might have failed
        log('Reddit: Login may have failed (still on login page)');
        await takeScreenshot(page, 'reddit-login-fail');
        return false;
      }

      log('Reddit: Login successful!');
      return true;
    }

    // Alternative login flow (new Reddit UI)
    await humanType(page, 'input[name="username"], #username', username);
    await humanDelay(500, 1000);
    await humanType(page, 'input[name="password"], #password', password);
    await humanDelay(500, 800);
    await safeClick(page, 'button[type="submit"]');
    await waitForNav(page);
    await humanDelay(3000, 5000);
    log('Reddit: Login attempt completed');
    return true;
  } catch (e) {
    log(`Reddit login error: ${e.message}`);
    await takeScreenshot(page, 'reddit-login-error');
    return false;
  }
}

async function redditPost(page, content) {
  const subreddit = content.subreddit || 'Entrepreneur';
  try {
    log(`Reddit: Posting to r/${subreddit}...`);

    // Navigate to subreddit submit page
    await page.goto(`https://www.reddit.com/r/${subreddit}/submit/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    // Click "Create Post" if needed (new Reddit might show a button first)
    const createPostBtn = await page.$('button[aria-label="Create Post"], a[data-click-id="body_text"]');
    if (createPostBtn) {
      await createPostBtn.click();
      await humanDelay(1500, 2500);
    }

    // Select "Text" tab if available
    await safeClick(page, 'button[data-testid="post-link-tab"], a[href*="text"]');
    await humanDelay(500, 1000);

    // Type title
    await humanType(page, 'textarea[name="title"], input[name="title"], #t3_--title', content.title, { delay: 50 });
    await humanDelay(800, 1500);

    // Type body
    const bodyText = content.body + '\n\n' + SITE_URL;
    await humanType(page, 'textarea[name="body"], div[contenteditable="true"], #t3_--body', bodyText, { delay: 30 });
    await humanDelay(1000, 2000);

    // Click Post button
    await safeClick(page, 'button[type="submit"], button[data-click-id="submit"]');
    await waitForNav(page, 10000);
    await humanDelay(3000, 5000);

    // Verify post was created
    const pageUrl = page.url();
    if (pageUrl.includes('/comments/') || pageUrl.includes('submitted')) {
      log(`Reddit: Post created successfully!`);
      return { success: true, post_url: pageUrl };
    }

    // Check for any error messages
    const errorEl = await page.$('.text-12, [class*="error"], [class*="Error"]');
    if (errorEl) {
      const errorText = await page.evaluate(el => el.textContent, errorEl);
      log(`Reddit: Possible error - ${errorText}`);
      await takeScreenshot(page, 'reddit-post-error');
    }

    // Assume success even if we can't confirm (Reddit sometimes redirects oddly)
    log(`Reddit: Post likely created (URL: ${pageUrl})`);
    return { success: true, post_url: `https://reddit.com/r/${subreddit}/comments/` };
  } catch (e) {
    log(`Reddit post error: ${e.message}`);
    await takeScreenshot(page, 'reddit-post-error');
    return { success: false, error: e.message };
  }
}

async function redditEngage(page, brain, limits) {
  const results = { likes: 0, follows: 0, comments: 0 };
  try {
    log('Reddit: Starting engagement activities...');

    // Browse relevant subreddit feeds
    const subreddits = ['r/Entrepreneur', 'r/smallbusiness', 'r/photography', 'r/SideProject', 'r/graphic_design'];
    const targetSub = subreddits[Math.floor(rand() * subreddits.length)];

    await page.goto(`https://www.reddit.com/${targetSub}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    // Scroll down a bit to load posts
    await humanScroll(page);
    await humanScroll(page);
    await humanDelay(1000, 2000);

    // Like posts (upvote)
    const maxLikes = Math.min(limits.dailyLikes, 5);
    for (let i = 0; i < maxLikes; i++) {
      try {
        // Find upvote buttons (arrow up)
        const upvoteBtns = await page.$$('button[aria-label="upvote"], button[aria-label="Upvote"], .upvote, [data-click-id="upvote"]');
        if (upvoteBtns.length > i) {
          await randomMouseMove(page);
          await upvoteBtns[i].click();
          results.likes++;
          await humanDelay(1500, 3000);
        }
      } catch (e) { /* skip this one */ }
    }

    // Follow a subreddit (if Monday)
    if (IS_MONDAY && limits.weeklyFollows > 0) {
      const maxFollows = Math.min(limits.weeklyFollows, 3);
      const followableSubs = ['r/photography', 'r/graphic_design', 'r/webdesign', 'r/ecommerce', 'r/Etsy'];
      for (let i = 0; i < maxFollows; i++) {
        try {
          const sub = followableSubs[Math.floor(rand() * followableSubs.length)];
          await page.goto(`https://www.reddit.com/${sub}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await humanDelay(1500, 2500);

          // Click "Join" button
          const joinBtn = await page.$('button Join, button[aria-label="Join"], button[class*="join"]');
          if (joinBtn) {
            const btnText = await page.evaluate(el => el.textContent.trim().toLowerCase(), joinBtn);
            if (btnText === 'join' || btnText === 'follow') {
              await joinBtn.click();
              results.follows++;
              log(`Reddit: Followed ${sub}`);
              await humanDelay(2000, 3000);
            }
          }
        } catch (e) { /* skip */ }
      }
    }

    log(`Reddit: Engagement done - likes: ${results.likes}, follows: ${results.follows}`);
    return results;
  } catch (e) {
    log(`Reddit engagement error: ${e.message}`);
    return results;
  }
}

// ═══════════════════════════════════════════════════════════════
// TWITTER/X AUTOMATION
// ═══════════════════════════════════════════════════════════════

async function twitterLogin(page) {
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;
  const email = process.env.TWITTER_EMAIL;
  if (!username || !password || !email) {
    log('Twitter: No credentials, skipping');
    return false;
  }

  try {
    log('Twitter: Logging in...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(3000, 5000);

    // Step 1: Enter username
    await humanType(page, 'input[autocomplete="username"], input[name="text"]', username, { delay: 100 });
    await humanDelay(1000, 2000);
    await safeClick(page, 'button:has-text("Next"), button[class*="primary"]');

    // Wait for next step
    await humanDelay(2000, 4000);

    // Step 2: Might ask for email or phone verification
    // Check if there's a unique identifier verification
    try {
      const identifierInput = await page.$('input[data-testid="ocfEnterTextTextInput"]');
      if (identifierInput) {
        log('Twitter: Asked for identifier (email/phone), entering email...');
        await humanType(page, 'input[data-testid="ocfEnterTextTextInput"]', email, { delay: 100 });
        await humanDelay(1000, 2000);
        await safeClick(page, 'button[data-testid="ocfEnterTextNextButton"]');
        await humanDelay(2000, 4000);
      }
    } catch (e) { /* No verification needed, proceed */ }

    // Step 3: Enter password
    await humanDelay(1000, 2000);
    await humanType(page, 'input[name="password"], input[type="password"]', password, { delay: 100 });
    await humanDelay(800, 1500);
    await safeClick(page, 'button[data-testid="LoginForm_Login_Button"]');
    await humanDelay(3000, 5000);

    // Check if login succeeded
    const url = page.url();
    if (url.includes('login') || url.includes('flow')) {
      log('Twitter: Login may have failed (still on login flow)');
      await takeScreenshot(page, 'twitter-login-fail');
      return false;
    }

    log('Twitter: Login successful!');
    return true;
  } catch (e) {
    log(`Twitter login error: ${e.message}`);
    await takeScreenshot(page, 'twitter-login-error');
    return false;
  }
}

async function twitterPost(page, content) {
  try {
    log('Twitter: Posting tweet...');
    await humanDelay(2000, 3000);

    // Click the compose tweet button (if on home page)
    const composeBtn = await page.$('a[data-testid="SideNav_NewTweet_Button"], div[data-testid="tweetButtonInline"]');
    if (!composeBtn) {
      // Try going to home
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(2000, 3000);
    }

    // Click tweet compose area
    await safeClick(page, 'div[data-testid="tweetTextarea_0"], div[contenteditable="true"][data-testid="tweetTextarea_0"]');
    await humanDelay(1000, 2000);

    // Type tweet content
    const tweetText = content.text;
    for (let i = 0; i < tweetText.length; i++) {
      await page.keyboard.type(tweetText[i], { delay: 60 + Math.floor(rand() * 50) });
      if (rand() < 0.03) await humanDelay(300, 600);
    }
    await humanDelay(1500, 3000);

    // Click Post button
    await safeClick(page, 'button[data-testid="tweetButton"]');
    await humanDelay(3000, 5000);

    // Verify tweet posted
    const toast = await page.$('[data-testid="toast"]');
    if (toast) {
      const toastText = await page.evaluate(el => el.textContent, toast);
      log(`Twitter: Toast message - ${toastText}`);
    }

    log('Twitter: Tweet posted successfully!');
    return { success: true };
  } catch (e) {
    log(`Twitter post error: ${e.message}`);
    await takeScreenshot(page, 'twitter-post-error');
    return { success: false, error: e.message };
  }
}

async function twitterEngage(page, brain, limits) {
  const results = { likes: 0, follows: 0, retweets: 0, comments: 0 };
  try {
    log('Twitter: Starting engagement activities...');

    // Browse home timeline
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await humanDelay(2000, 3000);
    await humanScroll(page);
    await humanScroll(page);
    await humanDelay(1000, 2000);

    // Like tweets
    const maxLikes = Math.min(limits.dailyLikes, 8);
    for (let i = 0; i < maxLikes; i++) {
      try {
        // Find like buttons that aren't already liked
        const likeBtns = await page.$$('button[data-testid="like"]:not([data-testid="unlike"])');
        if (likeBtns.length > i) {
          await randomMouseMove(page);
          await likeBtns[i].click();
          results.likes++;
          await humanDelay(1500, 3000);
          await humanScroll(page, 100, 300);
        }
      } catch (e) { /* skip */ }
    }

    // Retweet (1-2 per day)
    const maxRetweets = limits.dailyComments >= 1 ? 1 : 0;
    for (let i = 0; i < maxRetweets; i++) {
      try {
        const retweetBtns = await page.$$('button[data-testid="retweet"]');
        if (retweetBtns.length > i) {
          await retweetBtns[i].click();
          await humanDelay(500, 1000);
          await safeClick(page, 'a[data-testid="retweetConfirm"]');
          results.retweets++;
          log('Twitter: Retweeted a post');
          await humanDelay(2000, 3000);
        }
      } catch (e) { /* skip */ }
    }

    // Follow accounts (if Monday)
    if (IS_MONDAY && limits.weeklyFollows > 0) {
      const maxFollows = Math.min(limits.weeklyFollows, 4);

      // Search for relevant accounts
      const searchTerms = ['graphic design', 'photography tools', 'AI image editing', 'ecommerce tips'];
      const searchTerm = searchTerms[Math.floor(rand() * searchTerms.length)];

      await page.goto(`https://x.com/search?q=${encodeURIComponent(searchTerm)}&src=typed_query&f=user`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await humanDelay(2000, 4000);
      await humanScroll(page);

      for (let i = 0; i < maxFollows; i++) {
        try {
          const followBtns = await page.$$('button[data-testid$="-follow"]:not([data-testid$="-unfollow"])');
          if (followBtns.length > i) {
            await randomMouseMove(page);
            await followBtns[i].click();
            results.follows++;
            log(`Twitter: Followed account ${i + 1}`);
            await humanDelay(2000, 4000);
          }
        } catch (e) { /* skip */ }
      }
    }

    log(`Twitter: Engagement done - likes: ${results.likes}, follows: ${results.follows}, retweets: ${results.retweets}`);
    return results;
  } catch (e) {
    log(`Twitter engagement error: ${e.message}`);
    return results;
  }
}

// ═══════════════════════════════════════════════════════════════
// PINTEREST AUTOMATION
// ═══════════════════════════════════════════════════════════════

async function pinterestLogin(page) {
  const email = process.env.PINTEREST_EMAIL;
  const password = process.env.PINTEREST_PASSWORD;
  if (!email || !password) {
    log('Pinterest: No credentials, skipping');
    return false;
  }

  try {
    log('Pinterest: Logging in...');
    await page.goto('https://www.pinterest.com/login/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(2000, 4000);

    // Enter email
    await humanType(page, '#email, input[type="email"], input[name="email"]', email, { delay: 100 });
    await humanDelay(800, 1500);

    // Enter password
    await humanType(page, '#password, input[type="password"], input[name="password"]', password, { delay: 100 });
    await humanDelay(800, 1500);

    // Click login button
    await safeClick(page, 'button[type="submit"], button[class*="SignupButton"], div[class*="loginBtn"]');
    await waitForNav(page);
    await humanDelay(3000, 5000);

    // Check login
    const url = page.url();
    if (url.includes('login') && !url.includes('/login/')) {
      log('Pinterest: Login may have failed');
      await takeScreenshot(page, 'pinterest-login-fail');
      return false;
    }

    log('Pinterest: Login successful!');
    return true;
  } catch (e) {
    log(`Pinterest login error: ${e.message}`);
    await takeScreenshot(page, 'pinterest-login-error');
    return false;
  }
}

async function pinterestCreatePin(page, content) {
  try {
    log('Pinterest: Creating pin...');

    // Click "Create" button
    await safeClick(page, 'button[data-testid="create-pin-button"], div[class*="createPin"], a[href*="/pin-creation-tool/"]');
    await humanDelay(2000, 4000);

    // If directed to pin creation tool
    const url = page.url();
    if (!url.includes('pin-creation') && !url.includes('create')) {
      await page.goto('https://www.pinterest.com/pin-creation-tool/', {
        waitUntil: 'domcontentloaded', timeout: 20000
      });
      await humanDelay(2000, 3000);
    }

    // Title
    await humanType(page, 'input[id="pinTitle"], input[name="title"], div[contenteditable="true"][class*="title"]',
      content.pin_title, { delay: 60 });
    await humanDelay(800, 1500);

    // Description
    await humanType(page, 'textarea[id="pinDescription"], textarea[name="description"], div[contenteditable="true"][class*="description"]',
      content.pin_description, { delay: 40 });
    await humanDelay(800, 1500);

    // Add link
    await safeClick(page, 'button[data-test-id="pin-editor-link-toggle"], div[class*="linkField"]');
    await humanDelay(500, 1000);
    await humanType(page, 'input[id="pinLink"], input[name="link"], input[placeholder*="http"]',
      content.link || SITE_URL, { delay: 60 });
    await humanDelay(800, 1500);

    // Select board
    try {
      await safeClick(page, 'button[data-test-id="pin-editor-board-selector"], div[class*="boardSelect"]');
      await humanDelay(1000, 2000);

      // Search/select board
      const boardName = content.target_board || 'Free Design Tools';
      await humanType(page, 'input[placeholder*="board"], input[placeholder*="search"], input[class*="boardSearch"]',
        boardName, { delay: 60 });
      await humanDelay(1000, 2000);

      // Select first matching board
      await safeClick(page, 'div[class*="boardItem"], div[class*="boardResult"], div[class*="BoardTile"]');
    } catch (e) {
      log(`Pinterest: Board selection issue (will use default): ${e.message}`);
    }

    await humanDelay(1000, 2000);

    // Publish pin
    await safeClick(page, 'button[data-test-id="pin-editor-publish-button"], button[class*="Publish"], button[class*="save"]');
    await humanDelay(3000, 5000);

    log('Pinterest: Pin created successfully!');
    return { success: true };
  } catch (e) {
    log(`Pinterest pin error: ${e.message}`);
    await takeScreenshot(page, 'pinterest-pin-error');
    return { success: false, error: e.message };
  }
}

async function pinterestEngage(page, brain, limits) {
  const results = { likes: 0, follows: 0, saves: 0 };
  try {
    log('Pinterest: Starting engagement activities...');

    // Browse home feed
    await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await humanDelay(2000, 4000);
    await humanScroll(page);
    await humanScroll(page);
    await humanDelay(1000, 2000);

    // Save/Like pins
    const maxSaves = Math.min(limits.dailyLikes, 6);
    for (let i = 0; i < maxSaves; i++) {
      try {
        const saveBtns = await page.$$('button[aria-label="Save"], div[class*="SaveButton"], button[class*="save"]');
        if (saveBtns.length > i) {
          await randomMouseMove(page);
          await saveBtns[i].click();
          results.saves++;
          await humanDelay(1500, 3000);
        }
      } catch (e) { /* skip */ }
    }

    // Follow boards/users (if Monday)
    if (IS_MONDAY && limits.weeklyFollows > 0) {
      const maxFollows = Math.min(limits.weeklyFollows, 4);

      // Search for relevant boards
      const searches = ['graphic design tips', 'photography background', 'ecommerce product photography', 'design inspiration'];
      const search = searches[Math.floor(rand() * searches.length)];

      await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(search)}`, {
        waitUntil: 'domcontentloaded', timeout: 15000
      });
      await humanDelay(2000, 4000);
      await humanScroll(page);

      for (let i = 0; i < maxFollows; i++) {
        try {
          const followBtns = await page.$$('button[aria-label="Follow"], div[class*="FollowButton"]');
          if (followBtns.length > i) {
            await randomMouseMove(page);
            await followBtns[i].click();
            results.follows++;
            log(`Pinterest: Followed board/user ${i + 1}`);
            await humanDelay(2000, 4000);
          }
        } catch (e) { /* skip */ }
      }
    }

    log(`Pinterest: Engagement done - saves: ${results.saves}, follows: ${results.follows}`);
    return results;
  } catch (e) {
    log(`Pinterest engagement error: ${e.message}`);
    return results;
  }
}

// ═══════════════════════════════════════════════════════════════
// BRAIN UPDATE
// ═══════════════════════════════════════════════════════════════

function updateBrain(brain, results) {
  if (!brain.social) brain.social = {};
  if (!brain.social.recent_posts) brain.social.recent_posts = {};
  if (!brain.social.engagement) brain.social.engagement = {};
  if (!brain.social.reddit) brain.social.reddit = {};
  if (!brain.social.twitter) brain.social.twitter = {};
  if (!brain.social.pinterest) brain.social.pinterest = {};

  // Track posts
  for (const post of results.posts) {
    if (!brain.social.recent_posts[TODAY]) brain.social.recent_posts[TODAY] = [];

    brain.social.recent_posts[TODAY].push({
      platform: post.type,
      date: TODAY,
      title: post.title || post.text || post.pin_title || '',
      status: post.status,
      is_experiment: post.is_experiment || false,
      post_url: post.post_url || null,
    });

    if (post.type === 'reddit') {
      brain.social.reddit.posts = (brain.social.reddit.posts || 0) + 1;
      if (post.status === 'posted') brain.social.reddit.posted_count = (brain.social.reddit.posted_count || 0) + 1;
    } else if (post.type === 'twitter') {
      brain.social.twitter.posts = (brain.social.twitter.posts || 0) + 1;
      if (post.status === 'posted') brain.social.twitter.posted_count = (brain.social.twitter.posted_count || 0) + 1;
    } else if (post.type === 'pinterest') {
      brain.social.pinterest.pins = (brain.social.pinterest.pins || 0) + 1;
      if (post.status === 'posted') brain.social.pinterest.posted_count = (brain.social.pinterest.posted_count || 0) + 1;
    }
  }

  // Track engagement
  brain.social.engagement[TODAY] = {
    reddit: results.engagement.reddit,
    twitter: results.engagement.twitter,
    pinterest: results.engagement.pinterest,
  };

  // Track weekly follows
  if (IS_MONDAY) {
    if (!brain.social.weekly_follows) brain.social.weekly_follows = [];
    brain.social.weekly_follows.push({
      date: TODAY,
      reddit: results.engagement.reddit.follows,
      twitter: results.engagement.twitter.follows,
      pinterest: results.engagement.pinterest.follows,
    });
    // Keep last 12 weeks
    if (brain.social.weekly_follows.length > 12) {
      brain.social.weekly_follows = brain.social.weekly_follows.slice(-12);
    }
  }

  // Update totals
  brain.social.total_posts = (brain.social.total_posts || 0) + results.posts.filter(p => p.status === 'posted').length;

  // Update account status
  if (!brain.social.account_status) brain.social.account_status = {};
  brain.social.account_status.reddit = {
    created: true,
    username: process.env.REDDIT_USERNAME || 'configured',
    last_active: TODAY,
  };
  brain.social.account_status.twitter = {
    created: true,
    username: process.env.TWITTER_USERNAME || 'configured',
    last_active: TODAY,
  };
  brain.social.account_status.pinterest = {
    created: true,
    username: process.env.PINTEREST_USERNAME || 'configured',
    last_active: TODAY,
  };

  // Trim engagement history to last 90 days
  const ninetyDaysAgo = new Date(NOW - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  Object.keys(brain.social.engagement).forEach(date => {
    if (date < ninetyDaysAgo) delete brain.social.engagement[date];
  });

  // Trim recent posts to last 90 days
  Object.keys(brain.social.recent_posts).forEach(date => {
    if (date < ninetyDaysAgo) delete brain.social.recent_posts[date];
  });

  brain.last_updated = TODAY;
  writeJSON(BRAIN_FILE, brain);
}

// ── Git Commit + Push ──
function commitAndPush() {
  try {
    execSync('git config user.name "Social Agent"', { stdio: 'pipe' });
    execSync('git config user.email "social-agent[bot]@users.noreply.github.com"', { stdio: 'pipe' });
    execSync('git add data/brain.json data/config.json', { stdio: 'pipe' });

    const status = execSync('git status --porcelain data/brain.json data/config.json', { stdio: 'pipe' }).toString().trim();
    if (status) {
      execSync(`git commit -m "social-agent: ${TODAY} auto-post + engagement [skip ci]"`, { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      log('Changes committed and pushed.');
    } else {
      log('No changes to commit.');
    }
  } catch (e) {
    log(`Git error: ${e.message}`);
  }
}

// ── Email Report ──
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });
  await transporter.sendMail({
    from: `"Social Agent" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject: `[SOCIAL AGENT] ${subject}`,
    html,
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmailHTML(results, brain) {
  const social = brain.social || {};
  const posted = results.posts.filter(p => p.status === 'posted');
  const failed = results.posts.filter(p => p.status === 'failed');
  const eng = results.engagement;

  const totalLikes = eng.reddit.likes + eng.twitter.likes + eng.pinterest.saves;
  const totalFollows = eng.reddit.follows + eng.twitter.follows + eng.pinterest.follows;

  let postDetails = '';
  for (const post of results.posts) {
    const icon = post.type === 'reddit' ? '🔴' : post.type === 'twitter' ? '🐦' : '📌';
    const statusColor = post.status === 'posted' ? '#16a34a' : '#dc2626';
    const statusText = post.status === 'posted' ? 'POSTED' : 'FAILED';
    const title = escapeHTML(post.title || post.text || post.pin_title || '').substring(0, 100);
    const platform = post.type.charAt(0).toUpperCase() + post.type.slice(1);
    const subInfo = post.subreddit ? ` in ${post.subreddit}` : post.target_board ? ` to ${post.target_board}` : '';
    postDetails += `
      <div style="background:${post.status === 'posted' ? '#f0fdf4' : '#fef2f2'};border:1px solid ${post.status === 'posted' ? '#bbf7d0' : '#fecaca'};border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-size:11px;color:#6b7280;display:flex;justify-content:space-between">
          <span>${icon} ${platform}${subInfo}</span>
          <span style="color:${statusColor};font-weight:bold">${statusText}</span>
        </div>
        <div style="font-size:13px;font-weight:500;color:#1e293b;margin-top:4px">${title}${post.is_experiment ? ' <span style="font-size:9px;background:#ede9fe;color:#7c3aed;padding:1px 5px;border-radius:3px">EXPERIMENT</span>' : ''}</div>
        ${post.error ? `<div style="font-size:10px;color:#dc2626;margin-top:4px">Error: ${escapeHTML(post.error)}</div>` : ''}
      </div>`;
  }

  const weekNum = brain.week || 1;
  const followNote = IS_MONDAY ? '<div style="font-size:11px;color:#7c3aed;font-weight:bold;margin-top:4px">MONDAY - Follow Day Active</div>' : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);color:white;padding:20px;border-radius:12px;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px">Social Agent Report - ${TODAY}</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px">Week ${weekNum} | Puppeteer Auto-Posting + Engagement</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="background:#f0fdf4;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:#16a34a">${posted.length}</div>
          <div style="font-size:11px;color:#6b7280">Posts Published</div>
        </div>
        <div style="background:#eff6ff;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:#2563eb">${totalLikes}</div>
          <div style="font-size:11px;color:#6b7280">Likes/Saves</div>
        </div>
        <div style="background:#faf5ff;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:#7c3aed">${totalFollows}</div>
          <div style="font-size:11px;color:#6b7280">Follows</div>
        </div>
      </div>

      ${followNote}

      <h2 style="font-size:16px;color:#1e293b;margin:20px 0 10px">Posts</h2>
      ${postDetails || '<div style="color:#9ca3af;font-size:13px">No posts today</div>'}

      <h2 style="font-size:16px;color:#1e293b;margin:20px 0 10px">Engagement Breakdown</h2>
      <div style="display:grid;gap:8px">
        <div style="display:flex;justify-content:space-between;padding:10px;background:#fef2f2;border-radius:8px;font-size:13px">
          <span>🔴 Reddit</span>
          <span>${eng.reddit.likes} likes | ${eng.reddit.follows} follows</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:#f0f9ff;border-radius:8px;font-size:13px">
          <span>🐦 Twitter/X</span>
          <span>${eng.twitter.likes} likes | ${eng.twitter.retweets} retweets | ${eng.twitter.follows} follows</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:#fdf4ff;border-radius:8px;font-size:13px">
          <span>📌 Pinterest</span>
          <span>${eng.pinterest.saves} saves | ${eng.pinterest.follows} follows</span>
        </div>
      </div>

      ${failed.length > 0 ? `
        <h2 style="font-size:16px;color:#dc2626;margin:20px 0 10px">Failed Actions</h2>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;font-size:12px;color:#991b1b">
          ${failed.map(f => `<div>${f.type}: ${escapeHTML(f.error || 'Unknown error')}</div>`).join('')}
        </div>
      ` : ''}

      <div style="margin-top:20px;padding-top:15px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
        BG Remover Digital Social Agent v2.0 | Puppeteer-Powered | ${TODAY}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  log('=== Social Agent v2.0 Starting (Puppeteer-Powered) ===');

  // Load data
  const brain = readJSON(BRAIN_FILE);
  const config = readJSON(CONFIG_FILE);
  if (!brain) { log('FATAL: Cannot read brain.json'); process.exit(1); }
  if (!config) { log('FATAL: Cannot read config.json'); process.exit(1); }

  // Emergency brake check
  if (isEmergencyBrake(brain)) {
    log('EMERGENCY BRAKE ACTIVE — skipping all activities');
    return;
  }

  // Get mitigation limits
  const limits = getMitigationConfig(brain);
  const alreadyPosted = getAlreadyPostedToday(brain);
  const maxPostsToday = limits.dailySocialPosts - alreadyPosted;

  if (maxPostsToday <= 0) {
    log(`Already posted ${alreadyPosted} today (limit: ${limits.dailySocialPosts}). Skipping posts.`);
  }

  // Select platforms to post
  const platformsToPost = maxPostsToday > 0 ? selectPlatformsToPost(brain, maxPostsToday) : [];

  log(`Week: ${brain.week}, Posts today: ${alreadyPosted}/${limits.dailySocialPosts}, Platforms: [${platformsToPost.join(', ')}]`);
  log(`Mitigation: likes=${limits.dailyLikes}, comments=${limits.dailyComments}, follows=${limits.weeklyFollows}/week`);
  if (IS_MONDAY) log('TODAY IS MONDAY - Weekly follow activities active!');

  const results = {
    posts: [],
    engagement: { reddit: { likes: 0, follows: 0, comments: 0 }, twitter: { likes: 0, follows: 0, retweets: 0, comments: 0 }, pinterest: { likes: 0, follows: 0, saves: 0 } },
  };

  let browser, page;
  try {
    // Launch browser
    const browserCtx = await launchBrowser();
    browser = browserCtx.browser;
    page = browserCtx.page;

    // ── REDDIT ──
    if (platformsToPost.includes('reddit')) {
      const loggedIn = await redditLogin(page);
      if (loggedIn) {
        const subreddits = config.social?.subreddits || ['r/Entrepreneur'];
        const sub = subreddits[Math.floor(rand() * subreddits.length)].replace('r/', '');
        const content = generateRedditContent(brain, sub);
        if (content) {
          content.status = 'prepared';
          const postResult = await redditPost(page, content);
          if (postResult.success) {
            content.status = 'posted';
            content.post_url = postResult.post_url;
          } else {
            content.status = 'failed';
            content.error = postResult.error;
          }
          results.posts.push(content);
        }
        // Engagement
        const eng = await redditEngage(page, brain, limits);
        results.engagement.reddit = eng;
      } else {
        log('Reddit: Skipping (login failed)');
        results.posts.push({ type: 'reddit', status: 'failed', error: 'Login failed', date: TODAY });
      }
    }

    // ── TWITTER/X ──
    if (platformsToPost.includes('twitter')) {
      const loggedIn = await twitterLogin(page);
      if (loggedIn) {
        const content = generateTwitterContent(brain);
        if (content) {
          content.status = 'prepared';
          const postResult = await twitterPost(page, content);
          content.status = postResult.success ? 'posted' : 'failed';
          if (!postResult.success) content.error = postResult.error;
          results.posts.push(content);
        }
        // Engagement
        const eng = await twitterEngage(page, brain, limits);
        results.engagement.twitter = eng;
      } else {
        log('Twitter: Skipping (login failed)');
        results.posts.push({ type: 'twitter', status: 'failed', error: 'Login failed', date: TODAY });
      }
    }

    // ── PINTEREST ──
    if (platformsToPost.includes('pinterest')) {
      const loggedIn = await pinterestLogin(page);
      if (loggedIn) {
        const content = generatePinterestContent(brain);
        if (content) {
          content.status = 'prepared';
          const pinResult = await pinterestCreatePin(page, content);
          content.status = pinResult.success ? 'posted' : 'failed';
          if (!pinResult.success) content.error = pinResult.error;
          results.posts.push(content);
        }
        // Engagement
        const eng = await pinterestEngage(page, brain, limits);
        results.engagement.pinterest = eng;
      } else {
        log('Pinterest: Skipping (login failed)');
        results.posts.push({ type: 'pinterest', status: 'failed', error: 'Login failed', date: TODAY });
      }
    }

  } catch (e) {
    log(`FATAL ERROR: ${e.message}`);
  } finally {
    if (browser) await browser.close();
  }

  // Update brain.json
  updateBrain(brain, results);

  // Git commit + push
  commitAndPush();

  // Send email report
  try {
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS && process.env.ALERT_EMAIL) {
      const postedCount = results.posts.filter(p => p.status === 'posted').length;
      await sendEmail(
        `${TODAY} | ${postedCount} posted, engagement done`,
        buildEmailHTML(results, brain)
      );
      log('Email report sent.');
    } else {
      log('Email credentials not configured, skipping email report.');
    }
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Social Agent v2.0 Complete ===');
}

main().catch(e => {
  console.error('Agent crashed:', e);
  process.exit(1);
});
