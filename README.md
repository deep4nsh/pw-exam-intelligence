# 🏛️ Physics Wallah Exam Intelligence Radar

> **Private Real-Time Exam & Multi-Category Intelligence Pipeline for PW Marketing Leadership & CMMs**  
> Covers **State PSCs** (UPPSC, BPSC, MPSC, MPPSC, OPSC, RPSC), **Judiciary & Law** (Pan-India High Courts, SCI, ADA, AIBE), **UP State Board** (UPMSP Class 10/12), **Commerce / Professional** (ICAI CA Foundation & Intermediate), **GATE** (Engineering & Tech), **AE-JE** (Assistant & Junior Engineer), **Agriculture** (ICAR, ASRB, State Agri), and **State Boards** (MP Board, RBSE Rajasthan, CG Board) with category-targeted instant email alerts, pre-written marketing plays, clean Google Sheet tracking, and executive digests.

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
   - **MP State Board (MPBSE):** Madhya Pradesh Class 10 & 12 timetables, admit cards, and circulars.
   - **RBSE State Board:** Rajasthan Board secondary & senior secondary examination notifications.
   - **CG State Board (CGBSE):** Chhattisgarh Board exam timetables, admit cards, and results.
   - **MBA (CAT / XAT / OMETs):** IIM CAT, XLRI XAT, SNAP, NMAT, and CMAT notifications, percentiles, and results.
   - **IPMAT & JIPMAT:** Integrated Program in Management Aptitude Tests for IIM Indore, IIM Rohtak, and NTA JIPMAT.
   - **GMAT Focus Edition:** Graduate Management Admission Test updates, syllabus, score, and registration circulars.

2. **Multi-Category CMM Routing & Central Sheet Sync:**
   - **Dynamic CMM Ingestion:** Reads categories, tags (`INCLUDE`, `ALIAS`, `EXCLUDE`), and emails directly from the central Google Sheet (`1IIdA-chEZvTRT4xPKmvFp_U-6mCv6t2VdPTXOOhooYQ`).
   - **Strict Category Isolation:** Each Category Marketing Manager receives alerts **only** for their respective tags:
     - **UP State Board:** Delivered exclusively to `anshu.mishra@pw.live`
     - **CA Inter & Foundation:** Delivered exclusively to `moksh.sharma@pw.live`
     - **GATE:** Delivered exclusively to `falguni.gupta@pw.live`, `kashif.ahmed@pw.live`, `harsh.ayush1@pw.live`
     - **AE-JE:** Delivered exclusively to `falguni.gupta@pw.live`, `kashif.ahmed@pw.live`, `ananya.rajak@pw.live`
     - **Agriculture:** Delivered exclusively to `falguni.gupta@pw.live`, `kashif.ahmed@pw.live`, `ananya.rajak@pw.live`
     - **State Board (MP / RBSE / CG):** Delivered exclusively to `gitij.kumar@pw.live`
     - **MBA (CAT / XAT / OMETs):** Delivered exclusively to `jatin.sharma2@pw.live`, `prince.kumar1@pw.live`
     - **IPMAT & JIPMAT:** Delivered exclusively to `jatin.sharma2@pw.live`, `prince.kumar1@pw.live`
     - **GMAT Focus Edition:** Delivered exclusively to `jatin.sharma2@pw.live`, `prince.kumar1@pw.live`
     - **State PSC & Judiciary:** Delivered to Marketing Leadership (`CFG.EMAIL_TO`)
     - **Dedicated Official Portals Feed:** Delivered exclusively to `praphul.singh@pw.live` (119+ official portals: SSC, RRB, NTA NEET/JEE/CUET, UPSC, IBPS, Banking, Defence, State Education Boards, National Entrances). Decoupled and isolated from all other CMM workflows.
   - **Tag Honor Rules:** Strict exclusion tags (such as `JAM`, `CUET` for GATE; `Diploma admission` for AE-JE; `NEET`, `JEE` for Agri; `Mock test` for CA) are enforced at ingestion time.

3. **24/7 Automation via GitHub Actions & Webhook Triggers:**
   - **GitHub Actions (`.github/workflows/scrape.yml`):** Runs on cron every 10 minutes automatically.
   - **Cron-job.org / Webhook Trigger:** Directly pings `https://script.google.com/macros/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec?action=runMonitor` to trigger news monitoring and email dispatch on demand.
   - **Deduplication:** Uses SHA-256 hashes stored in `scraper/seen_hashes.json` and row history in Google Sheets to prevent duplicate email alerts.

4. **Apps Script / Google Sheet / Email Pipeline (`apps-script/ExamResultMonitor_v2.gs`):**
   - Color-coded priority badges (`CRITICAL`, `HIGH`, `NORMAL`).
   - Highlighted marketing campaign plays and hooks.
   - Clickable direct PDF links.
   - Instant rich HTML email alerts formatted specifically for executive clarity.

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

### Build Dashboard:
```bash
npm run build
```

---

## ⚙️ Deployment & Configuration

1. **Google Apps Script Web App Deployment:**
   - **Deployment ID:** `AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0`
   - **Web App URL:** `https://script.google.com/macros/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec`
   - **Trigger Actions:**
     - `?action=runMonitor` : Triggers the 24/7 exam news monitor & instant email dispatch.
     - `?action=syncTags` : Syncs CMM tags and recipient scopes from the central sheet.
     - `?action=health` : Returns system health and last processed metrics.

2. **GitHub Actions Secrets:**
   Go to **Settings > Secrets and variables > Actions** and ensure:
   - `GOOGLE_WEBAPP_URL`: `https://script.google.com/macros/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec`

3. **Enable Workflow Write Permissions:**
   Go to **Settings > Actions > General > Workflow permissions** and select **"Read and write permissions"** so the GitHub Action can commit updated circular hashes.

---

## 📂 Repository Structure

```
├── .github/
│   └── workflows/
│       └── scrape.yml             # 10-minute automated scraping cron job
├── apps-script/
│   └── ExamResultMonitor_v2.gs    # Google Sheet & Email alert dispatch engine
├── scraper/
│   ├── official_scrapers.js       # All 17 commission, board & legal scrapers
│   ├── probe_portals.js           # Network connectivity diagnostic
│   ├── latest_official_notices.json # Full structured database
│   └── seen_hashes.json           # SHA-256 deduplication cache
├── dashboard/                     # React executive radar web application
├── src/
│   └── worker.js                  # Cloudflare worker proxy & JSON feed API
├── package.json
└── README.md
```
