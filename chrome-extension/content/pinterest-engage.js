/**
 * Pinterest Engagement Content Script
 * Runs on *://*.pinterest.com/*
 * Handles: follow a user, comment on a pin, reply to a comment.
 *
 * Listens for messages from background.js where:
 *   message.type === 'post_request'
 *   message.platform === 'pinterest'
 *   message.payload.action === 'pinterest_follow' | 'pinterest_comment' | 'pinterest_reply'
 *
 * Does NOT handle pin creation (that's pinterest.js — untouched).
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

  // ── Utility: wait for element by text match ──
  function waitForElementByText(tag, textMatcher, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const all = document.querySelectorAll(tag);
        for (const el of all) {
          const elText = el.textContent?.trim() || '';
          if (typeof textMatcher === 'function' ? textMatcher(elText) : elText.toLowerCase().includes(textMatcher.toLowerCase())) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return el;
          }
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
      setTimeout(() => { observer.disconnect(); reject(new Error(`Element with text not found`)); }, timeout);
    });
  }

  // ── Utility: safe click with visibility check ──
  async function safeClick(selector, waitAfter = 500) {
    try {
      const el = await waitForElement(selector, 5000);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await humanDelay(200, 400);
      el.click();
      await sleep(waitAfter);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Utility: scroll into view with delay ──
  async function scrollIntoView(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanDelay(400, 800);
  }

  // ── Utility: human-like typing on contenteditable ──
  async function humanTypeOnElement(el, text) {
    el.focus();
    el.click();
    await humanDelay(300, 500);
    el.textContent = '';
    await humanDelay(100, 200);
    let charCount = 0;
    for (const char of text) {
      document.execCommand('insertText', false, char);
      charCount++;
      if (charCount % rand(4, 8) === 0) await humanDelay(200, 500);
      else await sleep(rand(20, 50));
    }
    await humanDelay(500, 1000);
  }

  // ── Utility: human-like typing on textarea/input ──
  async function humanTypeOnInput(el, text) {
    el.focus();
    el.click();
    await humanDelay(300, 500);
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, '');
    } else {
      el.value = '';
    }
    await humanDelay(100, 200);
    let charCount = 0;
    for (const char of text) {
      if (nativeSetter) {
        nativeSetter.call(el, el.value + char);
      } else {
        el.value += char;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      charCount++;
      if (charCount % rand(4, 8) === 0) await humanDelay(200, 500);
      else await sleep(rand(20, 45));
    }
    await humanDelay(500, 1000);
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 1: FOLLOW A USER
  // ═══════════════════════════════════════════════════════════════
  async function followUser(username) {
    console.log('[Pinterest Engage] Following user:', username);

    window.location.href = `https://www.pinterest.com/${username}/`;
    await sleep(5000);
    await humanDelay(1500, 3000);

    // Find the Follow button — Pinterest uses various selectors
    const followBtnSelectors = [
      'button[data-test-id="follow-button"]',
      'div[data-test-id="follow-button"]',
      'button[aria-label="Follow"]',
      'div[aria-label="Follow"]',
      'button[class*="followButton"]',
      'div[class*="followButton"]',
      'button[class*="Follow"]'
    ];

    let followBtn = null;
    for (const sel of followBtnSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Make sure it says "Follow" not "Following" or "Unfollow"
          const text = el.textContent?.trim().toLowerCase() || '';
          if (text === 'follow' || text === '') {
            followBtn = el;
            break;
          }
        }
      }
    }

    // Text-match fallback
    if (!followBtn) {
      try {
        const buttons = document.querySelectorAll('button, div[role="button"]');
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && text === 'follow') {
            followBtn = btn;
            break;
          }
        }
      } catch (e) {}
    }

    // Check if already following
    if (!followBtn) {
      const alreadyBtn = document.querySelector('button[aria-label="Unfollow"]') ||
                         document.querySelector('[data-test-id="unfollow-button"]');
      if (alreadyBtn) {
        return { success: false, error: 'Already following this user', data: { already_following: true } };
      }
      // Also check for "Following" text
      const followingEl = document.querySelector('button[class*="Following"]') ||
                          document.querySelector('div[class*="Following"]');
      if (followingEl) {
        const text = followingEl.textContent?.trim().toLowerCase() || '';
        if (text === 'following') {
          return { success: false, error: 'Already following this user', data: { already_following: true } };
        }
      }
      return { success: false, error: 'Follow button not found — user may not exist or page did not load' };
    }

    await scrollIntoView(followBtn);
    await humanDelay(300, 600);
    followBtn.click();
    await humanDelay(3000, 5000);

    // Verify: button should change to "Following"
    const nowFollowing = document.querySelector('button[aria-label="Unfollow"]') ||
                         document.querySelector('[data-test-id="unfollow-button"]');
    const followingText = document.querySelector('button[class*="Following"]');

    if (nowFollowing || followingText) {
      console.log('[Pinterest Engage] Follow successful!');
      return {
        success: true,
        data: {
          username,
          profile_url: `https://www.pinterest.com/${username}/`,
          followed: true
        }
      };
    }

    // Check for visible errors
    const bodyText = document.body.innerText?.toLowerCase() || '';
    if (bodyText.includes('something went wrong') || bodyText.includes("couldn't follow")) {
      return { success: false, error: 'Pinterest returned an error when trying to follow' };
    }

    return { success: true, data: { username, followed: true } };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 2: COMMENT ON A PIN
  // ═══════════════════════════════════════════════════════════════
  async function commentOnPin(pinUrl, commentText) {
    console.log('[Pinterest Engage] Commenting on pin:', pinUrl);

    // Navigate to pin page
    window.location.href = pinUrl;
    await sleep(5000);
    await humanDelay(2000, 3000);

    // Scroll down to find the comment section
    window.scrollBy(0, rand(300, 600));
    await humanDelay(1000, 2000);

    // Find the comment input area
    // Pinterest comment input is typically a contenteditable div or textarea
    // in the comments section of the pin
    const commentInputSelectors = [
      'div[contenteditable="true"][placeholder*="comment" i]',
      'div[contenteditable="true"][placeholder*="Add a comment" i]',
      'div[contenteditable="true"][aria-label*="comment" i]',
      'textarea[placeholder*="comment" i]',
      'textarea[placeholder*="Add a comment" i]',
      'div[class*="commentInput"]',
      'div[class*="CommentInput"]',
      'input[placeholder*="comment" i]'
    ];

    let commentInput = null;
    for (const sel of commentInputSelectors) {
      try {
        commentInput = await waitForElement(sel, 8000);
        if (commentInput) {
          const rect = commentInput.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) break;
          commentInput = null;
        }
      } catch (e) {
        commentInput = null;
      }
    }

    // Fallback: try clicking a "Comment" button first to reveal the input
    if (!commentInput) {
      const commentBtnSelectors = [
        'button[data-test-id="comment-button"]',
        'div[data-test-id="comment-button"]',
        'button[aria-label="Comment"]',
        'button[class*="comment"]'
      ];
      for (const sel of commentBtnSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            el.click();
            await humanDelay(1000, 2000);
            // Try finding input again
            for (const inputSel of commentInputSelectors) {
              try {
                commentInput = await waitForElement(inputSel, 5000);
                if (commentInput) break;
              } catch (e) {}
            }
            if (commentInput) break;
          }
        }
      }
    }

    if (!commentInput) {
      return { success: false, error: 'Comment input not found — pin may not allow comments or page did not load' };
    }

    // Type the comment
    await scrollIntoView(commentInput);
    if (commentInput.tagName === 'TEXTAREA' || commentInput.tagName === 'INPUT') {
      await humanTypeOnInput(commentInput, commentText);
    } else {
      await humanTypeOnElement(commentInput, commentText);
    }
    console.log('[Pinterest Engage] Comment typed');

    // Find and click submit/post button
    await humanDelay(800, 1500);
    const submitSelectors = [
      'button[data-test-id="comment-submit-button"]',
      'div[data-test-id="comment-submit-button"]',
      'button[type="submit"]',
      'button[aria-label="Post comment"]',
      'button[class*="submit"]',
      'button[class*="Submit"]',
      'div[role="button"][class*="submit"]'
    ];

    let submitBtn = null;
    for (const sel of submitSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          submitBtn = el;
          break;
        }
      }
    }

    // Text-match fallback for submit button
    if (!submitBtn) {
      const buttons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            (text === 'post' || text === 'send' || text === 'submit' || text === 'done')) {
          submitBtn = btn;
          break;
        }
      }
    }

    if (!submitBtn) {
      return { success: false, error: 'Comment submit button not found' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(3000, 5000);

    // Check for errors
    const bodyText = document.body.innerText?.toLowerCase() || '';
    if (bodyText.includes('something went wrong') || bodyText.includes("couldn't save") ||
        bodyText.includes('error')) {
      return { success: false, error: 'Pinterest returned an error when posting comment' };
    }

    console.log('[Pinterest Engage] Comment submitted!');
    return {
      success: true,
      data: {
        pin_url: pinUrl,
        comment_text: commentText,
        comment_url: pinUrl // Pin URL where the comment appears
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 3: REPLY TO A COMMENT
  // ═══════════════════════════════════════════════════════════════
  async function replyToComment(pinUrl, parentCommentText, replyText) {
    console.log('[Pinterest Engage] Replying to comment on:', pinUrl);

    // Navigate to pin
    window.location.href = pinUrl;
    await sleep(5000);
    await humanDelay(2000, 3000);

    // Scroll to load comments
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, rand(300, 600));
      await humanDelay(1000, 2000);
    }

    // Find the parent comment by matching text
    // Pinterest comments are typically in a list with text content
    let parentComment = null;
    const commentElements = document.querySelectorAll(
      'div[class*="comment"], div[class*="Comment"], ' +
      'span[class*="commentBody"], span[class*="commentText"], ' +
      'div[data-test-id*="comment"]'
    );

    for (const el of commentElements) {
      const text = el.textContent?.trim() || '';
      if (text.toLowerCase().includes(parentCommentText.toLowerCase()) &&
          text.length < 1000) { // Avoid matching the entire page
        parentComment = el;
        break;
      }
    }

    // Broader fallback: search all text-containing elements
    if (!parentComment) {
      const allDivs = document.querySelectorAll('div, span, p');
      for (const el of allDivs) {
        const text = el.textContent?.trim() || '';
        // Match if text is similar length and content
        if (text.toLowerCase().includes(parentCommentText.toLowerCase()) &&
            text.length < parentCommentText.length * 2 + 50 &&
            text.length > parentCommentText.length * 0.5) {
          parentComment = el;
          break;
        }
      }
    }

    if (!parentComment) {
      return { success: false, error: `Parent comment not found containing: "${parentCommentText.substring(0, 50)}..."` };
    }

    // Find the Reply button near the parent comment
    // Walk up the DOM to find the comment container, then find Reply within it
    let commentContainer = parentComment;
    let replyBtn = null;
    let depth = 0;

    while (commentContainer && depth < 10) {
      // Check for reply button within this container
      const btns = commentContainer.querySelectorAll(
        'button[aria-label="Reply"], button[class*="reply"], button[class*="Reply"], ' +
        'div[role="button"][aria-label="Reply"], div[data-test-id*="reply"]'
      );
      for (const btn of btns) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          replyBtn = btn;
          break;
        }
      }
      if (replyBtn) break;

      // Text-match for reply button
      if (!replyBtn) {
        const allBtns = commentContainer.querySelectorAll('button, div[role="button"]');
        for (const btn of allBtns) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && text === 'reply') {
            replyBtn = btn;
            break;
          }
        }
      }
      if (replyBtn) break;

      commentContainer = commentContainer.parentElement;
      depth++;
    }

    if (!replyBtn) {
      return { success: false, error: 'Reply button not found for the parent comment' };
    }

    // Click Reply
    await scrollIntoView(replyBtn);
    await humanDelay(300, 600);
    replyBtn.click();
    await humanDelay(1000, 2000);

    // Find the reply input that appeared
    const replyInputSelectors = [
      'div[contenteditable="true"][placeholder*="reply" i]',
      'div[contenteditable="true"][placeholder*="comment" i]',
      'div[contenteditable="true"][placeholder*="Write" i]',
      'textarea[placeholder*="reply" i]',
      'textarea[placeholder*="comment" i]',
      'input[placeholder*="reply" i]'
    ];

    let replyInput = null;
    for (const sel of replyInputSelectors) {
      try {
        replyInput = await waitForElement(sel, 5000);
        if (replyInput) {
          const rect = replyInput.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) break;
          replyInput = null;
        }
      } catch (e) {}
    }

    if (!replyInput) {
      return { success: false, error: 'Reply input did not appear after clicking Reply button' };
    }

    // Type the reply
    await scrollIntoView(replyInput);
    if (replyInput.tagName === 'TEXTAREA' || replyInput.tagName === 'INPUT') {
      await humanTypeOnInput(replyInput, replyText);
    } else {
      await humanTypeOnElement(replyInput, replyText);
    }
    console.log('[Pinterest Engage] Reply typed');

    // Submit
    await humanDelay(800, 1500);
    const submitSelectors = [
      'button[data-test-id="comment-submit-button"]',
      'button[type="submit"]',
      'button[aria-label="Post reply"]',
      'div[data-test-id="reply-submit"]',
      'button[class*="submit"]'
    ];

    let submitBtn = null;
    for (const sel of submitSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          submitBtn = el;
          break;
        }
      }
    }

    if (!submitBtn) {
      // Text-match fallback
      const buttons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            (text === 'post' || text === 'send' || text === 'submit')) {
          submitBtn = btn;
          break;
        }
      }
    }

    if (!submitBtn) {
      return { success: false, error: 'Reply submit button not found' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(3000, 5000);

    // Check for errors
    const bodyText = document.body.innerText?.toLowerCase() || '';
    if (bodyText.includes('something went wrong') || bodyText.includes("couldn't save") ||
        bodyText.includes('error')) {
      return { success: false, error: 'Pinterest returned an error when posting reply' };
    }

    console.log('[Pinterest Engage] Reply submitted!');
    return {
      success: true,
      data: {
        pin_url: pinUrl,
        parent_comment_text: parentCommentText,
        reply_text: replyText,
        reply_url: pinUrl
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE LISTENER
  // ═══════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'post_request' || message.platform !== 'pinterest') return;
    if (!message.payload || !message.payload.action) return;

    const action = message.payload.action;
    const engageActions = ['pinterest_follow', 'pinterest_comment', 'pinterest_reply'];
    if (!engageActions.includes(action)) return;

    const { requestId, payload } = message;
    console.log('[Pinterest Engage] Received:', action, requestId);

    let actionPromise;
    switch (action) {
      case 'pinterest_follow':
        actionPromise = followUser(payload.username);
        break;
      case 'pinterest_comment':
        actionPromise = commentOnPin(payload.pin_url, payload.text);
        break;
      case 'pinterest_reply':
        actionPromise = replyToComment(payload.pin_url, payload.parent_comment_text, payload.text);
        break;
    }

    if (!actionPromise) {
      sendResponse({ type: 'post_result', requestId, result: { success: false, error: `Unknown action: ${action}` } });
      return;
    }

    (async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await actionPromise;
          chrome.runtime.sendMessage({
            type: 'post_result', platform: 'pinterest', requestId, result
          }).catch(() => {});
          sendResponse({ type: 'post_result', requestId, result });
          return;
        } catch (e) {
          if (attempt === MAX_RETRIES) {
            const result = { success: false, error: e.message };
            chrome.runtime.sendMessage({
              type: 'post_result', platform: 'pinterest', requestId, result
            }).catch(() => {});
            sendResponse({ type: 'post_result', requestId, result });
          } else {
            console.log(`[Pinterest Engage] Attempt ${attempt} failed, retrying...`);
            await humanDelay(2000, 4000);
          }
        }
      }
    })();

    return true;
  });

  console.log('[Pinterest Engage] Content script loaded on', window.location.hostname);
})();
