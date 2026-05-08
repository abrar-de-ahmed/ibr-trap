# BG Remover Digital — Security Roadmap

> The Watchman Protocol: A 3-tier defense system with genetic algorithm evolution.
> Full details in GENETIC.md (Part 2: The Watchman Protocol).
>
> This document covers: current state, future phases, and activation triggers.

---

## Current State (Active)

### Security Agent v2 — Code-Level Security ✅
- **File:** `.github/workflows/security-agent.yml` + `scripts/security-audit.js`
- **Schedule:** Every Monday 6:00 UTC
- **What it does:** npm audit, secret scanning, gitignore check, dependency review, security headers
- **Status:** Active and running

### Monitor Agent — Site Health ✅
- **File:** `.github/workflows/monitor.yml` + `scripts/monitor.js`
- **Schedule:** Every 12 hours (0:00 + 12:00 UTC)
- **What it does:** Site uptime, response time, auto-deploy via Cloudflare
- **Status:** Active and running

### CHARLIE (Lightweight) — Live Site Security ✅
- **File:** `.github/workflows/charlie-agent.yml` + `scripts/charlie.js`
- **Schedule:** Every 6 hours (0:00, 6:00, 12:00, 18:00 UTC)
- **What it does:**
  - Monitors live site for suspicious response patterns
  - Checks if site content has been tampered with (hash verification)
  - Detects unexpected redirects or injected content
  - Monitors response time anomalies (DDoS early warning)
  - Ghost Page detection (checks if site serves unexpected error pages)
  - Saves security state to `data/charlie-state.json`
  - INSTANT ALERT on any anomaly
- **Status:** Active (lightweight version)

### BRAVO (Lightweight) — Sentinel Monitor ✅
- **File:** `.github/workflows/bravo-agent.yml` + `scripts/bravo.js`
- **Schedule:** Daily at 7:30 UTC (30 min after Supervisor)
- **What it does:**
  - Reviews Charlie's decisions and state
  - Cross-validates Monitor Agent findings
  - Checks if Security Agent findings have been addressed
  - Monitors GitHub Actions run history for missed schedules
  - Detects "poisoning" patterns (e.g., repeated false alarms exhausting resources)
  - Overrides Charlie if it detects malfunction (sets Charlie to "sandbox" mode)
  - Saves sentinel findings to `data/bravo-state.json`
  - INSTANT ALERT if Charlie or any agent shows signs of compromise
- **Status:** Active (lightweight version)

---

## Future Phases (Activation Required)

### Phase 2: Enhanced Charlie — Cloudflare Worker [REVENUE GATE: $50/month]
**Trigger:** When monthly revenue reaches $50+ (approx 5-10 paid users)

**Upgrades from lightweight:**
- Deploy as Cloudflare Worker at edge (sub-millisecond response)
- Real-time bot detection and blocking (not just monitoring)
- DOM mutation: Randomize HTML class names/IDs for suspicious requests
- Rate limiting per IP with exponential backoff
- Ghost Instance: Serve fake pages to malicious bots (no 403/404)
- Country-based access rules
- Integration with Cloudflare WAF rules

**What's needed:**
- Cloudflare Workers deployment (free tier: 100K requests/day)
- CF_API_TOKEN already available as GitHub secret
- Worker code written and tested
- ~1 day of development

**Files to create:**
- `workers/charlie/index.js` — Main Cloudflare Worker
- `workers/charlie/rules.json` — Bot detection rules
- `workers/charlie/ghost-pages/` — Fake page templates

### Phase 3: Full Bravo — Pattern Recognition GA [REVENUE GATE: $200/month]
**Trigger:** When monthly revenue reaches $200+ (approx 20-30 paid users)

**Upgrades from lightweight:**
- Genetic Algorithm for pattern recognition
- Machine learning on access logs (simplified statistical model)
- Behavioral analysis of traffic patterns
- Automated threat classification
- Predictive anomaly detection (learns what "normal" looks like)
- Integration with GSC API for SEO-specific threat detection

**What's needed:**
- Access to Cloudflare analytics API
- Historical traffic data (minimum 30 days)
- ~2-3 days of development

### Phase 4: ALPHA — Out-of-Band Overlord [REVENUE GATE: $500/month]
**Trigger:** When monthly revenue reaches $500+ (approx 50-80 paid users)

**Requirements (user must provide):**
| Item | Cost | Details |
|---|---|---|
| Separate physical device | $35-60 one-time | Raspberry Pi 4 or 5, or old laptop |
| Different network connection | $10-30/month | Mobile hotspot, second ISP, or cheap VPS |
| Power + internet 24/7 | $5-10/month | Must never go offline |
| Physical setup time | 2-4 hours | OS install, scripts, network config |

**What ALPHA does:**
- Lives on physically separate hardware with different network route
- Does NOT trust software-level logs (Bravo's blind spot)
- Monitors: Hardware thermals, raw CPU cycles, network switch activity
- Compares: What Bravo says vs what hardware sensors report
- If discrepancy detected: Both Charlie and Bravo are compromised
- ALPHA's only function: The Kill Switch
  - Physically severs site's connection to internet
  - Saves core code to immutable backup
  - Sends emergency alert to craftedminds3@gmail.com

**What's needed from development:**
- Python/Node.js script for hardware monitoring
- Secure communication channel (encrypted) to main site
- Kill switch implementation (DNS change via Cloudflare API)
- ~3-5 days of development + testing

### Phase 5: Lethal Upgrades [REVENUE GATE: $1000/month]
**Trigger:** When monthly revenue reaches $1000+ (approx 100+ paid users)

**5A: The Labyrinth (Never Block, Always Misdirect)**
- Charlie generates "Ghost Instances" — fake servers that feed attackers plausible but useless data
- Attackers think they breached the system; they waste their own resources
- Requires: Cloudflare Workers + fake API endpoints

**5B: Ephemeral Memory (Thousand Layers)**
- Core GA brain lives only in RAM, never on disk
- Encrypted, fragmented, and scrambled every 30 seconds
- If breached: Attacker gets nothing. If plug pulled: GA dies, sterile blueprint remains
- Requires: Dedicated server (not GitHub Actions) — Phase 4 hardware

**5C: Asymmetrical Retribution (Silent Strike)**
- If Alpha+Bravo+Charlie positively identify sustained adversarial attack from a competitor:
  - Silent script out-bids competitor on their own paid ad keywords
  - Drives their customer acquisition costs up
  - BG Remover Digital pivots to alternative traffic sources
- Requires: Google Ads API access + budget + legal review
- ⚠️ LEGAL RISK: Competitive ad bidding may violate policies in some jurisdictions

---

## Architecture Overview

```
PHASE 1 (Current — Free):
  Security Agent → Code security (npm, secrets, headers)
  Monitor Agent  → Site uptime + auto-deploy
  Charlie (Lite) → Live site anomaly detection
  Bravo (Lite)   → Cross-validates all agents

PHASE 2 ($50/month):
  Charlie (Worker) → Edge-level bot detection + rate limiting

PHASE 3 ($200/month):
  Bravo (GA) → Pattern recognition + behavioral analysis

PHASE 4 ($500/month):
  ALPHA (Hardware) → Out-of-band monitoring + kill switch

PHASE 5 ($1000/month):
  Labyrinth + Ephemeral Memory + Retribution
```

---

## Activation Checklist

When revenue reaches each gate, the user should:

### $50/month gate:
- [ ] Review Charlie Worker code
- [ ] Deploy to Cloudflare Workers (I write the code, you approve deployment)
- [ ] Test with bot simulation tools
- [ ] Monitor for 1 week before enabling auto-blocking

### $200/month gate:
- [ ] Ensure 30+ days of traffic data available
- [ ] Review Bravo GA patterns
- [ ] Test with simulated attack patterns
- [ ] Monitor for 2 weeks

### $500/month gate:
- [ ] Purchase Raspberry Pi or dedicated device
- [ ] Set up separate network connection
- [ ] Install monitoring scripts
- [ ] Test kill switch with controlled scenario
- [ ] Monitor for 1 month

### $1000/month gate:
- [ ] Legal review of competitive ad bidding
- [ ] Set up Google Ads API
- [ ] Test Labyrinth with penetration testing
- [ ] Full security audit before activation
