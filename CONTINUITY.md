# BG Remover Digital — Continuity Prompt

> **Purpose:** Paste this prompt in a new chat session to continue the project seamlessly.
> **Last Updated:** May 14, 2026 (Session 5 — Phase 3-5 complete, bg_V2.0 tagged)

---

```
Continue project: BG Remover Digital Growth Agent Army.

GitHub PAT: [provide your GitHub PAT when starting new session]

Repo: abrar-de-ahmed/ibr-trap (cloned at /home/z/my-project/ibr-deploy)
Site: bgremoverdigital.craftedmindss.com (Next.js on Cloudflare Pages)
Owner: Abrar (email: craftedminds3@gmail.com / abrar@craftedmindss.com)

DEPLOYED AGENTS (11 total, all running on GitHub Actions):
1. Supervisor v2 — Daily 7:00 UTC — monitors all agents
2. Growth Agent v2 — Daily 8:00 UTC — SEO intelligence, keyword pages, Sunday evolution
3. Content Agent — Mon/Wed/Fri 9:00 UTC — blog articles, A/B testing
4. Social Agent v2.0 — Daily 10:00 UTC (3:00 PM PKT) — Puppeteer auto-posting + engagement (nodeFetch + dynamic GraphQL)
5. Directory Agent — Weekly Sunday 11:00 UTC — directory submissions, backlinks
6. Monitor — Every 6 hours — site uptime
7. Security Agent — Daily — security audit
8. SEO Agent — Wednesday — SEO checks
9. Charlie Agent v2 — Every 6 hours — anti-scraping defense (3 FP bugs fixed)
10. Bravo Agent — Daily — pattern recognition defense
11. SM Executive — Every 4 hours — comment replies on Reddit/Twitter/Pinterest (fallback-only, no external AI)

LATEST TAG: bg_V2.0 at HEAD (c4875da) — Phase 3-5 complete

KEY FILES:
- data/brain.json — shared agent memory (includes Pinterest in rotation)
- data/config.json — behavior config, mitigation rules, budget scaling
- data/sm-executive-brain.json — SM Executive replied IDs + conversation history (auto-created on first run)
- data/sm-executive-config.json — SM Executive settings (auto-created on first run)
- data/cookies/reddit-cookies.json — Reddit auth cookies + OAuth token
- data/cookies/twitter-cookies.json — Twitter auth cookies (ct0 + auth_token)
- data/cookies/pinterest-cookies.json — Pinterest auth cookies (8 cookies)
- GENETIC.md — full strategy transcript + deployment status
- BG-REMOVER-SEO-STRATEGY.md — SEO roadmap
- BG-REMOVER-WORKLOG.md — deployment history
- SECURITY-ROADMAP.md — defense upgrade path
- CONTINUITY.md — this file (handoff prompt)

SOCIAL AGENT v2.0 STATUS (as of May 14, 2026 — bg_V2.0):
- 8 original bugs fixed (May 10) + 6 live issues fixed (May 13)
- Latest commit: c4875da (Phase 3-5, tagged bg_V2.0)
- Schedule: Daily 10:00 UTC (3:00 PM PKT)
- Platforms: Reddit, Twitter/X, Pinterest (all 3 in rotation)
- Twitter: Dynamic GraphQL query ID extraction (runtime), x-twitter-auth-type header
- Reddit: nodeFetch for all API calls (bypasses GH Actions IP blocks)
- Pinterest: Puppeteer canvas-based pin image generation (no external CLI needed)
- Auth: Cookie-based (reddit-cookies.json, twitter-cookies.json, pinterest-cookies.json)
- Git push: fetch-depth: 0 in workflow + git fetch --unshallow safety net
- Anti-detection: headless:false with xvfb (bypasses bot detection), Chrome/135 UA
- KNOWN RISKS: Reddit anti-bot (10%), Twitter email verify (5%), Pinterest board (15%)

SM EXECUTIVE STATUS (as of May 14, 2026 — bg_V2.0):
- Schedule: Every 4 hours (0:00, 4:00, 8:00, 12:00, 16:00, 20:00 UTC)
- Platforms: Reddit, Twitter/X, Pinterest comment replies
- Reply system: 13-category intelligent fallback (80+ variants, zero external AI/CLI)
- Mod filtering: Dual-layer (content patterns + author names) — skips AutoModerator/bots
- Twitter: Cookie-based (ct0 + auth_token) via nodeFetch, dynamic GraphQL query ID
- Reddit: OAuth Bearer via nodeFetch
- Rate limits: 5 max/session, 3 per platform, 2-5s randomized delays
- State files: sm-executive-brain.json, sm-executive-config.json (auto-created on first run)

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

CURRENT STATUS: Week 2 (walking phase). All 6 live issues fixed. Tag bg_V2.0 at HEAD.
Phase 3-5 COMPLETE (May 13, 2026):
- Twitter dynamic GraphQL query ID extraction (no more 404s)
- Twitter x-twitter-auth-type header (no more 403s)
- Git push fixed (fetch-depth: 0 + --unshallow)
- Pinterest in platform rotation (all 3 platforms scored)
- Pinterest pin images via Puppeteer canvas (no CLI tools needed)
- SM Executive: z-ai CLI removed, fallback-only replies, mod comment filtering

NEXT MILESTONES:
(1) Monitor Social Agent + SM Executive daily runs — verify posts and replies are live
(2) Review Week 2 data from brain.json
(3) Advance to Week 3 if indexing positive
(4) Connect GSC API for rank tracking (blocked by org policy — need personal Gmail)
(5) First 2 paid users → activate $5 ads budget
(6) Refresh cookies if sessions expire (reddit-cookies.json, twitter-cookies.json, pinterest-cookies.json)

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
| Social v2.0 | Daily 10:00 UTC | Auto-posts Reddit/Twitter/Pinterest + engagement (nodeFetch + dynamic GraphQL) |
| SM Executive | Every 4 hours | Comment replies on Reddit/Twitter/Pinterest (fallback-only) |
| Directory | Sunday 11:00 UTC | Directory submissions, profile backlinks |
| Supervisor | Daily 7:00 UTC | Monitors all 11 agents |

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
