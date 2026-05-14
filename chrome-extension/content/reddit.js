/**
 * Reddit Content Script — FULL BUILD
 * Runs on *://*.reddit.com/* and *://*.old.reddit.com/*
 * Handles: comment on post, reply to comment, upvote post/comment.
 * Supports both new Reddit (www.reddit.com) and old Reddit (old.reddit.com).
 *
 * Listens for messages from background.js where:
 *   message.type === 'post_request'
 *   message.platform === 'reddit'
 *   message.payload.action === 'reddit_comment' | 'reddit_reply' | 'reddit_upvote'
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

  // ── Utility: detect which Reddit layout we're on ──
  function isOldReddit() {
    return window.location.hostname === 'old.reddit.com' ||
           window.location.hostname === 'www.old.reddit.com';
  }

  // ── Utility: wait for element ──
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

  // ── Utility: scroll into view ──
  async function scrollIntoView(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanDelay(400, 800);
  }

  // ── Utility: human-like typing for textarea ──
  async function humanTypeTextarea(el, text) {
    el.focus();
    el.click();
    await humanDelay(300, 500);
    el.value = '';
    await humanDelay(100, 200);
    let charCount = 0;
    for (const char of text) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, el.value + char);
      } else {
        el.value += char;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      charCount++;
      if (charCount % rand(4, 8) === 0) await humanDelay(200, 500);
      else await sleep(rand(20, 50));
    }
    await humanDelay(500, 1000);
  }

  // ── Utility: human-like typing for contenteditable ──
  async function humanTypeContentEditable(el, text) {
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

  // ── Utility: check for Reddit error states ──
  function checkForErrors() {
    // Reddit shows errors in various places
    const errorEls = document.querySelectorAll(
      '.error', '[class*="error"]', '[class*="Error"]',
      '.thing.error', '[role="alert"]'
    );
    for (const el of errorEls) {
      if (el.offsetParent !== null) {
        const text = el.textContent?.trim() || '';
        if (text.length > 5 && text.length < 500) {
          return text;
        }
      }
    }
    return null;
  }

  // ── Utility: normalize Reddit URL to www.reddit.com format ──
  function normalizeRedditUrl(url) {
    let normalized = url;
    // Convert old.reddit.com to www.reddit.com for navigation
    normalized = normalized.replace('old.reddit.com', 'www.reddit.com');
    // Ensure leading https
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }
    return normalized;
  }

  // ═══════════════════════════════════════════════════════════════
  // NEW REDDIT (www.reddit.com) — SELECTORS AND HELPERS
  // ═══════════════════════════════════════════════════════════════

  async function newRedditFindCommentTextarea() {
    // New Reddit uses faceplate-textarea or similar
    const selectors = [
      'textarea[name="text"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea',
      'div[id*="comment"] faceplate-textarea textarea',
      'shreddit-comment-textarea textarea',
      'div[data-testid="comment-submit-input"]'
    ];

    for (const sel of selectors) {
      try {
        const el = await waitForElement(sel, 8000);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return el;
        }
      } catch (e) {}
    }
    return null;
  }

  async function newRedditFindSubmitButton() {
    const selectors = [
      'button[type="submit"]',
      'button[aria-label="Comment"]',
      'button[data-testid="comment-submit-button"]',
      'faceplate-button button[type="submit"]',
      'shreddit-post button[type="submit"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }

    // Fallback: text match
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          (text === 'comment' || text === 'reply' || text === 'post')) {
        return btn;
      }
    }
    return null;
  }

  async function newRedditFindUpvoteBtn(container) {
    // New Reddit uses shreddit-upvote or aria-label="Upvote"
    const scope = container || document;
    const selectors = [
      'shreddit-upvote',
      'button[aria-label="Upvote"]',
      'button[aria-label="Up vote"]',
      'div[aria-label="Upvote"][role="button"]'
    ];

    for (const sel of selectors) {
      const el = scope.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }
    return null;
  }

  async function newRedditFindReplyButton(commentContainer) {
    const selectors = [
      'button[aria-label="Reply"]',
      'shreddit-comment-action-button button[aria-label="Reply"]',
      'button[data-click-id="reply"]'
    ];

    for (const sel of selectors) {
      const el = commentContainer.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }

    // Text-match fallback
    const buttons = commentContainer.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && text === 'reply') {
        return btn;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // OLD REDDIT (old.reddit.com) — SELECTORS AND HELPERS
  // ═══════════════════════════════════════════════════════════════

  async function oldRedditFindCommentTextarea() {
    const selectors = [
      'textarea[name="text"]',
      'textarea[placeholder*="comment" i]',
      'textarea[placeholder*="reply" i]',
      '.usertext-edit textarea',
      '#comment-form textarea',
      'textarea'
    ];

    for (const sel of selectors) {
      try {
        const el = await waitForElement(sel, 8000);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return el;
        }
      } catch (e) {}
    }
    return null;
  }

  async function oldRedditFindSubmitButton(form) {
    const scope = form || document;
    const selectors = [
      '.usertext-buttons button[type="submit"]',
      '.usertext-buttons .btn',
      'button[type="submit"]',
      '.usertext-buttons input[type="submit"]'
    ];

    for (const sel of selectors) {
      const el = scope.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }

    // Text-match fallback
    const buttons = scope.querySelectorAll('button, input[type="submit"], .btn');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || btn.value?.toLowerCase() || '';
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          (text === 'save' || text === 'reply' || text === 'comment')) {
        return btn;
      }
    }
    return null;
  }

  async function oldRedditFindUpvoteBtn(container) {
    const scope = container || document;
    // Old Reddit uses .arrow.up or .up and .arrow.upmod for already voted
    const upvote = scope.querySelector('.arrow.up:not(.upmod)');
    if (upvote) {
      const rect = upvote.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return upvote;
    }
    // Fallback: .up class on the voting element
    const upArrow = scope.querySelector('.up:not(.upmod)');
    if (upArrow) {
      const rect = upArrow.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return upArrow;
    }
    return null;
  }

  function oldRedditIsAlreadyUpvoted(container) {
    const scope = container || document;
    return scope.querySelector('.arrow.upmod') !== null;
  }

  async function oldRedditFindReplyButton(commentThing) {
    // Old Reddit: reply button is inside .comment .buttons or .thing .buttons
    const selectors = [
      '.buttons a[data-event-action="reply"]',
      '.buttons .reply-button',
      '.child .usertext-edit button',
      '.buttons input[name="reply"]'
    ];

    for (const sel of selectors) {
      const el = commentThing.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }

    // Text-match fallback
    const links = commentThing.querySelectorAll('.buttons a, .buttons button');
    for (const link of links) {
      const text = link.textContent?.trim().toLowerCase() || '';
      const rect = link.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && text === 'reply') {
        return link;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 1: COMMENT ON A POST
  // ═══════════════════════════════════════════════════════════════
  async function commentOnPost(postUrl, commentText) {
    console.log('[Reddit CS] Commenting on post:', postUrl);

    // Normalize URL and navigate
    const targetUrl = normalizeRedditUrl(postUrl);
    window.location.href = targetUrl;
    await sleep(5000);
    await humanDelay(2000, 3000);

    const isOld = isOldReddit();

    if (isOld) {
      return await oldRedditComment(commentText);
    } else {
      return await newRedditComment(commentText);
    }
  }

  async function newRedditComment(commentText) {
    // Click the "Add a Comment" area to expand it if collapsed
    const addCommentBtn = document.querySelector('button[data-testid="add-comment"]') ||
                          document.querySelector('faceplate-pill-button');
    if (addCommentBtn) {
      const text = addCommentBtn.textContent?.trim().toLowerCase() || '';
      if (text.includes('comment')) {
        addCommentBtn.click();
        await humanDelay(1500, 2500);
      }
    }

    // Find comment textarea
    const textarea = await newRedditFindCommentTextarea();
    if (!textarea) {
      return { success: false, error: 'Comment textarea not found on new Reddit' };
    }

    await scrollIntoView(textarea);
    if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
      await humanTypeTextarea(textarea, commentText);
    } else {
      await humanTypeContentEditable(textarea, commentText);
    }
    console.log('[Reddit CS] Comment typed (new Reddit)');

    // Submit
    await humanDelay(800, 1500);
    const submitBtn = await newRedditFindSubmitButton();
    if (!submitBtn) {
      return { success: false, error: 'Comment submit button not found on new Reddit' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(4000, 6000);

    // Check for errors
    const error = checkForErrors();
    if (error) {
      return { success: false, error: `Reddit error: ${error}` };
    }

    // Verify: the textarea should be cleared after successful submission
    const remainingText = textarea.value || textarea.textContent || '';
    if (remainingText.trim().length > 0) {
      return { success: false, error: 'Comment text still present after submit — may not have posted' };
    }

    console.log('[Reddit CS] Comment submitted successfully (new Reddit)');
    return {
      success: true,
      data: {
        post_url: window.location.href,
        comment_text: commentText,
        comment_url: window.location.href
      }
    };
  }

  async function oldRedditComment(commentText) {
    // Old Reddit: find the comment form at the bottom of the post
    // The form is inside .usertext.cloneable or directly under the post
    let commentForm = document.querySelector('.commentarea .usertext') ||
                      document.querySelector('#comment-form .usertext') ||
                      document.querySelector('.usertext.cloneable');

    // If not found, try clicking a "comment" link to open the form
    if (!commentForm) {
      const commentLink = document.querySelector('a[data-event-action="comment"]') ||
                          document.querySelector('.commenting-as');
      if (commentLink) {
        commentLink.click();
        await humanDelay(1000, 2000);
        commentForm = document.querySelector('.commentarea .usertext') ||
                      document.querySelector('#comment-form .usertext');
      }
    }

    // If still not found, look for any visible textarea
    if (!commentForm) {
      const textarea = document.querySelector('.usertext textarea');
      if (textarea) {
        commentForm = textarea.closest('.usertext');
      }
    }

    let textarea = commentForm ? commentForm.querySelector('textarea') : null;
    if (!textarea) {
      textarea = await oldRedditFindCommentTextarea();
    }

    if (!textarea) {
      return { success: false, error: 'Comment textarea not found on old Reddit' };
    }

    await scrollIntoView(textarea);
    await humanTypeTextarea(textarea, commentText);
    console.log('[Reddit CS] Comment typed (old Reddit)');

    // Find and click Save/Submit button
    await humanDelay(800, 1500);
    const form = textarea.closest('.usertext');
    const submitBtn = await oldRedditFindSubmitButton(form);
    if (!submitBtn) {
      return { success: false, error: 'Comment submit button not found on old Reddit' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(4000, 6000);

    const error = checkForErrors();
    if (error) {
      return { success: false, error: `Reddit error: ${error}` };
    }

    // Verify: check if our comment appears in the page
    await humanDelay(2000, 3000);
    const newComments = document.querySelectorAll('.usertext-body');
    for (const c of newComments) {
      if (c.textContent?.includes(commentText.substring(0, 30))) {
        console.log('[Reddit CS] Comment verified on page (old Reddit)');
        return {
          success: true,
          data: {
            post_url: window.location.href,
            comment_text: commentText,
            comment_url: window.location.href,
            verified: true
          }
        };
      }
    }

    console.log('[Reddit CS] Comment submitted (old Reddit, unverified)');
    return {
      success: true,
      data: {
        post_url: window.location.href,
        comment_text: commentText,
        comment_url: window.location.href,
        verified: false
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 2: REPLY TO A COMMENT
  // ═══════════════════════════════════════════════════════════════
  async function replyToComment(postUrl, identifier, replyText) {
    console.log('[Reddit CS] Replying to comment on:', postUrl);

    const targetUrl = normalizeRedditUrl(postUrl);
    window.location.href = targetUrl;
    await sleep(5000);
    await humanDelay(2000, 3000);

    // Scroll to load comments
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, rand(400, 800));
      await humanDelay(1000, 2000);
    }

    const isOld = isOldReddit();

    if (isOld) {
      return await oldRedditReply(identifier, replyText);
    } else {
      return await newRedditReply(identifier, replyText);
    }
  }

  async function newRedditReply(identifier, replyText) {
    // identifier: { username, text_snippet } to find the parent comment
    const { username, text_snippet } = identifier;

    // Find the parent comment
    // New Reddit uses shreddit-comment elements
    const comments = document.querySelectorAll('shreddit-comment');
    let targetComment = null;

    for (const comment of comments) {
      const commentText = comment.getAttribute('content') || comment.textContent || '';
      const author = comment.getAttribute('author') || '';

      // Match by username and/or text snippet
      let matches = false;
      if (username && author.toLowerCase() === username.toLowerCase()) {
        matches = true;
      }
      if (text_snippet && commentText.toLowerCase().includes(text_snippet.toLowerCase())) {
        matches = true;
      }
      if (username && text_snippet) {
        matches = author.toLowerCase() === username.toLowerCase() &&
                  commentText.toLowerCase().includes(text_snippet.toLowerCase());
      }

      if (matches) {
        targetComment = comment;
        break;
      }
    }

    // Fallback: search by text in all elements
    if (!targetComment && text_snippet) {
      const allDivs = document.querySelectorAll('div, p, span');
      for (const el of allDivs) {
        const text = el.textContent?.trim() || '';
        if (text.toLowerCase().includes(text_snippet.toLowerCase()) &&
            text.length < text_snippet.length * 2 + 50) {
          targetComment = el.closest('shreddit-comment') || el;
          break;
        }
      }
    }

    if (!targetComment) {
      return { success: false, error: `Parent comment not found (${username || ''}, "${text_snippet?.substring(0, 50) || ''}...")` };
    }

    // Find and click Reply button
    const replyBtn = await newRedditFindReplyButton(targetComment);
    if (!replyBtn) {
      return { success: false, error: 'Reply button not found on target comment' };
    }

    await scrollIntoView(replyBtn);
    await humanDelay(300, 600);
    replyBtn.click();
    await humanDelay(1500, 2500);

    // Find reply textarea (should appear near the comment)
    let replyContainer = targetComment;
    let depth = 0;
    while (replyContainer && depth < 10) {
      const ta = replyContainer.querySelector('textarea, div[contenteditable="true"][role="textbox"]');
      if (ta) {
        const rect = ta.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          await scrollIntoView(ta);
          if (ta.tagName === 'TEXTAREA') {
            await humanTypeTextarea(ta, replyText);
          } else {
            await humanTypeContentEditable(ta, replyText);
          }
          console.log('[Reddit CS] Reply typed (new Reddit)');

          // Submit
          await humanDelay(800, 1500);
          const submitBtn = await newRedditFindSubmitButton(replyContainer);
          if (!submitBtn) {
            return { success: false, error: 'Reply submit button not found' };
          }
          await scrollIntoView(submitBtn);
          await humanDelay(300, 500);
          submitBtn.click();
          await humanDelay(4000, 6000);

          const error = checkForErrors();
          if (error) {
            return { success: false, error: `Reddit error: ${error}` };
          }

          return {
            success: true,
            data: {
              post_url: window.location.href,
              parent_username: username,
              reply_text: replyText,
              reply_url: window.location.href
            }
          };
        }
      }
      replyContainer = replyContainer.parentElement;
      depth++;
    }

    return { success: false, error: 'Reply textarea did not appear after clicking Reply' };
  }

  async function oldRedditReply(identifier, replyText) {
    const { username, text_snippet } = identifier;

    // Old Reddit: comments are .thing elements with .entry inside
    const things = document.querySelectorAll('.thing.comment');
    let targetThing = null;

    for (const thing of things) {
      const authorEl = thing.querySelector('.author');
      const author = authorEl?.textContent?.trim()?.toLowerCase() || '';
      const bodyEl = thing.querySelector('.usertext-body');
      const bodyText = bodyEl?.textContent?.trim() || '';

      let matches = false;
      if (username && author === username.toLowerCase()) {
        matches = true;
      }
      if (text_snippet && bodyText.toLowerCase().includes(text_snippet.toLowerCase())) {
        matches = true;
      }
      if (username && text_snippet) {
        matches = author === username.toLowerCase() &&
                  bodyText.toLowerCase().includes(text_snippet.toLowerCase());
      }

      if (matches) {
        targetThing = thing;
        break;
      }
    }

    // Fallback: search by text snippet alone
    if (!targetThing && text_snippet) {
      const allThings = document.querySelectorAll('.thing');
      for (const thing of allThings) {
        const body = thing.querySelector('.usertext-body');
        const text = body?.textContent?.trim() || '';
        if (text.toLowerCase().includes(text_snippet.toLowerCase())) {
          targetThing = thing;
          break;
        }
      }
    }

    if (!targetThing) {
      return { success: false, error: `Parent comment not found (${username || ''}, "${text_snippet?.substring(0, 50) || ''}...")` };
    }

    // Find and click Reply button
    const replyBtn = await oldRedditFindReplyButton(targetThing);
    if (!replyBtn) {
      return { success: false, error: 'Reply button not found on target comment (old Reddit)' };
    }

    await scrollIntoView(replyBtn);
    await humanDelay(300, 600);
    replyBtn.click();
    await humanDelay(1500, 2500);

    // A reply form should appear inside the comment's .child div
    // The textarea should be in the newly opened form
    const childDiv = targetThing.querySelector('.child');
    let textarea = null;
    if (childDiv) {
      textarea = childDiv.querySelector('textarea');
    }
    if (!textarea) {
      textarea = targetThing.querySelector('textarea');
    }
    if (!textarea) {
      textarea = await oldRedditFindCommentTextarea();
    }

    if (!textarea) {
      return { success: false, error: 'Reply textarea did not appear after clicking Reply' };
    }

    await scrollIntoView(textarea);
    await humanTypeTextarea(textarea, replyText);
    console.log('[Reddit CS] Reply typed (old Reddit)');

    // Find and click Save button
    await humanDelay(800, 1500);
    const form = textarea.closest('.usertext');
    const submitBtn = await oldRedditFindSubmitButton(form);
    if (!submitBtn) {
      return { success: false, error: 'Reply submit button not found (old Reddit)' };
    }

    await scrollIntoView(submitBtn);
    await humanDelay(300, 500);
    submitBtn.click();
    await humanDelay(4000, 6000);

    const error = checkForErrors();
    if (error) {
      return { success: false, error: `Reddit error: ${error}` };
    }

    return {
      success: true,
      data: {
        post_url: window.location.href,
        parent_username: username,
        reply_text: replyText,
        reply_url: window.location.href
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION 3: UPVOTE A POST OR COMMENT
  // ═══════════════════════════════════════════════════════════════
  async function upvote(targetUrl, identifier) {
    console.log('[Reddit CS] Upvoting:', targetUrl);

    // Navigate to the URL (post or comment permalink)
    const navUrl = normalizeRedditUrl(targetUrl);
    window.location.href = navUrl;
    await sleep(5000);
    await humanDelay(2000, 3000);

    const isOld = isOldReddit();

    if (isOld) {
      return await oldRedditUpvote(identifier);
    } else {
      return await newRedditUpvote(identifier);
    }
  }

  async function newRedditUpvote(identifier) {
    // identifier: { username?, text_snippet? } — if provided, find specific comment
    //           if null, upvote the main post

    let container = null;

    if (identifier && (identifier.username || identifier.text_snippet)) {
      // Find specific comment
      const { username, text_snippet } = identifier;
      const comments = document.querySelectorAll('shreddit-comment');

      for (const comment of comments) {
        const commentText = comment.getAttribute('content') || comment.textContent || '';
        const author = comment.getAttribute('author') || '';
        let matches = false;
        if (username && author.toLowerCase() === username.toLowerCase()) matches = true;
        if (text_snippet && commentText.toLowerCase().includes(text_snippet.toLowerCase())) matches = true;
        if (matches) { container = comment; break; }
      }

      if (!container && text_snippet) {
        const allDivs = document.querySelectorAll('div, p, span');
        for (const el of allDivs) {
          const text = el.textContent?.trim() || '';
          if (text.toLowerCase().includes(text_snippet.toLowerCase()) && text.length < 1000) {
            container = el.closest('shreddit-comment');
            break;
          }
        }
      }

      if (!container) {
        return { success: false, error: `Target comment not found for upvote` };
      }
    }

    const upvoteBtn = await newRedditFindUpvoteBtn(container);
    if (!upvoteBtn) {
      return { success: false, error: 'Upvote button not found' };
    }

    // Check if already upvoted
    const ariaLabel = upvoteBtn.getAttribute('aria-label') || '';
    if (ariaLabel.toLowerCase().includes('unvote') || upvoteBtn.classList.contains('upvoted')) {
      return { success: false, error: 'Already upvoted', data: { already_upvoted: true } };
    }

    await scrollIntoView(upvoteBtn);
    await humanDelay(300, 600);
    upvoteBtn.click();
    await humanDelay(2000, 3000);

    console.log('[Reddit CS] Upvote clicked (new Reddit)');
    return {
      success: true,
      data: {
        url: window.location.href,
        upvoted: true
      }
    };
  }

  async function oldRedditUpvote(identifier) {
    let container = null;

    if (identifier && (identifier.username || identifier.text_snippet)) {
      const { username, text_snippet } = identifier;
      const things = document.querySelectorAll('.thing');

      for (const thing of things) {
        const authorEl = thing.querySelector('.author');
        const author = authorEl?.textContent?.trim()?.toLowerCase() || '';
        const bodyEl = thing.querySelector('.usertext-body');
        const bodyText = bodyEl?.textContent?.trim() || '';

        let matches = false;
        if (username && author === username.toLowerCase()) matches = true;
        if (text_snippet && bodyText.toLowerCase().includes(text_snippet.toLowerCase())) matches = true;
        if (matches) { container = thing; break; }
      }

      if (!container) {
        return { success: false, error: 'Target comment not found for upvote (old Reddit)' };
      }
    } else {
      // Upvote the main post — look for the post's .thing in the linklisting
      container = document.querySelector('.linklisting .thing') ||
                  document.querySelector('.thing.link');
    }

    if (!container) {
      return { success: false, error: 'Post/comment container not found' };
    }

    // Check if already upvoted
    if (oldRedditIsAlreadyUpvoted(container)) {
      return { success: false, error: 'Already upvoted', data: { already_upvoted: true } };
    }

    const upvoteBtn = await oldRedditFindUpvoteBtn(container);
    if (!upvoteBtn) {
      return { success: false, error: 'Upvote arrow not found' };
    }

    await scrollIntoView(upvoteBtn);
    await humanDelay(300, 600);
    upvoteBtn.click();
    await humanDelay(2000, 3000);

    console.log('[Reddit CS] Upvote clicked (old Reddit)');
    return {
      success: true,
      data: {
        url: window.location.href,
        upvoted: true
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE LISTENER
  // ═══════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'post_request' || message.platform !== 'reddit') return;
    if (!message.payload || !message.payload.action) return;

    const action = message.payload.action;
    const redditActions = ['reddit_comment', 'reddit_reply', 'reddit_upvote'];
    if (!redditActions.includes(action)) return;

    const { requestId, payload } = message;
    console.log('[Reddit CS] Received:', action, requestId);

    let actionPromise;
    switch (action) {
      case 'reddit_comment':
        actionPromise = commentOnPost(payload.post_url, payload.text);
        break;
      case 'reddit_reply':
        actionPromise = replyToComment(payload.post_url, payload.identifier, payload.text);
        break;
      case 'reddit_upvote':
        actionPromise = upvote(payload.url, payload.identifier || null);
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
            type: 'post_result', platform: 'reddit', requestId, result
          }).catch(() => {});
          sendResponse({ type: 'post_result', requestId, result });
          return;
        } catch (e) {
          if (attempt === MAX_RETRIES) {
            const result = { success: false, error: e.message };
            chrome.runtime.sendMessage({
              type: 'post_result', platform: 'reddit', requestId, result
            }).catch(() => {});
            sendResponse({ type: 'post_result', requestId, result });
          } else {
            console.log(`[Reddit CS] Attempt ${attempt} failed, retrying...`);
            await humanDelay(2000, 4000);
          }
        }
      }
    })();

    return true;
  });

  console.log('[Reddit CS] Content script loaded on', window.location.hostname, isOldReddit() ? '(old Reddit)' : '(new Reddit)');
})();
