#!/usr/bin/env node
/**
 * BG Remover Digital — SM Executive Agent v1.0
 * ─────────────────────────────────────────────────────────
 * MISSION: Reply to comments on Reddit, Twitter/X, and Pinterest posts
 *   - Runs every 4 hours via GitHub Actions cron
 *   - Uses z-ai CLI for AI-powered contextual replies
 *   - Tracks replied comment IDs in brain.json to avoid duplicates
 *   - Weekly self-review of engagement metrics
 *   - Respects per-session and per-platform reply limits
 *
 * STATE FILES:
 *   - data/sm-executive-brain.json   — replied IDs, conversation history, metrics
 *   - data/sm-executive-config.json  — settings (tone, limits, delays)
 *
 * COOKIES:
 *   - data/cookies/reddit-cookies.json    (OAuth token)
 *   - data/cookies/twitter-cookies.json   (ct0 + auth_token)
 *   - data/cookies/pinterest-cookies.json (browser cookies)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { URL } = require('url');

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const SITE_URL = 'https://bgremoverdigital.craftedmindss.com';
const BRAND = 'BG Remover Digital';
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const COOKIES_DIR = path.join(DATA_DIR, 'cookies');
const BRAIN_FILE = path.join(DATA_DIR, 'sm-executive-brain.json');
const CONFIG_FILE = path.join(DATA_DIR, 'sm-executive-config.json');
const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date();

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function log(msg) {
  console.log(`[SM Executive ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ── Data I/O ──
function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch (e) { log(`ERROR reading ${filePath}: ${e.message}`); return null; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── nodeFetch helper (https/http wrapper returning fetch-like API) ──
function nodeFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); }
    catch (e) { reject(new Error(`Invalid URL: ${url}`)); return; }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers || {};

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {},
      timeout: options.timeout || 30000,
    };

    // Copy allowed headers
    const safeHeaders = ['content-type', 'authorization', 'cookie', 'user-agent',
      'x-csrf-token', 'x-twitter-active-user', 'x-twitter-client-language', 'accept',
      'accept-language', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'referer'];
    for (const [key, value] of Object.entries(headers)) {
      if (safeHeaders.includes(key.toLowerCase())) {
        reqOptions.headers[key] = value;
      }
    }

    const body = options.body || null;

    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf-8');
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          text: async () => text,
          json: async () => JSON.parse(text),
          buffer: async () => buf,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timeout: ${url}`)); });

    if (body) req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function initBrain() {
  if (fs.existsSync(BRAIN_FILE)) {
    const existing = readJSON(BRAIN_FILE);
    if (existing) return existing;
  }
  log('Initializing new brain.json');
  return {
    version: '1.0',
    created: TODAY,
    last_updated: TODAY,
    replied_comments: [],
    conversation_threads: [],
    metrics: {
      total_replies: 0,
      reddit_replies: 0,
      twitter_replies: 0,
      pinterest_replies: 0,
      avg_reply_length: 0,
      sessions_run: 0,
    },
    reply_patterns: {
      good_replies: [],
      bad_replies: [],
    },
    weekly_reviews: [],
    last_weekly_review: null,
  };
}

function initConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    const existing = readJSON(CONFIG_FILE);
    if (existing) return existing;
  }
  log('Initializing new config.json');
  return {
    version: '1.0',
    max_replies_per_session: 5,
    max_replies_per_platform: 3,
    reply_delay_ms: { min: 2000, max: 5000 },
    platforms: {
      reddit: { enabled: true, subreddits_to_check: ['Entrepreneur', 'webdev', 'SmallBusiness', 'Etsy'] },
      twitter: { enabled: true },
      pinterest: { enabled: true },
    },
    tone: 'friendly_casual',
    weekly_review_day: 1,
    last_weekly_review: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// LLM REPLY GENERATION
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are replying to a comment on a social media post for BG Remover Digital (bgremoverdigital.craftedmindss.com), a free online background removal tool. Rules:
- Be SHORT (1-3 sentences max). Like a real person on their phone.
- Match the user's tone. Casual if they're casual, direct if they ask a question.
- If someone says "cool" or "nice", just say thanks — don't over-explain.
- DO NOT promote the product unless asked about it.
- DO NOT say "I'm an AI" or "I'm a bot".
- If asked a question about the tool, answer honestly and briefly.
- If someone criticizes, be polite and open to feedback.
- Keep it natural and conversational.`;

function generateReply(userComment, conversationContext, platform) {
  conversationContext = conversationContext || '';
  platform = platform || 'reddit';

  const platformNote = platform === 'twitter' ? 'Keep it VERY short (under 280 chars). Can use emojis.' :
    platform === 'pinterest' ? 'Be friendly and helpful.' : '';

  const userPrompt = conversationContext
    ? `Conversation so far:\n${conversationContext}\n\nLatest comment: "${userComment}"\n\n${platformNote}\nWrite a short reply:`
    : `Comment: "${userComment}"\n\n${platformNote}\nWrite a short reply:`;

  try {
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
    // Use z-ai CLI for chat completion
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    const result = execSync(`z-ai chat -p '${escapedPrompt}'`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!result || result.length === 0) {
      throw new Error('Empty response from z-ai');
    }

    // Extract just the reply text (z-ai CLI may add formatting)
    const lines = result.split('\n').filter(l => l.trim());
    const reply = lines[lines.length - 1].trim();

    // Truncate excessively long replies
    if (reply.length > 300) {
      const truncated = reply.substring(0, 297) + '...';
      log(`LLM reply truncated: ${truncated}`);
      return truncated;
    }

    return reply;
  } catch (e) {
    log(`LLM failed: ${e.message}, using fallback`);
    // Fallback responses based on comment type
    const lowerComment = (userComment || '').toLowerCase();
    let fallback;

    if (lowerComment.includes('cool') || lowerComment.includes('nice') || lowerComment.includes('awesome') || lowerComment.includes('great')) {
      fallback = 'Thanks! Appreciate it!';
    } else if (lowerComment.includes('how') || lowerComment.includes('work') || lowerComment.includes('what')) {
      fallback = 'It uses client-side AI to remove backgrounds right in your browser — no upload needed!';
    } else if (lowerComment.includes('thank') || lowerComment.includes('thx')) {
      fallback = 'No problem, glad it helped!';
    } else if (lowerComment.includes('bad') || lowerComment.includes('hate') || lowerComment.includes('suck')) {
      fallback = 'Sorry to hear that — feedback like this helps us improve. What could be better?';
    } else if (lowerComment.includes('free')) {
      fallback = 'Yeah, it\'s completely free — no signup, no watermarks.';
    } else {
      const fallbacks = [
        'Thanks for checking it out!',
        'Glad you found it useful!',
        'Appreciate the feedback!',
        'Thanks! Let me know if you have any questions.',
        'Cool, glad it helped!',
        'Thanks for the kind words!',
      ];
      fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════
// REDDIT: Fetch and reply to comments
// ═══════════════════════════════════════════════════════════════

async function redditEngage(page, brain, config) {
  log('=== Reddit Engagement Starting ===');

  // Try to get OAuth token from env first, then from cookies file
  let oauthToken = process.env.REDDIT_OAUTH_TOKEN;

  if (!oauthToken) {
    const cookiesFile = path.join(COOKIES_DIR, 'reddit-cookies.json');
    if (fs.existsSync(cookiesFile)) {
      const cookieData = readJSON(cookiesFile);
      if (cookieData && cookieData.oauth_token) {
        const tokenExpiry = cookieData.oauth_expires || 0;
        if (Date.now() < tokenExpiry) {
          oauthToken = cookieData.oauth_token;
          log(`Reddit: Using OAuth token from cookies file (expires in ${Math.round((tokenExpiry - Date.now()) / 3600000)}h)`);
        } else {
          log('Reddit: OAuth token in cookies file has expired');
        }
      }
    }
  }

  if (!oauthToken) {
    log('Reddit: No OAuth token available, skipping');
    return;
  }

  // Verify token works
  try {
    const meResp = await nodeFetch('https://oauth.reddit.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${oauthToken}`, 'User-Agent': 'BGRemoverDigital/1.0' }
    });
    if (!meResp.ok) {
      log(`Reddit: OAuth token invalid (status: ${meResp.status}), skipping`);
      return;
    }
    const meData = await meResp.json();
    log(`Reddit: Authenticated as u/${meData.name}`);
  } catch (e) {
    log(`Reddit: Token verification failed: ${e.message}`);
    return;
  }

  // Get our recent posts
  let posts = [];
  try {
    const meResp = await nodeFetch('https://oauth.reddit.com/user/AbrardeAhmed/submitted?limit=10&sort=new', {
      headers: { 'Authorization': `Bearer ${oauthToken}`, 'User-Agent': 'BGRemoverDigital/1.0' }
    });
    if (!meResp.ok) {
      log(`Reddit: Could not fetch posts (${meResp.status})`);
      return;
    }
    const meData = await meResp.json();
    posts = meData.data?.children || [];
    log(`Reddit: Found ${posts.length} recent posts`);
  } catch (e) {
    log(`Reddit: Error fetching posts: ${e.message}`);
    return;
  }

  let repliesThisSession = 0;

  for (const post of posts) {
    if (repliesThisSession >= config.max_replies_per_platform) break;

    const postId = post.data.name; // t3_xxxxx
    const postTitle = post.data.title || '';
    const postPermalink = post.data.permalink;
    const postUrl = `https://oauth.reddit.com${postPermalink}comments/`;

    log(`Reddit: Checking comments on "${postTitle.substring(0, 60)}..." (${postId})`);

    // Fetch comments on this post
    let comments = [];
    try {
      const commentsResp = await nodeFetch(postUrl, {
        headers: { 'Authorization': `Bearer ${oauthToken}`, 'User-Agent': 'BGRemoverDigital/1.0' }
      });
      if (!commentsResp.ok) {
        log(`Reddit: Could not fetch comments for ${postId} (${commentsResp.status})`);
        continue;
      }
      const commentsData = await commentsResp.json();
      comments = commentsData[1]?.data?.children || [];
    } catch (e) {
      log(`Reddit: Error fetching comments: ${e.message}`);
      continue;
    }

    log(`Reddit: Found ${comments.length} comments on post ${postId}`);

    for (const comment of comments) {
      if (comment.kind !== 't1') continue;

      const commentId = comment.data.name; // t1_xxxxx
      const author = comment.data.author;
      const body = comment.data.body || '';

      // Skip our own comments
      if (author === 'AbrardeAhmed' || author === '[deleted]') continue;
      // Skip if already replied
      if (brain.replied_comments.some(r => r.comment_id === commentId)) continue;
      // Skip very short comments (likely noise)
      if (body.length < 3) continue;

      // Build conversation context from previous replies in this thread
      let context = '';
      const threadReplies = brain.replied_comments.filter(r =>
        r.platform === 'reddit' && r.post_id === postId
      );
      if (threadReplies.length > 0) {
        context = threadReplies.map(r =>
          `${r.author || 'User'}: ${r.original_text}\nMe: ${r.our_reply}`
        ).join('\n');
      }

      // Generate reply
      const reply = generateReply(body, context, 'reddit');
      if (!reply || reply.length === 0) continue;

      log(`Reddit: Generated reply for u/${author}: "${reply.substring(0, 80)}..."`);

      // Post reply via API
      try {
        const replyBody = new URLSearchParams({
          api_type: 'json',
          thing_id: commentId,
          text: reply,
        });
        const replyResp = await nodeFetch('https://oauth.reddit.com/api/comment/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${oauthToken}`,
            'User-Agent': 'BGRemoverDigital/1.0',
          },
          body: replyBody.toString(),
        });

        if (replyResp.ok) {
          const replyData = await replyResp.json().catch(() => ({}));
          const ourReplyId = replyData.json?.data?.things?.[0]?.data?.name || null;

          log(`Reddit: ✓ Replied to u/${author}: "${body.substring(0, 50)}..." → "${reply.substring(0, 50)}..."`);

          brain.replied_comments.push({
            platform: 'reddit',
            comment_id: commentId,
            post_id: postId,
            author: author,
            original_text: body.substring(0, 200),
            our_reply: reply.substring(0, 200),
            our_reply_id: ourReplyId,
            date: TODAY,
          });

          // Update metrics
          brain.metrics.total_replies++;
          brain.metrics.reddit_replies++;
          repliesThisSession++;

          // Track reply length for average
          const allLengths = brain.replied_comments
            .filter(r => r.our_reply)
            .map(r => r.our_reply.length);
          brain.metrics.avg_reply_length = Math.round(
            allLengths.reduce((a, b) => a + b, 0) / allLengths.length
          );

          // Human delay between replies
          const delay = config.reply_delay_ms.min + Math.random() * (config.reply_delay_ms.max - config.reply_delay_ms.min);
          log(`Reddit: Waiting ${(delay / 1000).toFixed(1)}s before next reply...`);
          await sleep(delay);
        } else {
          const errText = await replyResp.text().catch(() => '');
          log(`Reddit: Reply failed (status: ${replyResp.status}) — ${errText.substring(0, 100)}`);
        }
      } catch (e) {
        log(`Reddit: Error posting reply: ${e.message}`);
      }
    }
  }

  log(`Reddit: Session complete — ${repliesThisSession} replies sent`);
}

// ═══════════════════════════════════════════════════════════════
// TWITTER/X: Fetch and reply to mentions/replies
// ═══════════════════════════════════════════════════════════════

async function twitterEngage(page, brain, config) {
  log('=== Twitter Engagement Starting ===');

  const twCookiesFile = path.join(COOKIES_DIR, 'twitter-cookies.json');
  if (!fs.existsSync(twCookiesFile)) {
    log('Twitter: No cookies file found, skipping');
    return;
  }

  const cookieData = readJSON(twCookiesFile);
  if (!cookieData || !cookieData.cookies || !Array.isArray(cookieData.cookies)) {
    log('Twitter: Invalid cookies file format, skipping');
    return;
  }

  // Find ct0 cookie (CSRF token)
  const ct0Cookie = cookieData.cookies.find(c => c.name === 'ct0');
  const authTokenCookie = cookieData.cookies.find(c => c.name === 'auth_token');

  if (!ct0Cookie) {
    log('Twitter: No ct0 cookie found, skipping');
    return;
  }

  const cookieStr = cookieData.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const bearer = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  const ct0Value = ct0Cookie.value;

  // Verify session is valid
  try {
    const verifyResp = await nodeFetch('https://x.com/i/api/1.1/account/verify_credentials.json', {
      headers: {
        'Cookie': cookieStr,
        'X-CSRF-Token': ct0Value,
        'Authorization': bearer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      }
    });
    if (!verifyResp.ok) {
      log(`Twitter: Session invalid (status: ${verifyResp.status}), skipping`);
      return;
    }
    const verifyData = await verifyResp.json();
    log(`Twitter: Authenticated as @${verifyData.screen_name}`);
  } catch (e) {
    log(`Twitter: Session verification failed: ${e.message}`);
    return;
  }

  // Get mentions timeline
  let mentionsData;
  try {
    const resp = await nodeFetch('https://x.com/i/api/2/timeline/mention.json?count=20', {
      headers: {
        'Cookie': cookieStr,
        'X-CSRF-Token': ct0Value,
        'Authorization': bearer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'X-Twitter-Active-User': 'yes',
        'X-Twitter-Client-Language': 'en',
      }
    });
    if (!resp.ok) {
      log(`Twitter: Could not fetch mentions (${resp.status})`);
      return;
    }
    mentionsData = await resp.json();
  } catch (e) {
    log(`Twitter: Error fetching mentions: ${e.message}`);
    return;
  }

  // Parse mentions and reply to unreplied ones
  let repliesThisSession = 0;
  try {
    const tweets = mentionsData.globalObjects?.tweets || {};
    const users = mentionsData.globalObjects?.users || {};

    const tweetEntries = Object.entries(tweets).filter(([, tweet]) => {
      // Skip non-replies (only engage with replies/mentions to us)
      return tweet.in_reply_to_status_id_str !== null;
    });

    log(`Twitter: Found ${tweetEntries.length} mention/reply tweets`);

    for (const [tweetId, tweet] of tweetEntries) {
      if (repliesThisSession >= config.max_replies_per_platform) break;

      const authorId = tweet.user_id_str;
      const author = users[authorId]?.screen_name || 'unknown';
      if (author === 'bg_remover' || author === 'bgremoverdigital') continue;

      // Skip if already replied
      if (brain.replied_comments.some(r => r.comment_id === tweetId)) continue;

      const text = tweet.full_text || tweet.text || '';
      if (text.length < 2) continue;

      // Build context from prior replies in this thread
      let context = '';
      const parentId = tweet.in_reply_to_status_id_str;
      if (parentId && tweets[parentId]) {
        const parentText = tweets[parentId].full_text || tweets[parentId].text || '';
        context = `Original post: "${parentText.substring(0, 150)}"`;
      }

      const reply = generateReply(text, context, 'twitter');
      if (!reply) continue;

      // Trim to Twitter length if needed
      const finalReply = reply.length > 280 ? reply.substring(0, 277) + '...' : reply;
      log(`Twitter: Generated reply for @${author}: "${finalReply.substring(0, 80)}..."`);

      // Post reply via GraphQL
      const variables = {
        tweet_text: finalReply,
        reply: { in_reply_to_tweet_id: tweetId },
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

      try {
        const replyResp = await nodeFetch('https://x.com/i/api/graphql/Va2lvahdYCP1BLcl18y6pw/CreateTweet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieStr,
            'X-CSRF-Token': ct0Value,
            'Authorization': bearer,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            'X-Twitter-Active-User': 'yes',
            'X-Twitter-Client-Language': 'en',
            'Referer': 'https://x.com/',
          },
          body: JSON.stringify({ variables, features }),
        });

        if (replyResp.ok) {
          const replyData = await replyResp.json().catch(() => ({}));
          const ourTweetId = replyData.data?.create_tweet?.tweet_results?.result?.rest_id || null;

          log(`Twitter: ✓ Replied to @${author}: "${text.substring(0, 50)}..." → "${finalReply.substring(0, 50)}..."`);

          brain.replied_comments.push({
            platform: 'twitter',
            comment_id: tweetId,
            author: '@' + author,
            original_text: text.substring(0, 200),
            our_reply: finalReply.substring(0, 200),
            our_reply_id: ourTweetId,
            date: TODAY,
          });

          brain.metrics.total_replies++;
          brain.metrics.twitter_replies++;
          repliesThisSession++;

          const allLengths = brain.replied_comments
            .filter(r => r.our_reply)
            .map(r => r.our_reply.length);
          brain.metrics.avg_reply_length = Math.round(
            allLengths.reduce((a, b) => a + b, 0) / allLengths.length
          );

          const delay = config.reply_delay_ms.min + Math.random() * (config.reply_delay_ms.max - config.reply_delay_ms.min);
          log(`Twitter: Waiting ${(delay / 1000).toFixed(1)}s before next reply...`);
          await sleep(delay);
        } else {
          const errText = await replyResp.text().catch(() => '');
          log(`Twitter: Reply failed (status: ${replyResp.status}) — ${errText.substring(0, 200)}`);
        }
      } catch (e) {
        log(`Twitter: Error posting reply: ${e.message}`);
      }
    }
  } catch (e) {
    log(`Twitter: Mentions parsing error: ${e.message}`);
  }

  log(`Twitter: Session complete — ${repliesThisSession} replies sent`);
}

// ═══════════════════════════════════════════════════════════════
// PINTEREST: Fetch and reply to pin comments
// ═══════════════════════════════════════════════════════════════

async function pinterestEngage(page, brain, config) {
  log('=== Pinterest Engagement Starting ===');

  try {
    const cookiesFile = path.join(COOKIES_DIR, 'pinterest-cookies.json');
    if (!fs.existsSync(cookiesFile)) {
      log('Pinterest: No cookies file, skipping');
      return;
    }
    const cookieData = readJSON(cookiesFile);
    if (!cookieData || !cookieData.cookies || !Array.isArray(cookieData.cookies)) {
      log('Pinterest: Invalid cookies file, skipping');
      return;
    }

    // Load cookies into browser
    const formattedCookies = cookieData.cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.pinterest.com',
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure !== false,
    }));

    await page.setCookie(...formattedCookies);
    log(`Pinterest: Loaded ${formattedCookies.length} cookies`);

    // Navigate to our profile to verify session
    await page.goto('https://www.pinterest.com/BGRemoverPro/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    await sleep(2000);

    // Check if logged in
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('signup')) {
      log('Pinterest: Session expired (redirected to login), skipping');
      return;
    }

    log('Pinterest: Session valid, checking profile...');

    // Get our recent pins
    const pins = await page.$$eval('a[href*="/pin/"]', links =>
      links.slice(0, 5).map(l => l.href).filter(h => h.match(/\/pin\/\d+/))
    ).catch(() => []);

    if (pins.length === 0) {
      log('Pinterest: No recent pins found, skipping');
      return;
    }

    log(`Pinterest: Found ${pins.length} recent pins`);

    let repliesThisSession = 0;

    for (const pinUrl of pins) {
      if (repliesThisSession >= config.max_replies_per_platform) break;

      try {
        log(`Pinterest: Checking pin ${pinUrl}`);
        await page.goto(pinUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(2500);

        // Scroll down a bit to load comments
        await page.evaluate(() => window.scrollBy(0, 500));
        await sleep(1500);

        // Find comments on this pin
        const comments = await page.$$eval(
          '[data-test-id="pin-comment"], .comment, [class*="Comment"]',
          els => els.map(el => ({
            text: el.textContent.trim().substring(0, 200),
            id: el.getAttribute('data-test-id') || el.id || '',
          }))
        ).catch(() => []);

        if (comments.length === 0) {
          log(`Pinterest: No comments found on pin ${pinUrl}`);
          continue;
        }

        log(`Pinterest: Found ${comments.length} comments on pin`);

        for (const comment of comments) {
          if (!comment.text || comment.text.length < 5) continue;

          // Create a unique key for this comment
          const commentKey = `pin-${pinUrl}-${comment.text.substring(0, 40)}`;

          if (brain.replied_comments.some(r => r.comment_id === commentKey)) continue;

          const reply = generateReply(comment.text, '', 'pinterest');
          if (!reply) continue;

          // Try to find and use the reply input
          const replyInput = await page.$(
            'input[placeholder*="comment" i], input[placeholder*="reply" i], ' +
            'textarea[placeholder*="comment" i], textarea[placeholder*="reply" i], ' +
            '[data-test-id="comment-input"]'
          ).catch(() => null);

          if (replyInput) {
            await replyInput.click();
            await sleep(500);
            await page.keyboard.type(reply, { delay: 30 + Math.floor(Math.random() * 20) });
            await sleep(500);

            // Find and click submit button
            const submitBtn = await page.$(
              'button[data-test-id="pin-comment-submit"], ' +
              'button[type="submit"], ' +
              '[data-test-id="submit-comment"]'
            ).catch(() => null);

            if (submitBtn) {
              await submitBtn.click();
              await sleep(2000);

              log(`Pinterest: ✓ Replied to comment on pin: "${comment.text.substring(0, 50)}..." → "${reply.substring(0, 50)}..."`);

              brain.replied_comments.push({
                platform: 'pinterest',
                comment_id: commentKey,
                pin_url: pinUrl,
                original_text: comment.text.substring(0, 200),
                our_reply: reply.substring(0, 200),
                date: TODAY,
              });

              brain.metrics.total_replies++;
              brain.metrics.pinterest_replies++;
              repliesThisSession++;

              const allLengths = brain.replied_comments
                .filter(r => r.our_reply)
                .map(r => r.our_reply.length);
              brain.metrics.avg_reply_length = Math.round(
                allLengths.reduce((a, b) => a + b, 0) / allLengths.length
              );

              await sleep(3000);
            } else {
              log('Pinterest: Could not find submit button for comment reply');
            }
          } else {
            log('Pinterest: Could not find comment reply input');
          }
        }
      } catch (e) {
        log(`Pinterest: Error checking pin ${pinUrl}: ${e.message}`);
      }
    }
  } catch (e) {
    log(`Pinterest: Engagement error: ${e.message}`);
  }

  log(`Pinterest: Session complete — ${brain.metrics.pinterest_replies} total replies`);
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY SELF-REVIEW
// ═══════════════════════════════════════════════════════════════

function weeklyReview(brain) {
  log('=== Running Weekly Self-Review ===');

  const review = {
    date: TODAY,
    total_replies: brain.metrics.total_replies,
    platform_breakdown: {
      reddit: brain.metrics.reddit_replies,
      twitter: brain.metrics.twitter_replies,
      pinterest: brain.metrics.pinterest_replies,
    },
    avg_reply_length: brain.metrics.avg_reply_length,
    total_unique_conversations: new Set(
      brain.replied_comments.map(r => r.post_id || r.pin_url || r.comment_id)
    ).size,
    observations: [],
    recommendations: [],
  };

  // Analysis heuristics
  if (brain.metrics.reddit_replies === 0) {
    review.observations.push('No Reddit replies — check if OAuth token is still valid');
    review.recommendations.push('Run setup-cookies.js to refresh Reddit auth');
  }
  if (brain.metrics.twitter_replies === 0) {
    review.observations.push('No Twitter replies — check if cookies are still valid');
    review.recommendations.push('Run setup-cookies.js to refresh Twitter session');
  }
  if (brain.metrics.pinterest_replies === 0) {
    review.observations.push('No Pinterest replies — may need to refresh cookies');
  }

  if (brain.metrics.twitter_replies > brain.metrics.reddit_replies * 2) {
    review.observations.push('Twitter getting significantly more engagement than Reddit');
  }

  if (brain.metrics.reddit_replies > brain.metrics.twitter_replies * 2) {
    review.observations.push('Reddit getting more engagement than Twitter — good community fit');
  }

  if (brain.metrics.total_replies > 50) {
    review.observations.push('High engagement volume — consider increasing max_replies_per_session');
    review.recommendations.push('Consider raising max_replies_per_session from 5 to 8');
  }

  if (brain.metrics.avg_reply_length > 100) {
    review.observations.push('Average reply length is long — try to keep responses shorter');
    review.recommendations.push('Review LLM prompt to encourage brevity');
  }

  if (brain.metrics.avg_reply_length < 20) {
    review.observations.push('Average reply length is very short — ensure replies are still useful');
  }

  // Track total replied comments for trend
  const repliesThisWeek = brain.replied_comments.filter(r => {
    const replyDate = new Date(r.date);
    const weekAgo = new Date(NOW - 7 * 24 * 60 * 60 * 1000);
    return replyDate >= weekAgo;
  }).length;
  review.replies_this_week = repliesThisWeek;

  brain.weekly_reviews.push(review);

  // Trim old weekly reviews (keep last 12 weeks)
  if (brain.weekly_reviews.length > 12) {
    brain.weekly_reviews = brain.weekly_reviews.slice(-12);
  }

  // Trim old replied_comments (keep last 500)
  if (brain.replied_comments.length > 500) {
    brain.replied_comments = brain.replied_comments.slice(-500);
  }

  log(`Weekly review complete: ${review.total_replies} total replies, ${repliesThisWeek} this week`);
  review.observations.forEach(obs => log(`  → ${obs}`));
  review.recommendations.forEach(rec => log(`  💡 ${rec}`));
}

// ═══════════════════════════════════════════════════════════════
// PUPPETEER BROWSER LAUNCH
// ═══════════════════════════════════════════════════════════════

async function launchBrowser() {
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
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  // Anti-detection measures
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
    delete navigator.__proto__.webdriver;
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
  );

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  });

  return { browser, page };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  log('═══════════════════════════════════════════════════');
  log('═══ SM Executive Agent v1.0 Starting ═══');
  log('═══════════════════════════════════════════════════');

  // Initialize state
  let brain = initBrain();
  let config = initConfig();

  // Check if weekly review needed
  const today = new Date();
  if (config.weekly_review_day === today.getDay() && config.last_weekly_review !== TODAY) {
    weeklyReview(brain);
    config.last_weekly_review = TODAY;
  }

  // Count replies already made today (to respect per-session limits)
  const todayReplies = brain.replied_comments.filter(r => r.date === TODAY).length;
  const remainingQuota = Math.max(0, config.max_replies_per_session - todayReplies);
  log(`Today's replies so far: ${todayReplies}, remaining quota: ${remainingQuota}`);

  if (remainingQuota <= 0) {
    log('Daily reply quota already reached, skipping engagement');
  }

  // Launch browser
  log('Launching browser...');
  const { browser, page } = await launchBrowser();

  try {
    // Reddit engagement
    if (config.platforms.reddit.enabled && remainingQuota > 0) {
      await redditEngage(page, brain, config);
    } else if (config.platforms.reddit.enabled) {
      log('Reddit: Skipped (quota reached)');
    } else {
      log('Reddit: Disabled in config');
    }

    // Twitter engagement
    if (config.platforms.twitter.enabled && remainingQuota > 0) {
      await twitterEngage(page, brain, config);
    } else if (config.platforms.twitter.enabled) {
      log('Twitter: Skipped (quota reached)');
    } else {
      log('Twitter: Disabled in config');
    }

    // Pinterest engagement (uses browser)
    if (config.platforms.pinterest.enabled && remainingQuota > 0) {
      await pinterestEngage(page, brain, config);
    } else if (config.platforms.pinterest.enabled) {
      log('Pinterest: Skipped (quota reached)');
    } else {
      log('Pinterest: Disabled in config');
    }
  } catch (e) {
    log(`Error during engagement: ${e.message}`);
    log(e.stack);
  }

  // Update state
  brain.last_updated = TODAY;
  brain.metrics.sessions_run = (brain.metrics.sessions_run || 0) + 1;
  writeJSON(BRAIN_FILE, brain);
  writeJSON(CONFIG_FILE, config);
  log(`State saved: ${BRAIN_FILE}`);

  // Commit changes to git
  try {
    const projectRoot = path.resolve(DATA_DIR, '..');
    execSync(
      `cd "${projectRoot}" && git add data/sm-executive-brain.json data/sm-executive-config.json 2>/dev/null && ` +
      `git commit -m "sm-executive: engagement update - ${TODAY} [skip ci]" 2>/dev/null && ` +
      `git push 2>/dev/null`,
      { stdio: 'pipe', timeout: 30000 }
    );
    log('Git commit and push successful');
  } catch (e) {
    log(`Git commit skipped: ${e.message}`);
  }

  // Close browser
  await browser.close();
  log('Browser closed');

  // Final summary
  log('═══════════════════════════════════════════════════');
  log(`═══ SM Executive Complete ═══`);
  log(`Total replies: ${brain.metrics.total_replies}`);
  log(`  Reddit: ${brain.metrics.reddit_replies}`);
  log(`  Twitter: ${brain.metrics.twitter_replies}`);
  log(`  Pinterest: ${brain.metrics.pinterest_replies}`);
  log(`  Avg reply length: ${brain.metrics.avg_reply_length} chars`);
  log(`  Sessions run: ${brain.metrics.sessions_run}`);
  log('═══════════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
