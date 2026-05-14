#!/usr/bin/env node
/**
 * Login Debug — Tests Reddit and Twitter login flows step by step
 * Logs EVERYTHING: URLs, page text, input fields, buttons, screenshots
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const platform = process.env.PLATFORM || 'both';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function snap(name) {
  return `/tmp/login-debug-${name}-${Date.now()}.png`;
}

async function dumpPage(page, label) {
  const url = page.url();
  log(`\n── ${label} ──`);
  log(`URL: ${url}`);
  
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || 'NO BODY');
  log(`Body text:\n${bodyText}\n`);
  
  const inputs = await page.evaluate(() => 
    Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name, id: i.id, 
      placeholder: (i.placeholder || '').substring(0, 60),
      autocomplete: i.autocomplete,
      testid: i.getAttribute('data-testid'),
      visible: i.offsetParent !== null
    }))
  );
  log(`Inputs: ${JSON.stringify(inputs, null, 2)}`);
  
  const buttons = await page.evaluate(() => 
    Array.from(document.querySelectorAll('button')).map(b => ({
      text: (b.textContent || '').trim().substring(0, 80),
      testid: b.getAttribute('data-testid'),
      type: b.type,
      visible: b.offsetParent !== null
    }))
  );
  log(`Buttons: ${JSON.stringify(buttons, null, 2)}`);
  
  const path = snap(label.replace(/\s+/g, '-'));
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot: ${path}`);
}

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
      '--window-size=1366,768', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1366, height: 768 },
  });
  const page = (await browser.pages())[0];
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
  return { browser, page };
}

// ═════════════════════════════════════════
// REDDIT
// ═════════════════════════════════════════
async function testReddit() {
  log('\n========== REDDIT LOGIN TEST ==========');
  const { browser, page } = await launchBrowser();
  try {
    const user = process.env.REDDIT_USERNAME;
    const pass = process.env.REDDIT_PASSWORD;
    log(`Credentials: user="${user}", pass="${pass ? '***' + pass.substring(pass.length - 4) : 'EMPTY'}"`);

    await page.goto('https://www.reddit.com/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    await dumpPage(page, 'reddit-1-login-page');

    // Fill username
    const userEl = await page.$('#login-username');
    if (!userEl) { log('FATAL: No username field'); return; }
    await userEl.click();
    await new Promise(r => setTimeout(r, 300));
    await page.type('#login-username', user, { delay: 50 });
    log('Username typed');
    await new Promise(r => setTimeout(r, 1000));

    // Fill password
    const passEl = await page.$('#login-password');
    if (!passEl) { log('FATAL: No password field'); return; }
    await passEl.click();
    await new Promise(r => setTimeout(r, 300));
    await page.type('#login-password', pass, { delay: 50 });
    log('Password typed');
    await new Promise(r => setTimeout(r, 500));

    // Click login
    await dumpPage(page, 'reddit-2-before-submit');
    const btn = await page.$('button[class*="login" i]');
    if (btn) {
      await btn.click();
      log('Login button clicked');
    } else {
      await page.keyboard.press('Enter');
      log('Enter pressed');
    }

    // Wait and check
    await new Promise(r => setTimeout(r, 8000));
    await dumpPage(page, 'reddit-3-after-submit');

    // Check if we need to handle anything
    const url = page.url();
    if (url.includes('login')) {
      log('Still on login page — checking for specific issues...');
      const text = await page.evaluate(() => document.body.innerText.toLowerCase());
      
      if (text.includes('incorrect password') || text.includes('wrong password')) {
        log('❌ WRONG PASSWORD');
      } else if (text.includes("username doesn't exist") || text.includes('invalid username')) {
        log('❌ WRONG USERNAME');
      } else if (text.includes('captcha') || text.includes('verify you are human') || text.includes('select all')) {
        log('❌ CAPTCHA/CHALLENGE detected');
      } else if (text.includes('too many') || text.includes('try again later')) {
        log('❌ RATE LIMITED');
      } else if (text.includes('consent') && (text.includes('continue to reddit') || text.includes('allow'))) {
        log('⚠️ CONSENT PAGE — needs clicking');
      } else if (text.includes('verify your email') || text.includes('check your email')) {
        log('⚠️ EMAIL VERIFICATION required');
      } else {
        log('❓ UNKNOWN — no error text detected but still on login page');
        log('Could be: invisible CAPTCHA, JS challenge, or credential issue');
      }
    } else {
      log('✅ LOGIN SUCCESSFUL — navigated away from login page');
      
      // Save cookies
      const cookies = await page.cookies();
      fs.writeFileSync('/tmp/reddit-cookies.json', JSON.stringify(cookies, null, 2));
      log(`Saved ${cookies.length} cookies to /tmp/reddit-cookies.json`);
      
      // Save localStorage
      const localStorage = await page.evaluate(() => JSON.stringify(localStorage));
      fs.writeFileSync('/tmp/reddit-localStorage.json', localStorage);
      log('Saved localStorage');
    }
  } catch (e) {
    log(`Reddit error: ${e.message}`);
  } finally {
    await browser.close();
  }
}

// ═════════════════════════════════════════
// TWITTER/X
// ═════════════════════════════════════════
async function testTwitter() {
  log('\n========== TWITTER/X LOGIN TEST ==========');
  const { browser, page } = await launchBrowser();
  try {
    const user = process.env.TWITTER_USERNAME;
    const pass = process.env.TWITTER_PASSWORD;
    const email = process.env.TWITTER_EMAIL;
    log(`Credentials: user="${user}", pass="${pass ? '***' + pass.substring(pass.length - 4) : 'EMPTY'}", email="${email}"`);

    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    await dumpPage(page, 'twitter-1-login-page');

    // Try to find and fill username
    const userSel = 'input[autocomplete="username"], input[name="text"]';
    const userEl = await page.$(userSel);
    if (!userEl) {
      log('❌ NO USERNAME INPUT FOUND — page did not load login form');
      log('X may be blocking this IP or showing a different page');
      
      // Check if there's any visible text that explains why
      const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      log(`Page content: ${text}`);
      return;
    }
    
    await userEl.click();
    await new Promise(r => setTimeout(r, 300));
    await page.type(userSel, user, { delay: 80 });
    log('Username typed');
    await new Promise(r => setTimeout(r, 1000));

    // Click Next
    await dumpPage(page, 'twitter-2-before-next');
    let nextClicked = false;
    const primaryBtn = await page.$('button[class*="primary"]');
    if (primaryBtn) {
      await primaryBtn.click();
      nextClicked = true;
      log('Primary button clicked (Next)');
    }
    if (!nextClicked) {
      const btns = await page.$$('button');
      for (const b of btns) {
        const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), b);
        if (t === 'next') { await b.click(); nextClicked = true; log('Next button clicked'); break; }
      }
    }
    if (!nextClicked) {
      log('❌ NO NEXT BUTTON FOUND');
      return;
    }

    // Wait for verification step
    await new Promise(r => setTimeout(r, 4000));
    await dumpPage(page, 'twitter-3-after-next');

    const text = await page.evaluate(() => document.body.innerText.toLowerCase());
    log(`Page text after Next (first 500): ${text.substring(0, 500)}`);

    // Check if it asks for email/phone verification
    const needsVerify = text.includes('enter your phone') || text.includes('enter your email') || 
      text.includes('verify your identity') || text.includes('we need to verify');
    
    const idInput = await page.$('input[data-testid="ocfEnterTextTextInput"]') || 
      await page.$('input[autocomplete="email"]') || await page.$('input[autocomplete="tel"]');

    if (needsVerify || idInput) {
      log('⚠️ VERIFICATION PAGE detected — entering email...');
      if (idInput) {
        await idInput.click();
        await new Promise(r => setTimeout(r, 300));
        await idInput.type(email, { delay: 80 });
        log('Email typed');
        await new Promise(r => setTimeout(r, 1000));
        
        // Click Next on verification
        const verifyNext = await page.$('button[data-testid="ocfEnterTextNextButton"]');
        if (verifyNext) {
          await verifyNext.click();
          log('Verification Next clicked');
        } else {
          const btns = await page.$$('button');
          for (const b of btns) {
            const t = await page.evaluate(el => el.textContent.trim().toLowerCase(), b);
            if (t === 'next') { await b.click(); log('Verification Next clicked'); break; }
          }
        }
        
        await new Promise(r => setTimeout(r, 4000));
        await dumpPage(page, 'twitter-4-after-verify-next');
      }
    }

    // Check for password field
    await new Promise(r => setTimeout(r, 2000));
    const passInput = await page.$('input[name="password"], input[type="password"]');
    if (passInput) {
      log('✅ Password field found — filling...');
      await passInput.click();
      await new Promise(r => setTimeout(r, 300));
      await page.type('input[name="password"], input[type="password"]', pass, { delay: 80 });
      log('Password typed');
      await new Promise(r => setTimeout(r, 500));
      
      await dumpPage(page, 'twitter-5-before-login');
      
      // Click Login
      const loginBtn = await page.$('button[data-testid="LoginForm_Login_Button"]');
      if (loginBtn) {
        await loginBtn.click();
        log('Login button clicked');
      }
      
      await new Promise(r => setTimeout(r, 5000));
      await dumpPage(page, 'twitter-6-after-login');
      
      const finalUrl = page.url();
      if (!finalUrl.includes('login') && !finalUrl.includes('flow')) {
        log('✅ LOGIN SUCCESSFUL');
        const cookies = await page.cookies();
        fs.writeFileSync('/tmp/twitter-cookies.json', JSON.stringify(cookies, null, 2));
        log(`Saved ${cookies.length} cookies`);
        const ls = await page.evaluate(() => JSON.stringify(localStorage));
        fs.writeFileSync('/tmp/twitter-localStorage.json', ls);
        log('Saved localStorage');
      } else {
        log('❌ Still on login flow after password submit');
        const finalText = await page.evaluate(() => document.body.innerText.toLowerCase());
        if (finalText.includes('incorrect password') || finalText.includes('invalid password')) {
          log('❌ WRONG PASSWORD');
        } else if (finalText.includes('incorrect username') || finalText.includes('invalid username')) {
          log('❌ WRONG USERNAME');
        } else {
          log('❓ Unknown issue — check screenshots');
        }
      }
    } else {
      log('❌ NO PASSWORD FIELD FOUND');
      const inputs2 = await page.evaluate(() => 
        Array.from(document.querySelectorAll('input')).map(i => ({
          type: i.type, name: i.name, placeholder: i.placeholder, testid: i.getAttribute('data-testid')
        }))
      );
      log(`Available inputs: ${JSON.stringify(inputs2)}`);
    }
  } catch (e) {
    log(`Twitter error: ${e.message}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  if (platform === 'reddit' || platform === 'both') await testReddit();
  if (platform === 'twitter' || platform === 'both') await testTwitter();
  log('\n=== DONE ===');
})();
