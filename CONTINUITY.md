# BG Remover Digital — Continuity Prompt

> **Purpose:** Paste this prompt in a new chat session to continue the project seamlessly.
> **Last Updated:** May 16, 2026 (Session 8 — v2.2: Local Runner Architecture)

---

```
Continue project: BG Remover Digital Growth Agent Army.

GitHub PAT: [provide your GitHub PAT when starting new session]

Repo: abrar-de-ahmed/ibr-trap (cloned at /home/z/my-project/ibr-deploy)
Site: bgremoverdigital.craftedmindss.com (Next.js on Cloudflare Pages)
Owner: Abrar (email: craftedminds3@gmail.com / abrar@craftedmindss.com)

DEPLOYED AGENTS (11 total, 9 on GitHub Actions, 2 on LOCAL PC via Local Runner):
1. Supervisor v2 — Daily 7:00 UTC — monitors all agents
2. Growth Agent v2 — Daily 8:00 UTC — SEO intelligence, keyword pages, Sunday evolution
3. Content Agent — Mon/Wed/Fri 9:00 UTC — blog articles, A/B testing
4. **Social Agent v2.2** — Mon-Sun hourly via LOCAL RUNNER — Chrome Extension only, no Puppeteer, no CI — **Reddit posting PAUSED until June 12 (auto-resume)**
6. Monitor — Every 6 hours — site uptime
7. Security Agent — Daily — security audit
8. SEO Agent — Wednesday — SEO checks
9. Charlie Agent v2 — Every 6 hours — anti-scraping defense (3 FP bugs fixed)
10. Bravo Agent — Daily — pattern recognition defense
11. **SM Executive v1.1** — Mon-Sun hourly via LOCAL RUNNER — Chrome Extension only, no Puppeteer, no CI — **Reddit comments ACTIVE (building karma while posts paused)** — **Thread depth limit: 3 replies max per conversation**

LOCAL RUNNER v2.2 (NEW):
- local-runner.js — Node.js script that runs Social Agent and SM Executive from local PC
- Windows Task Scheduler triggers hourly Mon-Sun, all day (24/7)
- Auto-detects and starts ws-bridge.js on localhost:9876
- Runs agents with --local flag (skips Puppeteer, extension-only mode)
- brain.json is the single source of truth for daily limits (posts, likes, comments, follows)
- No weekend/time restrictions in local mode — agent checks brain.json each run
- Git pushes results after each run
- Logs to local-runner.log
- SETUP.md has full Windows setup guide

LATEST TAG: bg_V2.2 at HEAD — Local Runner Architecture + CI cron disabled

KEY FILES:
- local-runner.js — Local Runner entry point (runs agents from local PC)
- SETUP.md — Windows setup guide for Local Runner
- local-runner.log — Execution log (append mode)
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

SOCIAL AGENT v2.2 STATUS (as of May 16, 2026 — bg_V2.2):
- **NOW RUNS FROM LOCAL PC via local-runner.js** (CI cron DISABLED)
- Schedule: Mon-Sun hourly (all day) via Windows Task Scheduler — brain.json controls daily limits
- --local flag: skips Puppeteer entirely, extension-only mode
- All previous features preserved (extension-first, nodeFetch, dynamic GraphQL, etc.)
- **Reddit posting: PAUSED until June 12, 2026** (account too new — building karma via SM Executive comments)
- Twitter: ACTIVE — Dynamic GraphQL query ID extraction (runtime), x-twitter-auth-type header
- Pinterest: ACTIVE — Puppeteer canvas-based pin image generation (no external CLI needed)
- Auto-resume: social-agent.js checks paused_until date, auto-resets to active when reached
- Auth: Cookie-based (reddit-cookies.json, twitter-cookies.json, pinterest-cookies.json)
- Chrome Extension Architecture: Manifest V3 extension + WebSocket bridge on localhost:9876
- Extension-only in local mode: NO Puppeteer fallback (real browser = real IP = no blocks)
- Extension location: `chrome-extension/` folder, bridge: `ws-bridge/ws-bridge.js`
- 5 content scripts: twitter.js, twitter-engage.js, pinterest.js, pinterest-engage.js, reddit.js
- 10 message types: twitter_follow/like/comment/reply, pinterest_follow/comment/reply, reddit_comment/reply/upvote
- Message protocol: post_request/post_result via WebSocket relay
- CI workflow: social-agent.yml cron commented out, workflow_dispatch kept for manual triggers

SM EXECUTIVE v1.1 STATUS (as of May 16, 2026 — bg_V2.2):
- **NOW RUNS FROM LOCAL PC via local-runner.js** (CI cron DISABLED)
- Schedule: Mon-Sun hourly via Windows Task Scheduler (all day)
- --local flag: skips Puppeteer entirely, extension-only mode
- No weekend/time restrictions in local mode — brain.json controls daily limits
- **Thread depth limit: max 3 replies per conversation thread** (Reddit/Twitter/Pinterest)
- Platforms: Reddit (ACTIVE — building karma), Twitter/X, Pinterest comment replies
- Reply system: 13-category intelligent fallback (80+ variants, zero external AI/CLI)
- Mod filtering: Dual-layer (content patterns + author names) — skips AutoModerator/bots
- Twitter: Cookie-based (ct0 + auth_token) via nodeFetch, dynamic GraphQL query ID
- Reddit: OAuth Bearer via nodeFetch — **NOT affected by Social Agent Reddit pause**
- Rate limits: 5 max/session, 3 per platform, 2-5s randomized delays
- State files: sm-executive-brain.json, sm-executive-config.json (auto-created on first run)
- Extension-only in local mode: NO Puppeteer fallback
- CI workflow: sm-executive.yml cron commented out, workflow_dispatch kept for manual triggers

V2.2 LOCAL RUNNER ARCHITECTURE (May 16, 2026):
- PROBLEM: GitHub Actions CI = headless Puppeteer = blocked by Twitter/Pinterest (0% success)
- SOLUTION: Move posting from CI cron to local PC via local-runner.js
- local-runner.js: --agent flag, ws-bridge auto-start, --local flag passthrough
- NO schedule restrictions in local mode — brain.json controls daily limits
- social-agent.js: IS_LOCAL_MODE skips weekend check, Puppeteer, uses extension only
- sm-executive.js: IS_LOCAL_MODE skips weekend/time checks, Puppeteer, uses extension only
- sm-executive.js: Thread depth limit — max 3 replies per conversation (Reddit/Twitter/Pinterest)
- social-agent.yml: Cron DISABLED (commented out), workflow_dispatch kept
- sm-executive.yml: Cron DISABLED (commented out), workflow_dispatch kept
- SETUP.md: Full Windows setup guide (Node.js, Chrome, extension, Task Scheduler 24/7)
- 2 new files: local-runner.js, SETUP.md
- 4 modified files: social-agent.js, sm-executive.js, social-agent.yml, sm-executive.yml
- DO NOT MODIFY: chrome-extension/*, ws-bridge.js, brain.json, config.json, all other workflows

BUG FIX (v2.1):
- ws-bridge.js: Fixed `pendingRequests` used before declaration (moved to proper scope)

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

CURRENT STATUS: Week 2 (walking phase). Phase 3-5 complete. v2.2 Local Runner live. Reddit posting paused 28 days.

V2.2 LOCAL RUNNER ARCHITECTURE (May 16, 2026):
- Social Agent + SM Executive moved from CI cron to local PC
- local-runner.js manages scheduling, bridge startup, agent execution
- Extension-only mode: real Chrome browser, real IP, zero bot detection
- CI workflows still available via workflow_dispatch for manual triggers
- Full Windows setup documented in SETUP.md
Phase 3-5 COMPLETE (May 13, 2026):
- Twitter dynamic GraphQL query ID extraction (no more 404s)
- Twitter x-twitter-auth-type header (no more 403s)
- Git push fixed (fetch-depth: 0 + --unshallow)
- Pinterest in platform rotation (all 3 platforms scored)
- Pinterest pin images via Puppeteer canvas (no CLI tools needed)
- SM Executive: z-ai CLI removed, fallback-only replies, mod comment filtering

V2.1 EXTENSION ENGAGEMENT + QA + CRON UPDATES (May 15, 2026):
- Chrome Extension (Manifest V3) + WebSocket bridge on localhost:9876
- Extension-first with Puppeteer fallback for all engagement functions
- 5 content scripts: twitter.js, twitter-engage.js, pinterest.js, pinterest-engage.js, reddit.js
- 10 message types: twitter_follow/like/comment/reply, pinterest_follow/comment/reply, reddit_comment/reply/upvote
- Cron updated: Mon-Fri only (no weekends) for Social Agent and SM Executive
- SM Executive: tryExtensionReply() + `ws` package + defensive weekend/time checks
- Bug fix: ws-bridge.js pendingRequests scope issue

Reddit Posting Pause (May 15, 2026):
- Reddit posting PAUSED until June 12 (28 days) — account too new (age 5d, need 7d)
- SM Executive Reddit comments remain ACTIVE — builds karma while posts paused
- Auto-resume on June 12: social-agent.js detects paused_until date and resets to active
- Social Agent now posts to Twitter + Pinterest only (2 platforms in rotation)

NEXT MILESTONES:
(1) Monitor Social Agent daily runs — verify Twitter + Pinterest posts are live
(2) Monitor SM Executive — verify Reddit comments are being posted (karma building)
(3) Review Week 2 data from brain.json
(4) June 12: Reddit auto-resumes posting (check if karma threshold met)
(5) Advance to Week 3 if indexing positive
(6) Connect GSC API for rank tracking (blocked by org policy — need personal Gmail)
(7) First 2 paid users → activate $5 ads budget
(8) Refresh cookies if sessions expire (reddit-cookies.json, twitter-cookies.json, pinterest-cookies.json)

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
| Social v2.2 | LOCAL: Mon-Sun hourly (all day) | Extension-only auto-posts Twitter/Pinterest + engagement (**Reddit paused until June 12**) |
| SM Executive | LOCAL: Mon-Sun hourly (all day) | Extension-only comment replies on Reddit/Twitter/Pinterest (**Reddit ACTIVE — building karma**) — **Thread depth: 3 max** |
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
