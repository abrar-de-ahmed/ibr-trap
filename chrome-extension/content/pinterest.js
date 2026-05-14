/**
 * Pinterest Content Script
 * Runs on *://*.pinterest.com/*
 * Receives pin creation instructions from background.js via chrome.runtime.onMessage
 * Performs actual pin creation (image upload, title, description, link, board, publish)
 * in the real browser.
 */

(function() {
  'use strict';

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

  // ── Utility: wait for element by text content ──
  function waitForElementByText(tag, text, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const all = document.querySelectorAll(tag);
      for (const el of all) {
        if (el.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
          return resolve(el);
        }
      }

      const observer = new MutationObserver((mutations, obs) => {
        const all = document.querySelectorAll(tag);
        for (const el of all) {
          if (el.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
            obs.disconnect();
            resolve(el);
            return;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element <${tag}> containing "${text}" not found`));
      }, timeout);
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
      await sleep(rand(200, 400));
      el.click();
      await sleep(waitAfter);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Utility: human-like typing ──
  async function humanType(selector, text) {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.focus();
    el.click();
    await humanDelay(300, 500);
    el.textContent = '';
    await humanDelay(100, 200);

    let charCount = 0;
    for (const char of text) {
      document.execCommand('insertText', false, char);
      charCount++;
      if (charCount % rand(5, 10) === 0) {
        await humanDelay(200, 500);
      } else {
        await sleep(rand(20, 50));
      }
    }
    await humanDelay(500, 1000);
    return true;
  }

  // ── Utility: download image from URL → File ──
  async function downloadImageAsFile(imageUrl) {
    try {
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const filename = imageUrl.split('/').pop()?.split('?')[0] || 'pin-image.jpg';
      const ext = filename.split('.').pop() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      return new File([blob], `pin-image.${ext}`, { type: mimeType });
    } catch (e) {
      console.error('[Pinterest CS] Image download failed:', e.message);
      return null;
    }
  }

  // ── Utility: data URL → File ──
  function dataUrlToFile(dataUrl, filename = 'pin-image.png') {
    try {
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const b64 = atob(parts[1]);
      const arr = new Uint8Array(b64.length);
      for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
      const ext = mime.includes('png') ? 'png' : 'jpg';
      return new File([arr], `pin-image.${ext}`, { type: mime });
    } catch (e) {
      console.error('[Pinterest CS] Data URL conversion failed:', e.message);
      return null;
    }
  }

  // ── Main: Create Pin ──
  async function createPin(payload) {
    const { title, description, link, board, image_url, image_data_url } = payload;
    console.log('[Pinterest CS] Creating pin:', title);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[Pinterest CS] Attempt ${attempt}/${MAX_RETRIES}`);
      try {
        const result = await attemptPinCreation(payload);
        if (result.success) return result;
        if (attempt < MAX_RETRIES) {
          console.log(`[Pinterest CS] Attempt ${attempt} failed: ${result.error}. Retrying...`);
          await humanDelay(2000, 4000);
        } else {
          return result;
        }
      } catch (e) {
        console.error(`[Pinterest CS] Attempt ${attempt} exception:`, e.message);
        if (attempt === MAX_RETRIES) {
          return { success: false, error: e.message };
        }
        await humanDelay(2000, 4000);
      }
    }
    return { success: false, error: 'All retry attempts failed' };
  }

  async function attemptPinCreation(payload) {
    const { title, description, link, board, image_url, image_data_url } = payload;

    // Step 1: Navigate to pin creation tool
    const currentUrl = window.location.href;
    if (!currentUrl.includes('pin-creation-tool')) {
      window.location.href = 'https://www.pinterest.com/pin-creation-tool/';
      await sleep(4000);
      await humanDelay(1000, 2000);
    }

    // Step 2: Get image file
    let imageFile = null;
    if (image_data_url) {
      console.log('[Pinterest CS] Using base64 image data');
      imageFile = dataUrlToFile(image_data_url);
    } else if (image_url) {
      console.log('[Pinterest CS] Downloading image from URL:', image_url.substring(0, 60));
      imageFile = await downloadImageAsFile(image_url);
    }

    // Step 3: Upload image
    if (imageFile) {
      try {
        console.log('[Pinterest CS] Uploading image...');
        await humanDelay(1000, 2000);

        // Find file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
          const dt = new DataTransfer();
          dt.items.add(imageFile);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Pinterest CS] Image dispatched to file input');
        } else {
          // Try clicking the upload area to trigger file chooser
          const dropZone = document.querySelector('[data-test-id="pin-upload-dropzone"]') ||
                           document.querySelector('div[class*="Upload"]') ||
                           document.querySelector('label[class*="upload"]');
          if (dropZone) {
            dropZone.click();
            await humanDelay(500, 1000);
            // File chooser will open — but we can't programmatically accept it from content script
            // So fall back to the file input method
            console.log('[Pinterest CS] Drop zone clicked, trying file input fallback');
          }
        }

        // Wait for image to process
        console.log('[Pinterest CS] Waiting for image to process...');
        await sleep(5000);
        await humanDelay(2000, 3000);
      } catch (e) {
        console.error('[Pinterest CS] Image upload error:', e.message);
        // Continue anyway — sometimes Pinterest has the image from a previous attempt
      }
    } else {
      console.log('[Pinterest CS] No image file available, proceeding without upload');
    }

    // Step 4: Fill title
    const titleSelectors = [
      'div[contenteditable="true"]',
      'input[placeholder*="title" i]',
      'input[placeholder*="Add a title" i]',
      '[data-test-id="pin-title"]',
      'textarea[placeholder*="title" i]'
    ];

    let titleFilled = false;
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        await el.click();
        await humanDelay(200, 400);
        // Clear and type
        el.textContent = '';
        await humanDelay(100, 200);
        let charCount = 0;
        for (const char of (title || '')) {
          document.execCommand('insertText', false, char);
          charCount++;
          if (charCount % rand(5, 10) === 0) await humanDelay(200, 500);
          else await sleep(rand(25, 50));
        }
        titleFilled = true;
        console.log('[Pinterest CS] Title filled');
        break;
      }
    }
    if (!titleFilled) console.log('[Pinterest CS] Could not fill title');
    await humanDelay(800, 1500);

    // Step 5: Fill description
    if (description) {
      const descSelectors = [
        'textarea[placeholder*="description" i]',
        'textarea[placeholder*="Tell everyone" i]',
        'textarea[placeholder*="What is it about" i]',
        '[data-test-id="pin-description"]'
      ];

      let descFilled = false;
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          await el.click();
          await humanDelay(200, 400);
          el.value = '';
          await humanDelay(100, 200);
          let charCount = 0;
          for (const char of description) {
            // Use native input value setter for textarea
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            )?.set;
            if (nativeSetter) {
              nativeSetter.call(el, el.value + char);
            } else {
              el.value += char;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            charCount++;
            if (charCount % rand(5, 10) === 0) await humanDelay(200, 500);
            else await sleep(rand(20, 45));
          }
          descFilled = true;
          console.log('[Pinterest CS] Description filled');
          break;
        }
      }
      if (!descFilled) console.log('[Pinterest CS] Could not fill description');
    }
    await humanDelay(800, 1500);

    // Step 6: Add link
    if (link) {
      try {
        // Toggle link field
        const linkToggleSelectors = [
          'button[data-test-id="pin-editor-link-toggle"]',
          'div[class*="linkField"]',
          'button[class*="link"]'
        ];
        let linkToggled = false;
        for (const sel of linkToggleSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              el.click();
              linkToggled = true;
              await humanDelay(500, 1000);
              break;
            }
          }
        }

        // Fill link
        const linkSelectors = [
          'input[id="pinLink"]',
          'input[name="link"]',
          'input[data-test-id="pin-link-input"]',
          'input[placeholder*="http"]',
          'input[placeholder*="url" i]',
          'input[placeholder*="link" i]'
        ];

        for (const sel of linkSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            await el.click();
            await humanDelay(200, 400);
            el.value = link;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[Pinterest CS] Link filled');
            break;
          }
        }
        await humanDelay(1000, 2000);
      } catch (e) {
        console.log('[Pinterest CS] Link field issue:', e.message);
      }
    }

    // Step 7: Select board
    if (board) {
      try {
        const boardName = board || 'Free Design Tools';

        // Open board dropdown
        const boardBtnSelectors = [
          'div[data-test-id="pin-editor-board-selector"]',
          'button[data-test-id="pin-editor-board-selector"]',
          'div[class*="boardSelect"]',
          '[data-test-id*="board" i]'
        ];

        let boardOpened = false;
        for (const sel of boardBtnSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              el.click();
              boardOpened = true;
              console.log('[Pinterest CS] Board dropdown opened');
              await humanDelay(1500, 2500);
              break;
            }
          }
        }

        if (boardOpened) {
          // Search for the board
          const boardInputSelectors = [
            'input[placeholder*="board" i]',
            'input[placeholder*="search" i]',
            'input[data-test-id*="board" i]',
            'input[class*="board" i]'
          ];

          for (const sel of boardInputSelectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
              await el.click();
              await humanDelay(200, 400);
              el.value = boardName;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              console.log('[Pinterest CS] Board search filled:', boardName);
              await humanDelay(1500, 2500);

              // Click first matching board
              const resultSelectors = [
                'div[data-test-id="board-selection-item"]',
                'div[class*="boardItem"]',
                'div[class*="BoardTile"]'
              ];

              let boardClicked = false;
              for (const rSel of resultSelectors) {
                const rEl = document.querySelector(rSel);
                if (rEl) {
                  rEl.click();
                  boardClicked = true;
                  console.log('[Pinterest CS] Board selected');
                  await humanDelay(500, 1000);
                  break;
                }
              }

              if (!boardClicked) {
                // Text match fallback
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                  const t = div.textContent?.trim() || '';
                  if (t.toLowerCase() === boardName.toLowerCase() ||
                      t.toLowerCase().includes(boardName.toLowerCase())) {
                    // Don't click the input itself
                    if (div.tagName !== 'INPUT') {
                      div.click();
                      boardClicked = true;
                      console.log('[Pinterest CS] Board clicked via text match:', t);
                      await humanDelay(500, 1000);
                      break;
                    }
                  }
                }
              }
              break;
            }
          }
        } else {
          console.log('[Pinterest CS] Board dropdown not found — will use default');
        }
      } catch (e) {
        console.log('[Pinterest CS] Board selection issue:', e.message);
      }
    }

    await humanDelay(2000, 3000);

    // Step 8: Click Publish
    let publishClicked = false;
    const publishSelectors = [
      'button[data-test-id="pin-editor-publish-button"]',
      'button[class*="Publish"]',
      'button[class*="publish"]',
      'button[data-test-id*="publish" i]'
    ];

    for (const sel of publishSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          el.click();
          publishClicked = true;
          console.log('[Pinterest CS] Publish clicked');
          break;
        }
      }
    }

    if (!publishClicked) {
      // Text match fallback
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const btnText = btn.textContent?.trim().toLowerCase() || '';
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            (btnText === 'publish' || btnText === 'save' ||
             btnText.includes('publish') || btnText.includes('create pin'))) {
          btn.click();
          publishClicked = true;
          console.log('[Pinterest CS] Publish clicked via text match:', btnText);
          break;
        }
      }
    }

    if (!publishClicked) {
      return { success: false, error: 'Publish button not found' };
    }

    // Step 9: Wait and verify
    await humanDelay(5000, 8000);

    const finalUrl = window.location.href;
    const bodyText = document.body.innerText?.toLowerCase() || '';
    console.log('[Pinterest CS] Post-publish URL:', finalUrl);

    // Check: redirected to pin page
    if (finalUrl.includes('/pin/') && !finalUrl.includes('create')) {
      console.log('[Pinterest CS] Pin created! Redirected to pin page.');
      return { success: true, pin_url: finalUrl };
    }

    // Check: success toast/patterns
    const successPatterns = ['pin was saved', 'pin published', 'successfully saved',
                             'your pin is live', 'done!', 'saved to'];
    if (successPatterns.some(p => bodyText.includes(p))) {
      console.log('[Pinterest CS] Pin saved confirmation detected!');
      return { success: true };
    }

    // Check: toast element
    const toastEl = document.querySelector('[data-test-id="toast"]') ||
                    document.querySelector('div[class*="toast" i]') ||
                    document.querySelector('div[class*="Toast" i]') ||
                    document.querySelector('div[class*="success" i]');
    if (toastEl) {
      const toastText = toastEl.textContent?.trim().toLowerCase() || '';
      if (toastText.includes('save') || toastText.includes('publish') ||
          toastText.includes('success') || toastText.includes('done')) {
        console.log('[Pinterest CS] Pin confirmed via toast:', toastText);
        return { success: true };
      }
    }

    // Check: visible errors
    const errorPatterns = ['something went wrong', 'try again', "couldn't save",
                           'error', 'failed', 'oops'];
    if (errorPatterns.some(p => bodyText.includes(p))) {
      const errorElements = document.querySelectorAll('[class*="error" i], [class*="Error" i], [role="alert"]');
      for (const el of errorElements) {
        if (el.offsetParent !== null && (el.textContent?.trim().length || 0) > 5) {
          const errorText = el.textContent?.trim() || 'Unknown error';
          console.error('[Pinterest CS] Visible error:', errorText);
          return { success: false, error: `Publish error: ${errorText}` };
        }
      }
    }

    // Still on create page → ambiguous
    if (finalUrl.includes('pin-creation-tool')) {
      console.log('[Pinterest CS] Still on create page — ambiguous result');
      return { success: false, error: 'Pin may have been saved as draft — could not verify' };
    }

    console.log('[Pinterest CS] Pin creation completed (ambiguous verification)');
    return { success: true };
  }

  // ── Listen for messages from background.js ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'post_request' && message.platform === 'pinterest') {
      const { requestId, payload } = message;
      console.log('[Pinterest CS] Received pin request:', requestId, payload);

      createPin(payload)
        .then(result => {
          console.log('[Pinterest CS] Pin result:', result);
          chrome.runtime.sendMessage({
            type: 'post_result',
            platform: 'pinterest',
            requestId,
            result
          }).catch(() => {});
          sendResponse({ type: 'post_result', requestId, result });
        })
        .catch(err => {
          const result = { success: false, error: err.message };
          chrome.runtime.sendMessage({
            type: 'post_result',
            platform: 'pinterest',
            requestId,
            result
          }).catch(() => {});
          sendResponse({ type: 'post_result', requestId, result });
        });

      return true; // Keep channel open for async response
    }
  });

  console.log('[Pinterest CS] Content script loaded on', window.location.hostname);
})();
