#!/usr/bin/env node
/**
 * BG Remover Digital — TEST POSTING SCRIPT
 * ─────────────────────────────────────────────────────────
 * Standalone test: one post on X, one on Reddit, one on Pinterest.
 * Does NOT touch the daily cron or brain.json.
 * Uses the saved cookies and OAuth tokens from data/cookies/
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

// ── Constants ──
const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const DATA_DIR = path.join(__dirname, 'data');
const COOKIES_DIR = path.join(DATA_DIR, 'cookies');

function log(msg) {
  console.log(`[TEST ${new Date().toISOString()}] ${msg}`);
}

// ── Node.js-level fetch (bypasses browser/GitHub Actions IP blocking) ──
async function nodeFetch(url, options = {}) {
  const https = require('https');
  const http = require('http');
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => JSON.parse(data),
          text: () => data,
          headers: res.headers,
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch (e) { return null; }
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: REDDIT — One comment/post via OAuth API
// ═══════════════════════════════════════════════════════════════
async function testReddit() {
  log('═══ TEST 1: REDDIT ═══');
  const cookiesFile = path.join(COOKIES_DIR, 'reddit-cookies.json');
  const cookieData = readJSON(cookiesFile);

  let oauthToken = null;
  if (cookieData && cookieData.oauth_token && Date.now() < (cookieData.oauth_expires || 0)) {
    oauthToken = cookieData.oauth_token;
    log(`Reddit: Using OAuth token from cookies file (expires in ${Math.round((cookieData.oauth_expires - Date.now()) / 3600000)}h)`);
  } else if (cookieData && cookieData.oauth_token) {
    log('Reddit: OAuth token in cookies file is EXPIRED');
  } else {
    log('Reddit: No OAuth token found in cookies file');
  }

  if (!oauthToken) {
    log('Reddit: SKIP — no valid OAuth token');
    return { platform: 'reddit', success: false, error: 'No valid OAuth token' };
  }

  try {
    // Step 1: Verify token
    const meResp = await nodeFetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${oauthToken}`, 'User-Agent': 'BGRemoverDigital/1.0' }
    });
    if (!meResp.ok) {
      log(`Reddit: Token verification FAILED (status: ${meResp.status})`);
      return { platform: 'reddit', success: false, error: `Token invalid: ${meResp.status}` };
    }
    const me = await meResp.json();
    log(`Reddit: Token valid! User: ${me.name}, Link karma: ${me.link_karma}, Comment karma: ${me.comment_karma}, Account age: ${Math.floor((Date.now()/1000 - me.created_utc)/86400)}d`);

    // Step 2: Check a safe subreddit rules
    const testSubreddit = 'selfhosted';
    const rulesResp = await nodeFetch(`https://oauth.reddit.com/r/${testSubreddit}/about/rules`, {
      headers: { 'Authorization': `Bearer ${oauthToken}`, 'User-Agent': 'BGRemoverDigital/1.0' }
    });
    if (rulesResp.ok) {
      const rulesData = await rulesResp.json();
      const rules = rulesData.rules || [];
      log(`Reddit: r/${testSubreddit} has ${rules.length} rules`);
      rules.forEach((r, i) => log(`  Rule ${i+1}: ${r.short_name}`));
    }

    // Step 3: Post a TEST comment on an existing post (less risky than a new post)
    // First, find a recent post in a permissive subreddit
    log(`Reddit: Fetching recent posts from r/${testSubreddit}...`);
    const postsResp = await nodeFetch(`https://oauth.reddit.com/r/${testSubreddit}/new?limit=5`, {
      headers: { 'Authorization': `Bearer ${oauthToken}`, 'User-Agent': 'BGRemoverDigital/1.0' }
    });
    if (!postsResp.ok) {
      log(`Reddit: Failed to fetch posts (status: ${postsResp.status})`);
      return { platform: 'reddit', success: false, error: `Fetch posts failed: ${postsResp.status}` };
    }
    const postsData = await postsResp.json();
    const posts = postsData.data?.children || [];
    if (posts.length === 0) {
      log('Reddit: No posts found');
      return { platform: 'reddit', success: false, error: 'No posts found in subreddit' };
    }

    const targetPost = posts[0].data;
    const articleId = targetPost.name; // e.g. t3_xxxxx
    log(`Reddit: Target post: "${targetPost.title.substring(0, 60)}..." (id: ${articleId})`);

    // Post a genuine, helpful comment (not promotional)
    const commentBody = `This is really interesting. I've been working on a similar concept recently — the idea of keeping everything client-side and private is becoming more important. Would love to see how this evolves. Great share!`;

    const commentResp = await nodeFetch('https://oauth.reddit.com/api/comment/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${oauthToken}`,
        'User-Agent': 'BGRemoverDigital/1.0',
      },
      body: `thing_id=${encodeURIComponent(articleId)}&text=${encodeURIComponent(commentBody)}&api_type=json`,
    });

    if (commentResp.ok) {
      const commentData = await commentResp.json();
      if (commentData.json && commentData.json.data && commentData.json.data.things && commentData.json.data.things.length > 0) {
        const commentId = commentData.json.data.things[0].data.id;
        const commentUrl = `https://www.reddit.com/r/${testSubreddit}/comments/${targetPost.id}/_/${commentId}/`;
        log(`Reddit: ✅ COMMENT POSTED SUCCESSFULLY! URL: ${commentUrl}`);
        return { platform: 'reddit', success: true, post_url: commentUrl, type: 'comment' };
      }
      if (commentData.json && commentData.json.errors && commentData.json.errors.length > 0) {
        log(`Reddit: Comment rejected: ${JSON.stringify(commentData.json.errors)}`);
        return { platform: 'reddit', success: false, error: JSON.stringify(commentData.json.errors) };
      }
      log(`Reddit: Unexpected comment response: ${JSON.stringify(commentData).substring(0, 300)}`);
    } else if (commentResp.status === 429) {
      log('Reddit: Rate limited');
      return { platform: 'reddit', success: false, error: 'Rate limited (429)' };
    } else {
      log(`Reddit: Comment failed (status: ${commentResp.status})`);
      const respText = await commentResp.text();
      log(`Reddit: Response body: ${respText.substring(0, 300)}`);
    }
    return { platform: 'reddit', success: false, error: `HTTP ${commentResp.status}` };
  } catch (e) {
    log(`Reddit: Error: ${e.message}`);
    return { platform: 'reddit', success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST 2: TWITTER/X — One tweet via GraphQL API + cookies
// ═══════════════════════════════════════════════════════════════
async function testTwitter() {
  log('═══ TEST 2: TWITTER/X ═══');
  const cookiesFile = path.join(COOKIES_DIR, 'twitter-cookies.json');
  const cookieData = readJSON(cookiesFile);

  if (!cookieData || !cookieData.cookies) {
    log('Twitter: No cookies file found');
    return { platform: 'twitter', success: false, error: 'No cookies file' };
  }

  const ct0 = cookieData.cookies.find(c => c.name === 'ct0');
  const authToken = cookieData.cookies.find(c => c.name === 'auth_token');

  if (!ct0 || !authToken) {
    log(`Twitter: Missing ct0 (${!!ct0}) or auth_token (${!!authToken})`);
    return { platform: 'twitter', success: false, error: 'Missing ct0 or auth_token' };
  }

  log(`Twitter: ct0 found (${ct0.value.substring(0, 10)}...), auth_token found (${authToken.value.substring(0, 10)}...)`);

  const cookieStr = cookieData.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const bearerToken = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  try {
    // Step 1: Verify session
    log('Twitter: Verifying session...');
    const settingsResp = await nodeFetch('https://x.com/i/api/1.1/account/settings.json', {
      headers: {
        'Cookie': cookieStr,
        'X-CSRF-Token': ct0.value,
        'Authorization': bearerToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      }
    });

    if (!settingsResp.ok) {
      log(`Twitter: Session verification FAILED (status: ${settingsResp.status})`);
      const respText = await settingsResp.text();
      log(`Twitter: Response: ${respText.substring(0, 300)}`);
      return { platform: 'twitter', success: false, error: `Session invalid: ${settingsResp.status}` };
    }
    const settings = await settingsResp.json();
    log(`Twitter: Session valid! Screen name: @${settings.screen_name}`);

    // Step 2: Post a tweet
    const tweetText = `Remove any background in seconds — free, no signup, works right in your browser.\n\nYour images never leave your device. 🔒\n\nTry it free 👇\n${SITE_URL}\n\n#BackgroundRemover #FreeTool`;

    log(`Twitter: Posting tweet (${tweetText.length} chars)...`);

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

    const tweetResp = await nodeFetch('https://x.com/i/api/graphql/Va2lvahdYCP1BLcl18y6pw/CreateTweet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieStr,
        'X-CSRF-Token': ct0.value,
        'Authorization': bearerToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'X-Twitter-Active-User': 'yes',
        'X-Twitter-Client-Language': 'en',
      },
      body: JSON.stringify({ variables, features }),
    });

    if (tweetResp.ok) {
      const data = await tweetResp.json();
      if (data.data && data.data.create_tweet && data.data.create_tweet.tweet_results) {
        const tweetId = data.data.create_tweet.tweet_results.result?.rest_id;
        log(`Twitter: ✅ TWEET POSTED SUCCESSFULLY! ID: ${tweetId}`);
        return { platform: 'twitter', success: true, tweet_id: tweetId, post_url: `https://x.com/i/status/${tweetId}` };
      }
      if (data.errors) {
        log(`Twitter: Tweet errors: ${JSON.stringify(data.errors)}`);
        return { platform: 'twitter', success: false, error: JSON.stringify(data.errors) };
      }
      log(`Twitter: Unexpected response: ${JSON.stringify(data).substring(0, 500)}`);
      return { platform: 'twitter', success: false, error: 'Unexpected response structure' };
    } else if (tweetResp.status === 429) {
      log('Twitter: Rate limited');
      return { platform: 'twitter', success: false, error: 'Rate limited (429)' };
    } else {
      log(`Twitter: Tweet failed (status: ${tweetResp.status})`);
      const respText = await tweetResp.text();
      log(`Twitter: Response: ${respText.substring(0, 500)}`);
      return { platform: 'twitter', success: false, error: `HTTP ${tweetResp.status}` };
    }
  } catch (e) {
    log(`Twitter: Error: ${e.message}`);
    return { platform: 'twitter', success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST 3: PINTEREST — One pin with dynamic AI image
// ═══════════════════════════════════════════════════════════════
async function testPinterest() {
  log('═══ TEST 3: PINTEREST ═══');
  const cookiesFile = path.join(COOKIES_DIR, 'pinterest-cookies.json');
  const cookieData = readJSON(cookiesFile);

  if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0) {
    log('Pinterest: No cookies file found');
    return { platform: 'pinterest', success: false, error: 'No cookies file' };
  }

  log(`Pinterest: Loaded ${cookieData.cookies.length} cookies`);

  try {
    // Step 1: Generate a dynamic AI image for the pin
    log('Pinterest: Generating dynamic AI image...');
    const topic = 'product-photos';
    const prompt = 'Professional product photography before-and-after: a sneaker on messy background (left half) and same sneaker on clean white (right half). Split comparison, studio lighting, e-commerce style, 2:3 vertical aspect ratio. No text overlays.';
    const imagePath = `/tmp/pinterest-pin-test-${Date.now()}.jpg`;

    let aiImageGenerated = false;
    try {
      const { execSync } = require('child_process');
      execSync(`z-ai-generate --prompt "${prompt.replace(/"/g, '\\"')}" --output "${imagePath}" --size 1000x1500`, {
        timeout: 120000, stdio: ['pipe', 'pipe', 'pipe']
      });
      const stats = fs.statSync(imagePath);
      if (stats.size > 10000) {
        log(`Pinterest: AI image generated (${stats.size} bytes) ✅`);
        aiImageGenerated = true;
      } else {
        log(`Pinterest: AI image too small (${stats.size} bytes)`);
      }
    } catch (e) {
      log(`Pinterest: AI image generation failed: ${e.message}`);
    }

    if (!aiImageGenerated) {
      log('Pinterest: Using placeholder image as fallback');
      // Create a simple placeholder
      const { execSync } = require('child_process');
      execSync(`z-ai-generate --prompt "Professional product photography, clean white background, e-commerce style, sneakers displayed beautifully, studio lighting, 2:3 vertical aspect ratio" --output "${imagePath}" --size 1000x1500`, {
        timeout: 120000, stdio: ['pipe', 'pipe', 'pipe']
      });
      if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 5000) {
        log('Pinterest: Fallback image generated ✅');
        aiImageGenerated = true;
      }
    }

    if (!aiImageGenerated) {
      log('Pinterest: No image available, cannot create pin');
      return { platform: 'pinterest', success: false, error: 'Image generation failed' };
    }

    // Step 2: Launch browser and create pin
    const browser = await puppeteer.launch({
      headless: false,
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
      ],
      defaultViewport: { width: 1366, height: 768 },
    });

    const page = (await browser.pages())[0] || await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
      delete navigator.__proto__.webdriver;
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

    // Load Pinterest cookies
    try {
      const cookies = cookieData.cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.pinterest.com',
        path: c.path || '/',
        httpOnly: c.httpOnly || false,
        secure: c.secure !== false,
        sameSite: c.sameSite || 'None',
      }));
      await page.setCookie(...cookies);
      log('Pinterest: Cookies loaded into browser');
    } catch (e) {
      log(`Pinterest: Failed to set cookies: ${e.message}`);
    }

    // Navigate to Pinterest
    log('Pinterest: Navigating to Pinterest...');
    await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));

    const url = page.url();
    log(`Pinterest: Current URL: ${url}`);

    if (url.includes('login') || url.includes('signup')) {
      log('Pinterest: Session expired — redirected to login');
      await browser.close();
      return { platform: 'pinterest', success: false, error: 'Session expired (redirected to login)' };
    }

    // Navigate to pin creation tool
    log('Pinterest: Going to pin creation tool...');
    await page.goto('https://www.pinterest.com/pin-creation-tool/', {
      waitUntil: 'domcontentloaded', timeout: 20000
    });
    await new Promise(r => setTimeout(r, 3000));

    // Upload image
    log('Pinterest: Uploading image...');
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      log('Pinterest: File input not found');
      await page.screenshot({ path: '/tmp/pinterest-pin-creation-page.png' });
      await browser.close();
      return { platform: 'pinterest', success: false, error: 'File input not found on pin creation page' };
    }

    await fileInput.uploadFile(imagePath);
    log('Pinterest: Image uploaded, waiting for processing...');
    await new Promise(r => setTimeout(r, 5000));

    // Fill in title
    const pinTitle = 'Free Background Remover - Remove Image Backgrounds Instantly';
    const titleInput = await page.$('input[data-test-id="pin-title-input"], input[placeholder*="title" i], input[aria-label*="title" i], #pinTitle');
    if (titleInput) {
      await titleInput.click();
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.type(pinTitle, { delay: 50 });
      log('Pinterest: Title filled');
    } else {
      log('Pinterest: Title input not found, trying alternatives...');
      // Try to find any text input on the page
      const allInputs = await page.$$('input[type="text"], input:not([type])');
      for (const inp of allInputs) {
        const placeholder = await page.evaluate(el => el.placeholder || el.getAttribute('aria-label') || '', inp);
        const isVisible = await page.evaluate(el => el.offsetParent !== null, inp);
        if (isVisible && (placeholder.toLowerCase().includes('title') || placeholder.toLowerCase().includes('describe'))) {
          await inp.click();
          await new Promise(r => setTimeout(r, 500));
          await page.keyboard.type(pinTitle, { delay: 50 });
          log(`Pinterest: Title filled via input with placeholder: "${placeholder}"`);
          break;
        }
      }
    }

    await new Promise(r => setTimeout(r, 1000));

    // Fill in description
    const pinDescription = 'Remove backgrounds from any image in seconds with our free online tool. No signup required, no watermarks. Works right in your browser using AI technology. Perfect for product photos, profile pictures, logos, and design projects.';
    const descInput = await page.$('textarea[data-test-id="pin-description-textarea"], textarea[placeholder*="description" i], textarea[aria-label*="description" i], #pinDescription');
    if (descInput) {
      await descInput.click();
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.type(pinDescription, { delay: 30 });
      log('Pinterest: Description filled');
    } else {
      log('Pinterest: Description textarea not found, trying alternatives...');
      const allTextareas = await page.$$('textarea');
      for (const ta of allTextareas) {
        const placeholder = await page.evaluate(el => el.placeholder || el.getAttribute('aria-label') || '', ta);
        const isVisible = await page.evaluate(el => el.offsetParent !== null, ta);
        if (isVisible) {
          await ta.click();
          await new Promise(r => setTimeout(r, 500));
          await page.keyboard.type(pinDescription, { delay: 30 });
          log(`Pinterest: Description filled via textarea with placeholder: "${placeholder}"`);
          break;
        }
      }
    }

    await new Promise(r => setTimeout(r, 1000));

    // Fill in destination link
    const destInput = await page.$('input[data-test-id="pin-link-input"], input[placeholder*="link" i], input[placeholder*="url" i], input[placeholder*="website" i], #pinLink');
    if (destInput) {
      await destInput.click();
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.type(SITE_URL, { delay: 30 });
      log('Pinterest: Destination link filled');
    } else {
      log('Pinterest: Destination link input not found (may be collapsed/hidden)');
    }

    await new Promise(r => setTimeout(r, 1000));

    // Click Publish button
    log('Pinterest: Looking for Publish button...');
    const publishBtn = await page.$('button[data-test-id="board-dropdown-save-button"], button[aria-label*="Publish" i], button[aria-label*="Save" i]');
    if (publishBtn) {
      const btnText = await page.evaluate(el => el.textContent.trim(), publishBtn);
      log(`Pinterest: Found publish button: "${btnText}"`);
      await publishBtn.click();
      log('Pinterest: Publish clicked, waiting for confirmation...');
      await new Promise(r => setTimeout(r, 8000));

      const finalUrl = page.url();
      log(`Pinterest: Final URL: ${finalUrl}`);

      // Check if pin was created (URL should change to a pin page)
      if (finalUrl.includes('/pin/')) {
        log(`Pinterest: ✅ PIN CREATED SUCCESSFULLY! URL: ${finalUrl}`);
        await browser.close();
        return { platform: 'pinterest', success: true, post_url: finalUrl, used_ai_image: true };
      }

      // Also check for success indicators
      const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (pageText.includes('Pin saved') || pageText.includes('Your Pin is live') || pageText.includes('Published')) {
        log('Pinterest: ✅ PIN CREATED (detected via page text)');
        await browser.close();
        return { platform: 'pinterest', success: true, post_url: finalUrl, used_ai_image: true };
      }

      // Take screenshot for debugging
      await page.screenshot({ path: '/tmp/pinterest-after-publish.png' });
      log('Pinterest: Uncertain result — screenshot saved. The pin may have been created.');
    } else {
      log('Pinterest: Publish button not found');
      await page.screenshot({ path: '/tmp/pinterest-no-publish-btn.png' });
      // Try clicking any button that says "Publish" or "Save"
      const allButtons = await page.$$('button');
      for (const btn of allButtons) {
        const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), btn);
        if (t.includes('publish') || t.includes('save')) {
          log(`Pinterest: Found alternative button: "${t}"`);
          await btn.click();
          await new Promise(r => setTimeout(r, 8000));
          const finalUrl = page.url();
          if (finalUrl.includes('/pin/')) {
            log(`Pinterest: ✅ PIN CREATED! URL: ${finalUrl}`);
            await browser.close();
            return { platform: 'pinterest', success: true, post_url: finalUrl, used_ai_image: true };
          }
          break;
        }
      }
    }

    await browser.close();
    log('Pinterest: Could not confirm pin creation');
    return { platform: 'pinterest', success: false, error: 'Could not confirm pin creation' };
  } catch (e) {
    log(`Pinterest: Error: ${e.message}`);
    return { platform: 'pinterest', success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  log('═══════════════════════════════════════════════════');
  log('BG REMOVER DIGITAL — TEST POSTING');
  log('One post each on Reddit, Twitter/X, Pinterest');
  log('═══════════════════════════════════════════════════');

  const results = [];

  // Test Reddit (comment, not post — safer for test)
  log('');
  results.push(await testReddit());

  // Test Twitter/X
  log('');
  results.push(await testTwitter());

  // Test Pinterest (with AI image)
  log('');
  results.push(await testPinterest());

  // Summary
  log('');
  log('═══════════════════════════════════════════════════');
  log('TEST RESULTS SUMMARY');
  log('═══════════════════════════════════════════════════');
  for (const r of results) {
    const status = r.success ? '✅ SUCCESS' : '❌ FAILED';
    log(`${status} | ${r.platform.toUpperCase()} | ${r.error || r.post_url || r.tweet_id || 'OK'}`);
    if (r.post_url) log(`         URL: ${r.post_url}`);
  }
  log('═══════════════════════════════════════════════════');

  // Save results to file
  const resultsPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
  }, null, 2));
  log(`Results saved to: ${resultsPath}`);
}

main().catch(e => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});
