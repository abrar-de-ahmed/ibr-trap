/**
 * Twitter/X Content Script
 * Runs on *://x.com/* and *://twitter.com/*
 * Receives posting instructions from background.js via chrome.runtime.onMessage
 * Performs actual tweet composition, posting, and verification in the real browser.
 */

(function() {
  'use strict';

  const TWITTER_HANDLE = 'bg_remover';
  const MAX_RETRIES = 2;

  // ── Utility: human-like delays ──
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function humanDelay(min, max) {
    return sleep(rand(min, max));
  }

  // ── Utility: wait for element with MutationObserver ──
  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      // Check immediately
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element not found: ${selector} (timeout ${timeout}ms)`));
      }, timeout);
    });
  }

  // ── Utility: safe click with JS fallback ──
  async function safeClick(selector) {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanDelay(200, 400);
    el.click();
    return true;
  }

  // ── Utility: human-like typing on contenteditable ──
  async function humanType(element, text) {
    element.focus();
    await humanDelay(300, 500);
    // Clear existing content
    element.textContent = '';
    await humanDelay(100, 200);

    let charCount = 0;
    for (const char of text) {
      // Use execCommand or InputEvent for contenteditable
      document.execCommand('insertText', false, char);
      charCount++;

      // Random pause every 5-10 chars to simulate thinking
      if (charCount % rand(5, 10) === 0) {
        await humanDelay(200, 500);
      } else {
        await sleep(rand(25, 60));
      }
    }
    await humanDelay(500, 1000);
  }

  // ── Main: Post tweet ──
  async function postTweet(text) {
    console.log('[Twitter CS] Posting tweet:', text.substring(0, 50) + '...');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[Twitter CS] Attempt ${attempt}/${MAX_RETRIES}`);
      try {
        const result = await attemptTweet(text);
        if (result.success) return result;
        if (attempt < MAX_RETRIES) {
          console.log(`[Twitter CS] Attempt ${attempt} failed: ${result.error}. Retrying...`);
          await humanDelay(2000, 4000);
        } else {
          return result;
        }
      } catch (e) {
        console.error(`[Twitter CS] Attempt ${attempt} exception:`, e.message);
        if (attempt === MAX_RETRIES) {
          return { success: false, error: e.message };
        }
        await humanDelay(2000, 4000);
      }
    }
    return { success: false, error: 'All retry attempts failed' };
  }

  async function attemptTweet(text) {
    // Step 1: Navigate to compose
    const currentUrl = window.location.href;
    if (!currentUrl.includes('/compose/post')) {
      window.location.href = 'https://x.com/compose/post';
      await sleep(3000);
      // Wait for page load
      await waitForElement('[data-testid="tweetTextarea_0"]', 10000).catch(() => null);
      await humanDelay(1000, 2000);
    }

    // Step 2: Find compose box
    const composeSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][data-testid="tweetTextarea_0"]'
    ];

    let tweetBox = null;
    for (const sel of composeSelectors) {
      tweetBox = document.querySelector(sel);
      if (tweetBox) break;
    }

    if (!tweetBox) {
      // Maybe need to click "Post" button in side nav to open compose
      const postNavBtn = document.querySelector('a[href="/compose/post"]') ||
                          document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
      if (postNavBtn) {
        postNavBtn.click();
        await sleep(2000);
        for (const sel of composeSelectors) {
          tweetBox = document.querySelector(sel);
          if (tweetBox) break;
        }
      }
    }

    if (!tweetBox) {
      return { success: false, error: 'Compose box not found — may not be logged in' };
    }

    // Step 2.5: Clear any existing text in compose box (prevents duplicate detection)
    if (tweetBox.textContent?.trim().length > 0) {
      console.log('[Twitter CS] Compose box has existing text, clearing...');
      tweetBox.focus();
      tweetBox.textContent = '';
      await humanDelay(300, 500);
      // Trigger input event so Twitter knows it's empty
      tweetBox.dispatchEvent(new Event('input', { bubbles: true }));
      await humanDelay(1000, 2000);
    }

    // Step 3: Type tweet text with human-like delays
    await humanType(tweetBox, text);
    console.log('[Twitter CS] Text typed successfully');

    // Step 4: Wait for tweet button to become enabled
    await humanDelay(1000, 2000);

    let tweetBtn = null;
    const btnSelectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]'
    ];
    for (const sel of btnSelectors) {
      tweetBtn = document.querySelector(sel);
      if (tweetBtn) break;
    }

    if (!tweetBtn) {
      return { success: false, error: 'Tweet button not found' };
    }

    // Check if button is disabled
    const isDisabled = tweetBtn.getAttribute('aria-disabled') === 'true' ||
                       tweetBtn.disabled ||
                       tweetBtn.getAttribute('data-testid') === 'tweetButtonDisabled';

    if (isDisabled) {
      return { success: false, error: 'Tweet button is disabled — possibly duplicate or invalid content' };
    }

    // Step 5: Click tweet button
    console.log('[Twitter CS] Clicking tweet button...');
    tweetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanDelay(300, 500);
    tweetBtn.click();

    // Step 6: Wait and verify
    await humanDelay(4000, 6000);

    // Check for error toasts
    const errorToast = document.querySelector('[data-testid="toast"] [role="alert"]') ||
                       document.querySelector('[data-testid="toast"]');
    if (errorToast) {
      const errorText = errorToast.textContent?.trim() || 'Unknown error';
      console.error('[Twitter CS] Toast error:', errorText);
      if (errorText.toLowerCase().includes('error') ||
          errorText.toLowerCase().includes('duplicate') ||
          errorText.toLowerCase().includes('try again') ||
          errorText.toLowerCase().includes("can't")) {
        return { success: false, error: `Toast error: ${errorText}` };
      }
    }

    // Check if compose area is empty (tweet was sent)
    const composeAfter = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (composeAfter) {
      const remainingText = composeAfter.textContent?.trim() || '';
      if (remainingText.length > 0) {
        return { success: false, error: 'Tweet text still in compose box — likely failed' };
      }
    }

    console.log('[Twitter CS] Tweet appears to have been sent! Compose area cleared.');

    // Step 7: Try to get tweet URL from profile
    let tweetUrl = null;
    let tweetId = null;
    try {
      window.location.href = `https://x.com/${TWITTER_HANDLE}`;
      await sleep(3000);
      await humanDelay(1000, 2000);

      // Wait for timeline to load
      await new Promise(r => setTimeout(r, 2000));

      const tweetLinks = document.querySelectorAll('a[href*="/status/"]');
      const userTweetLinks = Array.from(tweetLinks).filter(a =>
        a.href.includes(`/${TWITTER_HANDLE}/status/`)
      );

      if (userTweetLinks.length > 0) {
        tweetUrl = userTweetLinks[0].href;
        tweetId = tweetUrl.split('/status/')[1]?.split('?')[0]?.split('/')[0];
        console.log('[Twitter CS] Found tweet URL:', tweetUrl);
      }
    } catch (e) {
      console.log('[Twitter CS] Profile check skipped:', e.message);
    }

    return {
      success: true,
      tweet_id: tweetId,
      post_url: tweetUrl
    };
  }

  // ── Listen for messages from background.js ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'post_request' && message.platform === 'twitter') {
      const { requestId, payload } = message;
      console.log('[Twitter CS] Received post request:', requestId, payload);

      // Execute async and send response back
      postTweet(payload.text || payload.tweet || '')
        .then(result => {
          console.log('[Twitter CS] Post result:', result);
          chrome.runtime.sendMessage({
            type: 'post_result',
            platform: 'twitter',
            requestId,
            result
          }).catch(() => {
            // Background might not be listening, that's OK
          });
          sendResponse({ type: 'post_result', requestId, result });
        })
        .catch(err => {
          const result = { success: false, error: err.message };
          chrome.runtime.sendMessage({
            type: 'post_result',
            platform: 'twitter',
            requestId,
            result
          }).catch(() => {});
          sendResponse({ type: 'post_result', requestId, result });
        });

      return true; // Keep channel open for async response
    }
  });

  console.log('[Twitter CS] Content script loaded on', window.location.hostname);
})();
