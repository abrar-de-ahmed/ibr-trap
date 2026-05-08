# BG Remover Digital — Worklog

---

## May 9, 2026 — Growth Agent Army Deployment

### 4 Growth Agents Deployed

**Growth Agent v2** (rebuild of v1):
- `.github/workflows/growth-agent.yml` — Daily 8:00 UTC
- `.github/workflows/scripts/growth-agent.js` — 524 lines
- Reads brain.json + config.json for shared intelligence
- Emergency brake: 3+ deindexed pages → SHUTDOWN + alert
- Creates new keyword pages respecting mitigation limits (Week 1: 2/day, Week 2: 3/day, etc.)
- Sunday evolution cycle: rewrites config.json based on weekly data
- Competitor analysis (remove.bg, remover.io, slazzer.com)
- Stripe revenue tracking, site health checks
- 80/20 proven/experiment rule for title formats

**Content Agent** (new):
- `.github/workflows/content-agent.yml` — Mon/Wed/Fri 9:00 UTC
- `.github/workflows/scripts/content-agent.js` — 542 lines
- 18 blog topics with full article generation (800-1500 words)
- Title A/B testing with variant tracking
- Mitigation: Week 1 max 1 post per 2 days
- Articles tracked in blog.json, strategy tracked in brain.json

**Social Agent** (new):
- `.github/workflows/social-agent.yml` — Daily 10:00 UTC
- `.github/workflows/scripts/social-agent.js` — 986 lines
- Prepares content for Reddit, Twitter/X, Pinterest, Medium
- Different content per platform (not copied)
- Platform rotation and 80/20 experiment rule
- Content prepared but NOT auto-posted (no API tokens yet)
- Owner receives full content in email for manual posting

**Directory Agent** (new):
- `.github/workflows/directory-agent.yml` — Weekly Sunday 11:00 UTC
- `.github/workflows/scripts/directory-agent.js` — 1306 lines
- Directory submissions from 20-platform queue
- Profile backlinks (Medium, Blogger, Tumblr, Dev.to, Hashnode)
- Web 2.0 blog post outlines for backlink building
- Max 3-5 backlinks per run (anti-spam)
- Rotates platforms each week

### Shared Intelligence Files

**brain.json** — Agent memory:
- SEO strategy tracking (title formats, rankings, pages)
- Content performance (blog lengths, A/B tests)
- Social platform engagement data
- Backlink tracking per platform
- Emergency brake state
- Evolution log

**config.json** — Behavior config:
- Week 1-4 mitigation limits
- Emergency brake thresholds
- Budget scaling (2 users=$5, 4=$10, 8=$15, 16=$20)
- 20 keyword candidates for page creation
- Social platform config (subreddits, best times)
- Directory and Web 2.0 platform queues
- 80/20 experiment rate

### Supervisor v2 Updated
- Added oversight for Growth v2, Content, Social, Directory agents
- Now monitors 10 total agents (was 6)
- Updated counts and references

### Safety Features
- Emergency brake: 3+ deindexed → all creation stops + email alert
- Week 1-4 progressive speed limits
- 80/20 proven/experiment rule
- Sunday evolution only advances if previous week positive
- No existing files modified (website untouched)

### Files Changed: 11 files, 3610 insertions
