# BG Remover Digital — Local Runner Setup Guide (Windows)

> **Version:** 2.2 — Local Runner Architecture
> **Last Updated:** May 16, 2026
> **Purpose:** Run Social Agent and SM Executive from your local PC instead of GitHub Actions CI

---

## Why Local Runner?

GitHub Actions CI runs headless. Twitter and Pinterest **detect and block** headless Puppeteer browsers — resulting in 0% posting success. Your local PC runs a **real Chrome browser** with the **BG Remover Chrome Extension** installed, which posts through your actual IP address with real browser fingerprints. The WebSocket bridge on localhost:9876 relays commands between the agent scripts and the extension.

---

## Prerequisites

1. **Windows 10/11** (64-bit)
2. **Google Chrome** installed and updated
3. **Node.js 20 LTS** installed ([download](https://nodejs.org/))
4. **Git** installed ([download](https://git-scm.com/))
5. **GitHub PAT** with `repo` scope (already provided)

---

## Step 1: Clone the Repository

Open PowerShell or Command Prompt:

```powershell
cd C:\Projects
git clone https://github.com/abrar-de-ahmed/ibr-trap.git ibr-trap-check
cd ibr-trap-check
```

Or if you already have the repo cloned:

```powershell
cd C:\Projects\ibr-trap-check
git pull origin main
```

---

## Step 2: Install Node.js Dependencies

```powershell
cd C:\Projects\ibr-trap-check
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth nodemailer ws
```

This installs:
- `puppeteer` + `puppeteer-extra` + stealth plugin (browser automation fallback)
- `nodemailer` (email reports from Social Agent)
- `ws` (WebSocket client for Chrome Extension bridge)

---

## Step 3: Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to `C:\Projects\ibr-trap-check\chrome-extension\` and select it
5. The extension should appear as "BG Remover Social Agent" with the Manifest V3 badge
6. **Pin** the extension to your toolbar for easy access

### Verify Extension is Active

- The extension icon should appear in your toolbar
- Click it — you should see a popup with bridge status info
- The WebSocket bridge must be running for the extension to communicate (see Step 4)

---

## Step 4: Start the WebSocket Bridge

The WebSocket bridge (`ws-bridge.js`) acts as a relay between the agent scripts and the Chrome Extension.

### Manual Start (for testing):

```powershell
cd C:\Projects\ibr-trap-check
node ws-bridge/ws-bridge.js
```

You should see:
```
WebSocket bridge listening on ws://localhost:9876
```

Leave this terminal window open. The bridge must be running whenever an agent executes.

### Auto-Start (recommended for production):

The `local-runner.js` script automatically detects if the bridge is running and starts it if needed. You do NOT need to start it manually when using the local runner — it handles this automatically.

---

## Step 5: Test the Local Runner

### Test Social Agent:

```powershell
cd C:\Projects\ibr-trap-check
node local-runner.js --agent social
```

Expected output:
```
[Local Runner 2026-05-16T... ] ═══════════════════════════════════════════════════
[Local Runner 2026-05-16T... ] ═══ Local Runner v2.2 — Agent: social ═══
[Local Runner 2026-05-16T... ] ═══════════════════════════════════════════════════
[Local Runner 2026-05-16T... ] ws-bridge.js is already running on localhost:9876
[Local Runner 2026-05-16T... ] Starting social agent in --local mode...
[Social Agent 2026-05-16T... ] === Social Agent v2.1 Starting (LOCAL MODE — Extension Only, No Puppeteer) ===
...
[Local Runner 2026-05-16T... ] ═══ Local Runner Complete ═══
```

### Test SM Executive:

```powershell
cd C:\Projects\ibr-trap-check
node local-runner.js --agent executive
```

### Common Issues:

| Issue | Solution |
|-------|----------|
| `ws-bridge.js not found` | Ensure `ws-bridge/ws-bridge.js` exists in the repo |
| `WebSocket (ws) package not available` | Run `npm install ws` |
| `Cannot read brain.json` | Run the agent once from GitHub Actions (manual trigger) to create initial data files |
| Extension not responding | Check that Chrome is open and the extension is loaded |
| Git push failed | Check your GitHub PAT and git remote URL |

---

## Step 6: Configure Windows Task Scheduler

### Option A: GUI Setup (Recommended)

1. Open **Task Scheduler** (search "Task Scheduler" in Start menu)
2. Click **Create Task** (not "Basic Task")
3. **General tab:**
   - Name: `BG Remover - Local Runner - Social Agent`
   - Description: `Runs Social Agent via local-runner.js with Chrome Extension bridge`
   - Security options: Run whether user is logged on or not
   - Check **Run with highest privileges**
   - Configure for: Windows 10/11
4. **Triggers tab:**
   - Click **New**
   - Begin the task: **On a schedule**
   - Settings: **Weekly**
   - Select: **Monday through Friday**
   - Repeat task every: **1 hour** for a duration of **4 hours**
   - Start time: **1:00 PM** (13:00)
5. **Actions tab:**
   - Click **New**
   - Action: **Start a program**
   - Program/script: `node.exe`
   - Add arguments: `local-runner.js --agent social`
   - Start in: `C:\Projects\ibr-trap-check`
6. **Conditions tab:**
   - Uncheck "Start the task only if the computer is on AC power"
   - Uncheck "Stop if the computer switches to battery power"
7. **Settings tab:**
   - Check "Allow task to be run on demand"
   - Check "Run task as soon as possible after a scheduled start is missed"
   - If the task fails, restart every: 5 minutes, up to 3 times

Repeat the same for SM Executive with:
- Name: `BG Remover - Local Runner - SM Executive`
- Arguments: `local-runner.js --agent executive`
- Start time: **1:00 PM** (13:00)

### Option B: PowerShell Setup

Run these commands in an elevated PowerShell:

```powershell
# Social Agent — hourly Mon-Fri 1PM-5PM PKT
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "local-runner.js --agent social" -WorkingDirectory "C:\Projects\ibr-trap-check"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "1:00PM" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 4)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "BG Remover - Local Runner - Social" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest

# SM Executive — hourly Mon-Fri 1PM-5PM PKT
$action2 = New-ScheduledTaskAction -Execute "node.exe" -Argument "local-runner.js --agent executive" -WorkingDirectory "C:\Projects\ibr-trap-check"
$trigger2 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "1:00PM" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 4)
Register-ScheduledTask -TaskName "BG Remover - Local Runner - Executive" -Action $action2 -Trigger $trigger2 -Settings $settings2 -RunLevel Highest
```

---

## Step 7: Keep Chrome Running

The Chrome Extension must be active for the WebSocket bridge to relay commands. Options:

1. **Keep Chrome open** — simplest approach. Chrome runs in the background with the extension active.
2. **Chrome startup with Windows** — add Chrome to Windows Startup folder:
   - Press `Win + R`, type `shell:startup`
   - Create a shortcut: `chrome.exe --start-maximized`
3. **Minimize to tray** — use an extension like "Minimize to Tray" to keep Chrome running without a taskbar icon.

---

## Architecture Diagram

```
Windows Task Scheduler (hourly, Mon-Fri 1-5PM PKT)
    │
    ▼
local-runner.js
    │
    ├─ Check: Is it weekend? → Skip
    ├─ Check: Is ws-bridge running? → Start if not
    ├─ Run: node social-agent.js --local  OR  node sm-executive.js --local
    │       │
    │       ▼
    │   Agent Script (--local mode)
    │       │
    │       ├─ Skip Puppeteer launch
    │       ├─ Use WebSocket (ws) package → localhost:9876
    │       │       │
    │       │       ▼
    │       │   ws-bridge.js (localhost:9876)
    │       │       │
    │       │       ▼
    │       │   Chrome Extension (Manifest V3)
    │       │       │
    │       │       ▼
    │       │   Real Chrome Browser (real IP, real fingerprints)
    │       │       │
    │       │       ▼
    │       │   Twitter / Pinterest / Reddit (sees real human)
    │       │
    │       ├─ Update brain.json
    │       └─ Return exit code
    │
    ├─ Git push results
    └─ Log to local-runner.log
```

---

## Troubleshooting

### "ws-bridge.js did not start within 15 seconds"
- Check if port 9876 is blocked by firewall
- Try running `node ws-bridge/ws-bridge.js` manually first
- Check Windows Firewall settings for Node.js

### "Extension bridge disabled, Puppeteer only"
- The `ws` npm package is not installed. Run: `npm install ws`
- In local mode, the agent REQUIRES the WebSocket bridge. It will not fall back to Puppeteer.

### Agent runs but nothing gets posted
- Verify Chrome is open and the extension is loaded
- Open Chrome DevTools → Console → look for WebSocket messages from the extension
- Check `ws-bridge.js` terminal output for errors
- Verify cookies are not expired (check `data/cookies/` files)

### Git push fails
- Check git remote: `git remote -v`
- Ensure GitHub PAT has `repo` scope
- Try manual: `git push origin main`

### Refresh Cookies
If posting/replies stop working, cookies may have expired:
1. Log into Twitter, Pinterest, Reddit manually in Chrome
2. Use the extension's cookie capture feature (if available)
3. Or update cookie files in `data/cookies/` manually

---

## File Locations

| File | Purpose |
|------|---------|
| `local-runner.js` | Main entry point — checks schedule, starts bridge, runs agent |
| `ws-bridge/ws-bridge.js` | WebSocket relay between Node.js scripts and Chrome Extension |
| `chrome-extension/` | Chrome Extension (Manifest V3) with 5 content scripts |
| `.github/workflows/scripts/social-agent.js` | Social Agent (posting + engagement) |
| `.github/workflows/scripts/sm-executive.js` | SM Executive (comment replies) |
| `data/brain.json` | Shared agent memory |
| `data/config.json` | Agent configuration |
| `local-runner.log` | Execution log (append mode) |
