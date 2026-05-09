#!/usr/bin/env node
/**
 * BG Remover Digital — Directory Agent v1
 * Runs weekly (Sunday 11:00 UTC / 4:00 PM PKT) via GitHub Actions
 *
 * MISSION: Build quality backlinks through directory submissions, profile creation,
 * and Web 2.0 content preparation. Agent PREPARES submissions — owner submits manually.
 *
 * SAFETY: Respects emergency brake, weekly mitigation limits, daily backlink caps.
 *         Never auto-submits. Rotates platforms to avoid patterns.
 *
 * Data Sources:
 * - data/brain.json (project state, backlink stats, emergency brake)
 * - data/config.json (directories queue, web20 platforms, mitigation rules)
 * - data/directories.json (submission tracking, status persistence)
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════

const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const BRAND_NAME = 'BG Remover Digital';
const BRAND_VOICE = 'friendly-professional';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

const FILES = {
  brain: path.join(DATA_DIR, 'brain.json'),
  config: path.join(DATA_DIR, 'config.json'),
  directories: path.join(DATA_DIR, 'directories.json'),
};

const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();
const RUN_ID = `${TODAY}-run-${Math.random().toString(36).slice(2, 8)}`;

// ═══════════════════════════════════════════════
// DIRECTORY CATALOG — Full metadata for each target
// ═══════════════════════════════════════════════

const DIRECTORY_CATALOG = {
  'alternativeto.net': {
    name: 'AlternativeTo',
    submission_url: 'https://alternativeto.net/suggest/',
    category: 'Design Tools',
    description: 'Free AI-powered background removal tool. Remove backgrounds from images instantly in your browser. No signup required. Perfect for product photos, ecommerce, and social media.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'product photography'],
    notes: 'Submit as alternative to remove.bg, PhotoScissors. Include screenshots.',
  },
  'producthunt.com': {
    name: 'Product Hunt',
    submission_url: 'https://www.producthunt.com/posts/new',
    category: 'Free Tools',
    description: 'BG Remover Digital — Free AI background remover that works right in your browser. No signup, no watermarks, instant results. Built for ecommerce sellers, content creators, and anyone who needs clean product photos.',
    tags: ['background remover', 'AI tool', 'free', 'image editing', 'product photography'],
    notes: 'Best to launch on a Tuesday-Thursday. Prepare maker comment. Add logo and gallery.',
  },
  'theresafontthat.com': {
    name: 'Theres A Font That',
    submission_url: 'https://theresafontthat.com/submit/',
    category: 'Design Tools',
    description: 'Free AI background removal tool for designers and creators. Instantly remove backgrounds from images in your browser — no signup, no downloads, completely free.',
    tags: ['background remover', 'free tool', 'AI', 'design tools', 'image editing'],
    notes: 'Design community audience. Emphasize free and no-signup aspects.',
  },
  'toolfinder.co': {
    name: 'ToolFinder',
    submission_url: 'https://toolfinder.co/submit',
    category: 'Image Editing',
    description: 'Discover BG Remover Digital — a free AI-powered background remover. Remove image backgrounds instantly in your browser. Perfect for product photography, ecommerce listings, and social media content.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'product photography'],
    notes: 'Tool discovery platform. Highlight unique selling points.',
  },
  'saashub.com': {
    name: 'SaaSHub',
    submission_url: 'https://www.saashub.com/submit',
    category: 'Design Tools',
    description: 'BG Remover Digital is a free AI background removal tool. Remove backgrounds from images instantly in your browser with no signup required. Ideal for product photos, ecommerce stores, and social media content creation.',
    tags: ['background remover', 'free tool', 'SaaS', 'AI', 'image editing'],
    notes: 'SaaS directory. Emphasize ease of use and free tier.',
  },
  'capterra.com': {
    name: 'Capterra',
    submission_url: 'https://www.capterra.com/vendors/new',
    category: 'Image Editing',
    description: 'Free AI background removal tool for businesses. Remove backgrounds from product photos, headshots, and marketing images instantly. No signup required. Trusted by ecommerce sellers and content creators.',
    tags: ['background remover', 'free tool', 'AI', 'business tool', 'image editing'],
    notes: 'Business-focused directory. Emphasize ROI for ecommerce.',
  },
  'getapp.com': {
    name: 'GetApp',
    submission_url: 'https://www.getapp.com/listing/',
    category: 'Image Editing',
    description: 'BG Remover Digital — free AI background removal for business. Instantly process product photos, marketing images, and team photos directly in your browser. No signup, no downloads.',
    tags: ['background remover', 'free tool', 'AI', 'business', 'image editing'],
    notes: 'Gartner-owned. Business audience. Similar to Capterra.',
  },
  'softwaresuggest.com': {
    name: 'SoftwareSuggest',
    submission_url: 'https://www.softwaresuggest.com/submit-software',
    category: 'Image Editing',
    description: 'Free AI-powered background remover. BG Remover Digital removes backgrounds from images instantly in your browser. No signup, no watermarks. Perfect for ecommerce and marketing.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'product photography'],
    notes: 'Software review platform. Good for long-term backlink.',
  },
  'g2.com': {
    name: 'G2',
    submission_url: 'https://www.g2.com/products/new',
    category: 'Image Editing',
    description: 'BG Remover Digital — free AI background removal tool. Remove image backgrounds instantly in-browser with no signup. Designed for ecommerce, marketing teams, and content creators.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'product photography'],
    notes: 'High-authority review site. Requires genuine reviews later for full value.',
  },
  'trustpilot.com': {
    name: 'Trustpilot',
    submission_url: 'https://business.trustpilot.com/signup',
    category: 'Free Tools',
    description: 'BG Remover Digital — free AI background remover. Remove backgrounds from images instantly in your browser. No signup required. Used by ecommerce sellers worldwide.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'product photography'],
    notes: 'Create business profile. Collect reviews from real users.',
  },
  'slashdot.org': {
    name: 'Slashdot',
    submission_url: 'https://slashdot.org/submission',
    category: 'Free Tools',
    description: 'BG Remover Digital: A free AI-powered tool that removes image backgrounds instantly in-browser. No signup, no watermarks. Open to everyone — from ecommerce sellers to developers.',
    tags: ['background remover', 'free tool', 'AI', 'open source', 'image editing'],
    notes: 'Tech-savvy audience. Emphasize technology (AI, browser-based).',
  },
  'lifewire.com': {
    name: 'LifeWire',
    submission_url: 'https://www.lifewire.com/contact',
    category: 'Free Tools',
    description: 'Free AI background removal tool that works in your browser. BG Remover Digital removes backgrounds from images instantly — no signup, no downloads, no watermarks.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'how-to'],
    notes: 'How-to and review site. Pitch as "free alternative to paid tools".',
  },
  'makeuseof.com': {
    name: 'MakeUseOf',
    submission_url: 'https://www.makeuseof.com/contact/',
    category: 'Free Tools',
    description: 'BG Remover Digital — completely free AI background remover. Remove backgrounds from any image instantly in your browser. No account needed. Compare with paid alternatives.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'productivity'],
    notes: 'Tech publication. Pitch as a listicle inclusion "Best Free Background Removers".',
  },
  'pcmag.com': {
    name: 'PCMag',
    submission_url: 'https://www.pcmag.com/contact/',
    category: 'Image Editing',
    description: 'BG Remover Digital offers free AI-powered background removal directly in your browser. No signup, no downloads. Competitive with premium tools like remove.bg and Adobe.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'software review'],
    notes: 'Major publication. Long-term pitch for review inclusion.',
  },
  'techradar.com': {
    name: 'TechRadar',
    submission_url: 'https://www.techradar.com/contact',
    category: 'Free Tools',
    description: 'Free AI background removal tool — BG Remover Digital. Remove image backgrounds instantly in your browser with zero signup. A powerful free alternative to paid background removal services.',
    tags: ['background remover', 'free tool', 'AI', 'image editing', 'tech'],
    notes: 'Major tech publication. Pitch for "best free tools" roundups.',
  },
  'zdnet.com': {
    name: 'ZDNet',
    submission_url: 'https://www.zdnet.com/contact/',
    category: 'Design Tools',
    description: 'BG Remover Digital provides free AI-powered background removal for enterprise and individual use. Process images instantly in-browser with no account required.',
    tags: ['background remover', 'free tool', 'AI', 'enterprise', 'image editing'],
    notes: 'Enterprise-focused publication. Emphasize scalability and free access.',
  },
  'wowpreneur.com': {
    name: 'WowPreneur',
    submission_url: 'https://wowpreneur.com/submit-tool/',
    category: 'Free Tools',
    description: 'BG Remover Digital — free AI background remover for entrepreneurs. Instantly remove backgrounds from product photos and marketing images. No signup, no watermarks, 100% free.',
    tags: ['background remover', 'free tool', 'AI', 'entrepreneur', 'ecommerce'],
    notes: 'Entrepreneur community. Perfect audience match.',
  },
  'startupbase.io': {
    name: 'StartupBase',
    submission_url: 'https://startupbase.io/submit',
    category: 'Free Tools',
    description: 'BG Remover Digital — AI-powered free background removal tool. Remove image backgrounds instantly in your browser. Built for ecommerce sellers, marketers, and content creators.',
    tags: ['background remover', 'free tool', 'AI', 'startup', 'image editing'],
    notes: 'Startup directory. Emphasize the product and founder story.',
  },
  'betalist.com': {
    name: 'BetaList',
    submission_url: 'https://betalist.com/submit',
    category: 'Free Tools',
    description: 'BG Remover Digital — free AI background remover. Remove backgrounds from images instantly in your browser. No signup required. Currently in early access with plans for bulk processing and API access.',
    tags: ['background remover', 'free tool', 'AI', 'beta', 'startup'],
    notes: 'Startup discovery platform. Works well for pre-launch and early-stage.',
  },
  'launching.page': {
    name: 'Launching.page',
    submission_url: 'https://launching.page/submit',
    category: 'Free Tools',
    description: 'BG Remover Digital — free AI background removal tool launching now. Remove backgrounds from images instantly in your browser. No signup, no watermarks. Built for the modern web.',
    tags: ['background remover', 'free tool', 'AI', 'launch', 'image editing'],
    notes: 'Launch directory. Great for initial visibility boost.',
  },
};

// ═══════════════════════════════════════════════
// WEB 2.0 PROFILE TEMPLATES
// ═══════════════════════════════════════════════

const PROFILE_TEMPLATES = {
  'medium.com': {
    platform: 'Medium',
    profile_url_format: 'https://medium.com/@{username}',
    bio: 'AI enthusiast & digital tools creator. Building free tools that make image editing effortless. Check out BG Remover Digital — free AI background removal in your browser: https://bgremoverdigital.craftedmindss.com',
    username_suggestion: 'bgremoverdigital',
    notes: 'Create account, fill profile, write first article linking to site.',
  },
  'wordpress.com': {
    platform: 'WordPress.com',
    profile_url_format: 'https://{username}.wordpress.com',
    bio: 'Free AI tools for everyone. BG Remover Digital lets you remove backgrounds from images instantly — no signup, no cost. Try it: https://bgremoverdigital.craftedmindss.com',
    username_suggestion: 'bgremoverdigital',
    notes: 'Create free blog, set up About page with backlink.',
  },
  'blogger.com': {
    platform: 'Blogger',
    profile_url_format: 'https://www.blogger.com/profile/{profile_id}',
    bio: 'Digital tools enthusiast. Creator of BG Remover Digital — a free AI-powered background removal tool that works right in your browser. https://bgremoverdigital.craftedmindss.com',
    username_suggestion: 'bgremoverdigital',
    notes: 'Google-owned. Good SEO benefit. Create blog and add backlink in profile.',
  },
  'tumblr.com': {
    platform: 'Tumblr',
    profile_url_format: 'https://{username}.tumblr.com',
    bio: 'Free AI image tools. Remove backgrounds instantly with BG Remover Digital — no signup needed. Perfect for product photos and social media. https://bgremoverdigital.craftedmindss.com',
    username_suggestion: 'bgremoverdigital',
    notes: 'Create blog, add link in description. Post visual content showcasing the tool.',
  },
  'dev.to': {
    platform: 'Dev.to',
    profile_url_format: 'https://dev.to/{username}',
    bio: 'Building free AI-powered tools for the web. Creator of BG Remover Digital — instant background removal in your browser, no signup required. https://bgremoverdigital.craftedmindss.com',
    username_suggestion: 'bgremoverdigital',
    notes: 'Developer community. Write technical article about AI background removal.',
  },
  'hashnode.dev': {
    platform: 'Hashnode',
    profile_url_format: 'https://{username}.hashnode.dev',
    bio: 'Developer building free AI tools. BG Remover Digital removes image backgrounds instantly in-browser — free, no signup. https://bgremoverdigital.craftedmindss.com',
    username_suggestion: 'bgremoverdigital',
    notes: 'Developer blogging platform. Great for technical SEO content with backlinks.',
  },
};

// ═══════════════════════════════════════════════
// WEB 2.0 BLOG POST OUTLINES
// ═══════════════════════════════════════════════

const BLOG_POST_OUTLINES = [
  {
    title: 'How AI Background Removal Is Changing Product Photography for Small Businesses',
    target_platform: 'medium.com',
    topic: 'AI in product photography',
    word_count_range: '600-800',
    outline: [
      'Introduction: The challenge of product photography for small businesses on a budget',
      'Traditional background removal methods (Photoshop, manual editing) — time and cost barriers',
      'How AI background removal works (neural networks, segmentation models)',
      'Benefits for ecommerce sellers (Amazon, Etsy, Shopify stores)',
      'Comparison: AI tools vs professional editing services',
      'Practical tips for getting the best results with AI background removers',
      'Conclusion with natural link to BG Remover Digital as a recommended free tool',
    ],
    backlink_placement: 'Conclusion and practical tips section',
    keywords: ['AI background removal', 'product photography', 'ecommerce', 'small business'],
  },
  {
    title: '5 Free AI Tools That Replace Expensive Image Editing Software',
    target_platform: 'dev.to',
    topic: 'Free AI tools roundup',
    word_count_range: '500-700',
    outline: [
      'Introduction: You don\'t need Photoshop for basic image editing anymore',
      'Tool #1: AI background removers (featuring BG Remover Digital)',
      'Tool #2: Free AI image upscalers',
      'Tool #3: AI color correction tools',
      'Tool #4: Free AI image compression tools',
      'Tool #5: AI-powered image enhancement tools',
      'Conclusion: The future of free image editing',
    ],
    backlink_placement: 'Tool #1 section with detailed review',
    keywords: ['free AI tools', 'image editing', 'Photoshop alternatives', 'background remover'],
  },
  {
    title: 'The Ultimate Guide to Preparing Product Photos for Online Marketplaces',
    target_platform: 'blogger.com',
    topic: 'Product photo preparation',
    word_count_range: '700-800',
    outline: [
      'Introduction: Why product photo quality matters for online sales',
      'Image requirements for major marketplaces (Amazon, eBay, Etsy)',
      'Step 1: Shooting tips for clean product photos',
      'Step 2: Removing backgrounds for a clean, professional look',
      'Step 3: Creating white backgrounds (Amazon requirement)',
      'Step 4: Optimizing image file sizes for fast loading',
      'Tools and resources (with link to BG Remover Digital)',
      'Conclusion: Professional photos on a bootstrap budget',
    ],
    backlink_placement: 'Step 2 and Tools section',
    keywords: ['product photos', 'online marketplace', 'Amazon photos', 'white background'],
  },
  {
    title: 'Background Removal for Social Media: A Creator\'s Complete Guide',
    target_platform: 'tumblr.com',
    topic: 'Social media image editing',
    word_count_range: '500-700',
    outline: [
      'Introduction: Visual content dominates social media',
      'Why removing backgrounds boosts engagement',
      'Instagram: Creating thumb-stopping product posts',
      'Pinterest: Clean images get more saves',
      'Twitter/X: Stand out in the timeline',
      'YouTube: Custom thumbnails that pop',
      'Free tools for instant background removal',
      'Conclusion with link to BG Remover Digital',
    ],
    backlink_placement: 'Free tools section and conclusion',
    keywords: ['social media', 'background removal', 'content creator', 'Instagram', 'Pinterest'],
  },
  {
    title: 'Building an AI-Powered Background Remover: A Developer\'s Journey',
    target_platform: 'hashnode.dev',
    topic: 'Technical deep-dive',
    word_count_range: '600-800',
    outline: [
      'Introduction: The idea behind BG Remover Digital',
      'Choosing the right AI model for background removal',
      'Browser-based AI: Running models in the client (WebAssembly, TensorFlow.js)',
      'Performance optimization for real-time processing',
      'UX design: Making it simple for non-technical users',
      'Handling edge cases (complex backgrounds, transparent objects)',
      'Lessons learned and future plans',
      'Try it yourself: link to the live tool',
    ],
    backlink_placement: 'Introduction and conclusion',
    keywords: ['AI development', 'background removal', 'TensorFlow.js', 'web development'],
  },
  {
    title: 'Ecommerce Photography on a Zero Budget: The Complete Playbook',
    target_platform: 'medium.com',
    topic: 'Ecommerce photography tips',
    word_count_range: '700-800',
    outline: [
      'Introduction: Starting an online store with no photography budget',
      'Equipment: What you actually need (smartphone + good lighting)',
      'Setup: DIY photo studio with household items',
      'Shooting: Composition tips for product photos',
      'Editing: Removing backgrounds and creating clean product images',
      'Optimization: Sizing and compressing for web stores',
      'Before/After examples',
      'Recommended free tools including BG Remover Digital',
    ],
    backlink_placement: 'Editing section and recommended tools',
    keywords: ['ecommerce photography', 'zero budget', 'product photos', 'DIY studio'],
  },
  {
    title: 'Why White Backgrounds Are Critical for Online Sales (And How to Get Them Free)',
    target_platform: 'wordpress.com',
    topic: 'White background importance',
    word_count_range: '500-700',
    outline: [
      'Introduction: The psychology of white backgrounds in online shopping',
      'Major marketplace requirements (Amazon white background rule)',
      'Studies showing increased conversion with clean backgrounds',
      'Professional services cost vs free AI tools',
      'Step-by-step: Creating perfect white backgrounds with AI',
      'Quality check: Ensuring professional results',
      'Conclusion with tool recommendation',
    ],
    backlink_placement: 'Step-by-step section and recommendation',
    keywords: ['white background', 'online sales', 'conversion', 'product photos'],
  },
  {
    title: 'From Raw Photo to Listing-Ready: Image Editing Workflow for Online Sellers',
    target_platform: 'dev.to',
    topic: 'Image editing workflow',
    word_count_range: '600-800',
    outline: [
      'Introduction: The complete image editing pipeline for online sellers',
      'Step 1: Organizing and selecting the best shots',
      'Step 2: Basic adjustments (brightness, contrast, color)',
      'Step 3: Background removal — the make-or-break step',
      'Step 4: Creating consistent product image dimensions',
      'Step 5: Exporting for different platforms',
      'Automation tips for bulk processing',
      'Tool stack recommendation with BG Remover Digital',
    ],
    backlink_placement: 'Step 3 and tool stack section',
    keywords: ['image editing workflow', 'online seller', 'product listing', 'background removal'],
  },
];

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function log(msg) {
  console.log(`[Directory Agent v1 ${new Date().toISOString()}] ${msg}`);
}

function readJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    log(`Error reading ${path.basename(filePath)}: ${e.message}`);
  }
  return null;
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    log(`Error writing ${path.basename(filePath)}: ${e.message}`);
    return false;
  }
}

function getWeekNumber(config, brain) {
  // Use brain.week if available, otherwise calculate from start date
  if (brain && brain.week) return brain.week;
  if (config && config.growth && config.growth.start_date) {
    const startDate = new Date(config.growth.start_date);
    const diff = Math.floor((NOW - startDate) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, diff + 1);
  }
  return 1;
}

function getMitigationLimits(week) {
  if (week <= 1) return { maxWeekly: 5, minWeekly: 3, label: 'Week 1: Baby Steps' };
  if (week === 2) return { maxWeekly: 8, minWeekly: 5, label: 'Week 2: Walking' };
  if (week === 3) return { maxWeekly: 15, minWeekly: 10, label: 'Week 3: Running' };
  return { maxWeekly: 25, minWeekly: 20, label: 'Week 4+: Sprinting' };
}

function rotateArray(arr, offset) {
  if (!arr || arr.length === 0) return [];
  const safeOffset = offset % arr.length;
  return [...arr.slice(safeOffset), ...arr.slice(0, safeOffset)];
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
    from: `"BG Remover Directory Agent" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject,
    html,
  });
}

// ═══════════════════════════════════════════════
// GIT OPERATIONS
// ═══════════════════════════════════════════════

function gitCommitAndPush() {
  try {
    execSync('git config user.name "Directory Agent"', { stdio: 'pipe' });
    execSync('git config user.email "directory-agent[bot]@users.noreply.github.com"', { stdio: 'pipe' });
    execSync('git add data/', { stdio: 'pipe' });
    const output = execSync('git diff --cached --stat', { encoding: 'utf8' }).trim();
    if (output) {
      execSync(`git commit -m "directory-agent: weekly backlink preparation - ${TODAY}"`, { stdio: 'pipe' });
      execSync('git push', { stdio: 'pipe' });
      log('Changes committed and pushed.');
      return true;
    } else {
      log('No changes to commit.');
      return false;
    }
  } catch (e) {
    log(`Git error: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════
// CORE LOGIC
// ═══════════════════════════════════════════════

/**
 * Check if emergency brake is active
 */
function checkEmergencyBrake(brain) {
  if (!brain || !brain.emergency) return false;
  return brain.emergency.brake_active === true;
}

/**
 * Determine what was targeted in previous runs
 */
function getPreviouslyTargetedPlatforms(directories) {
  const platforms = {};
  if (!directories || !directories.directories) return platforms;

  directories.directories.forEach(entry => {
    if (!platforms[entry.platform]) {
      platforms[entry.platform] = { count: 0, lastDate: null, types: [] };
    }
    platforms[entry.platform].count++;
    if (!platforms[entry.platform].lastDate || entry.submitted_date > platforms[entry.platform].lastDate) {
      platforms[entry.platform].lastDate = entry.submitted_date;
    }
    if (!platforms[entry.platform].types.includes(entry.type)) {
      platforms[entry.platform].types.push(entry.type);
    }
  });

  return platforms;
}

/**
 * Count submissions from this week
 */
function countThisWeekSubmissions(directories) {
  if (!directories || !directories.directories) return 0;
  const weekAgo = new Date(NOW);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  return directories.directories.filter(d => d.submitted_date >= weekAgoStr).length;
}

/**
 * Count submissions from last week (for comparison)
 */
function countLastWeekSubmissions(directories) {
  if (!directories || !directories.directories) return 0;
  const twoWeeksAgo = new Date(NOW);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const oneWeekAgo = new Date(NOW);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksStr = twoWeeksAgo.toISOString().split('T')[0];
  const oneWeekStr = oneWeekAgo.toISOString().split('T')[0];

  return directories.directories.filter(d => d.submitted_date >= twoWeeksStr && d.submitted_date < oneWeekStr).length;
}

/**
 * Get platforms targeted this week vs last week
 */
function getWeekPlatformComparison(directories) {
  const weekAgo = new Date(NOW);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(NOW);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const twoWeeksStr = twoWeeksAgo.toISOString().split('T')[0];

  const thisWeek = new Set();
  const lastWeek = new Set();

  if (directories && directories.directories) {
    directories.directories.forEach(d => {
      if (d.submitted_date >= weekAgoStr) thisWeek.add(d.platform);
      else if (d.submitted_date >= twoWeeksStr && d.submitted_date < weekAgoStr) lastWeek.add(d.platform);
    });
  }

  return { thisWeek: [...thisWeek], lastWeek: [...lastWeek] };
}

/**
 * Prepare directory submissions
 */
function prepareDirectorySubmissions(config, directories, week, maxSubmissions) {
  const entries = [];
  const directoriesQueue = config?.backlinks?.directories_queue || [];
  if (directoriesQueue.length === 0) return entries;

  // Get already submitted platforms
  const submittedPlatforms = new Set(
    (directories?.directories || []).map(d => d.platform)
  );

  // Rotate the queue based on week number so different directories are targeted
  const rotated = rotateArray(directoriesQueue, week - 1);

  // Find directories we haven't prepared yet
  let count = 0;
  for (const dirKey of rotated) {
    if (count >= maxSubmissions) break;
    if (submittedPlatforms.has(dirKey)) continue;

    const catalog = DIRECTORY_CATALOG[dirKey];
    if (!catalog) continue;

    entries.push({
      id: (directories?.directories?.length || 0) + count + 1,
      type: 'directory',
      platform: dirKey,
      name: catalog.name,
      submission_url: catalog.submission_url,
      site_url: SITE_URL,
      title: `${BRAND_NAME} - Free AI Background Remover`,
      description: catalog.description,
      category: catalog.category,
      tags: catalog.tags,
      status: 'prepared',
      submitted_date: TODAY,
      approved_date: null,
      backlink_url: null,
      notes: catalog.notes,
    });

    count++;
  }

  return entries;
}

/**
 * Prepare profile backlink entries
 */
function prepareProfileBacklinks(config, directories, week, maxProfiles) {
  const entries = [];
  const web20Platforms = config?.backlinks?.web20_platforms || [];
  if (web20Platforms.length === 0) return entries;

  // Get already prepared platforms
  const preparedPlatforms = new Set(
    (directories?.directories || []).filter(d => d.type === 'profile').map(d => d.platform)
  );

  // Rotate based on week
  const rotated = rotateArray(web20Platforms, week);

  let count = 0;
  for (const platformKey of rotated) {
    if (count >= maxProfiles) break;
    if (preparedPlatforms.has(platformKey)) continue;

    const template = PROFILE_TEMPLATES[platformKey];
    if (!template) continue;

    const profileUrl = template.profile_url_format.replace('{username}', template.username_suggestion);

    entries.push({
      id: (directories?.directories?.length || 0) + count + 1,
      type: 'profile',
      platform: platformKey,
      name: template.platform,
      submission_url: profileUrl,
      site_url: SITE_URL,
      bio: template.bio,
      username_suggestion: template.username_suggestion,
      profile_url_format: template.profile_url_format,
      status: 'prepared',
      submitted_date: TODAY,
      approved_date: null,
      backlink_url: null,
      notes: template.notes,
    });

    count++;
  }

  return entries;
}

/**
 * Prepare Web 2.0 blog post content
 */
function prepareWeb20Content(config, directories, week, maxPosts) {
  const entries = [];
  if (BLOG_POST_OUTLINES.length === 0) return entries;

  // Get already prepared blog post platforms/topics
  const preparedTopics = new Set(
    (directories?.directories || [])
      .filter(d => d.type === 'web20')
      .map(d => d.topic || d.platform)
  );

  // Rotate outlines based on week
  const rotatedOutlines = rotateArray(BLOG_POST_OUTLINES, week - 1);

  let count = 0;
  for (const outline of rotatedOutlines) {
    if (count >= maxPosts) break;
    if (preparedTopics.has(outline.topic + '_' + outline.target_platform)) continue;

    entries.push({
      id: (directories?.directories?.length || 0) + count + 1,
      type: 'web20',
      platform: outline.target_platform,
      name: outline.title,
      topic: outline.topic,
      submission_url: `https://${outline.target_platform}`,
      site_url: SITE_URL,
      blog_title: outline.title,
      word_count_range: outline.word_count_range,
      outline: outline.outline,
      backlink_placement: outline.backlink_placement,
      keywords: outline.keywords,
      status: 'prepared',
      submitted_date: TODAY,
      approved_date: null,
      backlink_url: null,
      notes: `Target platform: ${outline.target_platform}. Write ${outline.word_count_range} words following the outline. Include natural backlink in ${outline.backlink_placement}.`,
    });

    count++;
  }

  return entries;
}

/**
 * Update directories.json with new entries
 */
function updateDirectoriesJson(directories, newEntries) {
  if (!directories) {
    directories = { directories: [], total_submitted: 0, total_approved: 0 };
  }

  directories.directories.push(...newEntries);

  // Recount
  directories.total_submitted = directories.directories.filter(d => d.status === 'submitted' || d.status === 'approved').length;
  directories.total_approved = directories.directories.filter(d => d.status === 'approved').length;

  return directories;
}

/**
 * Update brain.json with new backlink stats
 */
function updateBrainJson(brain, newEntries) {
  if (!brain) return brain;

  // Increment total_created
  brain.backlinks.total_created = (brain.backlinks.total_created || 0) + newEntries.length;

  // Update per-platform stats
  const platformKeyMap = {
    'medium.com': 'medium',
    'wordpress.com': 'medium',
    'blogger.com': 'blogger',
    'tumblr.com': 'tumblr',
    'dev.to': 'devto',
    'hashnode.dev': 'devto',
  };

  newEntries.forEach(entry => {
    const platformKey = platformKeyMap[entry.platform];
    if (platformKey && brain.backlinks.platforms[platformKey]) {
      brain.backlinks.platforms[platformKey].created =
        (brain.backlinks.platforms[platformKey].created || 0) + 1;
    }

    // For directory type entries, track in directories_submitted
    if (entry.type === 'directory') {
      brain.backlinks.directories_submitted = (brain.backlinks.directories_submitted || 0) + 1;
    }
  });

  // Update timestamp
  brain.last_updated = TODAY;

  return brain;
}

/**
 * Generate recommendations based on brain.json data
 */
function generateRecommendations(brain, directories, week) {
  const recs = [];

  // Check which platforms have been created vs which are still available
  const platformStats = brain?.backlinks?.platforms || {};
  const createdPlatforms = Object.entries(platformStats)
    .filter(([_, stats]) => stats.created > 0)
    .map(([key]) => key);
  const missingPlatforms = Object.entries(platformStats)
    .filter(([_, stats]) => stats.created === 0)
    .map(([key]) => key);

  // Prioritize based on week
  if (week <= 1) {
    recs.push({
      priority: 'HIGH',
      emoji: '🟠',
      text: 'Focus on high-authority directories first: Product Hunt, AlternativeTo, SaaSHub. These give the strongest initial backlinks.',
    });
    if (missingPlatforms.length > 0) {
      recs.push({
        priority: 'HIGH',
        emoji: '🟠',
        text: `Create profiles on: ${missingPlatforms.join(', ')}. Profile backlinks are easy wins in Week 1.`,
      });
    }
  } else if (week === 2) {
    recs.push({
      priority: 'HIGH',
      emoji: '🟠',
      text: 'Start publishing Web 2.0 blog content on Medium and Dev.to. These platforms have strong domain authority.',
    });
    if (createdPlatforms.length > 0) {
      recs.push({
        priority: 'MEDIUM',
        emoji: '🟡',
        text: `Profiles created on ${createdPlatforms.join(', ')}. Start posting content on these platforms to activate the backlinks.`,
      });
    }
  } else {
    recs.push({
      priority: 'MEDIUM',
      emoji: '🟡',
      text: 'Scale up: Submit to more directories and publish 2-3 blog posts per week across different platforms.',
    });
  }

  // Check approved vs submitted ratio
  const totalSubmitted = directories?.total_submitted || 0;
  const totalApproved = directories?.total_approved || 0;
  const totalPrepared = directories?.directories?.filter(d => d.status === 'prepared').length || 0;

  if (totalPrepared > 5) {
    recs.push({
      priority: 'HIGH',
      emoji: '🟠',
      text: `${totalPrepared} submissions are in "prepared" status — submit them manually! Update directories.json status to "submitted" after each one.`,
    });
  }

  if (totalSubmitted > 0 && totalApproved === 0) {
    recs.push({
      priority: 'MEDIUM',
      emoji: '🟡',
      text: `${totalSubmitted} submissions sent but 0 approved yet. Directory approvals can take 1-4 weeks. Be patient and check status regularly.`,
    });
  }

  // Platform-specific recommendations
  if (createdPlatforms.includes('medium') && platformStats.medium.created <= 1) {
    recs.push({
      priority: 'MEDIUM',
      emoji: '🟡',
      text: 'Medium profile created — write at least 3 articles to maximize backlink value. Tag articles with relevant topics.',
    });
  }

  if (createdPlatforms.includes('devto') && platformStats.devto.created <= 1) {
    recs.push({
      priority: 'MEDIUM',
      emoji: '🟡',
      text: 'Dev.to profile created — technical articles about AI and image processing perform well here.',
    });
  }

  // General tip
  recs.push({
    priority: 'LOW',
    emoji: '🟢',
    text: 'Never submit to more than 3-5 directories in a single day. Spread submissions across the week to appear natural.',
  });

  return recs;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  log('=== Directory Agent v1 Started ===');
  log(`Run ID: ${RUN_ID}`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
    log('ERROR: Missing email credentials. Set GMAIL_USER and GMAIL_APP_PASS secrets.');
    process.exit(1);
  }

  // ── 1. Read all data files ──
  log('Step 1: Reading data files...');
  const brain = readJson(FILES.brain);
  const config = readJson(FILES.config);
  const directories = readJson(FILES.directories);

  if (!brain) { log('ERROR: brain.json not found or invalid.'); process.exit(1); }
  if (!config) { log('ERROR: config.json not found or invalid.'); process.exit(1); }
  if (!directories) { log('ERROR: directories.json not found or invalid.'); process.exit(1); }

  log(`  Brain: week ${brain.week || '?'}, phase ${brain.current_phase || '?'}`);
  log(`  Directories queue: ${(config.backlinks?.directories_queue || []).length} targets`);
  log(`  Web20 platforms: ${(config.backlinks?.web20_platforms || []).length} platforms`);
  log(`  Existing entries: ${(directories.directories || []).length}`);

  // ── 2. Emergency Brake Check ──
  log('Step 2: Emergency brake check...');
  if (checkEmergencyBrake(brain)) {
    log('EMERGENCY BRAKE ACTIVE — skipping all submissions. Status report only.');

    const brakeHtml = buildEmergencyEmail(brain, directories);
    try {
      await sendEmail(`EMERGENCY BRAKE | Directory Agent ${TODAY}`, brakeHtml);
      log('Emergency status email sent.');
    } catch (e) {
      log(`Email error: ${e.message}`);
    }
    log('=== Directory Agent v1 Finished (Emergency Mode) ===');
    return;
  }
  log('  Brake: NOT active. Proceeding.');

  // ── 3. Calculate limits based on week ──
  const week = getWeekNumber(config, brain);
  const limits = getMitigationLimits(week);
  const thisWeekCount = countThisWeekSubmissions(directories);
  const lastWeekCount = countLastWeekSubmissions(directories);
  const remainingThisWeek = Math.max(0, limits.maxWeekly - thisWeekCount);
  const maxThisRun = Math.min(remainingThisWeek, 5); // Cap at 5 per run even if weekly allows more

  log(`Step 3: Mitigation limits — ${limits.label}`);
  log(`  Weekly limit: ${limits.minWeekly}-${limits.maxWeekly}`);
  log(`  This week so far: ${thisWeekCount}`);
  log(`  Last week: ${lastWeekCount}`);
  log(`  Remaining this week: ${remainingThisWeek}`);
  log(`  Max this run: ${maxThisRun}`);

  if (maxThisRun <= 0) {
    log('Weekly limit reached. No new submissions this run.');
    const limitHtml = buildLimitReachedEmail(week, limits, thisWeekCount, directories, brain);
    try {
      await sendEmail(`Directory Agent ${TODAY} | Weekly Limit Reached`, limitHtml);
      log('Limit-reached email sent.');
    } catch (e) {
      log(`Email error: ${e.message}`);
    }
    log('=== Directory Agent v1 Finished (Limit Reached) ===');
    return;
  }

  // ── 4. Prepare Directory Submissions ──
  log('Step 4: Preparing directory submissions...');
  const dirMax = Math.min(Math.ceil(maxThisRun * 0.5), maxThisRun);
  const directoryEntries = prepareDirectorySubmissions(config, directories, week, dirMax);
  log(`  Prepared ${directoryEntries.length} directory submissions.`);

  // ── 5. Prepare Profile Backlinks ──
  log('Step 5: Preparing profile backlinks...');
  const profileMax = Math.min(Math.ceil(maxThisRun * 0.25), maxThisRun - directoryEntries.length);
  const profileEntries = prepareProfileBacklinks(config, directories, week, Math.max(1, profileMax));
  log(`  Prepared ${profileEntries.length} profile backlinks.`);

  // ── 6. Prepare Web 2.0 Blog Content ──
  log('Step 6: Preparing Web 2.0 blog content...');
  const blogMax = Math.min(Math.ceil(maxThisRun * 0.25), maxThisRun - directoryEntries.length - profileEntries.length);
  const blogEntries = prepareWeb20Content(config, directories, week, Math.max(1, blogMax));
  log(`  Prepared ${blogEntries.length} blog post outlines.`);

  const allNewEntries = [...directoryEntries, ...profileEntries, ...blogEntries];
  log(`  Total new entries: ${allNewEntries.length}`);

  if (allNewEntries.length === 0) {
    log('No new entries to prepare. All targets already prepared.');
    const noNewHtml = buildNoNewEntriesEmail(week, directories, brain);
    try {
      await sendEmail(`Directory Agent ${TODAY} | No New Entries`, noNewHtml);
      log('No-new-entries email sent.');
    } catch (e) {
      log(`Email error: ${e.message}`);
    }
    log('=== Directory Agent v1 Finished (No New Entries) ===');
    return;
  }

  // ── 7. Update directories.json ──
  log('Step 7: Updating directories.json...');
  const updatedDirectories = updateDirectoriesJson(directories, allNewEntries);
  writeJson(FILES.directories, updatedDirectories);
  log(`  Total entries: ${updatedDirectories.directories.length}`);

  // ── 8. Update brain.json ──
  log('Step 8: Updating brain.json...');
  const updatedBrain = updateBrainJson(brain, allNewEntries);
  writeJson(FILES.brain, updatedBrain);
  log(`  Total backlinks created: ${updatedBrain.backlinks.total_created}`);

  // ── 9. Git commit + push ──
  log('Step 9: Committing changes...');
  gitCommitAndPush();

  // ── 10. Generate recommendations ──
  log('Step 10: Generating recommendations...');
  const recommendations = generateRecommendations(updatedBrain, updatedDirectories, week);

  // ── 11. Build and send email report ──
  log('Step 11: Building email report...');
  const weekComparison = getWeekPlatformComparison(updatedDirectories);
  const emailHtml = buildMainEmail(
    week, limits, thisWeekCount, lastWeekCount,
    directoryEntries, profileEntries, blogEntries,
    updatedDirectories, updatedBrain, recommendations, weekComparison
  );

  try {
    await sendEmail(`Directory Agent ${TODAY} | ${allNewEntries.length} backlinks prepared | Week ${week}`, emailHtml);
    log('Email report sent successfully.');
  } catch (e) {
    log(`Email error: ${e.message}`);
  }

  log('=== Directory Agent v1 Finished ===');
}

// ═══════════════════════════════════════════════
// EMAIL BUILDERS
// ═══════════════════════════════════════════════

function buildMainEmail(week, limits, thisWeekCount, lastWeekCount,
  dirEntries, profileEntries, blogEntries,
  directories, brain, recommendations, weekComparison) {

  const totalPrepared = dirEntries.length + profileEntries.length + blogEntries.length;
  const totalCumulative = directories.directories.length;
  const totalSubmitted = directories.total_submitted;
  const totalApproved = directories.total_approved;

  // Directory entries detail
  const dirRows = dirEntries.map(d => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">${d.name}</td>
      <td style="padding:8px;border:1px solid #e2e8f0"><a href="${d.submission_url}" style="color:#2563eb">${d.submission_url}</a></td>
      <td style="padding:8px;border:1px solid #e2e8f0">${d.category}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px">${d.description}</td>
    </tr>`).join('');

  // Profile entries detail
  const profileRows = profileEntries.map(p => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">${p.name}</td>
      <td style="padding:8px;border:1px solid #e2e8f0"><a href="${p.submission_url}" style="color:#2563eb">${p.submission_url}</a></td>
      <td style="padding:8px;border:1px solid #e2e8f0">${p.username_suggestion}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px">${p.notes}</td>
    </tr>`).join('');

  // Blog entries detail
  const blogRows = blogEntries.map(b => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;font-size:12px">${b.name}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${b.target_platform}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${b.word_count_range}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px">${b.backlink_placement}</td>
    </tr>`).join('');

  // Recommendations
  const recsHtml = recommendations.map(r => {
    const bg = r.priority === 'HIGH' ? '#fff7ed' :
               r.priority === 'MEDIUM' ? '#fffbeb' : '#f0fdf4';
    const border = r.priority === 'HIGH' ? '#ea580c' :
                   r.priority === 'MEDIUM' ? '#ca8a04' : '#16a34a';
    return `<div style="background:${bg};border-left:3px solid ${border};padding:8px 10px;margin-bottom:4px;border-radius:0 6px 6px 0">
      <div style="font-size:12px;color:#374151">${r.emoji} <strong>${r.priority}</strong> — ${r.text}</div>
    </div>`;
  }).join('');

  // Platform comparison
  const newThisWeek = weekComparison.thisWeek.filter(p => !weekComparison.lastWeek.includes(p));
  const carriedOver = weekComparison.thisWeek.filter(p => weekComparison.lastWeek.includes(p));

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:750px;margin:0 auto;padding:20px">

<!-- Header -->
<div style="background:#7c3aed;color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:20px">Directory Agent — Weekly Backlink Report</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Week ${week} | ${TODAY} | ${limits.label}</p>
</div>

<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">

<!-- Summary Cards -->
<div style="display:flex;gap:10px;margin-bottom:16px">
  <div style="flex:1;background:#ede9fe;padding:12px;border-radius:6px;text-align:center;border:1px solid #c4b5fd">
    <div style="font-size:24px;font-weight:bold;color:#7c3aed">${totalPrepared}</div>
    <div style="font-size:11px;color:#64748b">Prepared Today</div>
  </div>
  <div style="flex:1;background:#eff6ff;padding:12px;border-radius:6px;text-align:center;border:1px solid #bfdbfe">
    <div style="font-size:24px;font-weight:bold;color:#2563eb">${thisWeekCount + totalPrepared}</div>
    <div style="font-size:11px;color:#64748b">This Week Total</div>
  </div>
  <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:6px;text-align:center;border:1px solid #bbf7d0">
    <div style="font-size:24px;font-weight:bold;color:#16a34a">${totalCumulative}</div>
    <div style="font-size:11px;color:#64748b">Cumulative Entries</div>
  </div>
  <div style="flex:1;background:#faf5ff;padding:12px;border-radius:6px;text-align:center;border:1px solid #e9d5ff">
    <div style="font-size:24px;font-weight:bold;color:#7c3aed">${totalApproved}</div>
    <div style="font-size:11px;color:#64748b">Approved</div>
  </div>
</div>

<!-- Progress -->
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px">
  <div style="font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:6px">Weekly Progress</div>
  <div style="display:flex;gap:20px;font-size:12px;color:#475569">
    <span>This week: <strong>${thisWeekCount + totalPrepared}/${limits.maxWeekly}</strong></span>
    <span>Last week: <strong>${lastWeekCount}</strong></span>
    <span>Submitted (cumulative): <strong>${totalSubmitted}</strong></span>
    <span>Approved (cumulative): <strong>${totalApproved}</strong></span>
  </div>
</div>

${newThisWeek.length > 0 ? `
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;margin-bottom:16px;font-size:12px;color:#166534">
  <strong>New platforms targeted this week:</strong> ${newThisWeek.join(', ')}
  ${carriedOver.length > 0 ? `<br><span style="color:#64748b">Also active from last week: ${carriedOver.join(', ')}</span>` : ''}
</div>` : ''}

<!-- Section: Directory Submissions -->
${dirEntries.length > 0 ? `
<h3 style="font-size:15px;margin:0 0 8px;color:#1e293b">&#128203; Directory Submissions (${dirEntries.length})</h3>
<div style="overflow-x:auto;margin-bottom:16px">
<table style="width:100%;border-collapse:collapse;font-size:12px">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Directory</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Submission URL</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Category</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Suggested Description</th>
    </tr>
  </thead>
  <tbody>${dirRows}</tbody>
</table>
</div>
<p style="font-size:11px;color:#64748b;margin:0 0 16px"><strong>Suggested tags:</strong> ${dirEntries[0]?.tags?.join(', ') || 'background remover, free tool, AI, image editing'}</p>
` : ''}

<!-- Section: Profile Backlinks -->
${profileEntries.length > 0 ? `
<h3 style="font-size:15px;margin:0 0 8px;color:#1e293b">&#128100; Profile Backlinks (${profileEntries.length})</h3>
<div style="overflow-x:auto;margin-bottom:16px">
<table style="width:100%;border-collapse:collapse;font-size:12px">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Platform</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Profile URL</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Username</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Notes</th>
    </tr>
  </thead>
  <tbody>${profileRows}</tbody>
</table>
</div>
` : ''}

<!-- Section: Web 2.0 Blog Content -->
${blogEntries.length > 0 ? `
<h3 style="font-size:15px;margin:0 0 8px;color:#1e293b">&#128221; Web 2.0 Blog Post Outlines (${blogEntries.length})</h3>
<div style="overflow-x:auto;margin-bottom:8px">
<table style="width:100%;border-collapse:collapse;font-size:12px">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Title</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Platform</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Word Count</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Backlink Placement</th>
    </tr>
  </thead>
  <tbody>${blogRows}</tbody>
</table>
</div>

${blogEntries.map(b => `
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:8px">
  <div style="font-size:12px;font-weight:bold;color:#1e293b;margin-bottom:4px">${b.name}</div>
  <div style="font-size:11px;color:#64748b;margin-bottom:6px">Keywords: ${b.keywords.join(', ')}</div>
  <ol style="font-size:11px;color:#475569;margin:0;padding-left:16px">
    ${b.outline.map(point => `<li style="margin-bottom:2px">${point}</li>`).join('')}
  </ol>
</div>`).join('')}
` : ''}

<!-- Recommendations -->
<h3 style="font-size:15px;margin:16px 0 8px;color:#1e293b">&#128161; Recommendations</h3>
${recsHtml}

<!-- Manual Action Notice -->
<div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:12px;margin-top:16px">
  <div style="font-size:13px;font-weight:bold;color:#92400e;margin-bottom:4px">&#9888; Manual Action Required</div>
  <div style="font-size:12px;color:#78350f">
    These submissions are <strong>prepared for manual action</strong>. The agent does NOT auto-submit (requires accounts on each platform).<br>
    <strong>To track approvals:</strong> Edit <code>data/directories.json</code> and update the <code>status</code> field from <code>"prepared"</code> to <code>"submitted"</code> after submitting, and to <code>"approved"</code> when confirmed.<br>
    <strong>Format:</strong> <code>{"status": "submitted", "backlink_url": "https://..."}</code>
  </div>
</div>

<!-- Backlink Stats -->
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-top:12px">
  <div style="font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:6px">Backlink Platform Stats</div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px">
    ${Object.entries(brain.backlinks.platforms).map(([key, stats]) => `
      <span style="background:${stats.created > 0 ? '#f0fdf4' : '#fef2f2'};border:1px solid ${stats.created > 0 ? '#bbf7d0' : '#fca5a5'};padding:4px 8px;border-radius:4px">
        <strong>${key}</strong>: ${stats.created} created
      </span>
    `).join('')}
  </div>
</div>

<!-- Footer -->
<div style="font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:16px">
  <p style="margin:0">Directory Agent v1 | Weekly backlink builder | Data stored in data/directories.json</p>
  <p style="margin:4px 0 0">Next run: Next Sunday 11:00 UTC (4:00 PM PKT)</p>
</div>

</div></div>`;
}

function buildEmergencyEmail(brain, directories) {
  const reason = brain.emergency.brake_reason || 'Unknown';
  const date = brain.emergency.brake_date || 'Unknown';

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#dc2626;color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:20px">&#128680; EMERGENCY BRAKE ACTIVE</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Directory Agent — Status Only | ${TODAY}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;margin-bottom:14px">
    <p style="margin:0;font-size:13px;color:#991b1b"><strong>Reason:</strong> ${reason}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#991b1b"><strong>Activated:</strong> ${date}</p>
  </div>
  <p style="font-size:13px;color:#374151">All directory submissions have been skipped. No new backlinks were prepared.</p>
  <div style="font-size:12px;color:#64748b;margin-top:12px">
    <strong>Current stats:</strong><br>
    Total entries: ${directories?.directories?.length || 0}<br>
    Total submitted: ${directories?.total_submitted || 0}<br>
    Total approved: ${directories?.total_approved || 0}
  </div>
  <p style="font-size:12px;color:#94a3b8;margin-top:12px">To resume: Set <code>brain.json</code> → <code>emergency.brake_active</code> to <code>false</code></p>
</div></div>`;
}

function buildLimitReachedEmail(week, limits, thisWeekCount, directories, brain) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#ea580c;color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:20px">Directory Agent — Weekly Limit Reached</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Week ${week} | ${TODAY} | ${limits.label}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:12px;margin-bottom:14px">
    <p style="margin:0;font-size:13px;color:#9a3412">This week's limit (${limits.maxWeekly} backlinks) has been reached with ${thisWeekCount} submissions. No new entries prepared this run.</p>
  </div>
  <p style="font-size:13px;color:#374151">This is by design — the mitigation system prevents spam-like behavior.</p>
  <div style="font-size:12px;color:#64748b;margin-top:12px">
    <strong>Stats:</strong> Cumulative: ${directories?.directories?.length || 0} | Submitted: ${directories?.total_submitted || 0} | Approved: ${directories?.total_approved || 0}
  </div>
</div></div>`;
}

function buildNoNewEntriesEmail(week, directories, brain) {
  const totalPrepared = directories?.directories?.filter(d => d.status === 'prepared').length || 0;
  const totalSubmitted = directories?.total_submitted || 0;
  const totalApproved = directories?.total_approved || 0;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#2563eb;color:white;padding:14px 16px;border-radius:8px 8px 0 0">
  <h2 style="margin:0;font-size:20px">Directory Agent — All Targets Prepared</h2>
  <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Week ${week} | ${TODAY}</p>
</div>
<div style="border:1px solid #e5e7eb;padding:16px;border-radius:0 0 8px 8px">
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;margin-bottom:14px">
    <p style="margin:0;font-size:13px;color:#1e40af">All directory targets and platform profiles have already been prepared. No new entries to generate.</p>
  </div>
  <div style="font-size:13px;color:#374151;margin-bottom:8px">
    <strong>Action items:</strong>
  </div>
  <ul style="font-size:12px;color:#475569;margin:0;padding-left:16px">
    <li><strong>${totalPrepared}</strong> entries are in "prepared" status — submit them manually</li>
    <li>Update directories.json status to "submitted" after each manual submission</li>
    <li>Check back next week for new recommendations</li>
  </ul>
  <div style="font-size:12px;color:#64748b;margin-top:12px">
    <strong>Stats:</strong> Cumulative: ${directories?.directories?.length || 0} | Prepared: ${totalPrepared} | Submitted: ${totalSubmitted} | Approved: ${totalApproved}
  </div>
</div></div>`;
}

// ═══════════════════════════════════════════════

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
