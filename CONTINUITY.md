# BG Remover Digital — Continuity Prompt

> **Purpose:** Paste this prompt in a new chat session to continue the project seamlessly.
> **Last Updated:** May 10, 2026 (Session 4 — Charlie v2 fix)

---

```
Continue project: BG Remover Digital Growth Agent Army.

GitHub PAT: [provide your GitHub PAT when starting new session]

Repo: abrar-de-ahmed/ibr-trap (cloned at /home/z/my-project/ibr-deploy)
Site: bgremoverdigital.craftedmindss.com (Next.js on Cloudflare Pages)
Owner: Abrar (email: craftedminds3@gmail.com / abrar@craftedmindss.com)

DEPLOYED AGENTS (10 total, all running on GitHub Actions):
1. Supervisor v2 — Daily 7:00 UTC — monitors all agents
2. Growth Agent v2 — Daily 8:00 UTC — SEO intelligence, keyword pages, Sunday evolution
3. Content Agent — Mon/Wed/Fri 9:00 UTC — blog articles, A/B testing
4. Social Agent v2.0 — Daily 10:00 UTC (3:00 PM PKT) — Puppeteer auto-posting + engagement
5. Directory Agent — Weekly Sunday 11:00 UTC — directory submissions, backlinks
6. Monitor — Every 6 hours — site uptime
7. Security Agent — Daily — security audit
8. SEO Agent — Wednesday — SEO checks
9. Charlie Agent — Daily — anti-scraping defense
10. Bravo Agent — Daily — pattern recognition defense

KEY FILES:
- data/brain.json — shared agent memory
- data/config.json — behavior config, mitigation rules, budget scaling
- GENETIC.md — full strategy transcript + deployment status
- BG-REMOVER-SEO-STRATEGY.md — SEO roadmap
- BG-REMOVER-WORKLOG.md — deployment history
- SECURITY-ROADMAP.md — defense upgrade path
- CONTINUITY.md — this file (handoff prompt)

SOCIAL AGENT v2.0 STATUS (as of May 10, 2026):
- 8 bugs found and fixed (3 CRITICAL, 3 MEDIUM, 2 MINOR)
- Latest commit: 34be5bc (all fixes pushed to main)
- Schedule: Daily 10:00 UTC (3:00 PM PKT)
- Platforms: Reddit, Twitter/X, Pinterest (all Puppeteer automated)
- Bug fixes: isContentUnique crash, networkidle2 timeout, wrong post tab,
  :has-text selectors (Playwright-only), Pinterest submit button, Pinterest
  login check inverted, outdated Chrome UA, Pinterest no image upload
- Image upload: downloadPinImage() with 3 fallback sources
- Anti-detection: webdriver hidden, Chrome/135 UA, human-like typing, random delays
- QA Report: 18-page PDF at /download/Social-Agent-Expert-QA-Report.pdf
- KNOWN RISKS: Reddit anti-bot (10%), Twitter email verify (5%), Pinterest board (15%)

CHARLIE AGENT v2 STATUS (as of May 10, 2026):
- 3 false positive bugs found and fixed (commit: 696fe19)
- Content Tampering FP: Now uses stable hash (strips Next.js chunk URLs before hashing)
- Injected Code FP: Added trusted domain whitelist (googletagmanager.com, staticimgly.com)
- Site Unreachable crash: Fixed ghost.findings → ghostFindings (returns array, not object)
- State file reset: all previous alerts were false positives
- Site verified clean: no malicious code, no injection, no suspicious activity

SOCIAL ACCOUNTS (Puppeteer automated):
- Reddit: u/AbrardeAhmed (craft@craftedmindss.com)
- Twitter/X: @bg_remover (craft@craftedmindss.com)
- Pinterest: BGRemoverPro Business (abrar_a@live.com, 32 followers)

GA INTELLIGENCE RULES:
- 80/20: 80% proven, 20% experiment
- Emergency brake: 3+ deindexed pages → shutdown
- Mitigation: Week 1 (1 post/day) → Week 2 (2) → Week 3 (3) → Week 4 (5)
- Sunday evolution: reviews brain.json, rewrites config.json
- Budget auto-scales: 2 users=$5, 4=$10, 8=$15, 16=$20 ads/month
- Never mention img.ly — use "AI technology" or "client-side AI"

CURRENT STATUS: Week 1 (started May 9, 2026). Social Agent bugs all fixed. Charlie Agent v2 fixed (3 false positive bugs). Next scheduled run: May 11, 3:00 PM PKT.
NEXT MILESTONES:
(1) Monitor Social Agent run on May 11 — check if posts are live
(2) Review Week 1 data from brain.json after 7 days
(3) Advance to Week 2 if indexing positive
(4) Connect GSC API for rank tracking (blocked by org policy — need personal Gmail)
(5) First 2 paid users → activate $5 ads budget
(6) Charlie Agent v2: first clean run expected within 6 hours — should report All Clear

DEFERRED ITEMS:
- GSC API: blocked by org policy iam.disableServiceAccountKeyCreation — need personal Gmail or org admin
- Pinterest boards: target boards in templates may not exist — first run will reveal

Read brain.json, check GitHub Actions runs, and give status report.
```

---

## Quick Reference

| Agent | Schedule | What It Does |
|-------|----------|-------------|
| Growth v2 | Daily 8:00 UTC | SEO intel, keyword pages, competitor analysis |
| Content | Mon/Wed/Fri 9:00 UTC | Blog articles, title A/B testing |
| Social v2.0 | Daily 10:00 UTC | Auto-posts Reddit/Twitter/Pinterest + engagement |
| Directory | Sunday 11:00 UTC | Directory submissions, profile backlinks |
| Supervisor | Daily 7:00 UTC | Monitors all 10 agents |

## GitHub Secrets (15 total)

| Category | Secrets |
|----------|---------|
| Email | GMAIL_USER, GMAIL_APP_PASS, ALERT_EMAIL |
| Reddit | REDDIT_USERNAME, REDDIT_PASSWORD, REDDIT_EMAIL |
| Twitter | TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL |
| Pinterest | PINTEREST_USERNAME, PINTEREST_PASSWORD, PINTEREST_EMAIL |
| Infra | CF_ACCOUNT_ID, CF_API_TOKEN, STRIPE_SECRET_KEY |

## 4-Month KPI Targets

| Month | Paid Users | Pages | Backlinks | Revenue |
|-------|-----------|-------|-----------|---------|
| May | 5 | 50 | 100 | $25-75 |
| June | 25 | 120 | 250 | $125-375 |
| July | 100 | 200 | 500 | $500-1,500 |
| August | 325 | 300+ | 800+ | $1,625-4,875 |
