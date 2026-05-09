# BG Remover Digital — MASTER PROMPT (Complete Project Reference)

> **Last Updated:** May 10, 2026
> **Version:** 5.1 — Growth Agent Live + 20 SEO Keyword Pages + Social Agent v2.0 Bugs Fixed + Supervisor Updated
> **Project Owner:** Abrar Ahmed
> **Contact Email:** craftedminds3@gmail.com
> **Project:** BG Remover Digital (formerly IBR-Trap)
> **Live URL:** https://bgremoverdigital.craftedmindss.com
> **Future Domain:** https://bgremoverdigital.com (planned, not purchased yet)
> **GitHub:** https://github.com/abrar-de-ahmed/ibr-trap
> **Branch:** main (only branch)

---

## 0. HANDOFF INSTRUCTIONS — READ FIRST

If this is a new chat session, the AI assistant should:

1. Read this entire file to understand the full project context
2. Check the live site at https://bgremoverdigital.craftedmindss.com to verify it's working
3. Read BG-REMOVER-SEO-STRATEGY.md for SEO plans
4. Read BG-REMOVER-WORKLOG.md for chronological history
5. Ask the user what they need help with before making any changes

**DO NOT:**
- Recreate or rewrite any working files without the user's request
- Change the domain or branding without explicit permission
- Modify Stripe keys or webhook configurations
- Deploy without git commit + push (all deploys go through CF Pages git integration)
- Mention img.ly by name in any user-facing content — always use "third-party AI integration" or "client-side AI technology"

---

## 1. PROJECT OVERVIEW

BG Remover Digital is an AI-powered background image removal web app. Users upload images, the browser-side `@imgly/background-removal` library removes backgrounds using ONNX Runtime WebAssembly. No server-side processing — all AI runs in the user's browser.

**Business Model:**
- Free tier: 2 images per user (localStorage tracked)
- Paid tier: 500 images for $9 one-time payment (Stripe)
- Batch upload for paid users: up to 30 images at once
- No signup required — frictionless entry

**Tech Stack:**
- Next.js 16 + React 19 + TypeScript (static export, `output: "export"`)
- Tailwind CSS 4 + shadcn/ui Dialog + Lucide React icons
- `@imgly/background-removal` v1.7 (client-side AI, FREE, no API key)
- Cloudflare Pages (hosting, FREE tier)
- CF Pages Functions (server-side API endpoints, FREE tier)
- Stripe (payment processing, LIVE mode)

**Critical Configuration:**
- `reactStrictMode: false` — DELIBERATE, prevents img.ly double-invocation bug
- `output: "export"` — static HTML, no server-side rendering
- All CF environment variables set via Cloudflare Dashboard (NEVER in code)
- `functions/` excluded from TypeScript build check in tsconfig.json
- Image auto-resize to 4096px max dimension
- MIME type filter: PNG, JPG, WEBP only (blocks HEIC/HEIF decode errors)

---

## 2. ALL 8 AGENTS — COMPLETE STATUS

### Agent 1: Monitor Agent ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/monitor.yml` |
| **Script File** | `.github/workflows/scripts/monitor.js` |
| **Schedule** | Every 12 hours (0:00 UTC and 12:00 UTC) + manual trigger |
| **Email Behavior** | INSTANT alert on ANY failure + weekly OK email on Sundays |
| **GitHub Secrets** | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, CF_API_TOKEN, CF_ACCOUNT_ID |

**7 Checks:**
1. HTTP Status (with 2 retries, 10s delay)
2. Content: Page title contains "Background Image Remover"
3. Content: Upload zone contains "Drop your image"
4. Content: CTA contains "500 images for just $9"
5. Content: Buy button contains "Need more" or "Buy Now"
6. Response time under 10 seconds
7. SSL/HTTPS validation

**Smart Diagnosis Engine:**
- CRITICAL: Site unreachable, SSL failure → no auto-fix, needs owner
- HIGH: 500/502/503/404 → auto-redeploy via CF API → wait 90s → re-check
- MEDIUM: Missing title/upload zone, slow response → auto-redeploy
- LOW: Missing CTA text → manual review needed

---

### Agent 2: Security Agent v2 ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/security-agent.yml` |
| **Script File** | `.github/workflows/scripts/security-audit.js` |
| **Schedule** | Every Monday at 6:00 UTC + manual trigger |
| **Email Behavior** | INSTANT alert if CRITICAL/HIGH findings + scheduled weekly report on Monday |
| **Smart Logic** | If all clear on manual trigger → skips email to avoid noise |
| **GitHub Secrets** | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL |

**6 Checks:**
1. `npm audit` — dependency vulnerability scanning
2. Secret scanning — scans all .ts/.js/.json files for exposed keys
3. `.gitignore` audit — ensures .env, .pem, .key patterns are blocked
4. Dependency count review — flags if >20 packages
5. Security headers check — verifies via live site
6. Email report with severity levels (CRITICAL, HIGH, MEDIUM, LOW)

---

### Agent 3: SEO Agent v2 ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/seo-agent.yml` |
| **Script File** | `.github/workflows/scripts/seo-check.js` |
| **Schedule** | Every Wednesday at 6:00 UTC + manual trigger |
| **Email Behavior** | INSTANT alert if CRITICAL/HIGH or site down + scheduled weekly report |
| **Smart Logic** | If all clear on manual trigger → skips email |
| **GitHub Secrets** | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL |

**10 Checks:**
1. Title tag (length: 40-60 chars optimal)
2. Meta description (length: 120-155 chars optimal)
3. Viewport meta tag
4. Canonical URL
5. Open Graph tags (og:title, og:description, og:image, og:url)
6. Twitter Card (summary_large_image)
7. JSON-LD structured data (SoftwareApplication schema)
8. robots.txt (accessibility, sitemap declaration, no Disallow: /)
9. sitemap.xml (URL count, domain match, lastmod dates)
10. Performance hints (HTML size, script count)

---

### Agent 4: PM Agent v2 ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/pm-agent.yml` |
| **Script File** | `.github/workflows/scripts/pm-report.js` |
| **Schedule** | Every Friday at 6:00 UTC + manual trigger |
| **Email Behavior** | INSTANT alert if site DOWN or Stripe API fails + scheduled weekly report |
| **Smart Logic** | If all clear on manual trigger → skips email |
| **GitHub Secrets** | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, CF_API_TOKEN, CF_ACCOUNT_ID, STRIPE_SECRET_KEY |
| **Extra Secret** | GITHUB_TOKEN (auto-provided by GitHub Actions for Supervisor API) |

**Report Contents:**
1. Site health: uptime, response time, content verification
2. Stripe revenue: 7-day transactions, total revenue, unique customers
3. CF deployment status: latest deployment ID and status
4. Agent status dashboard: all 5 agents with schedule and status
5. Actionable recommendations based on revenue and performance data

---

### Agent 5: Growth Agent v1 ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/growth-agent.yml` |
| **Script File** | `.github/workflows/scripts/growth-agent.js` |
| **Schedule** | Daily at 8:00 UTC (1:00 PM PKT) + manual trigger |
| **Email Behavior** | ALWAYS sends daily report (it IS the growth tracker) |
| **GitHub Secrets** | GITHUB_TOKEN (auto), GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, STRIPE_SECRET_KEY |
| **Permissions** | `contents: write` (commits daily metrics to repo) |

**Target:** 5 paid users before May 31, 2026

**Daily Report Contains:**
1. Target tracker (progress bar, days remaining, users/day needed)
2. KPI cards (paid users, total revenue, 7-day revenue, pages live)
3. Week-over-week trend analysis (revenue, users, response time, uptime)
4. Smart recommendations engine (CRITICAL/HIGH/MEDIUM/LOW priorities)
5. Milestone tracking (first sale, half target, target reached)
6. Failed pages alert

**Smart Recommendations (rules-based, adapts to data):**
- Zero sales + >10 days remaining → CRITICAL: urgent action needed
- Zero sales + >14 days → CRITICAL: share on social platforms
- Low conversion rate → HIGH: accelerate distribution
- All pages healthy → LOW: focus on distribution
- First sale achieved → MILESTONE: analyze and double down

**Data Storage:**
- `data/growth-metrics.json` — daily snapshots, milestones, recommendations log, learning notes
- Auto-commits daily to repo (creates visible history)

---

### Agent 6: Charlie Agent (Lightweight) ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/charlie-agent.yml` |
| **Script File** | `.github/workflows/scripts/charlie.js` |
| **Schedule** | Every 6 hours (0:00, 6:00, 12:00, 18:00 UTC) + manual trigger |
| **Email Behavior** | INSTANT alert on CRITICAL/HIGH findings |
| **GitHub Secrets** | GITHUB_TOKEN, GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL |
| **Future Upgrade** | Cloudflare Worker at edge (Revenue gate: $50/month) |

**The Reactive Phenotype — Frontline Security Monitor:**
1. Content integrity check — SHA-256 hash comparison of homepage
2. Response time anomaly detection — DDoS early warning
3. Ghost page detection — unexpected error pages or hijacked content
4. Suspicious code injection detection (scripts, iframes, eval, document.write)
5. Meta redirect detection — possible compromise indicator
6. Multi-page availability check (homepage + keyword page + sitemap)
7. State saved to `data/charlie-state.json`

**Bravo can sandbox Charlie** if malfunction detected.

### Agent 7: Bravo Agent (Lightweight) ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/bravo-agent.yml` |
| **Script File** | `.github/workflows/scripts/bravo.js` |
| **Schedule** | Daily at 7:30 UTC (30 min after Supervisor) + manual trigger |
| **Email Behavior** | Always emails daily sentinel report |
| **GitHub Secrets** | GITHUB_TOKEN, GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL |
| **Future Upgrade** | GA Pattern Recognition (Revenue gate: $200/month) |

**The Sentinel Heuristic — Watches the Watchers:**
1. Evaluates Charlie's state — checks for stale data, sandbox mode, poisoning
2. Alert fatigue detection — if Charlie sends too many false alarms
3. Repeated finding detection — flags persistent false positives
4. Independent site check — cross-validates WITHOUT relying on Charlie
5. Data integrity verification — checks all JSON state files for corruption
6. Override authority — can set Charlie to "sandbox" mode if malfunction
7. State saved to `data/bravo-state.json`

**Future: ALPHA (Out-of-Band Overlord)** — See SECURITY-ROADMAP.md (Revenue gate: $500/month, requires physical hardware).

---

### Agent 8: Supervisor Agent v2 ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/supervisor-agent.yml` |
| **Script File** | `.github/workflows/scripts/supervisor.js` |
| **Schedule** | Daily at 7:00 UTC (12:00 PM PKT) + manual trigger |
| **Email Behavior** | Always emails daily (it IS the meta-monitor). INSTANT alert if any agent missed schedule |
| **GitHub Secrets** | GITHUB_TOKEN (auto), GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, CF_API_TOKEN, CF_ACCOUNT_ID, STRIPE_SECRET_KEY |

**Responsibilities:**
1. Pings all 4 other agents via GitHub Actions API — checks last run time
2. Verifies each agent ran within its expected schedule window
3. Quick site health ping (HTTP status + response time)
4. Quick API endpoint check (webhook health)
5. Stripe revenue pulse (3-day window)
6. **Learning pattern analysis:**
   - Performance trends (response time patterns)
   - Revenue patterns (when first sale happens, traffic correlation)
   - Agent reliability (repeated failures → flag for investigation)
   - System health scoring
7. INSTANT ALERT if any agent missed its schedule or failed

**Agent Schedule Windows (Supervisor checks these):**

| Agent | Expected Schedule | Max Age Before "MISSED" |
|-------|-------------------|------------------------|
| Monitor | Every 12 hours | 14 hours |
| Security | Monday 6:00 UTC | 170 hours (~7 days + 2h) |
| SEO | Wednesday 6:00 UTC | 170 hours |
| PM | Friday 6:00 UTC | 170 hours |
| Supervisor | Daily 7:00 UTC | 26 hours |
| Growth | Daily 8:00 UTC | 26 hours |

---

### Agent 9: Social Agent v2.0 (Puppeteer) ✅ LIVE — BUGS FIXED

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/social-agent.yml` |
| **Script File** | `.github/workflows/scripts/social-agent.js` (~1,600 lines) |
| **Schedule** | Daily at 10:00 UTC (3:00 PM PKT) + manual trigger |
| **Email Behavior** | ALWAYS sends daily report (posts + engagement summary) |
| **GitHub Secrets** | GITHUB_TOKEN (auto), GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, REDDIT_USERNAME, REDDIT_PASSWORD, TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL, PINTEREST_EMAIL, PINTEREST_PASSWORD |
| **Permissions** | `contents: write` (commits brain.json updates) |
| **Latest Commit** | `34be5bc` — All 8 bugs fixed (May 10, 2026) |

**What It Does:**
- Logs into Reddit, Twitter/X, Pinterest via Puppeteer headless browser
- Auto-posts content with human-like typing delays (60-140ms per keystroke)
- Platform rotation — doesn't post to same platform every day
- Daily engagement: likes/saves 5-15 posts per platform, occasional retweets
- Weekly (Mondays): follows 3-5 relevant accounts per platform
- Pinterest: downloads image, uploads to pin creation tool, fills all fields
- Anti-detection: webdriver hidden, Chrome/135 UA, random mouse movements, random scrolls

**Bug Fix History (May 10, 2026):**
8 bugs found and fixed across 2 commits (`6c0aa6e`, `34be5bc`):
1. `isContentUnique()` crash — dict vs array `.some()` (CRITICAL)
2. Reddit `networkidle2` timeout → `domcontentloaded` (CRITICAL)
3. Reddit wrong post tab `post-link-tab` → `post-text-tab` (CRITICAL)
4. `:has-text()` selectors invalid in Puppeteer → text-match iteration (MEDIUM)
5. Pinterest wrong submit button `SignupButton` → submit chain (MEDIUM)
6. Pinterest inverted login check logic (MEDIUM)
7. Outdated Chrome UA `120` → `135` (MINOR)
8. Pinterest no image upload → `downloadPinImage()` + file upload (CRITICAL)

See BG-REMOVER-WORKLOG.md for full details. QA Report: `/download/Social-Agent-Expert-QA-Report.pdf`

**Social Accounts:**
| Platform | Username | Email |
|----------|----------|-------|
| Reddit | AbrardeAhmed | craft@craftedmindss.com |
| Twitter/X | @bg_remover | craft@craftedmindss.com |
| Pinterest | BGRemoverPro (Business) | abrar_a@live.com |

---

### Always-Active Security: Headers

**Headers File:** `_headers` (project root) — CSP is critical, blocks unauthorized scripts/connections

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy:
  script-src: 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com
  connect-src: 'self' https://api.stripe.com https://*.stripe.com https://staticimgly.com
  img-src: 'self' data: blob: https://z-cdn.chatglm.cn
  frame-src: https://js.stripe.com https://hooks.stripe.com
  style-src: 'self' 'unsafe-inline'
  font-src: 'self' https://fonts.gstatic.com
  worker-src: 'self' blob:
```

**CSP domains and WHY they're allowed:**
- `js.stripe.com` — Stripe Checkout JS
- `www.googletagmanager.com` — Google Analytics
- `api.stripe.com`, `*.stripe.com` — Stripe API calls
- `staticimgly.com` — AI model download (ONNX model CDN)
- `z-cdn.chatglm.cn` — Favicon CDN

---

## 3. COMPLETE FILE STRUCTURE

```
ibr-deploy/
├── _headers                                  # CF Pages security headers (CSP + standard headers)
├── .gitignore
├── .github/
│   └── workflows/
│       ├── monitor.yml                       # Monitor Agent (every 12h)
│       ├── security-agent.yml                # Security Agent v2 (weekly Monday)
│       ├── seo-agent.yml                     # SEO Agent v2 (weekly Wednesday)
│       ├── pm-agent.yml                      # PM Agent v2 (weekly Friday)
│       ├── growth-agent.yml                  # Growth Agent v1 (daily 8:00 UTC)
│       ├── supervisor-agent.yml              # Supervisor Agent v2 (daily 7:00 UTC)
│       └── scripts/
│           ├── monitor.js                    # Site monitoring + auto-redeploy
│           ├── security-audit.js             # v2: npm audit, secrets, headers + instant alert
│           ├── seo-check.js                  # v2: meta, sitemap, JSON-LD + instant alert
│           ├── pm-report.js                  # v2: revenue, 6-agent dashboard + instant alert
│           ├── growth-agent.js               # v1: daily growth tracker, Stripe, recommendations
│           └── supervisor.js                 # v2: agent compliance + learning patterns
├── functions/
│   ├── _middleware.ts                        # Rate limiting + UUID validation
│   └── api/
│       ├── create-checkout.ts                # POST /api/create-checkout
│       └── verify-payment.ts                 # GET/POST /api/verify-payment
├── public/
│   ├── favicon.ico                           # Custom branded favicon (16/32/48/64px)
│   ├── favicon.png                           # Custom branded favicon (1024x1024)
│   ├── apple-touch-icon.png                  # iOS home screen icon
│   ├── og-image.png                          # Social media preview (1344x768)
│   ├── robots.txt                            # Search engine rules
│   └── googlec9fe8dd65678b590.html          # GSC verification file
├── src/
│   ├── app/
│   │   ├── globals.css                       # Tailwind 4 + shadcn theme
│   │   ├── layout.tsx                        # Root layout + SEO + GA + JSON-LD + favicon
│   │   ├── page.tsx                          # Main app + footer with legal links
│   │   ├── sitemap.ts                        # Dynamic sitemap (all keyword pages + static)
│   │   ├── privacy-policy/
│   │   │   └── page.tsx                      # Privacy Policy page (craftedminds3@gmail.com)
│   │   └── terms-of-service/
│   │       └── page.tsx                      # Terms of Service page (craftedminds3@gmail.com)
│   ├── components/
│   │   └── ui/
│   │       └── dialog.tsx                    # shadcn/ui Dialog component
│   └── lib/
│       └── utils.ts                          # cn() utility (clsx + twMerge)
├── BG-REMOVER-MASTER-PROMPT.md               # THIS FILE — complete project reference
├── BG-REMOVER-SEO-STRATEGY.md                # SEO strategy (3-phase plan)
├── BG-REMOVER-WORKLOG.md                     # Chronological work log
├── next.config.ts                            # output: "export", reactStrictMode: false
├── package.json                              # Dependencies
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json                             # functions/ excluded from TS check
```

---

## 4. CREDENTIALS & SECRETS — WHERE THEY LIVE

### Cloudflare Pages Environment Variables (set in CF Dashboard)

| Variable | Value | Purpose |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | `sk_live_****...****` (set in CF Dashboard) | Stripe API authentication |
| `STRIPE_PRICE_ID` | `price_1QxGOHP7H2Dn9RlR6KBFM1Ko` | Stripe product price ID |
| `STRIPE_PRODUCT_ID` | `prod_Qw6lTBYWqRxMRy` | Stripe product ID |

### GitHub Actions Secrets (set in GitHub Settings)

| Secret | Used By | Purpose |
|--------|---------|---------|
| `GMAIL_USER` | All 5 agents | Gmail SMTP sender address |
| `GMAIL_APP_PASS` | All 5 agents | Gmail app password |
| `ALERT_EMAIL` | All 5 agents | craftedminds3@gmail.com (all reports go here) |
| `CF_API_TOKEN` | Monitor, PM, Supervisor | Cloudflare API for redeploy + status |
| `CF_ACCOUNT_ID` | Monitor, PM, Supervisor | `a5dff0139652af1d62f80ae1c6f1e9f5` |
| `STRIPE_SECRET_KEY` | PM, Supervisor | Stripe API for revenue data |
| `GITHUB_TOKEN` | Supervisor | Auto-provided by GitHub Actions (for checking agent runs) |

### Third-Party Services

| Service | Status | Details |
|---------|--------|---------|
| **Google Search Console** | ✅ Verified | URL prefix: bgremoverdigital.craftedmindss.com, HTML file verification |
| **Google Analytics** | ✅ Active | ID: G-K1QRPR8ZL9, Timezone: Asia/Karachi, Currency: USD, Industry: Technology |
| **Stripe** | ✅ LIVE | Product: 500 images for $9, Webhook: REMOVED (payments verified via polling) |
| **Cloudflare Pages** | ✅ LIVE | Project: bgremoverdigital, Account: a5dff0139652af1d62f80ae1c6f1e9f5 |

---

## 5. STRIPE PAYMENT FLOW (Complete)

```
User clicks "Buy Now - $9"
    ↓
Frontend: openCheckout() → POST /api/create-checkout { clientRefId }
    ↓
CF Function: create-checkout.ts → Stripe API → Creates Checkout Session
    ↓
Returns: { url: "https://checkout.stripe.com/...", sessionId: "cs_..." }
    ↓
Frontend: Opens popup window (520x720, centered)
    ↓
User pays on Stripe's secure checkout page
    ↓
Stripe redirects user → /?payment=success&session_id=cs_...
    ↓
Frontend: Polls /api/verify-payment (up to 5 times, 2s intervals)
    ↓
CF Function: verify-payment.ts → Stripe API → checks payment_status === 'paid'
    ↓
Frontend: Sets localStorage bg_remover_is_paid = 'true'
    ↓
User gets 500 images unlocked
```

---

## 6. EMAIL SCHEDULE — COMPLETE CROSS-CHECK REFERENCE

All times in UTC. Pakistan = UTC+5.

| Day | 7:00 UTC (12:00 PM PKT) | 6:00 UTC (11:00 AM PKT) | 0:00/12:00 UTC (5:00 AM/PM PKT) |
|-----|------------------------|------------------------|----------------------------------|
| **Every Day** | **Supervisor** daily report | — | **Monitor** health check |
| **Monday** | Supervisor | **Security** weekly report | Monitor |
| **Tuesday** | Supervisor | — | Monitor |
| **Wednesday** | Supervisor | **SEO** weekly report | Monitor |
| **Thursday** | Supervisor | — | Monitor |
| **Friday** | Supervisor | **PM** weekly report | Monitor |
| **Saturday** | Supervisor | — | Monitor |
| **Sunday** | Supervisor | — | **Monitor** weekly "All OK" email |

**INSTANT ALERT RULES (all agents):**
- **Monitor**: Instant on ANY check failure (site down, content missing, etc.)
- **Security**: Instant on CRITICAL/HIGH findings (secrets in code, critical vulns)
- **SEO**: Instant on CRITICAL/HIGH findings + site down
- **PM**: Instant on site DOWN + Stripe API failure
- **Supervisor**: Instant if ANY agent missed its schedule

**ALL-CLEAR RULES (manual dispatch):**
- If all clear and triggered manually → Security/SEO/PM SKIP email (no noise)
- Supervisor ALWAYS emails (daily heartbeat)

---

## 7. ARCHITECTURE DECISIONS & RATIONALE

| Decision | Rationale |
|----------|-----------|
| Static export (`output: "export"`) | FREE hosting on CF Pages, no server costs |
| CF Pages Functions (not external backend) | Same platform, FREE, no cold start issues |
| No KV for payment verification | Calls Stripe API directly, simpler |
| Webhook removed (May 2025) | Missing STRIPE_WEBHOOK_SECRET in CF env; polling works fine without it |
| `reactStrictMode: false` | img.ly runs twice in strict mode — known bug |
| Client-side AI (img.ly) | $0 API costs, privacy (images never leave device) |
| IP rate limiting in middleware | Basic protection; CF WAF for advanced rules |
| 5 agents with instant alerts | Problem found → email immediately, not wait for schedule |
| Supervisor cross-checks agents | If any agent fails silently, Supervisor catches it |
| Daily Supervisor cadence | Owner gets daily heartbeat + pattern analysis |
| CSP allows staticimgly.com | img.ly ONNX model CDN — without this, AI model download is blocked |
| CSP allows googletagmanager.com | GA4 tracking — without this, analytics is blind |
| "third-party AI integration" in legal | Never mention img.ly by name in user-facing content |

---

## 8. BRANDING & LEGAL

| Item | Status | Details |
|------|--------|---------|
| **Favicon** | ✅ Done | `favicon.ico` + `favicon.png` + `apple-touch-icon.png` (blue-to-purple gradient) |
| **OG Image** | ✅ Done | `og-image.png` (1344x768) — social media preview card |
| **Privacy Policy** | ✅ Done | `/privacy-policy` — craftedminds3@gmail.com, no img.ly mention |
| **Terms of Service** | ✅ Done | `/terms-of-service` — full legal coverage, $9 pricing |
| **Footer Links** | ✅ Done | Copyright + Privacy Policy + Terms of Service |
| **Contact Email** | ✅ Done | craftedminds3@gmail.com (legal pages + agent alerts) |

---

## 9. REVENUE TARGETS & KPIs

### Monthly Targets (Aggressive)

| Metric | Month 1 | Month 2 | Month 3 |
|--------|---------|---------|---------|
| **Revenue** | $100+ | $400+ | $1,000+ |
| **Paid Users** | ~12 | ~45 | ~112 |
| **Organic Traffic** | 10/day | 50/day | 200/day |
| **SEO Pages** | 10 | 25 | 50+ |

### Revenue Formula
- Price per user: $9 (one-time)
- Cost per user: $0 (client-side AI, CF Pages free tier)
- Profit margin: ~100% (minus Stripe fees: ~$0.85 per transaction)
- Net per transaction: ~$8.15

---

## 10. PHASE ROADMAP

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Core app (upload, process, download, free/paid tiers)
- [x] Stripe integration (checkout + polling verification, webhook REMOVED)
- [x] Rebranding (IBR-Trap → BG Remover Digital)
- [x] CF Pages deployment (bgremoverdigital.craftedmindss.com)
- [x] Monitor Agent (12h cron, 7 checks, auto-redeploy)
- [x] Security Agent v2 (instant alerts, weekly audit, false-positive fixes)
- [x] SEO Agent v2 (instant alerts, weekly audit)
- [x] PM Agent v2 (instant alerts, revenue tracking, 5-agent dashboard)
- [x] Supervisor Agent v1 (daily health, agent compliance, learning patterns)
- [x] Security headers (CSP with GA + img.ly domains)
- [x] Google Search Console verified (URL prefix: bgremoverdigital.craftedmindss.com)
- [x] Google Analytics integrated (G-K1QRPR8ZL9, CSP fixed)
- [x] Custom favicon + OG image + apple-touch-icon
- [x] Privacy Policy + Terms of Service pages
- [x] Footer with legal links
- [x] Custom domain migration (.pages.dev → .craftedmindss.com)
- [x] 10 programmatic SEO keyword pages (data/keywords.json + dynamic [keyword] route)

### 🔲 Phase 2: Growth (COOKING — Week 2)
- [x] System cooks for 1-2 weeks, all agents run on schedule
- [x] Verify all emails arriving correctly
- [x] GSC property created + sitemap submitted (new domain)
- [ ] Collect baseline GA data (traffic, bounce rate, sessions)
- [ ] GSC starts showing indexation data (10 keyword pages being indexed manually)
- [ ] Week 2 checkpoint: 80%+ of submitted pages indexed
- [ ] Custom 404 page

### 🔲 Phase 3: Content & SEO (Week 3+ — CONDITIONAL on Phase 2 checkpoint)
- [ ] First blog post ("Best Free Background Remover 2026")
- [ ] GA conversion events (full funnel tracking: upload → process → download → paywall → checkout → success)
- [x] Programmatic SEO pages Wave 1 (10 keyword-targeted pages LIVE)
- [ ] Programmatic SEO pages Wave 2 (10 more keywords if checkpoint passes)
- [ ] Social proof elements ("X images processed", testimonials)
- [ ] Email capture mechanism (lead generation)

### 🔲 Phase 4: Scale
- [ ] Programmatic SEO pages Wave 2 (15+ more pages)
- [ ] Blog content (1-2 posts per week)
- [ ] Backlink outreach, directory submissions
- [ ] Domain purchase: bgremoverdigital.com + migration
- [ ] Security Agent v2 (pattern tracking, fingerprinting)
- [ ] PM Agent v3 (revenue dashboards, month-over-month)
- [ ] manifest.json / PWA support
- [ ] A/B testing for conversion optimization

### 🔲 Phase 5: Clone
- [ ] Clone entire system with different branding
- [ ] Estimated time: 30 minutes (all code ready, rebrand + reconfigure)

---

## 11. CURRENT LIMITATIONS & KNOWN ISSUES

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Rate limiting is in-memory only | Medium | Known | Resets per CF worker cold start. CF WAF for advanced |
| No webhook (removed May 2025) | Low | By design | Payments verified via polling /api/verify-payment |
| Agents are rule-based (not ML) | Low | By design | Supervisor monitors patterns, agents act on rules |
| No GA conversion events yet | Medium | Phase 3 | Only pageviews tracked, full funnel tracking planned |
| No custom 404 page | Low | Phase 2 | CF default 404 shows on wrong URLs |
| No social proof or email capture | Medium | Phase 3 | Directly impacts conversion rates |
| No manifest.json (PWA) | Low | Phase 4 | Can't "Add to Home Screen" on mobile |

---

## 12. CLONING THIS PROJECT

**Yes, this system is 100% clonable.** To create a clone (e.g., "ImageBGRemover"):

1. Create new GitHub repo
2. Create new CF Pages project
3. Create new Stripe product + price (get new Price ID)
4. Create new GSC property + GA property
5. Copy all code, change branding + domain references
6. Set new CF env vars (STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_PRODUCT_ID)
7. Set new GitHub secrets (GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, CF_API_TOKEN, CF_ACCOUNT_ID, STRIPE_SECRET_KEY)
8. Deploy

**Estimated time: 30 minutes** — all code is ready, just rebrand + reconfigure.

**NOTE:** No webhook needed. Payments use polling verification only.
