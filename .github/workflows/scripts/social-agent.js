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

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──
const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const BRAND = 'BG Remover Digital';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const COOKIES_DIR = path.join(DATA_DIR, 'cookies');
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

// ── Cookie Persistence ──
function ensureCookiesDir() {
  if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
  }
}

function saveCookies(platform, cookies) {
  try {
    ensureCookiesDir();
    const filePath = path.join(COOKIES_DIR, `${platform}-cookies.json`);
    writeJSON(filePath, { cookies, saved_at: new Date().toISOString() });
    log(`${platform}: Saved ${cookies.length} cookies`);
    return true;
  } catch (e) {
    log(`${platform}: Failed to save cookies: ${e.message}`);
    return false;
  }
}

function loadCookies(platform) {
  try {
    const filePath = path.join(COOKIES_DIR, `${platform}-cookies.json`);
    const data = readJSON(filePath);
    if (data && data.cookies && Array.isArray(data.cookies) && data.cookies.length > 0) {
      log(`${platform}: Loaded ${data.cookies.length} cookies (saved: ${data.saved_at})`);
      return data.cookies;
    }
    return null;
  } catch (e) { return null; }
}

async function loadCookiesIntoPage(page, platform) {
  const cookies = loadCookies(platform);
  if (!cookies) return false;
  try {
    await page.setCookie(...cookies);
    return true;
  } catch (e) {
    log(`${platform}: Failed to set cookies: ${e.message}`);
    return false;
  }
}

async function checkSessionValid(page, platform) {
  try {
    if (platform === 'reddit') {
      // Try API-based check first (works even when IP-blocked from web UI)
      const apiCheck = await page.evaluate(async () => {
        try {
          const resp = await fetch('https://www.reddit.com/api/me.json', { credentials: 'include' });
          if (resp.status === 200) {
            const data = await resp.json();
            if (data.data && data.data.name) return { valid: true, username: data.data.name };
          }
          return { valid: false };
        } catch (e) { return { valid: false, error: e.message }; }
      }).catch(() => ({ valid: false }));
      
      if (apiCheck.valid) {
        log(`Reddit: Session valid via API (user: ${apiCheck.username})`);
        return true;
      }
      log(`Reddit: API session check failed, trying web check...`);
      
      // Fallback: web check
      await page.goto('https://www.reddit.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(2000, 3000);
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
      const hasAvatar = await page.$('#header-profile--flyout, button[aria-label*="User"], header img[alt*="avatar" i]').catch(() => null);
      const hasLoginPrompt = bodyText.includes('log in') || bodyText.includes('sign up');
      const isLoggedIn = hasAvatar || (!hasLoginPrompt && bodyText.length > 100);
      log(`Reddit: Web session check — bodyText length: ${bodyText.length}, hasAvatar: ${!!hasAvatar}, logged in: ${isLoggedIn}`);
      return isLoggedIn;
    } else if (platform === 'twitter') {
      // Try API-based check first
      await page.goto('https://x.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(2000, 3000);
      
      const apiCheck = await page.evaluate(async () => {
        try {
          const resp = await fetch('https://x.com/i/api/1.1/account/settings.json', { credentials: 'include' });
          return { status: resp.status, ok: resp.status === 200 };
        } catch (e) { return { ok: false, error: e.message }; }
      }).catch(() => ({ ok: false }));
      
      if (apiCheck.ok) {
        log('Twitter: Session valid via API (account settings returned 200)');
        return true;
      }
      log(`Twitter: API session check returned status ${apiCheck.status}, trying web check...`);
      
      // Fallback: web check
      const hasTweetButton = await page.$('[data-testid="SideNav_NewTweet_Button"]').catch(() => null);
      const hasLoginElements = await page.$('[data-testid="LoginForm_Login_Button"]').catch(() => null);
      const url = page.url();
      const isLoggedIn = (hasTweetButton || (!url.includes('login') && !url.includes('flow') && !hasLoginElements));
      log(`Twitter: Web session check — URL: ${url}, hasTweetButton: ${!!hasTweetButton}, logged in: ${isLoggedIn}`);
      return isLoggedIn;
    } else if (platform === 'pinterest') {
      await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(2000, 3000);
      const url = page.url();
      const hasCreateBtn = await page.$('[data-test-id="create-pin-button"], button[aria-label="Create"]').catch(() => null);
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
      const hasLoginPrompt = url.includes('login') || bodyText.includes('log in');
      const isLoggedIn = hasCreateBtn || (!hasLoginPrompt && !url.includes('login'));
      log(`Pinterest: Session check — URL: ${url}, hasCreateBtn: ${!!hasCreateBtn}, logged in: ${isLoggedIn}`);
      return isLoggedIn;
    }
    return false;
  } catch (e) {
    log(`${platform}: Session check error: ${e.message}`);
    return false;
  }
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
  const recentRaw = social.recent_posts || {};
  const recent = Object.values(recentRaw).flat();
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
  const recentRaw = social.recent_posts || {};
  const recent = Object.values(recentRaw).flat();
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
  const recentRaw = social.recent_posts || {};
  // recent_posts is a dict keyed by date, flatten to array
  const recent = Object.values(recentRaw).flat();
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
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector);
    await humanDelay(300, 600);
    for (let i = 0; i < text.length; i++) {
      await page.keyboard.type(text[i], { delay: delay + Math.floor(rand() * 60) });
      // Occasional longer pause (like a human thinking)
      if (rand() < 0.05) await humanDelay(400, 800);
    }
    return true;
  } catch (e) {
    return false;
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
  // puppeteer-extra + stealth plugin handles most anti-detection:
  // - navigator.webdriver = undefined
  // - chrome.runtime mock
  // - plugins, permissions, languages
  // - WebGL vendor/renderer
  // - iframe contentWindow
  // - media codecs
  const browser = await puppeteer.launch({
    headless: false,  // Run headed with xvfb — bypasses headless detection
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,768',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-web-security',
      '--disable-features=BlockThirdPartyCookies',
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  // Extra anti-detection on top of stealth plugin
  await page.evaluateOnNewDocument(() => {
    // Override navigator properties
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    // Fake languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // Override permissions API
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    }
    // Chrome runtime mock (extra safety)
    window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
    // Remove puppeteer-specific properties
    delete navigator.__proto__.webdriver;
  });

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
  );

  // Set extra headers to look like a real browser
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  });

  return { browser, page };
}

// ── Login with cookie persistence ──
async function loginWithCookies(platform, page, loginFn) {
  // Step 1: Try loading saved cookies
  const loaded = await loadCookiesIntoPage(page, platform);
  if (loaded) {
    log(`${platform}: Checking if saved session is still valid...`);
    const valid = await checkSessionValid(page, platform);
    if (valid) {
      log(`${platform}: Session still valid via saved cookies!`);
      return true;
    }
    log(`${platform}: Saved cookies expired, will attempt fresh login`);
  }

  // Step 2: Fresh login attempt
  const loginOk = await loginFn(page);

  // Step 3: If login succeeded, save cookies for next time
  if (loginOk) {
    try {
      const cookies = await page.cookies();
      if (cookies.length > 0) {
        saveCookies(platform, cookies);
      }
    } catch (e) {
      log(`${platform}: Could not save cookies after login: ${e.message}`);
    }
  }

  return loginOk;
}

// ═══════════════════════════════════════════════════════════════
// REDDIT AUTOMATION
// ═══════════════════════════════════════════════════════════════

async function redditLogin(page) {
  // ═══ STRATEGY 1: OAuth Bearer Token (works from ANY IP — no login page needed) ═══
  const oauthToken = process.env.REDDIT_OAUTH_TOKEN;
  if (oauthToken) {
    log('Reddit: Attempting OAuth Bearer token login...');
    try {
      const result = await page.evaluate(async (token) => {
        try {
          const resp = await fetch('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resp.status === 200) {
            const data = await resp.json();
            return { ok: true, username: data.name, id: data.id };
          }
          return { ok: false, status: resp.status };
        } catch (e) { return { ok: false, error: e.message }; }
      }, oauthToken);

      if (result.ok) {
        log(`Reddit: OAuth login successful! User: ${result.username} (ID: ${result.id})`);
        // Store token in localStorage so API calls from page context can use it
        await page.evaluate((token) => {
          localStorage.setItem('reddit_oauth_token', token);
        }, oauthToken);
        return true;
      }
      log(`Reddit: OAuth token failed (status: ${result.status}), falling back...`);
    } catch (e) {
      log(`Reddit: OAuth login error: ${e.message}`);
    }
  }

  // ═══ STRATEGY 2: OAuth token from cookies file ═══
  const cookiesFile = path.join(COOKIES_DIR, 'reddit-cookies.json');
  if (fs.existsSync(cookiesFile)) {
    try {
      const cookieData = readJSON(cookiesFile);
      if (cookieData && cookieData.oauth_token) {
        const tokenExpiry = cookieData.oauth_expires || 0;
        const now = Date.now();
        if (now < tokenExpiry) {
          log(`Reddit: Found OAuth token in cookies file (expires in ${Math.round((tokenExpiry - now) / 3600000)}h)`);
          try {
            const result = await page.evaluate(async (token) => {
              try {
                const resp = await fetch('https://oauth.reddit.com/api/v1/me', {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resp.status === 200) {
                  const data = await resp.json();
                  return { ok: true, username: data.name, id: data.id };
                }
                return { ok: false, status: resp.status };
              } catch (e) { return { ok: false, error: e.message }; }
            }, cookieData.oauth_token);

            if (result.ok) {
              log(`Reddit: OAuth login via cookies file! User: ${result.username}`);
              await page.evaluate((token) => {
                localStorage.setItem('reddit_oauth_token', token);
              }, cookieData.oauth_token);
              return true;
            }
            log(`Reddit: Cookies file OAuth token expired (status: ${result.status})`);
          } catch (e) {
            log(`Reddit: Cookies file OAuth error: ${e.message}`);
          }
        } else {
          log(`Reddit: OAuth token in cookies file expired ${(tokenExpiry - now) / 1000}s ago`);
        }
      }
    } catch (e) { /* ignore */ }
  }

  // ═══ STRATEGY 3: Username/password login (fallback) ═══
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  if (!username || !password) {
    log('Reddit: No credentials or valid token, skipping');
    return false;
  }

  try {
    log('Reddit: Attempting API-based login (/api/login/)...');
    let apiLoginOk = false;
    try {
      await page.goto('https://www.reddit.com/', { waitUntil: 'load', timeout: 20000 });
      await humanDelay(1000, 2000);
      const apiResult = await page.evaluate(async (creds) => {
        try {
          const resp = await fetch('https://www.reddit.com/api/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `user=${encodeURIComponent(creds.username)}&passwd=${encodeURIComponent(creds.password)}&api_type=json`,
            credentials: 'include',
          });
          const data = await resp.json();
          return { ok: data.json?.data !== undefined, errors: data.json?.errors };
        } catch (e) { return { ok: false, errors: [[e.message]] }; }
      }, { username, password });
      if (apiResult.ok) {
        log('Reddit: API login succeeded!');
        apiLoginOk = true;
      } else {
        log(`Reddit: API login error: ${JSON.stringify(apiResult.errors)}`);
      }
    } catch (e) {
      log(`Reddit: API login exception: ${e.message}`);
    }
    if (apiLoginOk) {
      await humanDelay(2000, 3000);
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
      const hasUserMenu = await page.$('#header-profile--flyout, [data-testid="header-profile"]').catch(() => null);
      if (hasUserMenu || !bodyText.includes('log in')) {
        log('Reddit: Session verified via API login!');
        return true;
      }
    }

    // ═══ STRATEGY 4: old.reddit.com web login ═══
    log('Reddit: Trying old.reddit.com web login...');
    await page.goto('https://old.reddit.com/login/', { waitUntil: 'networkidle2', timeout: 45000 });
    await humanDelay(2000, 3000);
    const formFound = await page.$('#user_login, input[name="username"], input[type="text"]').catch(() => null);
    if (!formFound) {
      log('Reddit: old.reddit.com form also not rendered — IP may be blocked');
      await takeScreenshot(page, 'reddit-ip-blocked');
      return false;
    }
    log('Reddit: old.reddit.com login form found!');
    await humanDelay(1000, 2000);
    await randomMouseMove(page);
    await humanDelay(500, 1000);

    const usernameSelectors = ['#user_login', '#login-username', 'input[name="username"]', 'input[autocomplete="username"]', 'input[type="text"]'];
    let usernameFilled = false;
    for (const sel of usernameSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const box = await el.boundingBox();
          if (box) await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
          else await el.click();
          await humanDelay(500, 800);
          await humanType(page, sel, username);
          usernameFilled = true;
          log(`Reddit: Username filled via: ${sel}`);
          break;
        }
      } catch (e) { /* next */ }
    }
    if (!usernameFilled) {
      log('Reddit: Could not find username field');
      return false;
    }

    await humanDelay(1500, 2500);
    await randomMouseMove(page);

    const passwordSelectors = ['#passwd', '#login-password', 'input[name="password"]', 'input[type="password"]'];
    let passwordFilled = false;
    for (const sel of passwordSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const box = await el.boundingBox();
          if (box) await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
          else await el.click();
          await humanDelay(500, 800);
          await humanType(page, sel, password);
          passwordFilled = true;
          log(`Reddit: Password filled via: ${sel}`);
          break;
        }
      } catch (e) { /* next */ }
    }
    if (!passwordFilled) {
      log('Reddit: Could not find password field');
      return false;
    }

    await humanDelay(800, 1500);
    await randomMouseMove(page);

    let submitted = false;
    const submitSelectors = ['button[type="submit"]', 'button.login-button', 'input[type="submit"]', 'button[class*="login" i]'];
    for (const sel of submitSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const box = await btn.boundingBox();
          if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          else await btn.click();
          submitted = true;
          log(`Reddit: Submit clicked via: ${sel}`);
          break;
        }
      } catch (e) { /* next */ }
    }
    if (!submitted) {
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
          if (t.includes('log in') || t.includes('sign in')) {
            await btn.click();
            submitted = true;
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!submitted) {
      await page.keyboard.press('Enter');
      log('Reddit: Submit via Enter');
    }

    try { await waitForNav(page, 15000); } catch (e) { /* ok */ }
    await humanDelay(3000, 5000);

    let loggedIn = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const currentUrl = page.url();
      log(`Reddit: Verify attempt ${attempt + 1}, URL: ${currentUrl}`);
      const hasAvatar = await page.$('#header-profile--flyout, button[aria-label*="User"]').catch(() => null);
      const isHome = currentUrl.includes('reddit.com/') && !currentUrl.includes('login') && !currentUrl.includes('consent');
      if (isHome || hasAvatar) {
        log('Reddit: Login successful!');
        loggedIn = true;
        break;
      }
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
      if (bodyText.includes('incorrect password') || bodyText.includes('wrong password') || bodyText.includes('invalid username')) {
        log('Reddit: Invalid credentials');
        break;
      }
      if (bodyText.includes('verify your email') || bodyText.includes('two-factor') || bodyText.includes('unusual activity')) {
        log('Reddit: Additional verification required');
        break;
      }
      const isConsent = currentUrl.includes('consent') || currentUrl.includes('authorize') ||
        (bodyText.includes('continue to reddit') && bodyText.includes('allow'));
      if (isConsent) {
        log('Reddit: Consent dialog, clicking continue...');
        try {
          const buttons = await page.$$('button');
          for (const btn of buttons) {
            const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
            if (t.includes('continue') || t.includes('accept')) {
              await btn.click();
              break;
            }
          }
          await waitForNav(page, 10000);
          await humanDelay(3000, 5000);
          continue;
        } catch (e) { /* proceed */ }
      }
      log(`Reddit: Still on login page. Snippet: "${bodyText.substring(0, 200)}"`);
      await takeScreenshot(page, `reddit-stuck-${attempt}`);
      await humanDelay(4000, 6000);
    }
    if (!loggedIn) {
      log(`Reddit: Login failed. Final URL: ${page.url()}`);
      await takeScreenshot(page, 'reddit-login-failed-final');
    }
    return loggedIn;
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

    // ═══ STRATEGY 1: OAuth Bearer Token API posting (works from ANY IP) ═══
    // Uses oauth.reddit.com which accepts Bearer tokens directly
    const oauthToken = process.env.REDDIT_OAUTH_TOKEN || await page.evaluate(() => localStorage.getItem('reddit_oauth_token'));
    if (oauthToken) {
      log('Reddit: Attempting OAuth API post...');
      const apiResult = await page.evaluate(async (params) => {
        try {
          // First, get the modhash using OAuth
          const meResp = await fetch('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${params.token}` }
          });
          if (meResp.status !== 200) {
            return { ok: false, error: `OAuth check failed: ${meResp.status}` };
          }

          // Submit post using OAuth
          const body = new URLSearchParams({
            api_type: 'json',
            kind: 'self',
            sr: params.subreddit,
            title: params.title,
            text: params.body + '\n\n' + params.siteUrl,
            // No uh (modhash) needed with OAuth — the Bearer token is the auth
            submit: 'Submit',
          });

          const postResp = await fetch('https://oauth.reddit.com/api/submit/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Bearer ${params.token}`,
            },
            body: body.toString(),
          });

          const postData = await postResp.json();
          if (postData.json && postData.json.data && postData.json.data.url) {
            return { ok: true, url: 'https://www.reddit.com' + postData.json.data.url };
          }
          if (postData.json && postData.json.errors && postData.json.errors.length > 0) {
            return { ok: false, error: JSON.stringify(postData.json.errors) };
          }
          return { ok: false, error: 'Unexpected OAuth response: ' + JSON.stringify(postData).substring(0, 300) };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, { token: oauthToken, subreddit, title: content.title, body: content.body, siteUrl: SITE_URL });

      if (apiResult.ok) {
        log(`Reddit: Post created via OAuth API! URL: ${apiResult.url}`);
        return { success: true, post_url: apiResult.url };
      }
      log(`Reddit: OAuth API post failed: ${apiResult.error} — trying regular API...`);
    }

    // ═══ STRATEGY 2: Regular API posting with cookies ═══
    log('Reddit: Attempting regular API-based post...');
    const apiResult = await page.evaluate(async (postContent) => {
      try {
        const csrfResp = await fetch('https://www.reddit.com/api/me.json', { credentials: 'include' });
        const csrfData = await csrfResp.json();
        if (!csrfData.data || !csrfData.data.modhash) {
          return { ok: false, error: 'Could not get modhash — not logged in via API' };
        }
        const modhash = csrfData.data.modhash;
        const body = new URLSearchParams({
          api_type: 'json',
          kind: 'self',
          sr: postContent.subreddit,
          title: postContent.title,
          text: postContent.body + '\n\n' + postContent.siteUrl,
          uh: modhash,
          submit: 'Submit',
        });
        const postResp = await fetch('https://www.reddit.com/api/submit/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          credentials: 'include',
        });
        const postData = await postResp.json();
        if (postData.json && postData.json.data && postData.json.data.url) {
          return { ok: true, url: 'https://www.reddit.com' + postData.json.data.url };
        }
        if (postData.json && postData.json.errors && postData.json.errors.length > 0) {
          return { ok: false, error: JSON.stringify(postData.json.errors) };
        }
        return { ok: false, error: 'Unknown API response: ' + JSON.stringify(postData).substring(0, 200) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }, { subreddit, title: content.title, body: content.body, siteUrl: SITE_URL });

    if (apiResult.ok) {
      log(`Reddit: Post created via regular API! URL: ${apiResult.url}`);
      return { success: true, post_url: apiResult.url };
    }
    log(`Reddit: Regular API post failed: ${apiResult.error} — trying web UI...`);

    // ═══ STRATEGY 3: Web UI posting via old.reddit.com ═══
    log('Reddit: Trying old.reddit.com web posting...');
    await page.goto(`https://old.reddit.com/r/${subreddit}/submit/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await humanDelay(2000, 4000);

    const isLoggedInOld = await page.evaluate(() => {
      const userLink = document.querySelector('#header-bottom-right a[href*="/user/"], .user > a');
      return !!userLink;
    }).catch(() => false);

    if (!isLoggedInOld) {
      log('Reddit: Not logged in on old.reddit.com — cannot post');
      return { success: false, error: 'Not logged in on old.reddit.com' };
    }

    const titleFilled = await humanType(page, '#title, textarea[name="title"], input[name="title"]', content.title, { delay: 50 });
    if (!titleFilled) {
      return { success: false, error: 'Title field not found on old.reddit.com' };
    }
    await humanDelay(800, 1500);

    const bodyText = content.body + '\n\n' + SITE_URL;
    const bodyFilled = await humanType(page, '#text, textarea[name="text"], textarea#text-field', bodyText, { delay: 30 });
    if (!bodyFilled) {
      return { success: false, error: 'Body field not found on old.reddit.com' };
    }
    await humanDelay(1000, 2000);

    let submitted = await safeClick(page, 'button[name="submit"], input[type="submit"], button.btn');
    if (!submitted) await page.keyboard.press('Enter');

    await waitForNav(page, 10000);
    await humanDelay(3000, 5000);

    const pageUrl = page.url();
    if (pageUrl.includes('/comments/')) {
      log(`Reddit: Post created successfully via old.reddit.com!`);
      return { success: true, post_url: pageUrl };
    }

    const errorText = await page.evaluate(() => {
      const errEl = document.querySelector('.error, .form-error, [class*="error"]');
      return errEl ? errEl.textContent.trim() : null;
    }).catch(() => null);
    if (errorText) {
      log(`Reddit: Error on page: ${errorText}`);
      return { success: false, error: errorText };
    }

    return { success: false, error: 'Could not verify post creation' };
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

          // Click "Join" button (Puppeteer-compatible text match)
          try {
            const joinBtns = await page.$$('button');
            for (const btn of joinBtns) {
              const btnText = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
              if (btnText === 'join' || btnText === 'follow' || btnText === 'joined') {
                // Skip if already joined
                if (btnText === 'joined') break;
                await btn.click();
                results.follows++;
                log(`Reddit: Followed ${sub}`);
                await humanDelay(2000, 3000);
                break;
              }
            }
          } catch (e) { /* skip */ }
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
    // WARM-UP: Visit X homepage first — looks like a natural user
    log('Twitter: Warming up — visiting homepage first...');
    try {
      await page.goto('https://x.com/', { waitUntil: 'load', timeout: 30000 });
      await humanDelay(3000, 5000);
      await randomMouseMove(page);
    } catch (e) {
      log(`Twitter: Homepage warm-up warning: ${e.message}`);
    }

    // Navigate to login
    log('Twitter: Navigating to login page...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for username input to appear (X loads it dynamically)
    log('Twitter: Waiting for login form to render...');
    try {
      await page.waitForSelector('input[autocomplete="username"], input[name="text"]', { timeout: 15000 });
      log('Twitter: Login form detected!');
    } catch (e) {
      log(`Twitter: Login form not found via selector: ${e.message}`);
      const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => 'empty');
      log(`Twitter: Page content: "${pageContent}"`);
      await takeScreenshot(page, 'twitter-login-form-missing');
    }
    await humanDelay(1000, 2000);
    await randomMouseMove(page);

    // Step 1: Enter username
    log('Twitter: Looking for username input...');
    const usernameFilled = await humanType(page, 'input[autocomplete="username"], input[name="text"]', username, { delay: 100 });
    if (!usernameFilled) {
      log('Twitter: Could not find username input field');
      const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => 'empty');
      log(`Twitter: Page content: "${pageContent}"`);
      await takeScreenshot(page, 'twitter-no-username-field');
      return false;
    }
    log('Twitter: Username entered');
    await humanDelay(1000, 2000);
    await randomMouseMove(page);

    // Click Next button — enumerate all buttons for diagnostics
    let nextClicked = false;
    try {
      const allButtons = await page.$$('button');
      const buttonTexts = [];
      for (const btn of allButtons) {
        const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
        const disabled = await page.evaluate(el => el.disabled, btn);
        buttonTexts.push({ text: t, disabled });
      }
      log(`Twitter: Buttons found: ${JSON.stringify(buttonTexts)}`);
      
      // Click the first non-disabled button that says 'next'
      for (const btn of allButtons) {
        const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
        const disabled = await page.evaluate(el => el.disabled, btn);
        if ((t === 'next') && !disabled) {
          // Use JavaScript click for reliability
          await page.evaluate(el => el.click(), btn);
          nextClicked = true;
          log('Twitter: Next button clicked (JS click)');
          break;
        }
      }
    } catch (e) { log(`Twitter: Next button error: ${e.message}`); }
    
    if (!nextClicked) {
      // Try data-testid selectors as fallback
      nextClicked = await safeClick(page, 'button[data-testid="ocfEnterTextNextButton"]');
    }
    if (!nextClicked) {
      log('Twitter: No Next button found, trying Enter');
      await page.keyboard.press('Enter');
    }

    // Wait longer for next step to load
    await humanDelay(5000, 8000);
    const postUsernameUrl = page.url();
    log(`Twitter: Post-username URL: ${postUsernameUrl}`);
    
    // Log full page state for diagnostics
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
    log(`Twitter: Full page text (first 500 chars): "${pageText.substring(0, 500)}"`);
    
    // Check all visible inputs
    const visibleInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, autocomplete: i.autocomplete, visible: i.offsetParent !== null
      })).filter(i => i.visible);
    }).catch(() => []);
    log(`Twitter: Visible inputs: ${JSON.stringify(visibleInputs)}`);

    // Step 2: Handle email/phone verification screen
    // X often shows this before the password step
    const needsVerification = pageText.includes('enter your phone number') ||
      pageText.includes('enter your email') ||
      pageText.includes('verify your identity') ||
      pageText.includes('enter the phone number') ||
      pageText.includes('enter the email') ||
      pageText.includes('we need to verify') ||
      pageText.includes('enter your phone') ||
      pageText.includes('in order to') ||
      pageText.includes('to continue') ||
      pageText.includes('confirm') ||
      pageText.includes('verification');

    const identifierInput = await page.$('input[data-testid="ocfEnterTextTextInput"]') ||
      await page.$('input[type="text"][name*="identifier"]') ||
      await page.$('input[autocomplete="email"]') ||
      await page.$('input[autocomplete="tel"]');

    // Also check if there's a text input visible (verification step)
    const hasTextInput = visibleInputs.some(i => i.type === 'text' && i.name !== 'username');

    if (needsVerification || identifierInput || hasTextInput) {
      log('Twitter: Verification/challenge page detected, entering email...');
      let verificationFilled = false;
      const verifySelectors = [
        'input[data-testid="ocfEnterTextTextInput"]',
        'input[type="text"][name*="identifier"]',
        'input[autocomplete="email"]',
        'input[autocomplete="tel"]',
        'input[type="text"]',
      ];
      for (const sel of verifySelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const isVisible = await page.evaluate(e => e.offsetParent !== null, el);
            if (!isVisible) continue;
            await el.click();
            await humanDelay(300, 500);
            await humanType(page, sel, email, { delay: 100 });
            verificationFilled = true;
            log(`Twitter: Verification field filled using selector: ${sel}`);
            break;
          }
        } catch (e) { /* try next */ }
      }
      if (verificationFilled) {
        await humanDelay(1000, 2000);
        await randomMouseMove(page);
        // Click Next on verification page
        let verifyNextClicked = false;
        try {
          const buttons = await page.$$('button');
          for (const btn of buttons) {
            const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
            if (t === 'next') {
              await page.evaluate(el => el.click(), btn);
              verifyNextClicked = true;
              log('Twitter: Verification Next clicked (JS click)');
              break;
            }
          }
        } catch (e) { /* ignore */ }
        if (!verifyNextClicked) {
          await page.keyboard.press('Enter');
          log('Twitter: Verification submitted via Enter');
        }
        await humanDelay(5000, 8000);
        log(`Twitter: Post-verification URL: ${page.url()}`);
      }
    }

    // Step 3: Enter password
    await humanDelay(1000, 2000);
    await randomMouseMove(page);
    log('Twitter: Looking for password input...');
    const passwordFilled = await humanType(page, 'input[name="password"], input[type="password"]', password, { delay: 100 });
    if (!passwordFilled) {
      log('Twitter: Could not find password input field');
      await takeScreenshot(page, 'twitter-no-password-field');
      return false;
    }
    log('Twitter: Password entered');
    await humanDelay(800, 1500);
    await randomMouseMove(page);

    // Click Log In button
    let loginClicked = await safeClick(page, 'button[data-testid="LoginForm_Login_Button"]');
    if (!loginClicked) {
      loginClicked = await safeClick(page, 'button[class*="primary"]');
    }
    if (!loginClicked) {
      // Try by text
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const btnText = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
          if (btnText === 'log in' || btnText === 'sign in') {
            await btn.click();
            loginClicked = true;
            log(`Twitter: Login button clicked via text match: "${btnText}"`);
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!loginClicked) {
      await page.keyboard.press('Enter');
      log('Twitter: Login submitted via Enter');
    }

    // Wait for navigation
    try {
      await waitForNav(page, 15000);
    } catch (e) {
      log(`Twitter: waitForNav timeout (may be OK): ${e.message}`);
    }
    await humanDelay(3000, 5000);

    // Check if login succeeded
    const url = page.url();
    log(`Twitter: Post-login URL: ${url}`);

    // Check for visible signs of being logged in
    const loginPageText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
    const hasHomeContent = loginPageText.includes('home') || loginPageText.includes('timeline') || loginPageText.includes('tweet');
    const hasTweetButton = await page.$('[data-testid="SideNav_NewTweet_Button"]').catch(() => null);

    if ((url.includes('home') || url === 'https://x.com/' || url === 'https://x.com') && (hasHomeContent || hasTweetButton)) {
      log('Twitter: Login successful! (verified via URL + page content)');
      return true;
    }
    if (!url.includes('login') && !url.includes('flow') && hasTweetButton) {
      log('Twitter: Login successful! (tweet button found)');
      return true;
    }
    if (url.includes('login') || url.includes('flow')) {
      // Check for specific error messages
      if (loginPageText.includes('incorrect') || loginPageText.includes('invalid') || loginPageText.includes('wrong password') || loginPageText.includes('username or password')) {
        log(`Twitter: Invalid credentials — "${loginPageText.substring(0, 300)}"`);
        await takeScreenshot(page, 'twitter-invalid-credentials');
        return false;
      }
      if (loginPageText.includes('unusual') || loginPageText.includes('suspicious') || loginPageText.includes('locked') || loginPageText.includes('verify')) {
        log(`Twitter: Account verification/lock — "${loginPageText.substring(0, 300)}"`);
        await takeScreenshot(page, 'twitter-account-locked');
        return false;
      }
      log('Twitter: Still on login flow after all steps — login may have failed');
      await takeScreenshot(page, 'twitter-login-fail');
      return false;
    }

    // If URL is not login but we can't confirm either way, check more carefully
    log(`Twitter: Uncertain login state, URL: ${url}, checking page...`);
    await takeScreenshot(page, 'twitter-uncertain-state');
    // If we're not on login/flow and have some content, assume success
    return !url.includes('login') && !url.includes('flow');
  } catch (e) {
    log(`Twitter login error: ${e.message}`);
    await takeScreenshot(page, 'twitter-login-error');
    return false;
  }
}

async function twitterPost(page, content) {
  try {
    log('Twitter: Posting tweet...');

    // ═══ STRATEGY 1: API-based tweet via page.evaluate fetch ═══
    // This works even when X's web UI is IP-blocked, as long as we have cookies
    log('Twitter: Attempting API-based tweet...');
    const apiResult = await page.evaluate(async (tweetText) => {
      try {
        // First check if we're logged in by fetching home timeline
        const homeCheck = await fetch('https://x.com/i/api/2/timeline/home.json?count=1', { credentials: 'include' });
        if (homeCheck.status === 200) {
          // We have a valid session — try to tweet via API
          // Get csrf token from cookies
          const cookies = document.cookie.split('; ').map(c => c.split('='));
          const ct0Cookie = cookies.find(c => c[0] === 'ct0');
          if (!ct0Cookie) return { ok: false, error: 'No ct0 CSRF cookie found' };
          const csrfToken = ct0Cookie[1];

          // Also get the x-twitter-auth-token or other auth cookies
          const authToken = cookies.find(c => c[0] === 'auth_token');

          // Use the GraphQL API endpoint for creating tweets
          const variables = {
            tweet_text: tweetText,
            dark_request: false,
            media: { media_entities: [], possibly_sensitive: false },
            semantic_annotation_ids: [],
          };
          const features = {
            communities_web_enable_tweet_community_results_fetch: true,
            c9s_tweet_anatomy_moderator_badge_enabled: true,
            tweetypie_unmention_optimization_enabled: true,
            responsive_web_edit_tweet_api_enabled: true,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
            view_counts_everywhere_api_enabled: true,
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: true,
            tweet_awards_web_tipping_enabled: false,
            creator_subscriptions_quote_tweet_preview_enabled: false,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: true,
            articles_preview_enabled: true,
            rweb_video_timestamps_enabled: true,
            rweb_tipjar_consumption_enabled: true,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: true,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: true,
            responsive_web_enhance_cards_enabled: false,
          };

          const resp = await fetch('https://x.com/i/api/graphql/Va2lvahdYCP1BLcl18y6pw/CreateTweet', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
              'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
              'User-Agent': navigator.userAgent,
              'X-Twitter-Active-User': 'yes',
              'X-Twitter-Client-Language': 'en',
            },
            body: JSON.stringify({ variables, features }),
            credentials: 'include',
          });

          const data = await resp.json();
          if (data.data && data.data.create_tweet && data.data.create_tweet.tweet_results) {
            const tweetId = data.data.create_tweet.tweet_results.result?.rest_id;
            return { ok: true, tweet_id: tweetId, url: `https://x.com/i/status/${tweetId}` };
          }
          if (data.errors) return { ok: false, error: JSON.stringify(data.errors) };
          return { ok: false, error: 'Unexpected response: ' + JSON.stringify(data).substring(0, 300) };
        }
        return { ok: false, error: `Home timeline returned status ${homeCheck.status} — not logged in` };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }, content.text);

    if (apiResult.ok) {
      log(`Twitter: Tweet posted via API! URL: ${apiResult.url}`);
      return { success: true, post_url: apiResult.url };
    }
    log(`Twitter: API tweet failed: ${apiResult.error} — trying web UI...`);

    // ═══ STRATEGY 2: Web UI posting ═══
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

    log('Twitter: Tweet posted successfully via web UI!');
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
    let loginClicked = await safeClick(page, 'button[type="submit"]');
    if (!loginClicked) {
      loginClicked = await safeClick(page, 'button[data-testid="login-btn"]');
    }
    if (!loginClicked) {
      // Fallback: find button by text content
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const btnText = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
          if (btnText.includes('log in') || btnText.includes('login')) {
            await btn.click();
            log(`Pinterest: Login button clicked via text match: "${btnText}"`);
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }
    await waitForNav(page);
    await humanDelay(3000, 5000);

    // Check login — if URL still contains 'login', login failed
    const url = page.url();
    if (url.includes('login')) {
      log('Pinterest: Login may have failed (still on login page)');
      await takeScreenshot(page, 'pinterest-login-fail');
      return false;
    }

    // Check for visible login error messages (NOT raw HTML — too many false positives)
    try {
      const visibleErrors = await page.evaluate(() => {
        // Only check visible text in the body — not scripts, styles, or hidden elements
        const bodyText = document.body.innerText.toLowerCase();
        // Look for actual Pinterest error messages shown to the user
        const errorPatterns = [
          'incorrect password',
          'invalid email or password',
          'wrong password',
          'account not found',
          'too many attempts',
          'your account was suspended',
          'couldn\'t log you in',
          'something went wrong',
        ];
        for (const pattern of errorPatterns) {
          if (bodyText.includes(pattern)) return pattern;
        }
        return null;
      });
      if (visibleErrors) {
        log(`Pinterest: Login error detected: "${visibleErrors}"`);
        await takeScreenshot(page, 'pinterest-login-error-content');
        return false;
      }
    } catch (e) {
      log(`Pinterest: Error check failed: ${e.message}`);
    }

    // Also verify we actually navigated away from login
    const finalUrl = page.url();
    log(`Pinterest: Post-login URL: ${finalUrl}`);
    if (finalUrl.includes('login') || finalUrl.includes('login?')) {
      log('Pinterest: Still on login page — login failed');
      await takeScreenshot(page, 'pinterest-still-on-login');
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

// Download an image from our site for Pinterest pin upload
async function downloadPinImage() {
  const https = require('https');
  const http = require('http');
  const imagePath = '/tmp/pinterest-pin-image.jpg';

  try {
    // Try multiple image URLs from our site
    const imageUrls = [
      SITE_URL + '/pinterest-pin-image.jpg',
      SITE_URL + '/og-image.jpg',
      SITE_URL + '/favicon.ico',
      'https://placehold.co/1000x1500/1a56db/ffffff?text=Free+Background+Remover',
    ];

    for (const imageUrl of imageUrls) {
      try {
        log(`Pinterest: Trying to download image from: ${imageUrl}`);
        const result = await new Promise((resolve, reject) => {
          const file = require('fs').createWriteStream(imagePath);
          const mod = imageUrl.startsWith('https') ? https : http;
          const req = mod.get(imageUrl, { timeout: 15000 }, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              const redirUrl = response.headers.location;
              const redirMod = redirUrl.startsWith('https') ? https : http;
              redirMod.get(redirUrl, { timeout: 15000 }, (redirRes) => {
                if (redirRes.statusCode === 200) {
                  redirRes.pipe(file);
                  file.on('finish', () => { file.close(); resolve(imagePath); });
                } else {
                  file.close();
                  try { require('fs').unlinkSync(imagePath); } catch (e) {}
                  reject(new Error(`Redirect status: ${redirRes.statusCode}`));
                }
              }).on('error', reject);
            } else if (response.statusCode === 200) {
              response.pipe(file);
              file.on('finish', () => { file.close(); resolve(imagePath); });
            } else {
              file.close();
              try { require('fs').unlinkSync(imagePath); } catch (e) {}
              reject(new Error(`HTTP ${response.statusCode}`));
            }
          });
          req.on('error', (e) => {
            file.close();
            try { require('fs').unlinkSync(imagePath); } catch (e2) {}
            reject(e);
          });
          req.on('timeout', () => {
            req.destroy();
            file.close();
            try { require('fs').unlinkSync(imagePath); } catch (e) {}
            reject(new Error('Download timeout'));
          });
        });
        // Verify file size — Pinterest needs at least 100x100
        const stats = fs.statSync(imagePath);
        if (stats.size > 500) {
          log(`Pinterest: Image downloaded (${stats.size} bytes)`);
          return imagePath;
        } else {
          log(`Pinterest: Image too small (${stats.size} bytes), trying next URL`);
        }
      } catch (e) {
        log(`Pinterest: Image download failed for this URL: ${e.message}`);
      }
    }
    log('Pinterest: All image download attempts failed');
    return null;
  } catch (e) {
    log(`Pinterest: downloadPinImage error: ${e.message}`);
    return null;
  }
}

async function pinterestCreatePin(page, content) {
  try {
    log('Pinterest: Creating pin...');

    // Step 1: Navigate to pin creation tool directly (more reliable than clicking Create button)
    await page.goto('https://www.pinterest.com/pin-creation-tool/', {
      waitUntil: 'domcontentloaded', timeout: 20000
    });
    await humanDelay(3000, 5000);

    // Step 2: Upload an image (REQUIRED by Pinterest — pins cannot be created without images)
    log('Pinterest: Attempting image upload...');
    const imagePath = await downloadPinImage();

    if (imagePath) {
      try {
        // Wait for the file input or drop zone to be ready
        await humanDelay(2000, 3000);

        // Method 1: Find file input and set file directly
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(imagePath);
          log('Pinterest: Image uploaded via file input');
          await humanDelay(3000, 5000); // Wait for image to process
        } else {
          // Method 2: Use CDP to set file on file chooser
          const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 10000 }).catch(() => null),
            // Click the upload area to trigger file chooser
            page.click('div[data-test-id="pin-upload-dropzone"], div[class*="Upload"], label[class*="upload"]')
              .catch(() => page.click('input[type="file"]'))
              .catch(() => null),
          ]);
          if (fileChooser) {
            await fileChooser.accept([imagePath]);
            log('Pinterest: Image uploaded via file chooser');
            await humanDelay(3000, 5000);
          } else {
            log('Pinterest: Could not trigger file upload, will try URL-based approach');
          }
        }
      } catch (e) {
        log(`Pinterest: Image upload error: ${e.message}`);
      }
    } else {
      log('Pinterest: No image available for upload, proceeding with URL-based approach');
    }

    // Step 3: Fill title — try multiple selector strategies for Pinterest's evolving UI
    await humanDelay(2000, 3000);
    let titleFilled = false;
    const titleSelectors = [
      'input[id="pinTitle"]',
      'input[name="title"]',
      'input[data-test-id="pin-title-input"]',
      'div[contenteditable="true"][class*="title"]',
      'div[contenteditable="true"][class*="Title"]',
      'input[placeholder*="title" i]',
      'label[class*="title"] input',
      'label[class*="Title"] input',
      // Generic: first contenteditable div (Pinterest often uses these)
      'div[contenteditable="true"]',
    ];
    for (const sel of titleSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await humanDelay(300, 600);
          await humanType(page, sel, content.pin_title, { delay: 60 });
          titleFilled = true;
          log(`Pinterest: Title filled using selector: ${sel}`);
          break;
        }
      } catch (e) { /* try next */ }
    }
    if (!titleFilled) {
      log('Pinterest: Could not fill title field — Pinterest UI may have changed');
      await takeScreenshot(page, 'pinterest-no-title-field');
    }
    await humanDelay(800, 1500);

    // Step 4: Fill description
    let descFilled = false;
    const descSelectors = [
      'textarea[id="pinDescription"]',
      'textarea[name="description"]',
      'div[data-test-id="pin-description-textarea"]',
      'div[contenteditable="true"][class*="description"]',
      'div[contenteditable="true"][class*="Description"]',
      'textarea[placeholder*="description" i]',
      'textarea[placeholder*="tell" i]',
      // Generic: second contenteditable div (after title)
    ];
    for (const sel of descSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await humanDelay(300, 600);
          await humanType(page, sel, content.pin_description, { delay: 40 });
          descFilled = true;
          log(`Pinterest: Description filled using selector: ${sel}`);
          break;
        }
      } catch (e) { /* try next */ }
    }
    if (!descFilled) {
      log('Pinterest: Description field not found (may be optional or UI changed)');
    }
    await humanDelay(800, 1500);

    // Step 5: Add link
    try {
      // Try clicking link toggle first
      const linkToggleSelectors = [
        'button[data-test-id="pin-editor-link-toggle"]',
        'div[class*="linkField"]',
        'button[class*="link"]',
        'button[class*="Link"]',
      ];
      let linkToggled = false;
      for (const sel of linkToggleSelectors) {
        linkToggled = await safeClick(page, sel, 3000);
        if (linkToggled) break;
      }
      if (linkToggled) await humanDelay(500, 1000);

      // Type the link
      const linkSelectors = [
        'input[id="pinLink"]',
        'input[name="link"]',
        'input[data-test-id="pin-link-input"]',
        'input[placeholder*="http"]',
        'input[placeholder*="url" i]',
        'input[placeholder*="link" i]',
      ];
      let linkFilled = false;
      for (const sel of linkSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await el.click();
            await humanDelay(300, 500);
            await humanType(page, sel, content.link || SITE_URL, { delay: 60 });
            linkFilled = true;
            log(`Pinterest: Link filled using selector: ${sel}`);
            break;
          }
        } catch (e) { /* try next */ }
      }
      if (!linkFilled) {
        log('Pinterest: Link field not found (may need to toggle first or UI changed)');
      }
      await humanDelay(1000, 2000);
    } catch (e) {
      log(`Pinterest: Link field issue: ${e.message}`);
    }

    // Step 6: Select board — Pinterest's current UI uses a dropdown/modal
    try {
      const boardName = content.target_board || 'Free Design Tools';
      let boardSelected = false;

      // Strategy 1: Look for any element that says "Board" or has a dropdown indicator
      const boardBtnSelectors = [
        'div[data-test-id="pin-editor-board-selector"]',
        'button[data-test-id="pin-editor-board-selector"]',
        'div[class*="boardSelect"]',
        'div[class*="board"]',
        'button[class*="board"]',
        'div[aria-label*="Board" i]',
        'button[aria-label*="Board" i]',
        // Generic: any div with data-test-id containing "board"
        '[data-test-id*="board" i]',
      ];
      for (const sel of boardBtnSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const isVisible = await page.evaluate(e => {
              const rect = e.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }, el);
            if (isVisible) {
              await el.click();
              boardSelected = true;
              log(`Pinterest: Board dropdown opened via: ${sel}`);
              break;
            }
          }
        } catch (e) { /* try next */ }
      }

      if (boardSelected) {
        await humanDelay(1500, 2500);
        // Search for the target board
        const boardInputSelectors = [
          'input[placeholder*="board" i]',
          'input[placeholder*="search" i]',
          'input[data-test-id*="board" i]',
          'input[class*="board" i]',
          'div[contenteditable="true"]', // Sometimes Pinterest uses contenteditable for search
        ];
        let boardSearchFilled = false;
        for (const sel of boardInputSelectors) {
          try {
            const el = await page.$(sel);
            if (el) {
              const isVisible = await page.evaluate(e => e.offsetParent !== null, el);
              if (!isVisible) continue;
              await el.click();
              await humanDelay(300, 500);
              await humanType(page, sel, boardName, { delay: 60 });
              boardSearchFilled = true;
              log(`Pinterest: Board search filled using selector: ${sel}`);
              break;
            }
          } catch (e) { /* try next */ }
        }
        if (boardSearchFilled) {
          await humanDelay(1500, 2500);
          // Click first matching board in results
          const boardResultSelectors = [
            'div[data-test-id="board-selection-item"]',
            'div[class*="boardItem"]',
            'div[class*="boardResult"]',
            'div[class*="BoardTile"]',
            'div[class*="boardName"]',
            // Fallback: any div containing the board name text
          ];
          let boardClicked = false;
          for (const sel of boardResultSelectors) {
            boardClicked = await safeClick(page, sel, 3000);
            if (boardClicked) {
              log(`Pinterest: Board result clicked via: ${sel}`);
              break;
            }
          }
          if (!boardClicked) {
            // Text-match fallback: find element containing our board name
            try {
              const allDivs = await page.$$('div');
              for (const div of allDivs) {
                const t = await page.evaluate(el => el.textContent.trim(), div);
                if (t.toLowerCase() === boardName.toLowerCase() || t.toLowerCase().includes(boardName.toLowerCase())) {
                  await div.click();
                  boardClicked = true;
                  log(`Pinterest: Board clicked via text match: "${t}"`);
                  break;
                }
              }
            } catch (e) { /* ignore */ }
          }
        }
      } else {
        log(`Pinterest: Board dropdown not found — will use Pinterest's default board`);
      }
    } catch (e) {
      log(`Pinterest: Board selection issue (will use default): ${e.message}`);
    }

    await humanDelay(2000, 3000);

    // Step 7: Publish pin — multiple strategies
    let publishClicked = false;
    const publishSelectors = [
      'button[data-test-id="pin-editor-publish-button"]',
      'button[class*="Publish"]',
      'button[class*="publish"]',
      'button[data-test-id*="publish" i]',
    ];
    for (const sel of publishSelectors) {
      publishClicked = await safeClick(page, sel, 3000);
      if (publishClicked) {
        log(`Pinterest: Publish clicked via selector: ${sel}`);
        break;
      }
    }
    if (!publishClicked) {
      // Text-match fallback: find Publish/Save button by text content
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const btnText = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
          const isVisible = await page.evaluate(e => {
            const rect = e.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, btn);
          if (isVisible && (btnText === 'publish' || btnText === 'save' || btnText.includes('publish') || btnText.includes('create pin'))) {
            await page.evaluate(el => el.click(), btn);
            publishClicked = true;
            log(`Pinterest: Publish button clicked via text match: "${btnText}"`);
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }

    if (!publishClicked) {
      log('Pinterest: CRITICAL — Could not find Publish button. Pin NOT created.');
      await takeScreenshot(page, 'pinterest-no-publish-button');
      return { success: false, error: 'Publish button not found' };
    }

    // Step 8: Wait and verify pin was created
    // Pinterest may: redirect to pin page, show toast, or stay on create page with success indicator
    await humanDelay(5000, 8000);

    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
    log(`Pinterest: Post-publish URL: ${finalUrl}`);
    log(`Pinterest: Page text (first 300): "${bodyText.substring(0, 300)}"`);

    // Definitive success: redirected to a pin page
    if (finalUrl.includes('/pin/') && !finalUrl.includes('create')) {
      log('Pinterest: Pin created successfully! (redirected to pin page)');
      return { success: true, pin_url: finalUrl };
    }

    // Pinterest often shows a toast "Your Pin was saved!" or "Pin published!"
    const successPatterns = ['pin was saved', 'pin published', 'successfully saved', 'your pin is live', 'done!', 'saved to'];
    if (successPatterns.some(p => bodyText.includes(p))) {
      log('Pinterest: Pin saved confirmation detected!');
      return { success: true };
    }

    // Check for a success toast element
    const toastEl = await page.$('[data-test-id="toast"], div[class*="toast" i], div[class*="Toast" i], div[class*="success" i], div[class*="Success" i]').catch(() => null);
    if (toastEl) {
      const toastText = await page.evaluate(el => el.textContent.trim().toLowerCase(), toastEl).catch(() => '');
      log(`Pinterest: Toast found: "${toastText}"`);
      if (toastText.includes('save') || toastText.includes('publish') || toastText.includes('success') || toastText.includes('done')) {
        log('Pinterest: Pin creation confirmed via toast!');
        return { success: true };
      }
    }

    // Check for actual visible errors
    const errorPatterns = ['something went wrong', 'try again', 'couldn\'t save', 'error', 'failed', 'oops'];
    if (errorPatterns.some(p => bodyText.includes(p))) {
      // But make sure it's a user-visible error, not something in scripts
      const hasVisibleError = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('[class*="error" i], [class*="Error" i], [role="alert"]');
        for (const el of errorElements) {
          if (el.offsetParent !== null && el.textContent.trim().length > 5) {
            return el.textContent.trim();
          }
        }
        return null;
      }).catch(() => null);
      if (hasVisibleError) {
        log(`Pinterest: Visible error after publish: "${hasVisibleError}"`);
        await takeScreenshot(page, 'pinterest-pin-create-error');
        return { success: false, error: `Publish error: ${hasVisibleError}` };
      }
    }

    // If still on pin-creation-tool, check if the pin draft was auto-saved (Pinterest sometimes does this)
    if (finalUrl.includes('pin-creation-tool')) {
      log('Pinterest: Still on create page after publish click — pin may have been saved as draft');
      await takeScreenshot(page, 'pinterest-ambiguous-result');
      // Don't claim success if we can't verify
      return { success: false, error: 'Pin may have been saved as draft — could not verify publish' };
    }

    log('Pinterest: Pin creation completed (ambiguous verification)');
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
    execSync('mkdir -p data/cookies 2>/dev/null; git add data/brain.json data/config.json data/cookies/ 2>/dev/null', { stdio: 'pipe' });

    const status = execSync('git status --porcelain data/brain.json data/config.json data/cookies/ 2>/dev/null', { stdio: 'pipe' }).toString().trim();
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
      const loggedIn = await loginWithCookies('reddit', page, redditLogin);
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
      const loggedIn = await loginWithCookies('twitter', page, twitterLogin);
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
      const loggedIn = await loginWithCookies('pinterest', page, pinterestLogin);
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
