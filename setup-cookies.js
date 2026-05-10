#!/usr/bin/env node
/**
 * COOKIE CAPTURE TOOL — Login manually, capture cookies automatically
 * ════════════════════════════════════════════════════
 * 
 * USAGE: node setup-cookies.js [reddit|twitter|pinterest|all]
 * 
 * This opens a REAL browser window for you to login manually.
 * Once you're logged in, the script captures the cookies
 * and saves them to data/cookies/ for the Social Agent to reuse.
 * 
 * No credentials needed — YOU login, we capture.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_DIR = path.join(__dirname, 'data', 'cookies');
if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR, { recursive: true });

const platform = (process.argv[2] || 'all').toLowerCase();

const PLATFORMS = {
  reddit: {
    url: 'https://www.reddit.com/login/',
    checkUrl: 'https://www.reddit.com/',
    name: 'Reddit'
  },
  twitter: {
    url: 'https://x.com/i/flow/login',
    checkUrl: 'https://x.com/home',
    name: 'Twitter/X'
  },
  pinterest: {
    url: 'https://www.pinterest.com/login/',
    checkUrl: 'https://www.pinterest.com/',
    name: 'Pinterest'
  }
};

async function captureCookies(key, config) {
  console.log(`\n═════════════════════════════════════════`);
  console.log(`  ${config.name} — LOGIN & CAPTURE`);
  console.log(`═════════════════════════════════════════`);
  console.log(`\n1. A browser window will open`);
  console.log(`2. Login to ${config.name} manually`);
  console.log(`3. After login, the script will detect it and capture cookies`);
  console.log(`4. Cookies will be saved to data/cookies/${key}-cookies.json\n`);

  const browser = await puppeteer.launch({
    headless: false, // REAL browser window
    args: ['--window-size=1366,768'],
    defaultViewport: { width: 1366, height: 768 },
    user dataDir: `/tmp/puppeteer-${key}-profile`,
  });

  const page = (await browser.pages())[0];
  
  console.log(`Opening ${config.url}...`);
  await page.goto(config.url, { waitUntil: 'domcontentloaded' });

  // Wait for user to login — poll every 2 seconds
  console.log(`Waiting for you to login to ${config.name}...`);
  console.log(`(checking every 2 seconds)`);
  
  let loggedIn = false;
  for (let i = 0; i < 300; i++) { // 10 minutes max
    await new Promise(r => setTimeout(r, 2000));
    try {
      const url = page.url();
      
      if (key === 'reddit') {
        const text = await page.evaluate(() => document.body.innerText.toLowerCase());
        if (!url.includes('login') && text.includes('home') && !text.includes('log in') && !text.includes('sign up')) {
          loggedIn = true;
        }
      } else if (key === 'twitter') {
        if (!url.includes('login') && !url.includes('flow')) {
          loggedIn = true;
        }
      } else if (key === 'pinterest') {
        if (!url.includes('login')) {
          loggedIn = true;
        }
      }
      
      if (loggedIn) break;
    } catch (e) { /* page may be navigating */ }
    
    if (i % 15 === 14) console.log(`  Still waiting... (${Math.floor((i+1)*2/60)} min)`);
  }

  if (loggedIn) {
    console.log(`\n✅ ${config.name} login detected! Capturing cookies...`);
    
    const cookies = await page.cookies();
    const filePath = path.join(COOKIES_DIR, `${key}-cookies.json`);
    const data = {
      cookies,
      saved_at: new Date().toISOString(),
      captured_from: 'manual-login',
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${cookies.length} cookies to ${filePath}`);
    console.log(`   These cookies will be used by the Social Agent for future runs.`);
  } else {
    console.log(`\n❌ Timed out waiting for ${config.name} login (10 min)`);
  }

  await browser.close();
  return loggedIn;
}

(async () => {
  const targets = platform === 'all' ? ['reddit', 'twitter', 'pinterest'] : [platform];
  
  for (const key of targets) {
    const config = PLATFORMS[key];
    if (!config) {
      console.log(`Unknown platform: ${key}. Use reddit, twitter, pinterest, or all.`);
      process.exit(1);
    }
    await captureCookies(key, config);
  }
  
  console.log('\n═════════════════════════════════════════');
  console.log('  DONE! Now commit and push the cookies:');
  console.log('  git add data/cookies/');
  console.log('  git commit -m "cookies: manual session capture"');
  console.log('  git push origin main');
  console.log('═════════════════════════════════════════\n');
})();
