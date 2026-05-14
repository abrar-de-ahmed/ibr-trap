const puppeteer = require('puppeteer');

// Load credentials from environment or prompt
const REDDIT_USERNAME = process.env.REDDIT_USERNAME || '';
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD || '';
const TWITTER_USERNAME = process.env.TWITTER_USERNAME || '';
const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD || '';
const TWITTER_EMAIL = process.env.TWITTER_EMAIL || '';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testReddit() {
  console.log('\n=== REDDIT LOGIN TEST ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1366,768', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1366, height: 768 },
  });
  const page = (await browser.pages())[0];
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

  try {
    console.log('Going to Reddit login...');
    await page.goto('https://www.reddit.com/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    console.log('Current URL:', page.url());
    
    // Take screenshot of initial page
    await page.screenshot({ path: '/tmp/reddit-1-initial.png' });
    console.log('Screenshot: /tmp/reddit-1-initial.png');

    // Check what's on the page
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Page text (first 500):', bodyText);

    // Check for username field
    const usernameEl = await page.$('#login-username');
    console.log('Username field found:', !!usernameEl);
    
    if (usernameEl) {
      await usernameEl.click();
      await delay(500);
      await page.type('#login-username', REDDIT_USERNAME, { delay: 50 });
      await delay(1000);
      
      // Check password field
      const passwordEl = await page.$('#login-password');
      console.log('Password field found:', !!passwordEl);
      
      if (passwordEl) {
        await passwordEl.click();
        await delay(500);
        await page.type('#login-password', REDDIT_PASSWORD, { delay: 50 });
        await delay(1000);
        
        // Click login button
        const loginBtn = await page.$('button[class*="login" i]');
        if (loginBtn) {
          const btnText = await page.evaluate(el => el.textContent.trim(), loginBtn);
          console.log('Login button text:', btnText);
          await loginBtn.click();
          console.log('Login button clicked');
        } else {
          // Try pressing Enter
          await page.keyboard.press('Enter');
          console.log('Pressed Enter to submit');
        }
        
        await delay(5000);
        console.log('After submit URL:', page.url());
        await page.screenshot({ path: '/tmp/reddit-2-after-login.png' });
        console.log('Screenshot: /tmp/reddit-2-after-login.png');
        
        const afterText = await page.evaluate(() => document.body.innerText.substring(0, 800));
        console.log('After login page text (first 800):', afterText);
        
        // Save cookies for reuse
        const cookies = await page.cookies();
        console.log('Cookies received:', cookies.length);
        if (cookies.length > 0) {
          require('fs').writeFileSync('/tmp/reddit-cookies.json', JSON.stringify(cookies, null, 2));
          console.log('Cookies saved to /tmp/reddit-cookies.json');
        }
      }
    }
  } catch (e) {
    console.error('Reddit error:', e.message);
    await page.screenshot({ path: '/tmp/reddit-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
}

async function testTwitter() {
  console.log('\n=== TWITTER/X LOGIN TEST ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1366,768', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1366, height: 768 },
  });
  const page = (await browser.pages())[0];
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');

  try {
    console.log('Going to Twitter/X login...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(5000);
    console.log('Current URL:', page.url());
    
    await page.screenshot({ path: '/tmp/twitter-1-initial.png' });
    console.log('Screenshot: /tmp/twitter-1-initial.png');

    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Page text (first 500):', bodyText);

    // Check all input fields on page
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, autocomplete: i.autocomplete, testid: i.getAttribute('data-testid')
      }));
    });
    console.log('Input fields found:', JSON.stringify(inputs, null, 2));

    // Check all buttons on page
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim().substring(0, 50),
        testid: b.getAttribute('data-testid'),
        class: b.className.substring(0, 80)
      }));
    });
    console.log('Buttons found:', JSON.stringify(buttons, null, 2));

    // Try to fill username
    const usernameInput = await page.$('input[autocomplete="username"]') || await page.$('input[name="text"]');
    if (usernameInput) {
      console.log('Username input found, filling...');
      await usernameInput.click();
      await delay(500);
      await page.type('input[autocomplete="username"], input[name="text"]', TWITTER_USERNAME, { delay: 80 });
      await delay(1000);
      
      // Click Next
      const nextBtn = await page.$('button[class*="primary"]') || await page.$('button:last-of-type');
      if (nextBtn) {
        const btnText = await page.evaluate(el => el.textContent.trim(), nextBtn);
        console.log('Next button text:', btnText);
        await nextBtn.click();
        console.log('Next clicked');
      }
      
      await delay(4000);
      console.log('After Next URL:', page.url());
      await page.screenshot({ path: '/tmp/twitter-2-after-next.png' });
      console.log('Screenshot: /tmp/twitter-2-after-next.png');
      
      const afterText = await page.evaluate(() => document.body.innerText.substring(0, 800));
      console.log('After Next page text (first 800):', afterText);
      
      // Check inputs again
      const inputs2 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, testid: i.getAttribute('data-testid')
        }));
      });
      console.log('Input fields after Next:', JSON.stringify(inputs2, null, 2));

      // Save cookies
      const cookies = await page.cookies();
      console.log('Cookies received:', cookies.length);
      if (cookies.length > 0) {
        require('fs').writeFileSync('/tmp/twitter-cookies.json', JSON.stringify(cookies, null, 2));
        console.log('Cookies saved to /tmp/twitter-cookies.json');
      }
    } else {
      console.log('NO username input found!');
    }
  } catch (e) {
    console.error('Twitter error:', e.message);
    await page.screenshot({ path: '/tmp/twitter-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
}

(async () => {
  if (REDDIT_USERNAME && REDDIT_PASSWORD) await testReddit();
  else console.log('Reddit: No credentials');
  if (TWITTER_USERNAME && TWITTER_PASSWORD && TWITTER_EMAIL) await testTwitter();
  else console.log('Twitter: No credentials');
})();
