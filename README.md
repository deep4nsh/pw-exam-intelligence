# 🏛️ Physics Wallah Exam Intelligence Radar

> **Private Real-Time Exam Monitoring Pipeline for PW Marketing Leadership**  
> Covers **6 State PSCs** (UPPSC, BPSC, MPSC, MPPSC, OPSC, RPSC) & **Judiciary** (Allahabad High Court, Delhi High Court, MP HC, etc.) with instant Telegram alerts, pre-written marketing plays, clean Google Sheet tracking, and rich email digests.

---

## ⚡ Overview & Architecture

This repository operates on a **₹0 recurring cost stack** with zero server maintenance:

1. **Commission Scrapers (`scraper/official_scrapers.js`):**
   - **BPSC (Bihar):** Direct notice parsing via `bpsc.bihar.gov.in`.
   - **UPPSC (Uttar Pradesh):** Live marquee & circular notice extractor with 20s network resilience.
   - **MPPSC (Madhya Pradesh):** Direct PDF circular crawler via `mppsc.mp.gov.in`.
   - **RPSC (Rajasthan):** Live news list parser via `rpsc.rajasthan.gov.in`.
   - **OPSC (Odisha):** ASP.NET circular table scraper via `opsc.gov.in`.
   - **MPSC (Maharashtra):** Native AES-128-CBC + CRC32 encrypted API client via `mpsc.gov.in`.
   - **Allahabad High Court (Judiciary):** Direct judicial event circular parser via `allahabadhighcourt.in`.

2. **24/7 GitHub Actions Automation (`.github/workflows/scrape.yml`):**
   - Runs on cron every 20 minutes automatically.
   - Alerts sent to Telegram in real-time only when brand-new circulars drop.
   - Deduplicates notices via SHA-256 hashes stored in `scraper/seen_hashes.json`.
   - Commits state changes back to GitHub without human intervention.

3. **Telegram Instant Alert Bot:**
   - Group: `Deepansh & Aditya Sir, Akshay Pw`
   - Formatted with jurisdiction tags, exam name, notice description, PDF links, and **actionable marketing hooks**.

4. **Apps Script / Google Sheet / Email Pipeline (`apps-script/`):**
   - Color-coded priority badges (`CRITICAL`, `HIGH`, `NORMAL`).
   - Highlighted marketing campaign hooks.
   - Clickable direct PDF links.
   - Scannable email digests with bullet points.

---

## 🚀 Local Usage

### Run scraper manually:
```bash
npm run scrape
```

### Probe portal connectivity:
```bash
npm run probe
```

---

## ⚙️ GitHub Deployment Setup (One-Time)

To turn on 24/7 automated scraping:

1. **Create a private repository** on GitHub (e.g. `pw-exam-intelligence`).
2. **Push this codebase:**
   ```bash
   git remote add origin https://github.com/<your-username>/pw-exam-intelligence.git
   git branch -M main
   git push -u origin main
   ```
3. **(Optional) Configure GitHub Secrets:**
   Go to **Settings > Secrets and variables > Actions** and add:
   - `TELEGRAM_BOT_TOKEN` (default already configured in code)
   - `TELEGRAM_CHAT_ID` (default already configured in code)
4. **Enable Workflow Write Permissions:**
   Go to **Settings > Actions > General > Workflow permissions** and select **"Read and write permissions"** so the GitHub Action can commit updated circular hashes.

---

## 📂 Repository Structure

```
├── .github/
│   └── workflows/
│       └── scrape.yml             # 24/7 automated scraping cron job
├── apps-script/
│   └── ExamResultMonitor_v2.gs    # Google Sheet & Email digest engine
├── scraper/
│   ├── official_scrapers.js       # All 7 commission & court scrapers
│   ├── probe_portals.js           # Network connectivity diagnostic
│   ├── latest_official_notices.json # Full structured database (56 notices)
│   └── seen_hashes.json           # SHA-256 deduplication cache
├── package.json
└── README.md
```
