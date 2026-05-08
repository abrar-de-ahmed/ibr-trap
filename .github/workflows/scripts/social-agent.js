#!/usr/bin/env node
/**
 * BG Remover Digital — Social Agent
 * Cross-Platform Engagement Engine
 * Runs daily at 10:00 UTC via GitHub Actions
 *
 * MISSION: Prepare social media content for Reddit, Twitter/X, Pinterest, and Medium
 *   - Reads brain.json + config.json for state and configuration
 *   - Respects emergency brake and weekly mitigation limits
 *   - Generates platform-specific content (NO auto-posting without API tokens)
 *   - Saves prepared posts to brain.json for persistence
 *   - Commits changes and sends email report
 *
 * STRATEGY:
 *   - 80/20 rule: 80% best-performing formats, 20% experiments
 *   - Platform rotation to avoid overposting on any single channel
 *   - Content variety: features, use cases, tips, and community value
 *   - Friendly-professional tone, never aggressive marketing
 *   - Never mentions img.ly — use "AI technology" or "client-side AI"
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──
const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const BRAND = 'BG Remover Digital';
const BRAND_VOICE = 'friendly-professional';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const BRAIN_FILE = path.join(DATA_DIR, 'brain.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();

function log(msg) {
  console.log(`[Social Agent ${new Date().toISOString()}] ${msg}`);
}

// ── Data I/O ──
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    log(`ERROR reading ${filePath}: ${e.message}`);
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Pseudo-random seeded by date (deterministic per day) ──
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

const rand = seededRandom(TODAY + '-social-agent');

// ── Emergency Brake ──
function isEmergencyBrake(brain) {
  return brain && brain.emergency && brain.emergency.brake_active === true;
}

// ── Mitigation Limits ──
function getMaxPostsPerDay(week) {
  const limits = { 1: 1, 2: 2, 3: 3, 4: 5 };
  return limits[week] || limits[4];
}

function getAlreadyPostedToday(brain) {
  const social = brain.social || {};
  const recent = social.recent_posts || [];
  return recent.filter(p => p.date === TODAY).length;
}

// ── Platform Rotation ──
function getRecentPlatforms(brain) {
  const social = brain.social || {};
  const recent = social.recent_posts || [];
  // Get platforms used in last 3 days
  const threeDaysAgo = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return recent.filter(p => p.date >= threeDaysAgo).map(p => p.platform);
}

function selectPlatformsToPost(brain, maxPosts) {
  const allPlatforms = ['reddit', 'twitter', 'pinterest', 'medium'];
  const recentPlatforms = getRecentPlatforms(brain);
  const social = brain.social || {};

  // Score platforms: prefer ones NOT used recently, boost higher engagement
  const scored = allPlatforms.map(platform => {
    let score = 10; // base score
    const recentCount = recentPlatforms.filter(p => p === platform).length;
    score -= recentCount * 5; // penalize recently used platforms

    // Boost by engagement if data exists
    const platformData = social[platform] || {};
    const engagement = platformData.avg_engagement || platformData.avg_clicks || platformData.avg_reads || 0;
    score += engagement * 0.1;

    // Check if platform is active
    if (platformData.status === 'inactive' || platformData.status === 'paused') {
      score -= 100;
    }

    return { platform, score };
  });

  // Sort by score descending, pick top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPosts).map(s => s.platform);
}

// ── 80/20 Rule: Experiment or Best Format ──
function shouldExperiment() {
  return rand() < 0.2;
}

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

// ── Content Templates ──

// Reddit content templates
const redditTemplates = {
  toolShare: [
    {
      title: 'I built a free background remover that runs entirely in your browser — no signup needed',
      body: (subreddit) => {
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
      body: (subreddit) => {
        const angles = [
          'For anyone running an online store or selling products, clean product photos make a huge difference in click-through rates. I built a free tool that removes backgrounds from product images right in your browser.\n\nNo account needed, no watermarks, and because it runs client-side, you can literally use it offline once the page loads. Handles furniture, electronics, clothing, food — pretty much anything.\n\nI know a lot of folks here pay $10-30/month for background removal, so hoping this saves some people money. Let me know if there\'s a specific product type you\'d like better support for.',
          'Clean product photography shouldn\'t require expensive software or sending your images to some random server. I put together a free browser tool that does instant background removal with client-side AI.\n\nIt\'s particularly good with ecommerce product shots — clothing, accessories, electronics, home goods. You get a transparent PNG you can drop straight into your listing. No signup, no limits, completely free.\n\nWould appreciate any feedback from the sellers here on what would make this more useful for your workflow.',
        ];
        return angles[Math.floor(rand() * angles.length)];
      }
    },
    {
      title: 'What\'s the best way to remove backgrounds from photos without paying for Photoshop?',
      body: (subreddit) => {
        return 'I was looking for a solution recently and ended up building my own because everything else was either too expensive or too limited. Made it free and browser-based — no signup, no downloads.\n\nIt uses client-side AI to handle the cutting, so your images don\'t get uploaded anywhere. Works well for most common cases: product photos, portraits, logos, social media posts.\n\nNot trying to replace Photoshop for complex editing, but for quick background removal it\'s been surprisingly reliable. Check it out if you need something like this.';
      }
    },
  ],
  helpfulShare: [
    {
      title: 'Protip: You can remove backgrounds from any image for free directly in your browser',
      body: (subreddit) => {
        return 'Just wanted to share a tool I\'ve been using that saves me a ton of time. It\'s a free background remover that works entirely in your browser — no install, no account, no catch.\n\nI use it for:\n• Cleaning up product photos before listing them\n• Making transparent PNGs for design work\n• Removing backgrounds from screenshots for presentations\n• Creating profile pictures with custom backgrounds\n\nRuns on client-side AI so it\'s private and fast. Thought others here might find it useful too.';
      }
    },
    {
      title: 'I automated my product photo workflow with a free browser tool — no more manual background removal',
      body: (subreddit) => {
        return 'If you\'re processing more than a handful of product photos, removing backgrounds manually is soul-crushing. I found (and contributed to) a free browser tool that does it automatically using client-side AI.\n\nThe workflow is: upload → instant transparent cutout → download. That\'s it. No layers, no magic wand, no edge cleanup needed in most cases.\n\nIt handles tricky stuff like hair, furry items, and transparent objects better than I expected. Completely free, no signup. Just wanted to share because it\'s saved me hours this week alone.';
      }
    },
  ],
};

// Twitter/X content templates
const twitterTemplates = {
  featureFocused: [
    'Remove any background in seconds — free, no signup, works right in your browser. Your images never leave your device. 🎨✨ {SITE}',
    'Client-side AI background removal that actually works. No upload, no account, no watermarks. Just results. Try it free → {SITE}',
    'Built a background remover that runs 100% in your browser. No server. No signup. No catch. Works offline too. → {SITE} #BackgroundRemover #FreeTool',
  ],
  useCaseFocused: [
    'Running an online store? Clean product photos increase conversions. Remove backgrounds for free in your browser → {SITE} #Ecommerce #ProductPhotography',
    'Need transparent backgrounds for logos, profile pics, or design work? Free browser tool, no signup needed → {SITE} #DesignTools #FreeTool',
    'Side hustle sellers — this free background remover saves me hours every week. No signup, works in browser → {SITE} #SideHustle #EtsySeller',
  ],
  tipFocused: [
    'Pro tip: Clean white backgrounds on product photos can boost sales by up to 30%. Remove backgrounds free → {SITE} #SmallBusiness #PhotographyTip',
    'Your profile picture with a clean background looks 10x more professional. Remove it free in 3 seconds → {SITE} #PersonalBranding',
  ],
  memeStyle: [
    'Me: "I need to remove this background"\nAlso me: *opens Photoshop, 30 min trial*\nTool: "bruh just use me" → {SITE} #BackgroundRemover',
    'POV: You just discovered you can remove backgrounds for free in your browser without any signup → {SITE} 🤯',
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
    description: 'Professional product photos start with a clean background. Remove backgrounds from your product images for free — no signup, no watermarks, no limits. Works entirely in your browser so your images stay private. Get studio-quality cutouts in seconds.',
    board: 'Ecommerce Photography',
    link: '/remove-background/product-photos',
  },
  {
    title: 'How to Remove Backgrounds from Photos - Free Browser Tool',
    description: 'Learn how to remove backgrounds from any photo using our free online tool. No software download needed — works directly in your browser. Client-side AI handles complex edges like hair, fur, and transparent objects. Step-by-step guide included.',
    board: 'Background Removal Tips',
    link: '/remove-background/how-to-remove',
  },
  {
    title: 'Free White Background Maker for Product Listings',
    description: 'Create clean white backgrounds for your online store listings instantly. Our free tool removes any background and lets you replace it with white — perfect for Amazon, Shopify, Etsy, and eBay sellers. No signup, no watermarks, browser-based.',
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
    description: 'Easily remove backgrounds from pet and animal photos with our free AI-powered tool. Handles fur, whiskers, and complex edges beautifully. Works in your browser — no signup, no upload to servers. Great for creating pet portraits and fun composites.',
    board: 'Photography Tips',
    link: '/remove-background/pets',
  },
  {
    title: 'Free Logo Background Remover - Instant Transparent Logos',
    description: 'Need your logo on a transparent background? Our free tool removes logo backgrounds instantly in your browser. No signup, no software needed. Get a clean PNG ready for any use — website, business cards, social media, presentations.',
    board: 'Free Design Tools',
    link: '/remove-background/logos',
  },
  {
    title: 'ID Photo Background Remover - Free Online Tool',
    description: 'Remove and replace backgrounds on ID photos, passport photos, and profile pictures. Our free tool works in your browser with client-side AI — your photos stay private. Perfect for visa applications, employee badges, and professional headshots.',
    board: 'Photography Tips',
    link: '/remove-background/id-photos',
  },
];

// Medium content planning templates
const mediumTopics = [
  {
    title: '5 Free Tools That Replace Photoshop for Background Removal',
    keywords: ['background remover', 'free photoshop alternative', 'remove background online'],
    outline: [
      'Why you don\'t need Photoshop for simple background removal',
      'Top 5 free browser-based alternatives compared',
      'When to use each tool (product photos, portraits, logos)',
      'Privacy considerations: client-side vs server-side processing',
      'My recommendation and why I built my own',
    ],
  },
  {
    title: 'How Clean Product Photos Can Double Your E-commerce Sales',
    keywords: ['product photography', 'ecommerce sales', 'background removal'],
    outline: [
      'The data: how background quality affects conversion rates',
      'Common mistakes in product photography',
      'Step-by-step: creating professional product photos at zero cost',
      'Before/after examples and A/B test results',
      'Tools and workflow for consistent product imagery',
    ],
  },
  {
    title: 'The Complete Guide to Background Removal for Online Sellers',
    keywords: ['background removal guide', 'online seller tips', 'product photos'],
    outline: [
      'Why background removal matters for online marketplaces',
      'Amazon, Shopify, and Etsy image requirements explained',
      'Free tools vs paid services: cost-benefit analysis',
      'Batch processing tips for large catalogs',
      'Creating a consistent brand look with clean backgrounds',
    ],
  },
  {
    title: 'Client-Side AI: Why Your Images Should Never Leave Your Browser',
    keywords: ['client-side AI', 'privacy', 'browser-based tools'],
    outline: [
      'The privacy problem with cloud-based image editing',
      'How client-side AI works (in plain English)',
      'Performance comparison: browser vs cloud processing',
      'Use cases where client-side matters most',
      'The future of privacy-first web applications',
    ],
  },
  {
    title: 'How to Remove Backgrounds from 100+ Product Photos in Under an Hour',
    keywords: ['bulk background removal', 'product photography workflow', 'efficiency'],
    outline: [
      'The challenge of scaling product photography',
      'Setting up an efficient background removal workflow',
      'Tools for batch processing (free and paid)',
      'Quality control tips for consistent results',
      'Automating repetitive image editing tasks',
    ],
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
  // Always include at least one general hashtag
  if (!selected.some(h => hashtagPools.general.includes(h))) {
    selected.unshift(hashtagPools.general[Math.floor(rand() * hashtagPools.general.length)]);
  }
  return selected.slice(0, count + 1).join(' ');
}

// ── Content Generators ──

function generateRedditContent(brain, config, subreddit) {
  const social = brain.social || {};
  const isExperiment = shouldExperiment();

  let templatePool;
  if (isExperiment) {
    // Experiment: try the less-used category
    templatePool = redditTemplates.helpfulShare;
  } else {
    // 80%: use best-performing or rotate between all templates
    const allTemplates = [...redditTemplates.toolShare, ...redditTemplates.helpfulShare];
    templatePool = allTemplates;
  }

  const template = templatePool[Math.floor(rand() * templatePool.length)];
  const title = template.title;
  const body = template.body(subreddit);

  if (!isContentUnique(brain, title)) {
    // Try another template
    const fallback = templatePool[(templatePool.indexOf(template) + 1) % templatePool.length];
    const fallbackTitle = fallback.title;
    const fallbackBody = fallback.body(subreddit);
    if (!isContentUnique(brain, fallbackTitle)) {
      log('  Could not generate unique Reddit content for ' + subreddit);
      return null;
    }
    return {
      type: 'reddit',
      subreddit,
      title: fallbackTitle,
      body: fallbackBody,
      link: SITE_URL,
      engagement_estimate: 'medium',
      date: TODAY,
      status: 'prepared',
      is_experiment: isExperiment,
    };
  }

  return {
    type: 'reddit',
    subreddit,
    title,
    body,
    link: SITE_URL,
    engagement_estimate: 'medium',
    date: TODAY,
    status: 'prepared',
    is_experiment: isExperiment,
  };
}

function generateTwitterContent(brain) {
  const isExperiment = shouldExperiment();
  let category;

  if (isExperiment) {
    category = 'memeStyle';
  } else {
    // Rotate between categories based on performance or randomly
    const categories = ['featureFocused', 'useCaseFocused', 'tipFocused'];
    category = categories[Math.floor(rand() * categories.length)];
  }

  const templates = twitterTemplates[category];
  let text = templates[Math.floor(rand() * templates.length)];

  // Add hashtags
  let hashtagCategory = 'general';
  if (category === 'useCaseFocused') hashtagCategory = 'ecommerce';
  else if (category === 'tipFocused') hashtagCategory = 'photography';

  const hashtags = pickHashtags(hashtagCategory);

  text = text.replace('{SITE}', SITE_URL);

  // Ensure within 280 chars
  if (text.length + hashtags.length + 1 > 280) {
    text = text.substring(0, 279 - hashtags.length - 1) + '…';
  }

  const fullTweet = text + '\n' + hashtags;

  if (!isContentUnique(brain, fullTweet)) {
    // Try another template
    const fallback = templates[(templates.indexOf(text) + 1) % templates.length];
    const fallbackText = fallback.replace('{SITE}', SITE_URL);
    const fallbackTweet = fallbackText + '\n' + hashtags;
    if (!isContentUnique(brain, fallbackTweet)) {
      log('  Could not generate unique Twitter content');
      return null;
    }
    return {
      type: 'twitter',
      text: fallbackTweet,
      hashtags,
      category,
      character_count: fallbackTweet.length,
      date: TODAY,
      status: 'prepared',
      is_experiment: isExperiment,
    };
  }

  return {
    type: 'twitter',
    text: fullTweet,
    hashtags,
    category,
    character_count: fullTweet.length,
    date: TODAY,
    status: 'prepared',
    is_experiment: isExperiment,
  };
}

function generatePinterestContent(brain) {
  const isExperiment = shouldExperiment();

  // Pick template — rotate or experiment
  let templateIndex = Math.floor(rand() * pinterestTemplates.length);
  if (isExperiment) {
    // Try a less common index
    templateIndex = (templateIndex + 3) % pinterestTemplates.length;
  }

  const template = pinterestTemplates[templateIndex];

  if (!isContentUnique(brain, template.title)) {
    // Try next template
    const fallback = pinterestTemplates[(templateIndex + 1) % pinterestTemplates.length];
    if (!isContentUnique(brain, fallback.title)) {
      log('  Could not generate unique Pinterest content');
      return null;
    }
    return {
      type: 'pinterest',
      pin_title: fallback.title,
      pin_description: fallback.description,
      target_board: fallback.board,
      link: SITE_URL + fallback.link,
      date: TODAY,
      status: 'prepared',
      is_experiment: isExperiment,
    };
  }

  return {
    type: 'pinterest',
    pin_title: template.title,
    pin_description: template.description,
    target_board: template.board,
    link: SITE_URL + template.link,
    date: TODAY,
    status: 'prepared',
    is_experiment: isExperiment,
  };
}

function generateMediumContent(brain) {
  const isExperiment = shouldExperiment();
  let topicIndex = Math.floor(rand() * mediumTopics.length);
  if (isExperiment) {
    topicIndex = (topicIndex + 2) % mediumTopics.length;
  }

  const topic = mediumTopics[topicIndex];

  if (!isContentUnique(brain, topic.title)) {
    const fallback = mediumTopics[(topicIndex + 1) % mediumTopics.length];
    if (!isContentUnique(brain, fallback.title)) {
      log('  Could not generate unique Medium content');
      return null;
    }
    return {
      type: 'medium',
      article_title: fallback.title,
      article_outline: fallback.outline,
      target_keywords: fallback.keywords,
      date: TODAY,
      status: 'planned',
      is_experiment: isExperiment,
      note: 'Planning only — Content Agent handles actual article writing',
    };
  }

  return {
    type: 'medium',
    article_title: topic.title,
    article_outline: topic.outline,
    target_keywords: topic.keywords,
    date: TODAY,
    status: 'planned',
    is_experiment: isExperiment,
    note: 'Planning only — Content Agent handles actual article writing',
  };
}

// ── Update brain.json ──
function updateBrain(brain, preparedPosts) {
  // Ensure social section has all needed fields
  if (!brain.social) brain.social = {};
  if (!brain.social.prepared_posts) brain.social.prepared_posts = [];
  if (!brain.social.recent_posts) brain.social.recent_posts = [];
  if (!brain.social.reddit) brain.social.reddit = {};
  if (!brain.social.reddit.prepared_posts) brain.social.reddit.prepared_posts = {};
  if (!brain.social.twitter) brain.social.twitter = {};
  if (!brain.social.pinterest) brain.social.pinterest = {};
  if (!brain.social.medium) brain.social.medium = {};

  // Add today's prepared posts
  for (const post of preparedPosts) {
    brain.social.prepared_posts.push(post);

    // Track per-platform
    if (post.type === 'reddit') {
      brain.social.reddit.prepared_posts[TODAY] = post;
      brain.social.reddit.posts = (brain.social.reddit.posts || 0) + 1;
    } else if (post.type === 'twitter') {
      brain.social.twitter.posts = (brain.social.twitter.posts || 0) + 1;
    } else if (post.type === 'pinterest') {
      brain.social.pinterest.pins = (brain.social.pinterest.pins || 0) + 1;
    } else if (post.type === 'medium') {
      brain.social.medium.posts = (brain.social.medium.posts || 0) + 1;
    }

    // Add to recent_posts for rotation tracking
    brain.social.recent_posts.push({
      platform: post.type,
      date: TODAY,
      title: post.title || post.text || post.pin_title || post.article_title || '',
      is_experiment: post.is_experiment || false,
    });
  }

  // Update totals
  brain.social.total_posts = (brain.social.total_posts || 0) + preparedPosts.length;

  // Trim prepared_posts to last 200 entries
  if (brain.social.prepared_posts.length > 200) {
    brain.social.prepared_posts = brain.social.prepared_posts.slice(-200);
  }

  // Trim recent_posts to last 90 days
  const ninetyDaysAgo = new Date(NOW - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  brain.social.recent_posts = brain.social.recent_posts.filter(p => p.date >= ninetyDaysAgo);

  // Update timestamp
  brain.last_updated = TODAY;

  writeJSON(BRAIN_FILE, brain);
}

// ── Git Commit + Push ──
function commitAndPush() {
  try {
    execSync('git config user.name "Social Agent"', { stdio: 'pipe' });
    execSync('git config user.email "social-agent[bot]@users.noreply.github.com"', { stdio: 'pipe' });
    execSync('git add data/brain.json', { stdio: 'pipe' });

    // Check if there are changes to commit
    const status = execSync('git status --porcelain data/brain.json', { stdio: 'pipe' }).toString().trim();
    if (status) {
      execSync(`git commit -m "🤖 Social Agent: prepared ${TODAY} content [skip ci]"`, { stdio: 'pipe' });
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

function buildEmailHTML(preparedPosts, brain, skipped) {
  const social = brain.social || {};
  const totalPosts = social.total_posts || 0;
  const redditPosts = social.reddit?.posts || 0;
  const twitterPosts = social.twitter?.posts || 0;
  const pinterestPins = social.pinterest?.pins || 0;
  const mediumPosts = social.medium?.posts || 0;

  // Determine best performing platform
  const platforms = [
    { name: 'Reddit', engagement: social.reddit?.avg_engagement || 0 },
    { name: 'Twitter', engagement: social.twitter?.avg_engagement || 0 },
    { name: 'Pinterest', engagement: social.pinterest?.avg_clicks || 0 },
    { name: 'Medium', engagement: social.medium?.avg_reads || 0 },
  ];
  platforms.sort((a, b) => b.engagement - a.engagement);
  const bestPlatform = platforms[0].name;
  const experimentsCount = preparedPosts.filter(p => p.is_experiment).length;

  // Build platform sections
  let platformSections = '';

  const redditPosts_prepared = preparedPosts.filter(p => p.type === 'reddit');
  if (redditPosts_prepared.length > 0) {
    platformSections += `
      <div style="margin-bottom:20px">
        <h3 style="color:#FF4500;font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:6px">
          <span style="font-size:18px">🔴</span> Reddit (${redditPosts_prepared.length} post${redditPosts_prepared.length > 1 ? 's' : ''} prepared)
        </h3>`;
    for (const post of redditPosts_prepared) {
      platformSections += `
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:#DC2626;font-weight:bold;text-transform:uppercase;margin-bottom:4px">
            Subreddit: ${post.subreddit}${post.is_experiment ? ' | 🧪 Experiment' : ''}
          </div>
          <div style="font-weight:bold;font-size:13px;color:#1e293b;margin-bottom:6px">${escapeHTML(post.title)}</div>
          <div style="font-size:12px;color:#4b5563;white-space:pre-line;line-height:1.5">${escapeHTML(post.body)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px">Link: ${SITE_URL}</div>
        </div>`;
    }
    platformSections += `</div>`;
  }

  const twitterPosts_prepared = preparedPosts.filter(p => p.type === 'twitter');
  if (twitterPosts_prepared.length > 0) {
    platformSections += `
      <div style="margin-bottom:20px">
        <h3 style="color:#1DA1F2;font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:6px">
          <span style="font-size:18px">🐦</span> Twitter/X (${twitterPosts_prepared.length} tweet${twitterPosts_prepared.length > 1 ? 's' : ''} prepared)
        </h3>`;
    for (const post of twitterPosts_prepared) {
      platformSections += `
        <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:#0284C7;font-weight:bold;text-transform:uppercase;margin-bottom:4px">
            Category: ${post.category} | ${post.character_count}/280 chars${post.is_experiment ? ' | 🧪 Experiment' : ''}
          </div>
          <div style="font-size:13px;color:#1e293b;white-space:pre-line;line-height:1.5">${escapeHTML(post.text)}</div>
        </div>`;
    }
    platformSections += `</div>`;
  }

  const pinterestPosts_prepared = preparedPosts.filter(p => p.type === 'pinterest');
  if (pinterestPosts_prepared.length > 0) {
    platformSections += `
      <div style="margin-bottom:20px">
        <h3 style="color:#E60023;font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:6px">
          <span style="font-size:18px">📌</span> Pinterest (${pinterestPosts_prepared.length} pin${pinterestPosts_prepared.length > 1 ? 's' : ''} prepared)
        </h3>`;
    for (const post of pinterestPosts_prepared) {
      platformSections += `
        <div style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:#BE123C;font-weight:bold;text-transform:uppercase;margin-bottom:4px">
            Board: ${post.target_board}${post.is_experiment ? ' | 🧪 Experiment' : ''}
          </div>
          <div style="font-weight:bold;font-size:13px;color:#1e293b;margin-bottom:4px">${escapeHTML(post.pin_title)}</div>
          <div style="font-size:12px;color:#4b5563;line-height:1.5">${escapeHTML(post.pin_description)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px">Link: ${escapeHTML(post.link)}</div>
        </div>`;
    }
    platformSections += `</div>`;
  }

  const mediumPosts_prepared = preparedPosts.filter(p => p.type === 'medium');
  if (mediumPosts_prepared.length > 0) {
    platformSections += `
      <div style="margin-bottom:20px">
        <h3 style="color:#000;font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:6px">
          <span style="font-size:18px">📝</span> Medium (${mediumPosts_prepared.length} topic${mediumPosts_prepared.length > 1 ? 's' : ''} planned)
        </h3>`;
    for (const post of mediumPosts_prepared) {
      const outlineHTML = post.article_outline.map((section, i) =>
        `<li style="font-size:12px;color:#4b5563;margin-bottom:2px">${i + 1}. ${escapeHTML(section)}</li>`
      ).join('');
      platformSections += `
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:#475569;font-weight:bold;text-transform:uppercase;margin-bottom:4px">
            PLANNING ONLY — Content Agent writes the article${post.is_experiment ? ' | 🧪 Experiment' : ''}
          </div>
          <div style="font-weight:bold;font-size:13px;color:#1e293b;margin-bottom:6px">${escapeHTML(post.article_title)}</div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Target keywords: ${post.target_keywords.map(k => escapeHTML(k)).join(', ')}</div>
          <ol style="margin:6px 0 0;padding-left:18px">${outlineHTML}</ol>
        </div>`;
    }
    platformSections += `</div>`;
  }

  // Emergency brake section
  let emergencySection = '';
  if (skipped.emergencyBrake) {
    emergencySection = `
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="font-weight:bold;color:#DC2626;font-size:13px">⚠️ Emergency Brake Active</div>
        <div style="font-size:12px;color:#7f1d1d;margin-top:4px">
          Content preparation was skipped. Reason: ${escapeHTML(skipped.emergencyReason || 'Unknown')}
        </div>
      </div>`;
  }

  // Mitigation section
  let mitigationSection = '';
  if (skipped.mitigationHit) {
    mitigationSection = `
      <div style="background:#FEFCE8;border:1px solid #FDE68A;border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="font-weight:bold;color:#A16207;font-size:13px">📋 Mitigation Limit Reached</div>
        <div style="font-size:12px;color:#713f12;margin-top:4px">
          Already prepared ${skipped.alreadyPosted} post(s) today (Week ${skipped.week} limit: ${skipped.maxPosts}). No new content generated.
        </div>
      </div>`;
  }

  const noContentSection = preparedPosts.length === 0 && !skipped.emergencyBrake && !skipped.mitigationHit
    ? `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px;margin-bottom:16px;text-align:center;font-size:13px;color:#166534">
        No new content prepared today — all unique content templates exhausted for this run.
      </div>`
    : '';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:680px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:16px 20px;border-radius:10px 10px 0 0">
    <h2 style="margin:0;font-size:20px">🤖 Social Agent — Daily Content Report</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.9">${BRAND} | ${TODAY} | ${preparedPosts.length} post${preparedPosts.length !== 1 ? 's' : ''} prepared</p>
  </div>

  <div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 10px 10px">
    ${emergencySection}
    ${mitigationSection}
    ${noContentSection}

    <!-- Stats Summary -->
    <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
      <div style="flex:1;min-width:100px;background:#F8FAFC;padding:10px;border-radius:8px;text-align:center;border:1px solid #E2E8F0">
        <div style="font-size:22px;font-weight:bold;color:#6366f1">${totalPosts}</div>
        <div style="font-size:10px;color:#6b7280">Total Tracked</div>
      </div>
      <div style="flex:1;min-width:100px;background:#FFF1F2;padding:10px;border-radius:8px;text-align:center;border:1px solid #FECDD3">
        <div style="font-size:22px;font-weight:bold;color:#E60023">${redditPosts}</div>
        <div style="font-size:10px;color:#6b7280">Reddit</div>
      </div>
      <div style="flex:1;min-width:100px;background:#F0F9FF;padding:10px;border-radius:8px;text-align:center;border:1px solid #BAE6FD">
        <div style="font-size:22px;font-weight:bold;color:#0284C7">${twitterPosts}</div>
        <div style="font-size:10px;color:#6b7280">Twitter</div>
      </div>
      <div style="flex:1;min-width:100px;background:#FFF1F2;padding:10px;border-radius:8px;text-align:center;border:1px solid #FECDD3">
        <div style="font-size:22px;font-weight:bold;color:#BE123C">${pinterestPins}</div>
        <div style="font-size:10px;color:#6b7280">Pinterest</div>
      </div>
      <div style="flex:1;min-width:100px;background:#F8FAFC;padding:10px;border-radius:8px;text-align:center;border:1px solid #E2E8F0">
        <div style="font-size:22px;font-weight:bold;color:#1e293b">${mediumPosts}</div>
        <div style="font-size:10px;color:#6b7280">Medium</div>
      </div>
    </div>

    ${platformSections}

    <!-- Manual Posting Notice -->
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px;margin-top:18px">
      <div style="font-weight:bold;font-size:13px;color:#1e40af;margin-bottom:4px">📋 How to Use These Posts</div>
      <ol style="font-size:12px;color:#1e3a5f;margin:6px 0 0;padding-left:18px;line-height:1.8">
        <li>Copy the content from each section above</li>
        <li>Paste it into the respective platform (Reddit, Twitter, Pinterest, Medium)</li>
        <li>All posts are also saved in <code style="background:#DBEAFE;padding:1px 4px;border-radius:3px;font-size:11px">data/brain.json</code> under <code style="background:#DBEAFE;padding:1px 4px;border-radius:3px;font-size:11px">social.prepared_posts</code></li>
      </ol>
      <div style="font-size:11px;color:#3b82f6;margin-top:8px;font-style:italic">
        💡 To enable auto-posting, add API tokens to GitHub Secrets (REDDIT_*, TWITTER_*, PINTEREST_*, MEDIUM_*).
      </div>
    </div>

    <!-- Footer -->
    <div style="font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:16px">
      <p style="margin:0">Social Agent | ${BRAND} | Week ${brain.week || 1} | ${brain.current_phase || 'baby_steps'}</p>
      <p style="margin:3px 0 0">Best performing platform: ${bestPlatform} | Experiments today: ${experimentsCount}/${preparedPosts.length}</p>
      <p style="margin:3px 0 0">Posts prepared today: ${preparedPosts.length} | 80/20 rule: ${experimentsCount} experiment${experimentsCount !== 1 ? 's' : ''}, ${preparedPosts.length - experimentsCount} proven format${(preparedPosts.length - experimentsCount) !== 1 ? 's' : ''}</p>
    </div>
  </div>
</div>`;

  return html;
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Main ──
async function main() {
  log('=== Social Agent Started ===');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials (GMAIL_USER, GMAIL_APP_PASS)');
    process.exit(1);
  }

  // Read brain and config
  const brain = readJSON(BRAIN_FILE);
  const config = readJSON(CONFIG_FILE);

  if (!brain) {
    log('ERROR: Cannot read brain.json');
    process.exit(1);
  }
  if (!config) {
    log('ERROR: Cannot read config.json');
    process.exit(1);
  }

  const week = brain.week || config.growth?.current_week || 1;
  const maxPosts = getMaxPostsPerDay(week);
  const alreadyPosted = getAlreadyPostedToday(brain);
  const remainingPosts = maxPosts - alreadyPosted;

  const skipped = {
    emergencyBrake: false,
    emergencyReason: null,
    mitigationHit: false,
    alreadyPosted,
    week,
    maxPosts,
  };

  // Step 1: Emergency brake check
  log(`Step 1: Checking emergency brake...`);
  if (isEmergencyBrake(brain)) {
    log('  ⛔ Emergency brake is ACTIVE — skipping content preparation');
    skipped.emergencyBrake = true;
    skipped.emergencyReason = brain.emergency.brake_reason || 'Unknown';
  }

  // Step 2: Mitigation check
  if (!skipped.emergencyBrake) {
    log(`Step 2: Checking mitigation limits (Week ${week}, max ${maxPosts}/day, already ${alreadyPosted})...`);
    if (remainingPosts <= 0) {
      log(`  📋 Mitigation limit reached — ${alreadyPosted}/${maxPosts} posts today`);
      skipped.mitigationHit = true;
    }
  }

  // Step 3: Generate content if not blocked
  const preparedPosts = [];

  if (!skipped.emergencyBrake && !skipped.mitigationHit) {
    log(`Step 3: Selecting platforms and generating content (${remainingPosts} post${remainingPosts !== 1 ? 's' : ''})...`);

    const selectedPlatforms = selectPlatformsToPost(brain, remainingPosts);
    log(`  Selected platforms: ${selectedPlatforms.join(', ')}`);

    const subreddits = config.social?.subreddits || ['r/Entrepreneur', 'r/smallbusiness'];

    for (const platform of selectedPlatforms) {
      let post = null;

      switch (platform) {
        case 'reddit': {
          // Pick a subreddit (rotate based on recent usage)
          const usedSubreddits = (brain.social?.recent_posts || [])
            .filter(p => p.platform === 'reddit' && p.date >= TODAY)
            .map(p => p.title); // We'll pick fresh
          const subreddit = subreddits[Math.floor(rand() * subreddits.length)];
          log(`  Generating Reddit content for ${subreddit}...`);
          post = generateRedditContent(brain, config, subreddit);
          break;
        }
        case 'twitter': {
          log('  Generating Twitter/X content...');
          post = generateTwitterContent(brain);
          break;
        }
        case 'pinterest': {
          log('  Generating Pinterest content...');
          post = generatePinterestContent(brain);
          break;
        }
        case 'medium': {
          log('  Generating Medium content plan...');
          post = generateMediumContent(brain);
          break;
        }
      }

      if (post) {
        preparedPosts.push(post);
        log(`  ✅ Prepared ${platform} content`);
      } else {
        log(`  ⚠️ Could not generate unique ${platform} content`);
      }
    }
  }

  // Step 4: Update brain.json
  if (preparedPosts.length > 0) {
    log(`Step 4: Updating brain.json with ${preparedPosts.length} prepared post(s)...`);
    updateBrain(brain, preparedPosts);
  } else {
    log('Step 4: No new posts to save — brain.json unchanged.');
  }

  // Step 5: Git commit + push
  log('Step 5: Committing changes...');
  commitAndPush();

  // Step 6: Send email report
  log('Step 6: Sending email report...');
  const emailHTML = buildEmailHTML(preparedPosts, brain, skipped);
  const emailSubject = skipped.emergencyBrake
    ? `⛔ EMERGENCY BRAKE — ${TODAY}`
    : skipped.mitigationHit
      ? `📋 Mitigation limit reached — ${TODAY}`
      : preparedPosts.length > 0
        ? `${preparedPosts.length} post${preparedPosts.length !== 1 ? 's' : ''} prepared — ${TODAY}`
        : `No new content — ${TODAY}`;

  try {
    await sendEmail(emailSubject, emailHTML);
    log('Email sent successfully.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Social Agent Finished ===');
}

main().catch(e => {
  log(`Fatal: ${e.message}`);
  console.error(e);
  process.exit(1);
});
