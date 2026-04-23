# BG Remover Digital — MASTER PROMPT (Complete Project Reference)

> **Last Updated:** April 24, 2025
> **Version:** 2.0 — Post-Launch (All Agents Live)
> **Project Owner:** Abrar Ahmed
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

## 2. ALL AGENTS — COMPLETE STATUS

### Agent 1: Monitor Agent ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/monitor.yml` |
| **Script File** | `.github/workflows/scripts/monitor.js` |
| **Schedule** | Every 12 hours (0:00 UTC and 12:00 UTC) + manual trigger |
| **Email Behavior** | Instant alert on ANY failure + weekly OK email on Sundays |
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

### Agent 2: Security Agent ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/security-agent.yml` |
| **Script File** | `.github/workflows/scripts/security-audit.js` |
| **Schedule** | Every Monday at 6:00 UTC + manual trigger |
| **Email Behavior** | Weekly report only (no instant alerts) |
| **GitHub Secrets** | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL |

**6 Checks:**
1. `npm audit` — dependency vulnerability scanning
2. Secret scanning — scans all .ts/.js/.json files for exposed keys:
   - Stripe live/test keys, webhook secrets, publishable keys
   - Google API keys, GitHub PATs, AWS access keys, private keys
3. `.gitignore` audit — ensures .env, .pem, .key patterns are blocked
4. Dependency count review — flags if >20 packages
5. Security headers check — verifies via live site:
   - X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
   - Referrer-Policy, Content-Security-Policy
6. Email report with severity levels (CRITICAL, HIGH, MEDIUM, LOW)

**Limitations (Phase 1):**
- Static checks only — does NOT learn patterns or track trends
- In-memory rate limiting resets per CF worker cold start
- No fingerprinting or behavioral analysis yet
- Secret scanning is pattern-based, not semantic

---

### Agent 3: SEO Agent ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/seo-agent.yml` |
| **Script File** | `.github/workflows/scripts/seo-check.js` |
| **Schedule** | Every Wednesday at 6:00 UTC + manual trigger |
| **Email Behavior** | Weekly report only (no instant alerts) |
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

### Agent 4: PM Agent ✅ LIVE

| Detail | Value |
|--------|-------|
| **Workflow File** | `.github/workflows/pm-agent.yml` |
| **Script File** | `.github/workflows/scripts/pm-report.js` |
| **Schedule** | Every Friday at 6:00 UTC + manual trigger |
| **Email Behavior** | Weekly report only |
| **GitHub Secrets** | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL, CF_API_TOKEN, CF_ACCOUNT_ID, STRIPE_SECRET_KEY |

**Report Contents:**
1. Site health: uptime, response time, content verification
2. Stripe revenue: 7-day transactions, total revenue, unique customers
3. CF deployment status: latest deployment ID and status
4. Agent status dashboard: all 4 agents with schedule and status
5. Actionable recommendations based on revenue and performance data
6. KPI cards in HTML email

**Revenue Data Source:**
- Calls Stripe API directly: `GET /v1/checkout/sessions?created[gte]=<7_days_ago>&payment_status=paid`
- Shows individual transactions with date, email, amount
- Uses the full Stripe secret key from GitHub secrets

---

### Always-Active Security: Middleware + Headers

**Middleware File:** `functions/_middleware.ts`
- Runs BEFORE every `/api/*` request
- IP-based rate limiting (in-memory, per CF worker instance):
  - create-checkout: 5 req/min/IP
  - verify-payment: 30 req/min/IP
  - webhook: 100 req/min/IP
  - default: 60 req/min/IP
- UUID format validation on clientRefId
- Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Logs warnings when rate limit nearly exceeded

**Headers File:** `_headers` (project root)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://api.stripe.com https://*.stripe.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; worker-src 'self' blob:;

---

## 3. COMPLETE FILE STRUCTURE

```
ibr-deploy/
├── _headers                                  # CF Pages security headers (always active)
├── .gitignore
├── .github/
│   └── workflows/
│       ├── monitor.yml                       # Monitor Agent (every 12h)
│       ├── security-agent.yml                # Security Agent (weekly Monday)
│       ├── seo-agent.yml                     # SEO Agent (weekly Wednesday)
│       ├── pm-agent.yml                      # PM Agent (weekly Friday)
│       └── scripts/
│           ├── monitor.js                    # 317 lines — site monitoring
│           ├── security-audit.js             # ~200 lines — security scanning
│           ├── seo-check.js                  # ~250 lines — SEO auditing
│           └── pm-report.js                  # ~250 lines — PM reporting
├── functions/
│   ├── _middleware.ts                        # Rate limiting + security (always active)
│   └── api/
│       ├── create-checkout.ts                # POST /api/create-checkout
│       ├── verify-payment.ts                 # GET/POST /api/verify-payment
│       └── webhook.ts                        # POST/GET /api/webhook
├── public/
│   ├── robots.txt                            # Search engine rules
│   ├── sitemap.xml                           # XML sitemap
│   └── googlec9fe8dd65678b590.html          # GSC verification file
├── src/
│   ├── app/
│   │   ├── globals.css                       # Tailwind 4 + shadcn theme
│   │   ├── layout.tsx                        # Root layout + full SEO + GA + JSON-LD
│   │   └── page.tsx                          # Main app (731 lines, all-in-one)
│   ├── components/
│   │   └── ui/
│   │       └── dialog.tsx                    # shadcn/ui Dialog component
│   └── lib/
│       └── utils.ts                          # cn() utility (clsx + twMerge)
├── BG-REMOVER-MASTER-PROMPT.md               # THIS FILE — complete project reference
├── BG-REMOVER-SEO-STRATEGY.md                # SEO strategy (3-phase plan)
├── BG-REMOVER-WORKLOG.md                     # Chronological work log
├── next.config.ts                            # output: "export", reactStrictMode: false
├── package.json                              # 12 prod deps, 5 dev deps
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json                             # functions/ excluded from TS check
```

---

## 4. CREDENTIALS & SECRETS — WHERE THEY LIVE

### Cloudflare Pages Environment Variables (set in CF Dashboard)

| Variable | Value | Purpose |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | `sk_live_****...****` | Stripe API authentication (set in CF Dashboard) |
| `STRIPE_PRICE_ID` | `price_...` (set in CF) | Stripe product price ID |
| `STRIPE_WEBHOOK_SECRET` | `whsec_****...****` | Webhook signature verification |
| `SITE_URL` | `https://bgremoverdigital.pages.dev` | Base URL for redirects |

### GitHub Actions Secrets (set in GitHub Settings)

| Secret | Used By | Purpose |
|--------|---------|---------|
| `GMAIL_USER` | All 4 agents | Gmail SMTP sender address |
| `GMAIL_APP_PASS` | All 4 agents | Gmail app password |
| `ALERT_EMAIL` | All 4 agents | Report recipient email |
| `CF_API_TOKEN` | Monitor, PM | Cloudflare API for redeploy + status |
| `CF_ACCOUNT_ID` | Monitor, PM | Cloudflare account ID |
| `STRIPE_SECRET_KEY` | PM Agent | Stripe API for revenue data |

### Third-Party Services

| Service | Status | Details |
|---------|--------|---------|
| **Google Search Console** | ✅ Verified | URL prefix: bgremoverdigital.pages.dev |
| **Google Analytics** | ✅ Active | Measurement ID: G-K1QRPR8ZL9, Timezone: Asia/Karachi, Currency: USD |
| **Stripe** | ✅ LIVE | Product: 500 images for $9, Webhook: checkout.session.completed |

**IMPORTANT:** Stripe keys are in CF env vars AND GitHub secrets (PM Agent needs it for revenue reports). GSC uses HTML file verification (public/googlec9fe8dd65678b590.html). GA uses gtag.js in layout.tsx head.

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

**Key Points:**
- Payment verification is SERVER-SIDE via Stripe API (no localStorage loophole)
- Webhook exists so Stripe doesn't retry, but actual verification is API-based
- No CF KV dependency — simpler architecture
- clientRefId (UUID) stored in localStorage for tracking

---

## 6. ARCHITECTURE DECISIONS & RATIONALE

| Decision | Rationale |
|----------|-----------|
| Static export (`output: "export"`) | FREE hosting on CF Pages, no server costs |
| CF Pages Functions (not external backend) | Same platform, FREE, no cold start issues |
| No KV for payment verification | v2 design — calls Stripe API directly, simpler |
| `reactStrictMode: false` | img.ly runs twice in strict mode — known bug |
| Client-side AI (img.ly) | $0 API costs, privacy (images never leave device) |
| IP rate limiting in middleware | Basic protection; CF WAF for advanced rules |
| Weekly agent cadence | Mon=Security, Wed=SEO, Fri=PM — spreads load, avoids overlap |
| 12h monitor checks | Fast detection of downtime + auto-redeploy |
| gtag.js for GA (not next/script) | Static export can't use Next.js script optimization |

---

## 7. EMAIL SCHEDULE — WHAT TO EXPECT

| Day | What Arrives | From Agent |
|-----|-------------|------------|
| **Sunday** | Weekly OK report (if all checks pass) | Monitor |
| **Any day** | INSTANT alert if site goes down or checks fail | Monitor |
| **Monday 6:00 UTC** | Security audit report (npm audit, secrets, headers) | Security |
| **Wednesday 6:00 UTC** | SEO audit report (meta, sitemap, structured data) | SEO |
| **Friday 6:00 UTC** | PM report (revenue, health, agent status, recommendations) | PM |

**Note for Pakistan (UTC+5):** All agent times are UTC. Monday 6:00 UTC = Monday 11:00 AM Pakistan time.

**Known Gap:** If an agent's cron job FAILS silently (GitHub Actions issue), no alert is sent. Currently, the owner must manually verify that weekly emails arrive. A "meta-monitor" for agent health is planned for Phase 2.

---

## 8. CURRENT LIMITATIONS & KNOWN ISSUES

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Rate limiting is in-memory only | Medium | Known | Resets per CF worker cold start. Advanced protection needs CF WAF rules |
| Agents are static (no learning) | Medium | Phase 2 | They run same checks each week, no trend analysis or pattern recognition |
| No agent health monitoring | Medium | Planned | If a cron fails silently, nobody knows. Need meta-monitor |
| CF Pages `_headers` partially applied | Low | Known | Some headers only apply to API routes, not static pages. CF managed headers take precedence |
| No OG image yet | Low | Pending | og-image.png referenced in meta tags but file doesn't exist yet |
| Paywall uses localStorage for initial check | Low | Known | Server verification happens on mount + after payment, so loophole is minimal |
| Only 1 page (no programmatic SEO pages) | Medium | Phase 2 | SEO strategy has 25+ pages planned |
| No tests | Low | Planned | Zero test files. Add when scaling |

---

## 9. REVENUE TARGETS & KPIs

### Monthly Targets (Aggressive)

| Metric | Month 1 | Month 2 | Month 3 |
|--------|---------|---------|---------|
| **Revenue** | $100+ | $400+ | $1,000+ |
| **Paid Users** | ~12 | ~45 | ~112 |
| **Organic Traffic** | 10/day | 50/day | 200/day |
| **SEO Pages** | 10 | 25 | 50+ |
| **Google Rankings (top 10)** | 2 keywords | 5 keywords | 15 keywords |

### Revenue Formula
- Price per user: $9 (one-time)
- Cost per user: $0 (client-side AI, CF Pages free tier)
- Profit margin: ~100% (minus Stripe fees: $0.59 + 2.9% = ~$0.85 per transaction)
- Net per transaction: ~$8.15

---

## 10. PHASE ROADMAP

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Core app (upload, process, download, free/paid tiers)
- [x] Stripe integration (checkout, verification, webhook)
- [x] Rebranding (IBR-Trap → BG Remover Digital)
- [x] CF Pages deployment (bgremoverdigital.pages.dev)
- [x] Monitor Agent (12h cron, 7 checks, auto-redeploy)
- [x] Security Agent v1 (weekly audit, secret scanning, headers)
- [x] SEO Agent v1 (meta, sitemap, JSON-LD, OG, Twitter)
- [x] PM Agent v1 (weekly revenue report, agent dashboard)
- [x] Security middleware (rate limiting, UUID validation)
- [x] Security headers (CSP, X-Frame-Options, etc.)
- [x] Google Search Console verified
- [x] Google Analytics integrated (G-K1QRPR8ZL9)
- [x] Stripe webhook configured

### 🔲 Phase 2: Growth (NEXT)
- [ ] Agent health meta-monitor (verify all agents are actually running)
- [ ] OG image generation (1200x630px for social sharing)
- [ ] Programmatic SEO pages Wave 1 (10 keyword-targeted pages)
- [ ] Submit sitemap to GSC manually
- [ ] Advanced CF WAF rate limiting rules
- [ ] Security Agent v2 (pattern tracking, fingerprinting)
- [ ] Domain purchase: bgremoverdigital.com + migration

### 🔲 Phase 3: Scale
- [ ] Programmatic SEO pages Wave 2 (15 more pages)
- [ ] Blog content (5 SEO-optimized articles)
- [ ] SEO Phase C: backlink outreach, directory submissions
- [ ] PM Agent v2: trend analysis, month-over-month comparisons
- [ ] Dynamic agent learning (store historical data, detect anomalies)
- [ ] Server-side API option (remove.bg/Adobe for higher quality)
- [ ] A/B testing for conversion optimization

---

## 11. CLONING THIS PROJECT

**Yes, this system is 100% clonable for other products.** To create a clone (e.g., "ImageBGRemover"):

1. Create new GitHub repo
2. Create new CF Pages project
3. Create new Stripe product + price (get new Price ID)
4. Create new Stripe webhook (get new whsec secret)
5. Create new GSC property + GA property
6. Copy all code, change branding
7. Set new CF env vars (STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, SITE_URL)
8. Set new GitHub secrets
9. Deploy

**Estimated time: 30 minutes** — all code is ready, just rebrand + reconfigure.

---

## 12. GIT COMMIT HISTORY (All 10 Commits)

| # | Hash | Message |
|---|------|---------|
| 10 | 2bb2421 | Add Google Analytics tracking (G-K1QRPR8ZL9) |
| 9 | c4123f3 | Add Google Search Console verification file |
| 8 | 25cfadf | Update worklog with deployment verification results |
| 7 | 9ef7269 | Deploy all 4 agents: Security, SEO, PM, Monitor + headers + docs |
| 6 | 84a2e84 | Force rebuild: refresh CF Pages Functions |
| 5 | 2bf2b4b | Stripe v2: API-based payment verification (no KV dependency) |
| 4 | 9542914 | Fix verify-payment: use single onRequest handler for all methods |
| 3 | 950526f | Exclude functions/ from TypeScript build check |
| 2 | 811d226 | Stripe integration: replace Lemon Squeezy with server-validated payments |
| 1 | ec18710 | Rebrand: IBR-Trap → BG Remover Digital, domain bgremoverdigital.pages.dev |
