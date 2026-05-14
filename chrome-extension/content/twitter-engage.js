/**
 * Twitter/X Engagement Content Script
 * Runs on *://x.com/* and *://twitter.com/*
 * Handles: follow, like, comment on tweet, reply to a specific reply.
 *
 * Listens for messages from background.js where:
 *   message.type === 'post_request'
 *   message.platform === 'twitter'
 *   message.payload.action === 'twitter_follow' | 'twitter_like' | 'twitter_comment' | 'twitter_reply'
 *
 * Does NOT handle posting (that's twitter.js — untouched).
 */

(function() {
  'use strict';

  const MAX_RETRIES = 2;

  // ── Utility: random helpers ──
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
  function humanDelay(min, max) {
    return sleep(rand(min, max));
  }

  // ── Utility: wait for element via MutationObserver ──
  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Element not found: ${selector}`)); }, timeout);
    });
  }

  // ── Utility: wait for element matching predicate ──
  function waitForElementMatching(predicate, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const els = document.querySelectorAll('*');
        for (const el of els) {
          if (predicate(el)) return el;
        }
        return null;
      };
      const found = check();
      if (found) return resolve(found);
      const observer = new MutationObserver(() => {
        const el = check();
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('Predicate element not found')); }, timeout);
    });
  }

  // ── Utility: human-like typing on contenteditable ──
  async function humanType(element, text) {
    element.focus();
    await humanDelay(300, 600);
    element.textContent = '';
    await humanDelay(150, 300);
    let charCount = 0;
    for (const char of text) {
      document.execCommand('insertText', false, char);
      charCount++;
      if (charCount % rand(4, 8) === 0) await humanDelay(200, 500);
      else await sleep(rand(25, 65));
    }
    await humanDelay(500, 1200);
  }

  // ── Utility: scroll element into view with delay ──
  async function scrollIntoView(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanDelay(400, 800);
  }

  // ── Utility: check for error toast ──
  function checkForToastError() {
    const toast = document.querySelector('[data-testid="toast"] [role="alert"]') ||
                  document.querySelector('[data-testid="toast"]');
    if (toast) {
      const text = toast.textContent?.trim() || '';
      if (text.length > 0) {
        const lower = text.toLowerCase();
        if (lower.includes('error') || lower.includes('try again') ||
            lower.includes("can't") || lower.includes('something went') ||
            lower.includes('rate limit') || lower.includes('duplicate')) {
          return text;
        }
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 1: FOLLOW A USER
  // ═══════════════════════════════════════════════════════════════
  async function followUser(username) {
    console.log('[Twitter Engage] Following user:', username);

    // Navigate to profile
    window.location.href = `https://x.com/${username}`;
    await sleep(4000);
    await humanDelay(1000, 2000);

    // Wait for profile to load — look for the Follow button
    // data-testid changes: "follow" when not following, "following" / "unfollow" when already following
    const followBtnSelectors = [
      '[data-testid="placementTracking"] [data-testid$="ollow"]',
      'button[data-testid="follow"]',
      '[role="button"] span span span'  // fallback
    ];

    // More robust: find any element with text "Follow" that's a button-like element
    let followBtn = null;
    for (const sel of followBtnSelectors) {
      try {
        followBtn = await waitForElement(sel, 8000);
        if (followBtn) {
          const testId = followBtn.getAttribute('data-testid') || '';
          const text = followBtn.textContent?.trim().toLowerCase() || '';
          // Only click if it says "Follow" (not "Following" or "Unfollow")
          if (testId === 'follow' || (text === 'follow' && !testId.includes('unfollow') && !testId.includes('following'))) {
            break;
          }
          followBtn = null;
        }
      } catch (e) {
        followBtn = null;
      }
    }

    // Text-match fallback: find button/link containing "Follow"
    if (!followBtn) {
      try {
        followBtn = await waitForElementMatching(el => {
          if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.getAttribute('role') !== 'button') return false;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          const text = el.textContent?.trim().toLowerCase() || '';
          return text === 'follow';
        }, 8000);
      } catch (e) {}
    }

    if (!followBtn) {
      // Maybe already following — check for "Following" / "Unfollow" button
      const followingBtn = document.querySelector('[data-testid="unfollow"]') ||
                           document.querySelector('[data-testid="following"]');
      if (followingBtn) {
        return { success: false, error: 'Already following this user', data: { already_following: true } };
      }
      return { success: false, error: 'Follow button not found — user may not exist or profile did not load' };
    }

    await scrollIntoView(followBtn);
    await humanDelay(300, 600);
    followBtn.click();
    await humanDelay(3000, 5000);

    // Check for errors
    const toastError = checkForToastError();
    if (toastError) {
      return { success: false, error: `Follow failed: ${toastError}` };
    }

    // Verify: button should now say "Following" or have unfollow testid
    const nowFollowing = document.querySelector('[data-testid="unfollow"]') ||
                         document.querySelector('[data-testid="following"]');
    if (nowFollowing) {
      console.log('[Twitter Engage] Follow successful!');
      return {
        success: true,
        data: {
          username,
          profile_url: `https://x.com/${username}`,
          followed: true
        }
      };
    }

    return { success: true, data: { username, followed: true } };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 2: LIKE A TWEET
  // ═══════════════════════════════════════════════════════════════
  async function likeTweet(tweetUrl) {
    console.log('[Twitter Engage] Liking tweet:', tweetUrl);

    // Navigate to tweet
    window.location.href = tweetUrl;
    await sleep(4000);
    await humanDelay(1500, 3000);

    // Find the Like button — data-testid="like" (unliked) or "unlike" (already liked)
    const likeBtn = document.querySelector('[data-testid="like"]');
    const unlikeBtn = document.querySelector('[data-testid="unlike"]');

    if (unlikeBtn) {
      return { success: false, error: 'Tweet already liked', data: { already_liked: true, tweet_url: tweetUrl } };
    }

    if (!likeBtn) {
      return { success: false, error: 'Like button not found — tweet may not exist or page did not load' };
    }

    await scrollIntoView(likeBtn);
    await humanDelay(300, 600);
    likeBtn.click();
    await humanDelay(2000, 4000);

    // Verify: button should change to "unlike"
    const verified = document.querySelector('[data-testid="unlike"]');
    if (verified) {
      const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0]?.split('/')[0];
      console.log('[Twitter Engage] Like successful!');
      return {
        success: true,
        data: {
          tweet_url: tweetUrl,
          tweet_id: tweetId,
          liked: true
        }
      };
    }

    // Check for toast error
    const toastError = checkForToastError();
    if (toastError) {
      return { success: false, error: `Like failed: ${toastError}` };
    }

    return { success: false, error: 'Like may not have registered — could not verify' };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 3: COMMENT ON A TWEET
  // ═══════════════════════════════════════════════════════════════
  async function commentOnTweet(tweetUrl, commentText) {
    console.log('[Twitter Engage] Commenting on tweet:', tweetUrl);

    // Navigate to tweet
    window.location.href = tweetUrl;
    await sleep(4000);
    await humanDelay(1500, 3000);

    // Find the Reply button for the original tweet
    const replyBtnSelectors = [
      '[data-testid="reply"]',
      'button[data-testid="reply"]'
    ];

    let replyBtn = null;
    for (const sel of replyBtnSelectors) {
      try {
        replyBtn = await waitForElement(sel, 8000);
        if (replyBtn) break;
      } catch (e) {}
    }

    if (!replyBtn) {
      return { success: false, error: 'Reply button not found on tweet' };
    }

    await scrollIntoView(replyBtn);
    await humanDelay(400, 700);
    replyBtn.click();
    await humanDelay(1000, 2000);

    // A reply compose box should appear — find it
    // The reply box gets a new data-testid like "tweetTextarea_0" in the reply dialog
    const replyBoxSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-testid="tweetTextarea_0"]'
    ];

    let replyBox = null;
    for (const sel of replyBoxSelectors) {
      // Wait a moment for the reply dialog to fully render
      try {
        replyBox = await waitForElement(sel, 5000);
        if (replyBox) break;
      } catch (e) {}
    }

    if (!replyBox) {
      return { success: false, error: 'Reply compose box did not appear after clicking Reply' };
    }

    // Type the comment
    await humanType(replyBox, commentText);
    console.log('[Twitter Engage] Comment typed successfully');

    // Find and click the Reply/Submit button in the dialog
    await humanDelay(800, 1500);
    const submitBtnSelectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]'
    ];

    let submitBtn = null;
    for (const sel of submitBtnSelectors) {
      submitBtn = document.querySelector(sel);
      if (submitBtn) {
        const isDisabled = submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.disabled;
        if (isDisabled) {
          return { success: false, error: 'Reply button is disabled — comment may be empty or invalid' };
        }
        break;
      }
      submitBtn = null;
    }

    if (!submitBtn) {
      return { success: false, error: 'Reply submit button not found' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(3000, 5000);

    // Verify: check for error toast
    const toastError = checkForToastError();
    if (toastError) {
      return { success: false, error: `Comment failed: ${toastError}` };
    }

    // Check: reply compose area should be cleared
    const replyAfter = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (replyAfter) {
      const remaining = replyAfter.textContent?.trim() || '';
      if (remaining.length > 0 && remaining === commentText.trim()) {
        return { success: false, error: 'Comment text still in reply box — may not have submitted' };
      }
    }

    console.log('[Twitter Engage] Comment submitted successfully!');
    const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0]?.split('/')[0];
    return {
      success: true,
      data: {
        tweet_url: tweetUrl,
        tweet_id: tweetId,
        comment_text: commentText,
        // We can't reliably get the comment URL without additional API calls
        comment_url: `${tweetUrl}#replies`
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 4: REPLY TO A SPECIFIC REPLY
  // ═══════════════════════════════════════════════════════════════
  async function replyToSpecificReply(tweetUrl, targetUsername, replyText) {
    console.log('[Twitter Engage] Replying to', targetUsername, 'on', tweetUrl);

    // Navigate to tweet
    window.location.href = tweetUrl;
    await sleep(4000);
    await humanDelay(1500, 3000);

    // Scroll down to load replies
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, rand(400, 800));
      await humanDelay(1000, 2000);
    }

    // Find the target user's reply and click its Reply button
    // Twitter renders replies as individual tweet cells
    // Each reply has its own Reply button [data-testid="reply"]
    const tweetCells = document.querySelectorAll('[data-testid="tweetText"]');
    if (tweetCells.length === 0) {
      return { success: false, error: 'No replies found on this tweet' };
    }

    // Strategy: walk up from tweetText to find the tweet cell container,
    // then find the Reply button within that container
    let targetReplyBtn = null;
    const allTweetTexts = Array.from(tweetCells);

    for (const tweetTextEl of allTweetTexts) {
      // Walk up to find the cell/ancestor that contains the username and reply button
      let ancestor = tweetTextEl.parentElement;
      let foundUsername = false;
      let replyBtnInCell = null;
      let depth = 0;

      while (ancestor && depth < 15) {
        // Check if this ancestor has the target username
        const userLinks = ancestor.querySelectorAll('a[href^="/"]');
        for (const link of userLinks) {
          const href = link.getAttribute('href') || '';
          if (href.toLowerCase() === `/${targetUsername.toLowerCase()}` ||
              href.toLowerCase().startsWith(`/${targetUsername.toLowerCase()}/`)) {
            foundUsername = true;
          }
        }

        // Also check UserAvatar or name display
        const avatarEl = ancestor.querySelector('[data-testid="UserAvatar"]');
        if (avatarEl) {
          const altText = avatarEl.getAttribute('alt') || '';
          if (altText.toLowerCase() === targetUsername.toLowerCase()) {
            foundUsername = true;
          }
        }

        // Check for text content matching username
        const spans = ancestor.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent?.trim().toLowerCase().startsWith('@') &&
              span.textContent?.trim().toLowerCase().includes(targetUsername.toLowerCase())) {
            foundUsername = true;
          }
        }

        // Look for Reply button within this ancestor
        const cellReplyBtn = ancestor.querySelector('[data-testid="reply"]');
        if (cellReplyBtn) replyBtnInCell = cellReplyBtn;

        // If we found both the username and a reply button, we're good
        if (foundUsername && replyBtnInCell) {
          targetReplyBtn = replyBtnInCell;
          break;
        }

        ancestor = ancestor.parentElement;
        depth++;
      }

      if (targetReplyBtn) break;
    }

    if (!targetReplyBtn) {
      return { success: false, error: `Could not find reply from @${targetUsername} — the user may not have replied to this tweet` };
    }

    // Click the Reply button on the specific reply
    await scrollIntoView(targetReplyBtn);
    await humanDelay(400, 700);
    targetReplyBtn.click();
    await humanDelay(1000, 2000);

    // Find the reply compose box
    const replyBoxSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[contenteditable="true"][role="textbox"]'
    ];

    let replyBox = null;
    for (const sel of replyBoxSelectors) {
      try {
        replyBox = await waitForElement(sel, 5000);
        if (replyBox) break;
      } catch (e) {}
    }

    if (!replyBox) {
      return { success: false, error: 'Reply compose box did not appear' };
    }

    // Type the reply
    await humanType(replyBox, replyText);
    console.log('[Twitter Engage] Reply typed successfully');

    // Submit
    await humanDelay(800, 1500);
    let submitBtn = document.querySelector('[data-testid="tweetButton"]') ||
                    document.querySelector('[data-testid="tweetButtonInline"]');
    if (!submitBtn) {
      return { success: false, error: 'Reply submit button not found' };
    }

    const isDisabled = submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.disabled;
    if (isDisabled) {
      return { success: false, error: 'Reply button is disabled' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(3000, 5000);

    const toastError = checkForToastError();
    if (toastError) {
      return { success: false, error: `Reply failed: ${toastError}` };
    }

    console.log('[Twitter Engage] Reply submitted!');
    const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0]?.split('/')[0];
    return {
      success: true,
      data: {
        tweet_url: tweetUrl,
        tweet_id: tweetId,
        target_username: targetUsername,
        reply_text: replyText,
        reply_url: `${tweetUrl}#replies`
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE LISTENER — Routes to correct action handler
  // ═══════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only handle post_request with platform 'twitter' that has an action field
    if (message.type !== 'post_request' || message.platform !== 'twitter') return;
    if (!message.payload || !message.payload.action) return;

    // Only handle engage actions (not 'twitter_post' — that's handled by twitter.js)
    const action = message.payload.action;
    const engageActions = ['twitter_follow', 'twitter_like', 'twitter_comment', 'twitter_reply'];
    if (!engageActions.includes(action)) return;

    const { requestId, payload } = message;
    console.log('[Twitter Engage] Received:', action, requestId);

    let actionPromise;
    switch (action) {
      case 'twitter_follow':
        actionPromise = followUser(payload.username);
        break;
      case 'twitter_like':
        actionPromise = likeTweet(payload.tweet_url);
        break;
      case 'twitter_comment':
        actionPromise = commentOnTweet(payload.tweet_url, payload.text);
        break;
      case 'twitter_reply':
        actionPromise = replyToSpecificReply(payload.tweet_url, payload.target_username, payload.text);
        break;
    }

    if (!actionPromise) {
      sendResponse({ type: 'post_result', requestId, result: { success: false, error: `Unknown action: ${action}` } });
      return;
    }

    // Execute with retries
    (async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await actionPromise;
          chrome.runtime.sendMessage({
            type: 'post_result', platform: 'twitter', requestId, result
          }).catch(() => {});
          sendResponse({ type: 'post_result', requestId, result });
          return;
        } catch (e) {
          if (attempt === MAX_RETRIES) {
            const result = { success: false, error: e.message };
            chrome.runtime.sendMessage({
              type: 'post_result', platform: 'twitter', requestId, result
            }).catch(() => {});
            sendResponse({ type: 'post_result', requestId, result });
          } else {
            console.log(`[Twitter Engage] Attempt ${attempt} failed, retrying...`);
            await humanDelay(2000, 4000);
          }
        }
      }
    })();

    return true; // Keep channel open for async response
  });

  console.log('[Twitter Engage] Content script loaded on', window.location.hostname);
})();
