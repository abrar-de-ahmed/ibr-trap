# BG Remover Digital — SEO Strategy

> **Last Updated:** May 9, 2026
> **Status:** Phase A COMPLETE — Phase B IN PROGRESS (indexing phase) — **GA Growth Agents ACTIVE**
> **Live URL:** https://bgremoverdigital.craftedmindss.com
> **Target Keywords:** background remover, remove background, free background remover

---

## GA Growth Agent Army — ACTIVE ✅

4 GA-powered agents deployed May 9, 2026 to automate SEO growth:

| Agent | Schedule | File | Role |
|-------|----------|------|------|
| **Growth Agent v2** | Daily 8:00 UTC | `growth-agent.yml` | SEO intelligence, keyword pages, competitor analysis, Sunday evolution |
| **Content Agent** | Mon/Wed/Fri 9:00 UTC | `content-agent.yml` | Blog articles (800-1500 words), title A/B testing, FAQ content |
| **Social Agent** | Daily 10:00 UTC | `social-agent.yml` | Content for Reddit, Twitter/X, Pinterest, Medium |
| **Directory Agent** | Weekly Sunday 11:00 UTC | `directory-agent.yml` | Directory submissions, profile backlinks, Web 2.0 content |

**Shared Intelligence:**
- `data/brain.json` — All agents read/write shared performance memory
- `data/config.json` — Behavior config with mitigation rules (Week 1-4 speed limits)

**Safety:**
- Emergency brake: 3+ deindexed pages → all creation stops + email alert
- Mitigation: Week 1 (2 pages/day) → Week 2 (3) → Week 3 (5) → Week 4 (7)
- 80/20 rule: 80% proven strategies, 20% experiments
- Sunday evolution: Growth Agent reviews data, rewrites config.json

---

## Phase A: Technical SEO Foundation — COMPLETE ✅

- [x] robots.txt with sitemap declaration
- [x] Dynamic sitemap (`src/app/sitemap.ts` — 13 URLs: homepage + 10 keyword pages + privacy + terms)
- [x] JSON-LD structured data (SoftwareApplication + WebApplication schemas)
- [x] Open Graph meta tags (og:title, og:description, og:image, og:url)
- [x] Twitter Card meta tags (summary_large_image)
- [x] Canonical URL on homepage (via metadataBase)
- [x] Comprehensive meta description (120-155 chars)
- [x] Title tag optimized (40-60 chars)
- [x] Security headers (CSP, X-Frame-Options, etc.)
- [x] SEO Agent cron for ongoing monitoring (every Wednesday)
- [x] Google Search Console verified (URL prefix: bgremoverdigital.craftedmindss.com)
- [x] Google Analytics integrated (G-K1QRPR8ZL9)
- [x] OG image (og-image.png)
- [x] Custom domain live (bgremoverdigital.craftedmindss.com)
- [x] Sitemap submitted to GSC (https://bgremoverdigital.craftedmindss.com/sitemap.xml)

---

## Phase B: Content & On-Page SEO — IN PROGRESS

### Wave 1: Programmatic SEO Pages — 10 Pages LIVE ✅

All 10 keyword-targeted pages are deployed under `/remove-background/[keyword]` with:
- Unique H1, intro, why_matters sections, how_to_steps, FAQs
- Related keyword internal linking
- Generated from `data/keywords.json` + dynamic route `src/app/remove-background/[keyword]/page.tsx`

| # | Slug | Target Keyword | Status |
|---|------|---------------|--------|
| 1 | product-photos | background remover for product photos | ✅ Live, indexing |
| 2 | shoes | remove background from shoes | ✅ Live, indexing |
| 3 | jewelry | background remover for jewelry | ✅ Live, indexing |
| 4 | clothing | remove background from clothing | ✅ Live, indexing |
| 5 | watches | background remover for watches | ✅ Live, indexing |
| 6 | electronics | remove background from electronics | ✅ Live, indexing |
| 7 | amazon-listings | background remover for Amazon listings | ✅ Live, indexing |
| 8 | etsy-shop | background remover for Etsy shop | ✅ Live, indexing |
| 9 | ebay-photos | remove background for eBay photos | ✅ Live, indexing |
| 10 | shopify-store | background remover for Shopify store | ✅ Live, indexing |

### GSC Indexing Progress
- User is manually indexing 2-3 pages per day in GSC (Request Indexing)
- Indexed through jewelry (first ~6 keywords as of May 5)
- Remaining 3-4 keywords being submitted this week
- Sitemap status: "Couldn't fetch" — normal for new domain, will resolve in 3-7 days

### Week 2 Checkpoint (CRITICAL GATE)
- **Trigger:** After all 10 pages submitted + 5-7 days wait
- **Pass criteria:** 80%+ of pages indexed in GSC
- **If PASS:** Proceed to Phase C (Wave 2 keywords + blog #1)
- **If FAIL:** Wait longer, diagnose issues, re-submit

---

## Phase C: Content Scaling (Week 3+ — CONDITIONAL)

### Wave 2: 10 More Keyword Pages (if checkpoint passes)
- Additional ecommerce/product-related keywords
- Generated same way via keywords.json expansion

### Blog Content
- [ ] Blog #1: "Best Free Background Remover 2026"
- [ ] Blog #2: "How to Remove Image Backgrounds Without Photoshop"
- [ ] Blog #3: "AI Background Removal for E-commerce: Complete Guide"
- Target: 1-2 blog posts per week after checkpoint passes

### GA Conversion Events (full funnel)
- Upload → Process → Download → Paywall → Checkout → Success

### Social Proof & Lead Gen
- [ ] "X images processed" counter
- [ ] Testimonials section
- [ ] Email capture mechanism

---

## Phase D: Authority Building (Month 2+)

### Backlink Strategy
- Submit to tool directories (Product Hunt, There's A Tool For That, etc.)
- Guest posts on design/photography blogs
- Community engagement (Reddit, forums — monitor mentions)
- Resource page link building

### Technical SEO Advancement
- Brotli compression via CF
- Advanced caching headers
- Core Web Vitals monitoring via CrUX API

### Content Scaling
- Monthly blog posts (2-4 per month)
- Programmatic pages based on search trends
- Video content (screen recordings + AI voiceover)

---

## Sandbox-Friendly Pacing

To avoid Google's sandbox penalty for new domains:
- Month 1: 1-2 pages per week (slow and natural) — CURRENT
- Month 2: 2-3 pages per week
- Month 3+: Scale up based on GSC data

**Do NOT:**
- Mass-submit 50 pages in one day
- Use aggressive link building
- Keyword stuff or use hidden text
- Buy backlinks

---

## Tracking & KPIs

| Metric | Month 1 Target | Month 2 Target | Month 3 Target |
|--------|---------------|---------------|---------------|
| Organic impressions (GSC) | 1,000 | 5,000 | 25,000 |
| Organic clicks (GSC) | 50 | 200 | 1,000 |
| Organic sessions/day | 5 | 25 | 100 |
| Rankings (top 10) | 2 keywords | 5 keywords | 15 keywords |
| Revenue | $50+ | $200+ | $500+ |

---

## SEO Agent Automated Checks

The SEO Agent runs every Wednesday and checks:
- Title tag (length, keyword presence)
- Meta description (length, completeness)
- Viewport meta tag
- Canonical URL
- Open Graph tags
- Twitter Card
- JSON-LD structured data
- robots.txt (accessibility, sitemap, no accidental blocks)
- sitemap.xml (URL count, domain, lastmod)
- HTML size and script count
