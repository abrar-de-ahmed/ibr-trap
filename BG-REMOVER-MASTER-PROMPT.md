# BG Remover Digital — MASTER PROMPT (Complete Project Reference)

> **Last Updated:** April 24, 2026
> **Version:** 3.0 — All 5 Agents Live + Legal + Branding Complete
> **Project Owner:** Abrar Ahmed
> **Contact Email:** craftedminds3@gmail.com
> **Project:** BG Remover Digital (formerly IBR-Trap)
> **Live URL:** https://bgremoverdigital.pages.dev
> **Future Domain:** https://bgremoverdigital.com (planned, not purchased yet)
> **GitHub:** https://github.com/abrar-de-ahmed/ibr-trap
> **Branch:** main (only branch)

---

## 0. HANDOFF INSTRUCTIONS — READ FIRST

If this is a new chat session, the AI assistant should:

1. Read this entire file to understand the full project context
2. Check the live site at https://bgremoverdigital.pages.dev to verify it's working
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

## 2. ALL 5 AGENTS — COMPLETE STATUS

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

### Agent 5: Supervisor Agent v1 ✅ LIVE

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
│       ├── supervisor-agent.yml              # Supervisor Agent v1 (daily 7:00 UTC)
│       └── scripts/
│           ├── monitor.js                    # Site monitoring + auto-redeploy
│           ├── security-audit.js             # v2: npm audit, secrets, headers + instant alert
│           ├── seo-check.js                  # v2: meta, sitemap, JSON-LD + instant alert
│           ├── pm-report.js                  # v2: revenue, 5-agent dashboard + instant alert
│           └── supervisor.js                 # v1: agent compliance + learning patterns
├── functions/
│   ├── _middleware.ts                        # Rate limiting + UUID validation
│   └── api/
│       ├── create-checkout.ts                # POST /api/create-checkout
│       ├── verify-payment.ts                 # GET/POST /api/verify-payment
│       └── webhook.ts                        # POST/GET /api/webhook
├── public/
│   ├── favicon.ico                           # Custom branded favicon (16/32/48/64px)
│   ├── favicon.png                           # Custom branded favicon (1024x1024)
│   ├── apple-touch-icon.png                  # iOS home screen icon
│   ├── og-image.png                          # Social media preview (1344x768)
│   ├── robots.txt                            # Search engine rules
│   ├── sitemap.xml                           # XML sitemap
│   └── googlec9fe8dd65678b590.html          # GSC verification file
├── src/
│   ├── app/
│   │   ├── globals.css                       # Tailwind 4 + shadcn theme
│   │   ├── layout.tsx                        # Root layout + SEO + GA + JSON-LD + favicon
│   │   ├── page.tsx                          # Main app (~650 lines, all-in-one) + footer with legal links
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
| `STRIPE_WEBHOOK_SECRET` | `whsec_****...****` (set in CF Dashboard) | Webhook signature verification |

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
| **Google Search Console** | ✅ Verified | URL prefix: bgremoverdigital.pages.dev, HTML file verification |
| **Google Analytics** | ✅ Active | ID: G-K1QRPR8ZL9, Timezone: Asia/Karachi, Currency: USD, Industry: Technology |
| **Stripe** | ✅ LIVE | Product: 500 images for $9, Webhook: checkout.session.completed only |
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
Stripe sends webhook → POST /api/webhook (signature verified via HMAC-SHA256)
    ↓
Stripe redirects user → /?payment=success&session_id=cs_...
    ↓
Frontend: Polls verify-payment (up to 5 times, 2s intervals)
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
| No KV for payment verification | v2 design — calls Stripe API directly, simpler |
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
- [x] Stripe integration (checkout, verification, webhook)
- [x] Rebranding (IBR-Trap → BG Remover Digital)
- [x] CF Pages deployment (bgremoverdigital.pages.dev)
- [x] Monitor Agent (12h cron, 7 checks, auto-redeploy)
- [x] Security Agent v2 (instant alerts, weekly audit)
- [x] SEO Agent v2 (instant alerts, weekly audit)
- [x] PM Agent v2 (instant alerts, revenue tracking, 5-agent dashboard)
- [x] Supervisor Agent v1 (daily health, agent compliance, learning patterns)
- [x] Security headers (CSP with GA + img.ly domains)
- [x] Google Search Console verified (HTML file)
- [x] Google Analytics integrated (G-K1QRPR8ZL9, CSP fixed)
- [x] Stripe webhook configured (checkout.session.completed)
- [x] Custom favicon + OG image + apple-touch-icon
- [x] Privacy Policy + Terms of Service pages
- [x] Footer with legal links

### 🔲 Phase 2: Growth (COOKING — Week 1-2)
- [ ] System cooks for 1-2 weeks, all agents run on schedule
- [ ] Verify all emails arriving correctly
- [ ] Collect baseline GA data (traffic, bounce rate, sessions)
- [ ] GSC starts showing indexation data
- [ ] Submit sitemap to GSC manually (if not auto-discovered)
- [ ] Custom 404 page

### 🔲 Phase 3: Content & SEO (Week 3+)
- [ ] First blog post (Week 3 — "Best Free Background Remover 2026")
- [ ] GA conversion events (full funnel tracking: upload → process → download → paywall → checkout → success)
- [ ] Programmatic SEO pages Wave 1 (10 keyword-targeted pages)
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
4. Create new Stripe webhook (get new whsec secret)
5. Create new GSC property + GA property
6. Copy all code, change branding
7. Set new CF env vars (STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET)
8. Set new GitHub secrets (GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, CF_API_TOKEN, CF_ACCOUNT_ID, STRIPE_SECRET_KEY)
9. Deploy

**Estimated time: 30 minutes** — all code is ready, just rebrand + reconfigure.
