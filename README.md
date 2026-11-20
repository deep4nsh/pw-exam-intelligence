# 🏛️ Physics Wallah Exam Intelligence Radar

> **Private Real-Time Exam & Multi-Category Intelligence Pipeline for PW Marketing Leadership**  
> Covers **State PSCs** (UPPSC, BPSC, MPSC, MPPSC, OPSC, RPSC), **Judiciary & Law** (Pan-India High Courts, SCI, ADA, AIBE), **UP State Board** (UPMSP Class 10/12), **Commerce / Professional** (ICAI CA Foundation & Intermediate), **GATE** (Engineering & Tech), **AE-JE** (Assistant & Junior Engineer), and **Agriculture** (ICAR, ASRB, State Agri) with category-targeted email routing, instant Telegram alerts, pre-written marketing plays, clean Google Sheet tracking, and rich executive digests.

---

## ⚡ Overview & Architecture

This repository operates on a **₹0 recurring cost stack** with zero server maintenance:

1. **Official Commission & Board Scrapers (`scraper/official_scrapers.js`):**
   - **BPSC (Bihar):** Direct notice parsing via `bpsc.bihar.gov.in`.
   - **UPPSC (Uttar Pradesh):** Live marquee & circular notice extractor with 20s network resilience.
   - **MPPSC (Madhya Pradesh):** Direct PDF circular crawler via `mppsc.mp.gov.in`.
   - **RPSC (Rajasthan):** Live news list parser via `rpsc.rajasthan.gov.in`.
   - **OPSC (Odisha):** ASP.NET circular table scraper via `opsc.gov.in`.
   - **MPSC (Maharashtra):** Native AES-128-CBC + CRC32 encrypted API client via `mpsc.gov.in`.
   - **Pan-India Judiciary:** Direct judicial circulars across High Courts & Supreme Court of India.
   - **ADA & State Prosecution:** Prosecution officer & assistant district attorney updates.
   - **Bar Advocacy & AIBE:** All India Bar Examination and Bar Council of India notifications.
   - **UP State Board (UPMSP):** Class 10 & 12 Board model papers, exam datesheets, results, and scrutiny notices via `upmsp.edu.in`.
   - **ICAI (Chartered Accountants):** CA Foundation & Intermediate announcements, results, and examination circulars via `icai.org`.
   - **GATE & Engineering:** IIT & IISc GATE notifications, answer keys, dates, and score updates.
   - **AE-JE Technical:** State & Central Assistant Engineer and Junior Engineer recruitments (UPPSC, BPSC, SSC, RRB).
   - **Agriculture & Allied:** ICAR, ASRB, IBPS AFO, State Agriculture Officers & Supervisors.

2. **Multi-Category CMM Routing & Central Tags Sheet:**
   - **Dynamic CMM Ingestion:** Reads categories, tags (`INCLUDE`, `ALIAS`, `EXCLUDE`), and emails directly from the central Google Sheet (`1IIdA-chEZvTRT4xPKmvFp_U-6mCv6t2VdPTXOOhooYQ`).
   - **Strict Category Isolation:** Each Category Marketing Manager receives alerts **only** for their respective tags:
     - **UP State Board:** Delivered exclusively to `anshu.mishra@pw.live`
     - **CA Inter & Foundation:** Delivered exclusively to `moksh.sharma@pw.live`
     - **GATE:** Delivered exclusively to `falguni.gupta@pw.live`, `kashif.ahmed@pw.live`, `harsh.ayush1@pw.live`
     - **AE-JE:** Delivered exclusively to `falguni.gupta@pw.live`, `kashif.ahmed@pw.live`, `ananya.rajak@pw.live`
     - **Agriculture:** Delivered exclusively to `falguni.gupta@pw.live`, `kashif.ahmed@pw.live`, `ananya.rajak@pw.live`
     - **State PSC & Judiciary:** Delivered to Marketing Leadership (`CFG.EMAIL_TO`)
   - **Tag Honor Rules:** Custom exclusion tags (such as `JAM`, `CUET` for GATE; `GATE`, `Diploma admission` for AE-JE; `NEET`, `JEE` for Agri; `Mock test` for CA) are enforced at ingestion time.

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
   - `TELEGRAM_BOT_TOKEN`: `8962093670:AAEFDh6xdxBqVNUBIf3IybLRufbJYbjvNxI`
   - `TELEGRAM_CHAT_ID`: `-5324420343`
   - `GOOGLE_WEBAPP_URL`: `https://script.google.com/macros/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec`

4. **Google Apps Script Web App Deployment Details:**
   - **Deployment ID:** `AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0`
   - **Web App URL:** `https://script.google.com/macros/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec`
   - **Internal PW URL:** `https://script.google.com/a/macros/pw.live/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec`

5. **Enable Workflow Write Permissions:**
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
