# BG Remover Digital — Master Agent Prompt

> **Last Updated:** April 24, 2025
> **Project:** BG Remover Digital (formerly IBR-Trap)
> **Live URL:** https://bgremoverdigital.pages.dev
> **Future Domain:** https://bgremoverdigital.com
> **GitHub:** https://github.com/abrar-de-ahmed/ibr-trap

---

## 1. Project Overview

BG Remover Digital is an AI-powered background image removal web app. Users upload images, the browser-side `@imgly/background-removal` library removes backgrounds using ONNX Runtime. Free tier: 2 images. Paid tier: 500 images for $9 one-time via Stripe.

**Tech Stack:**
- Next.js 16 + React 19 + TypeScript (static export, `output: "export"`)
- Tailwind CSS 4 + shadcn/ui
- `@imgly/background-removal` v1.7 (client-side AI, no API key needed)
- Cloudflare Pages (hosting + CF Pages Functions for API)
- Stripe (payment processing)

**Key Configuration:**
- `reactStrictMode: false` — deliberate, prevents img.ly double-invocation
- All CF env vars set via Cloudflare API (never in code)
- `functions/` excluded from TypeScript build check

---

## 2. Agents — Status & Architecture

### Agent 1: Monitor Agent (Cron — Every 12 Hours)

**File:** `.github/workflows/monitor.yml` + `.github/workflows/scripts/monitor.js`
**Schedule:** Every 12 hours (0:00 UTC and 12:00 UTC)
**GitHub Secrets Required:** `GMAIL_USER`, `GMAIL_APP_PASS`, `ALERT_EMAIL`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`

**What It Does:**
- Runs 7 checks: HTTP status, page title, upload zone, CTA button, buy CTA, response time, SSL
- Smart diagnosis engine with severity levels (CRITICAL, HIGH, MEDIUM, LOW)
- Auto-fix: Triggers CF redeployment for server errors, 404s, missing content
- Post-fix verification: Waits 90s, re-runs all checks
- Email alerts on failure, weekly OK report on Sundays

### Agent 2: Security Agent (Cron — Weekly Monday 6:00 UTC)

**File:** `.github/workflows/security-agent.yml` + `.github/workflows/scripts/security-audit.js`
**Schedule:** Every Monday at 6:00 UTC
**GitHub Secrets Required:** `GMAIL_USER`, `GMAIL_APP_PASS`, `ALERT_EMAIL`

**What It Does:**
- `npm audit` — checks for dependency vulnerabilities
- Secret scanning — scans source code for exposed keys (Stripe, GitHub, AWS, Google, private keys)
- `.gitignore` audit — ensures sensitive file patterns are blocked
- Dependency count review — flags excessive dependencies
- Security headers check — verifies X-Frame-Options, CSP, X-Content-Type-Options via live site
- Sends weekly email report with severity levels and recommendations

### Agent 3: SEO Agent (Cron — Weekly Wednesday 6:00 UTC)

**File:** `.github/workflows/seo-agent.yml` + `.github/workflows/scripts/seo-check.js`
**Schedule:** Every Wednesday at 6:00 UTC
**GitHub Secrets Required:** `GMAIL_USER`, `GMAIL_APP_PASS`, `ALERT_EMAIL`

**What It Does:**
- Title tag analysis (length, keyword presence)
- Meta description analysis (length, completeness)
- Viewport meta check
- Canonical URL verification
- Open Graph tags check (og:title, og:description, og:image, og:url)
- Twitter Card verification
- JSON-LD structured data check
- robots.txt validation (accessibility, sitemap declaration, no accidental Disallow: /)
- sitemap.xml validation (URL count, domain match, lastmod presence)
- Performance hints (HTML size, script count)
- Sends weekly email report with pass/fail for each check

### Agent 4: PM Agent (Cron — Weekly Friday 6:00 UTC)

**File:** `.github/workflows/pm-agent.yml` + `.github/workflows/scripts/pm-report.js`
**Schedule:** Every Friday at 6:00 UTC
**GitHub Secrets Required:** `GMAIL_USER`, `GMAIL_APP_PASS`, `ALERT_EMAIL`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `STRIPE_SECRET_KEY`

**What It Does:**
- Site health check (uptime, response time, content verification)
- Stripe revenue data: transactions, revenue, unique customers (last 7 days)
- CF deployment status: latest deployment, deployment ID
- Agent status dashboard: shows all 4 agents with their schedule and current status
- Actionable recommendations based on revenue and performance
- Sends comprehensive weekly email report with KPI cards

### Security Middleware (Always Active — CF Pages Function)

**File:** `functions/_middleware.ts`
**Runs:** On every `/api/*` request (before the handler)

**What It Does:**
- IP-based rate limiting (in-memory, per CF worker instance)
  - `create-checkout`: 5 req/min per IP
  - `verify-payment`: 30 req/min per IP
  - `webhook`: 100 req/min per IP
  - Default: 60 req/min per IP
- `clientRefId` UUID format validation on checkout requests
- Rate limit headers on all API responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- Suspicious activity logging (when rate limit nearly exceeded)

### Security Headers (Always Active — CF Pages)

**File:** `_headers` (project root)
**Applied by:** Cloudflare Pages automatically

**Headers:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` (allows self, Stripe JS, data URIs, blob URIs)

---

## 3. File Structure

```
ibr-deploy/
├── _headers                              # CF Pages security headers
├── .gitignore
├── .github/
│   └── workflows/
│       ├── monitor.yml                   # Monitor Agent (every 12h)
│       ├── security-agent.yml            # Security Agent (weekly Monday)
│       ├── seo-agent.yml                 # SEO Agent (weekly Wednesday)
│       ├── pm-agent.yml                  # PM Agent (weekly Friday)
│       └── scripts/
│           ├── monitor.js                # Site monitoring script
│           ├── security-audit.js         # Security audit script
│           ├── seo-check.js              # SEO audit script
│           └── pm-report.js              # PM report script
├── functions/
│   ├── _middleware.ts                    # Rate limiting + security middleware
│   └── api/
│       ├── create-checkout.ts            # Stripe checkout session creator
│       ├── verify-payment.ts             # Stripe payment verifier (API-based)
│       └── webhook.ts                    # Stripe webhook receiver
├── public/
│   ├── robots.txt                        # Search engine crawler rules
│   └── sitemap.xml                       # XML sitemap
├── src/
│   ├── app/
│   │   ├── globals.css                   # Tailwind + shadcn theme
│   │   ├── layout.tsx                    # Root layout + SEO meta + JSON-LD
│   │   └── page.tsx                      # Main app (731 lines)
│   ├── components/
│   │   └── ui/
│   │       └── dialog.tsx                # shadcn/ui Dialog
│   └── lib/
│       └── utils.ts                      # cn() utility
├── BG-REMOVER-MASTER-PROMPT.md           # This file
├── BG-REMOVER-SEO-STRATEGY.md            # SEO strategy document
├── BG-REMOVER-WORKLOG.md                 # Work log
├── next.config.ts                        # Static export config
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. Cloudflare Pages Environment Variables

| Variable | Purpose | Where Set |
|----------|---------|-----------|
| `STRIPE_SECRET_KEY` | Stripe API authentication | CF Dashboard or API |
| `STRIPE_PRICE_ID` | Price ID for the $9 product | CF Dashboard or API |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | CF Dashboard or API |
| `SITE_URL` | Base URL for success/cancel redirects | CF Dashboard or API |

**NEVER commit these to git.** They are set via Cloudflare Pages environment variables.

---

## 5. GitHub Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `GMAIL_USER` | All agents | Gmail address for sending reports |
| `GMAIL_APP_PASS` | All agents | Gmail app password for SMTP |
| `ALERT_EMAIL` | All agents | Recipient email for reports |
| `CF_API_TOKEN` | Monitor, PM | Cloudflare API token for redeployment/status |
| `CF_ACCOUNT_ID` | Monitor, PM | Cloudflare account ID |
| `STRIPE_SECRET_KEY` | PM Agent | Stripe API key for revenue data |

---

## 6. Stripe Configuration

- **Product:** Background Image Remover — 500 Images
- **Price:** $9.00 USD (one-time payment)
- **Mode:** payment (not subscription)
- **Webhook Events:** `checkout.session.completed`
- **Webhook URL:** `https://bgremoverdigital.pages.dev/api/webhook`
- **Success URL:** `https://bgremoverdigital.pages.dev/?payment=success&session_id={CHECKOUT_SESSION_ID}`
- **Cancel URL:** `https://bgremoverdigital.pages.dev/?payment=cancelled`

---

## 7. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Static export + CF Functions | $0 hosting, no server to maintain, CF Functions for API needs |
| No KV for payment verification | v2 design calls Stripe API directly — simpler, no extra dependency |
| `reactStrictMode: false` | img.ly double-invocation in strict mode |
| Client-side AI | No API costs, privacy-friendly (images never leave user's device) |
| IP rate limiting in middleware | Basic protection layer; Cloudflare WAF for advanced rules |
| Weekly agent cadence | Monday=Security, Wednesday=SEO, Friday=PM — spreads load |

---

## 8. Pending Tasks

### Requires User Action
- [ ] Google Search Console: Add property, verify with HTML tag, provide verification code
- [ ] Google Analytics: Create property, provide Measurement ID (G-XXXXXXX)
- [ ] Stripe Webhook: Add endpoint, provide webhook secret (whsec_XXXXXXX)

### Phase 2 — Growth
- [ ] Programmatic SEO pages (10-15 keyword-targeted pages)
- [ ] OG image generation (1200x630px for social sharing)
- [ ] Domain migration to bgremoverdigital.com
- [ ] Google Analytics integration
- [ ] Advanced Cloudflare WAF rate limiting rules

### Phase 3 — Scale
- [ ] Security Agent v2: Pattern learning, fingerprinting
- [ ] SEO Phase C: 20-30 pages, backlink outreach
- [ ] Server-side API option (remove.bg/Adobe for quality)
- [ ] PM Agent v2: Monthly automated business report
