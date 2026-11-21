/**
 * EXAM INTELLIGENCE RADAR v2.0 — PW MARKETING
 * Google Apps Script
 *
 * Upgrades in v2.0:
 * 1. 🚀 Instant Telegram Bot Alerts to PW Marketing Group / DM with inline marketing action hooks.
 * 2. 🤖 Gemini 1.5 Flash (Free Tier) Integration: Pristine 5-word English summaries, Hindi/Advt resolution, and 1-sentence campaign hooks.
 * 3. 📧 Rich Executive HTML Email: Visual card blocks with headlines, marketing plays, and direct links right in your inbox.
 * 4. 🛡️ Circuit Breakers & Anti-Flood: Max 5 urgent Telegram alerts per run (bundles into a digest if more to prevent spam).
 * 5. 🔑 Composite SHA-256 Hash: Prevents duplicates and avoids Google News redirect token bugs.
 *
 * Script Properties (Project Settings > Script Properties):
 * - TRACKER_SHEET_ID (Required): Your Google Spreadsheet ID
 * - TELEGRAM_BOT_TOKEN (Optional): Telegram bot token from @BotFather
 * - TELEGRAM_CHAT_ID (Optional): Chat ID or Group ID (e.g., -100xxxxxxxxxx or your personal ID)
 * - GEMINI_API_KEY (Optional): Free API key from https://aistudio.google.com
 * - EMAIL_TO (Optional): Defaults to CFG.EMAIL_TO
 *
 * Setup:
 * 1. Run setupExamNewsMonitor() once to initialize sheet & hourly trigger.
 * 2. Run monitorExamNews() to perform an immediate live test.
 */

const CFG = {
  SHEET_NAME: 'Exam News Tracker',
  LOG_SHEET_NAME: 'Monitor Logs',
  EMAIL_TO: 'deepansh.gupta@pw.live,akshay.vaishnav@pw.live,aditya.kiran@pw.live,manas.mohan@pw.live,dipika.agrawal@pw.live,chhatrashal.singh@pw.live',
  TELEGRAM_BOT_TOKEN: '8962093670:AAEFDh6xdxBqVNUBIf3IybLRufbJYbjvNxI',
  TELEGRAM_CHAT_ID: '-5324420343', // Deepansh & Aditya Sir, Akshay Pw Group
  TIMEZONE: 'Asia/Kolkata',
  MAX_AGE_HOURS: 24, // Strictly today's articles only
  MAX_NEW_ROWS_PER_RUN: 150,
  MAX_TELEGRAM_ALERTS_PER_RUN: 5, // Circuit breaker against alert storms
  SEND_EMAIL_WHEN_NO_NEWS: false,
  FONT: 'Arial',
  FONT_SIZE: 10,
  GEMINI_MODEL: 'gemini-1.5-flash',
  GITHUB_NOTICES_URL: 'https://raw.githubusercontent.com/deep4nsh/pw-exam-intelligence/main/scraper/latest_official_notices.json',
  TRACKER_SHEET_ID: '1IIdA-chEZvTRT4xPKmvFp_U-6mCv6t2VdPTXOOhooYQ', // Default tracker spreadsheet
  TAGS_SHEET_ID: '1IIdA-chEZvTRT4xPKmvFp_U-6mCv6t2VdPTXOOhooYQ', // Central CMM Multi-Category Sheet
  ENABLE_DYNAMIC_CMM_TAGS: true // Auto-load CMM categories, tags & emails directly from Sheet
};

const HEADERS = [
  'Date & Time',
  'State / Body',
  'Exam Name',
  'Category',
  'Priority',
  'Quick Summary',
  '🎯 Suggested Marketing Action',
  'Official Notice / Link',
  'Telegram Alert',
  'Unique ID'
];

/**
 * Built-in Category Scopes for CMM Routing (Fallback & Base Config)
 */
const BUILTIN_CMM_SCOPES = [
  {
    name: 'UP State Board',
    sheetTab: 'UP State board',
    jurisdiction: 'Uttar Pradesh',
    exam: 'UP Board (Class 10 / 12)',
    category: 'UP State Board',
    recipientEmail: 'anshu.mishra@pw.live',
    aliases: ['UP State Board', 'UPMSP', 'Uttar Pradesh Madhyamik Shiksha Parishad', 'UP Board', 'Madhyamik'],
    includes: [
      'https://upmsp.edu.in/',
      'amarujala',
      'Jagran Josh',
      'UPMSP Result',
      'UPMSP Model Paper',
      'UPMSP Datesheet',
      'UPMSP Timetable',
      'UPMSP Scrutiny',
      'हाईस्कूल',
      'इण्टरमीडिएट'
    ],
    excludes: [],
    queries: [
      'UPMSP result board pariksha date sheet',
      'UP State Board timetable datesheet scrutiny',
      'UPMSP Model Paper amarujala jagran josh',
      'UPMSP Class 10 12 board pariksha',
      'Uttar Pradesh Madhyamik Shiksha Parishad UPMSP notice'
    ],
    kind: 'cmm_category'
  },
  {
    name: 'CA Inter & Fond Online',
    sheetTab: 'CA',
    jurisdiction: 'ICAI / National',
    exam: 'CA Foundation / Intermediate',
    category: 'CA Inter & Fond Online',
    recipientEmail: 'moksh.sharma@pw.live',
    aliases: [
      'CA Inter',
      'CA Inter results',
      'ICAI',
      'Foundation',
      'Intermediate',
      'Chartered Accountants',
      'CA Foundation',
      'CA Intermediate'
    ],
    includes: [
      'CA Foundation',
      'CA Intermediate',
      'CA Foundation Result',
      'CA Intermediate Results',
      'https://www.icai.org/category/announcements'
    ],
    excludes: [
      'Mock test'
    ],
    queries: [
      'ICAI CA Foundation result announcement date',
      'ICAI CA Intermediate result exam schedule',
      'Chartered Accountants CA Inter foundation notice',
      'ICAI examination announcement circular',
      'ICAI CA Inter results date sheet'
    ],
    kind: 'cmm_category'
  },
  {
    name: 'GATE',
    sheetTab: 'GATE',
    jurisdiction: 'National / IIT',
    exam: 'GATE (CSE, DA, ECE, EE, ME, CE, IN, Sciences)',
    category: 'GATE',
    recipientEmail: 'falguni.gupta@pw.live, kashif.ahmed@pw.live, harsh.ayush1@pw.live',
    aliases: [
      'GATE Computer Science',
      'GATE CS',
      'GATE Data Science and Artificial Intelligence',
      'GATE EE',
      'GATE ME',
      'GATE CE',
      'GATE IN',
      'Graduate Aptitude Test',
      'GATE exam'
    ],
    includes: [
      'GATE',
      'GATE 2027',
      'GATE 2026',
      'Graduate Aptitude Test in Engineering',
      'GATE CSE',
      'GATE DA',
      'GATE ECE',
      'GATE Electrical Engineering',
      'GATE Mechanical Engineering',
      'GATE Civil Engineering',
      'GATE Instrumentation Engineering',
      'GATE Engineering Sciences',
      'GATE Life Sciences',
      'GATE Chemistry',
      'GATE Physics',
      'GATE Mathematics',
      'GATE preparation',
      'GATE mock test',
      'GATE previous year questions',
      'GATE answer key',
      'GATE result',
      'GATE admit card',
      'GATE counselling'
    ],
    excludes: [
      'JAM',
      'CUET'
    ],
    queries: [
      'GATE 2026 2027 exam notification dates',
      'GATE answer key result score card update',
      'Graduate Aptitude Test in Engineering notification',
      'GATE admit card counselling schedule'
    ],
    kind: 'cmm_category'
  },
  {
    name: 'AE-JE',
    sheetTab: 'AE-JE',
    jurisdiction: 'Pan-India / State & Central Engineering',
    exam: 'Assistant Engineer & Junior Engineer (AE/JE)',
    category: 'AE-JE',
    recipientEmail: 'falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live',
    aliases: [
      'AE/JE',
      'AE',
      'JE',
      'AEE',
      'UPPSC Assistant Engineer',
      'SSC Junior Engineer',
      'Railway Junior Engineer',
      'Bihar Assistant Engineer',
      'Rajasthan Assistant Engineer',
      'Madhya Pradesh Assistant Engineer',
      'Uttarakhand AE JE',
      'Haryana Assistant Engineer'
    ],
    includes: [
      'AE JE',
      'Assistant Engineer',
      'Junior Engineer',
      'Assistant Executive Engineer',
      'Engineering recruitment',
      'State AE JE',
      'UPPSC AE',
      'UPSSSC JE',
      'SSC JE',
      'RRB JE',
      'BPSC AE',
      'RPSC AEN',
      'MPPSC AE',
      'UKPSC AE JE',
      'HPSC AE',
      'PSU engineering recruitment',
      'AE JE syllabus',
      'AE JE previous year questions',
      'AE JE mock test',
      'AE JE admit card',
      'AE JE answer key',
      'AE JE result'
    ],
    excludes: [
      'GATE',
      'Diploma admission'
    ],
    queries: [
      'SSC JE RRB JE recruitment notification',
      'State AE JE Assistant Engineer result exam date',
      'UPPSC AE UPSSSC JE vacancy circular',
      'Junior Engineer recruitment answer key'
    ],
    kind: 'cmm_category'
  },
  {
    name: 'Agriculture',
    sheetTab: 'Agriculture',
    jurisdiction: 'Pan-India / ICAR & State Agriculture',
    exam: 'Agriculture & Allied Competitive Exams',
    category: 'Agriculture',
    recipientEmail: 'falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live',
    aliases: [
      'Agricultural Scientists Recruitment Board',
      'NABARD Agriculture',
      'Agriculture Field Officer',
      'ADO'
    ],
    includes: [
      'Agriculture',
      'Agriculture exams',
      'Agriculture competitive exams',
      'Agriculture entrance exam',
      'ICAR',
      'ICAR AIEEA',
      'ICAR PG',
      'ICAR JRF',
      'ICAR SRF',
      'ICAR NET',
      'ASRB NET',
      'NABARD Grade A Agriculture',
      'IBPS AFO',
      'State Agriculture Officer',
      'Agriculture Officer',
      'Agriculture Development Officer',
      'AAO Agriculture',
      'Agriculture Supervisor',
      'Rajasthan Agriculture Supervisor',
      'UP Agriculture Technical Assistant',
      'BSc Agriculture',
      'MSc Agriculture',
      'Agronomy',
      'Horticulture',
      'Plant Pathology',
      'Entomology',
      'Soil Science',
      'Agricultural Economics',
      'Agricultural Extension',
      'Agriculture syllabus',
      'Agriculture previous year questions',
      'Agriculture mock test',
      'Agriculture admit card',
      'Agriculture answer key',
      'Agriculture result'
    ],
    excludes: [
      'NEET',
      'JEE'
    ],
    queries: [
      'ICAR AIEEA NET PG exam notification',
      'IBPS AFO Agriculture Field Officer result',
      'State Agriculture Officer Supervisor vacancy',
      'NABARD Grade A Agriculture exam date'
    ],
    kind: 'cmm_category'
  }
];

let _cachedScopes = null;

function getActiveCategoryScopes_() {
  if (_cachedScopes && _cachedScopes.length > 0) return _cachedScopes;

  if (CFG.ENABLE_DYNAMIC_CMM_TAGS) {
    try {
      const dynamicScopes = loadCategoryScopesFromTagsSheet_();
      if (dynamicScopes && dynamicScopes.length > 0) {
        _cachedScopes = dynamicScopes;
        return _cachedScopes;
      }
    } catch (e) {
      Logger.log('Dynamic tags loading notice: ' + e.message);
    }
  }

  _cachedScopes = getBuiltInScopes_();
  return _cachedScopes;
}

function getBuiltInScopes_() {
  return [...EXAM_SCOPES, ...BUILTIN_CMM_SCOPES];
}

/**
 * Loads dynamic categories, tags (INCLUDE, ALIAS, EXCLUDE) and CMM emails
 * directly from the shared Google Spreadsheet tabs!
 */
function loadCategoryScopesFromTagsSheet_() {
  const props = PropertiesService.getScriptProperties();
  const tagsSheetId = props.getProperty('TAGS_SHEET_ID') || CFG.TAGS_SHEET_ID;
  if (!tagsSheetId) return null;

  try {
    const ss = SpreadsheetApp.openById(tagsSheetId);
    const sheets = ss.getSheets();
    const dynamicScopes = [];

    sheets.forEach(sheet => {
      const sheetName = sheet.getName().trim();
      if (sheetName.toLowerCase() === 'sample' || sheetName === CFG.LOG_SHEET_NAME || sheetName === CFG.SHEET_NAME) return;

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      const numCols = Math.min(sheet.getLastColumn(), 5);
      const data = sheet.getRange(1, 1, lastRow, numCols).getValues();

      let categoryName = sheetName;
      const cmmEmails = [];
      const includes = [];
      const aliases = [];
      const excludes = [];

      data.forEach(row => {
        const colA = String(row[0] || '').trim();
        const colB = String(row[1] || '').trim();
        const colC = String(row[2] || '').trim().toUpperCase();

        if (colA && !/category|exam|mail|email/i.test(colA)) {
          categoryName = colA;
        }

        // Collect all CMM emails across columns A and B
        [colA, colB].forEach(cell => {
          if (cell && cell.includes('@')) {
            cell.replace(/;/g, ',').split(',').forEach(em => {
              em = em.trim();
              if (em.includes('@') && !cmmEmails.includes(em)) {
                cmmEmails.push(em);
              }
            });
          }
        });

        if (colB && !/tag to add|category|exam|mail|email/i.test(colB) && !colB.includes('@')) {
          if (colC === 'ALIAS') {
            aliases.push(colB);
          } else if (colC === 'EXCLUDE') {
            excludes.push(colB);
          } else {
            includes.push(colB);
          }
        }
      });

      let cmmEmail = cmmEmails.join(', ');
      if (!cmmEmail) {
        if (/up state|upmsp|up board/i.test(categoryName + ' ' + sheetName)) cmmEmail = 'anshu.mishra@pw.live';
        else if (/ca |icai/i.test(categoryName + ' ' + sheetName)) cmmEmail = 'moksh.sharma@pw.live';
        else if (/gate/i.test(categoryName + ' ' + sheetName)) cmmEmail = 'falguni.gupta@pw.live, kashif.ahmed@pw.live, harsh.ayush1@pw.live';
        else if (/ae[- ]?je/i.test(categoryName + ' ' + sheetName)) cmmEmail = 'falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live';
        else if (/agri/i.test(categoryName + ' ' + sheetName)) cmmEmail = 'falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live';
        else cmmEmail = CFG.EMAIL_TO;
      }

      const queryKeywords = [...includes, ...aliases]
        .filter(k => !k.startsWith('http') && k.length > 2 && !/amarujala|jagran/i.test(k))
        .slice(0, 6);

      const queries = queryKeywords.map(k => `${categoryName} ${k}`);
      if (queries.length === 0) {
        queries.push(`${categoryName} exam notification result dates`);
      }

      dynamicScopes.push({
        name: categoryName,
        sheetTab: sheetName,
        jurisdiction: sheetName,
        exam: categoryName,
        category: categoryName,
        recipientEmail: cmmEmail,
        aliases: aliases.length > 0 ? aliases : [categoryName],
        includes: includes,
        excludes: excludes,
        queries: queries,
        kind: 'cmm_category'
      });
    });

    if (dynamicScopes.length > 0) {
      log_('INFO', `Loaded ${dynamicScopes.length} dynamic CMM categories from Sheet.`, JSON.stringify(dynamicScopes.map(s => ({ tab: s.sheetTab, email: s.recipientEmail }))));
      return [...EXAM_SCOPES, ...dynamicScopes];
    }
  } catch (err) {
    Logger.log('Could not read tags sheet via SpreadsheetApp: ' + err.message);
  }

  return null;
}

function isUpBoardItem_(item) {
  if (!item) return false;
  if (item.recipientEmail === 'anshu.mishra@pw.live' || item.targetEmail === 'anshu.mishra@pw.live') return true;
  const text = (
    String(item.category || '') + ' ' +
    String(item.exam || '') + ' ' +
    String(item.jurisdiction || '') + ' ' +
    String(item.scope || '') + ' ' +
    String(item.title || '') + ' ' +
    String(item.url || '') + ' ' +
    String(item.queryLabel || '')
  ).toLowerCase();

  return /up state board|up board|upmsp|madhyamik|हाईस्कूल|इण्टरमीडिएट|results\.upmsp|board_modelpaper|upmsp\.edu\.in/i.test(text);
}

function isCaItem_(item) {
  if (!item) return false;
  if (item.recipientEmail === 'moksh.sharma@pw.live' || item.targetEmail === 'moksh.sharma@pw.live') return true;
  const text = (
    String(item.category || '') + ' ' +
    String(item.exam || '') + ' ' +
    String(item.jurisdiction || '') + ' ' +
    String(item.scope || '') + ' ' +
    String(item.title || '') + ' ' +
    String(item.url || '') + ' ' +
    String(item.queryLabel || '')
  ).toLowerCase();

  return /ca inter|ca foundation|ca final|icai|chartered accountant|caresults\.icai|resource\.cdn\.icai|icai\.org/i.test(text);
}

function isGateItem_(item) {
  if (!item) return false;
  const emails = String(item.recipientEmail || '') + ' ' + String(item.targetEmail || '');
  if (/falguni\.gupta|kashif\.ahmed|harsh\.ayush1/i.test(emails) && /gate/i.test(String(item.category || '') + ' ' + String(item.sheetTab || '') + ' ' + String(item.exam || ''))) return true;
  const text = (
    String(item.category || '') + ' ' +
    String(item.exam || '') + ' ' +
    String(item.jurisdiction || '') + ' ' +
    String(item.scope || '') + ' ' +
    String(item.title || '') + ' ' +
    String(item.url || '') + ' ' +
    String(item.queryLabel || '')
  ).toLowerCase();

  return /\bgate\b|graduate aptitude test in engineering|gate 202[5-7]|gate cse|gate da|gate ece/i.test(text);
}

function isAeJeItem_(item) {
  if (!item) return false;
  const emails = String(item.recipientEmail || '') + ' ' + String(item.targetEmail || '');
  if (/falguni\.gupta|kashif\.ahmed|ananya\.rajak/i.test(emails) && /ae[- ]?je/i.test(String(item.category || '') + ' ' + String(item.sheetTab || ''))) return true;
  const text = (
    String(item.category || '') + ' ' +
    String(item.exam || '') + ' ' +
    String(item.jurisdiction || '') + ' ' +
    String(item.scope || '') + ' ' +
    String(item.title || '') + ' ' +
    String(item.url || '') + ' ' +
    String(item.queryLabel || '')
  ).toLowerCase();

  return /\bae[- /]?je\b|\bassistant engineer\b|\bjunior engineer\b|\baee\b|upsssc je|ssc je|rrb je|bpsc ae|uppsc ae|rpsc aen|mppsc ae/i.test(text);
}

function isAgricultureItem_(item) {
  if (!item) return false;
  const emails = String(item.recipientEmail || '') + ' ' + String(item.targetEmail || '');
  if (/falguni\.gupta|kashif\.ahmed|ananya\.rajak/i.test(emails) && /agri/i.test(String(item.category || '') + ' ' + String(item.sheetTab || ''))) return true;
  const text = (
    String(item.category || '') + ' ' +
    String(item.exam || '') + ' ' +
    String(item.jurisdiction || '') + ' ' +
    String(item.scope || '') + ' ' +
    String(item.title || '') + ' ' +
    String(item.url || '') + ' ' +
    String(item.queryLabel || '')
  ).toLowerCase();

  return /\bagriculture\b|\bicar\b|\basrb net\b|\bibps afo\b|\bagronomy\b|\bhorticulture\b|agriculture officer|krishi adhikari|agriculture supervisor/i.test(text);
}

function isCmmOnlyItem_(item) {
  if (!item) return false;
  if (item.kind === 'cmm_category') return true;
  if (isUpBoardItem_(item) || isCaItem_(item) || isGateItem_(item) || isAeJeItem_(item) || isAgricultureItem_(item)) return true;
  const emails = String(item.recipientEmail || '') + ' ' + String(item.targetEmail || '');
  if (emails && emails.includes('@pw.live') && !emails.includes(getEmailTo_())) return true;
  return false;
}

const MONTH_MAP_ = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

function getTodayIST_() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd');
}

function parseSingleDate_(str) {
  if (!str) return null;
  str = String(str).trim();
  const m1 = str.match(/\b([0-3]?\d)[-/.]([0-1]?\d)[-/.](\d{4})\b/);
  if (m1) return { d: +m1[1], m: +m1[2], y: +m1[3] };

  const m2 = str.match(/\b(\d{4})[-/.]([0-1]?\d)[-/.]([0-3]?\d)\b/);
  if (m2) return { y: +m2[1], m: +m2[2], d: +m2[3] };

  const m3 = str.match(/\b([a-zA-Z]{3,9})\s+([0-3]?\d)\s*,?\s*(\d{4})\b/);
  if (m3 && MONTH_MAP_[m3[1].toLowerCase()]) return { m: MONTH_MAP_[m3[1].toLowerCase()], d: +m3[2], y: +m3[3] };

  const m4 = str.match(/\b([0-3]?\d)\s+([a-zA-Z]{3,9})\s*,?\s*(\d{4})\b/);
  if (m4 && MONTH_MAP_[m4[2].toLowerCase()]) return { d: +m4[1], m: MONTH_MAP_[m4[2].toLowerCase()], y: +m4[3] };

  return null;
}

function extractNoticeDate_(item) {
  const title = item.title || '';
  const url = item.url || '';

  // 1. Strict URL Date Inspection: check if article URL contains date (/2026/11/14/, /2026-11-14/, /14-11-2026/)
  const urlYmdSlashes = url.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (urlYmdSlashes) return { y: +urlYmdSlashes[1], m: +urlYmdSlashes[2], d: +urlYmdSlashes[3] };
  const urlDmySlashes = url.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (urlDmySlashes) return { d: +urlDmySlashes[1], m: +urlDmySlashes[2], y: +urlDmySlashes[3] };

  // 2. Explicit dated string in title or URL (e.g. "dated 14-11-2026", "दिनांक 14.11.2026")
  const markedDate = (title + ' ' + url).match(/(?:dated|dt\.?|दिनांक|date)[_:\s]+([0-3]?\d)[-_/.]([0-1]?\d)[-_/.](20\d{2})/i);
  if (markedDate) return { d: +markedDate[1], m: +markedDate[2], y: +markedDate[3] };

  const trailingParen = title.match(/\(\s*([0-3]?\d)[-/.]([0-1]?\d)[-/.](\d{4})\s*\)\s*$/);
  if (trailingParen) return { d: +trailingParen[1], m: +trailingParen[2], y: +trailingParen[3] };

  // 3. Stored/scraped item date string
  if (item.date && item.date !== 'Recent' && item.date.length >= 6) {
    const p = parseSingleDate_(item.date);
    if (p) return p;
  }

  // 4. Feed publication date or ISO timestamp
  if (item.publishedDate || item.published || item.pubDate) {
    const raw = item.publishedDate || item.published || item.pubDate;
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) {
      const dtIST = Utilities.formatDate(dt, CFG.TIMEZONE, 'yyyy-MM-dd');
      const parts = dtIST.split('-').map(Number);
      return { y: parts[0], m: parts[1], d: parts[2] };
    }
  }

  const urlDmy = url.match(/[_-]([0-3]\d)[_-]([0-1]\d)[_-](20\d{2})\.pdf/i);
  if (urlDmy) return { d: +urlDmy[1], m: +urlDmy[2], y: +urlDmy[3] };
  const urlYmd = url.match(/20\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (urlYmd) {
    const raw = urlYmd[0];
    return { y: +raw.slice(0, 4), m: +raw.slice(4, 6), d: +raw.slice(6, 8) };
  }
  const urlDdmmyyyy = url.match(/[_-]([0-3]\d)(0[1-9]|1[0-2])(20\d{2})/);
  if (urlDdmmyyyy) {
    return { d: +urlDdmmyyyy[1], m: +urlDdmmyyyy[2], y: +urlDdmmyyyy[3] };
  }
  const anyDmy = title.match(/\b([0-3]?\d)[-/.]([0-1]?\d)[-/.](\d{4})\b/);
  if (anyDmy) return { d: +anyDmy[1], m: +anyDmy[2], y: +anyDmy[3] };
  return null;
}

/**
 * Strict date filter: checks if article/notice was issued/published TODAY in IST.
 * If older than today, returns false.
 */
function isNoticeFromToday_(item) {
  const todayIST = getTodayIST_();
  const parts = todayIST.split('-').map(Number);
  const p = extractNoticeDate_(item);
  if (!p) return false;
  return p.y === parts[0] && p.m === parts[1] && p.d === parts[2];
}

function getCmmEmailForCategory_(item) {
  // 1. Strict Category Isolation: UP Board items ALWAYS route to Anshu Mishra
  if (isUpBoardItem_(item)) {
    return 'anshu.mishra@pw.live';
  }

  // 2. Strict Category Isolation: CA items ALWAYS route to Moksh Sharma
  if (isCaItem_(item)) {
    return 'moksh.sharma@pw.live';
  }

  // 3. Strict Category Isolation: GATE items ALWAYS route to Falguni, Kashif, Harsh
  if (isGateItem_(item)) {
    return 'falguni.gupta@pw.live, kashif.ahmed@pw.live, harsh.ayush1@pw.live';
  }

  // 4. Strict Category Isolation: AE-JE items ALWAYS route to Falguni, Kashif, Ananya
  if (isAeJeItem_(item)) {
    return 'falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live';
  }

  // 5. Strict Category Isolation: Agriculture items ALWAYS route to Falguni, Kashif, Ananya
  if (isAgricultureItem_(item)) {
    return 'falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live';
  }

  if (item.targetEmail && item.targetEmail.includes('@') && item.targetEmail !== getEmailTo_()) {
    return item.targetEmail.trim();
  }
  if (item.recipientEmail && item.recipientEmail.includes('@') && item.recipientEmail !== getEmailTo_()) {
    return item.recipientEmail.trim();
  }

  // Match dynamic CMM scopes
  try {
    const text = (
      String(item.category || '') + ' ' +
      String(item.exam || '') + ' ' +
      String(item.jurisdiction || '') + ' ' +
      String(item.title || '')
    ).toLowerCase();

    const activeScopes = getActiveCategoryScopes_().filter(s => s.kind === 'cmm_category');
    for (const scope of activeScopes) {
      const scopeName = (scope.name || '').toLowerCase();
      const tabName = (scope.sheetTab || '').toLowerCase();
      if (text.includes(scopeName) || text.includes(tabName)) {
        if (scope.recipientEmail && scope.recipientEmail.includes('@')) {
          return scope.recipientEmail.trim();
        }
      }
    }
  } catch (e) {}

  return getEmailTo_();
}

const EXAM_SCOPES = [
  {
    name: 'UPPSC',
    jurisdiction: 'Uttar Pradesh',
    aliases: ['UPPSC', 'Uttar Pradesh Public Service Commission', 'UP PCS', 'PCS', 'RO/ARO', 'RO ARO', 'Combined State'],
    queries: [
      'UPPSC notification recruitment exam',
      'UPPSC application last date deadline',
      'UPPSC exam calendar schedule date',
      'UPPSC admit card answer key',
      'UPPSC prelims mains interview result cutoff',
      'UPPSC corrigendum syllabus eligibility age limit',
      'Uttar Pradesh Public Service Commission recruitment notice'
    ]
  },
  {
    name: 'BPSC',
    jurisdiction: 'Bihar',
    aliases: ['BPSC', 'Bihar Public Service Commission', 'BPSC CCE', 'BPSC TRE', '70th BPSC', '71st BPSC', 'BPSC APO', 'Bihar APO', 'Prosecution Officer', 'Bihar Judicial Service', '32nd BJS', '33rd BJS'],
    queries: [
      'BPSC Prosecution Officer APO prelims mains result',
      'Bihar Assistant Prosecution Officer APO result cutoff',
      'Bihar Judicial Service PCS-J exam date result cutoff',
      'BPSC notification recruitment exam',
      'BPSC application last date deadline',
      'BPSC exam calendar schedule date',
      'BPSC admit card answer key',
      'BPSC prelims mains interview result cutoff',
      'BPSC corrigendum syllabus eligibility age limit',
      'Bihar Public Service Commission recruitment notice'
    ]
  },
  {
    name: 'MPSC',
    jurisdiction: 'Maharashtra',
    aliases: ['MPSC', 'Maharashtra Public Service Commission', 'Rajyaseva'],
    queries: [
      'MPSC Maharashtra notification recruitment exam',
      'MPSC application last date deadline',
      'MPSC exam calendar schedule date',
      'MPSC admit card answer key',
      'MPSC prelims mains interview result cutoff',
      'MPSC corrigendum syllabus eligibility age limit',
      'Maharashtra Public Service Commission recruitment notice'
    ]
  },
  {
    name: 'MPPSC',
    jurisdiction: 'Madhya Pradesh',
    aliases: ['MPPSC', 'Madhya Pradesh Public Service Commission', 'State Service Examination'],
    queries: [
      'MPPSC notification recruitment exam',
      'MPPSC application last date deadline',
      'MPPSC exam calendar schedule date',
      'MPPSC admit card answer key',
      'MPPSC prelims mains interview result cutoff',
      'MPPSC corrigendum syllabus eligibility age limit',
      'Madhya Pradesh Public Service Commission recruitment notice'
    ]
  },
  {
    name: 'OPSC',
    jurisdiction: 'Odisha',
    aliases: [
      'OPSC',
      'Odisha Public Service Commission',
      'Orissa Public Service Commission',
      'OAS'
    ],
    queries: [
      'OPSC notification recruitment exam',
      'OPSC application last date deadline',
      'OPSC exam calendar schedule date',
      'OPSC admit card answer key',
      'OPSC prelims mains interview result cutoff',
      'OPSC corrigendum syllabus eligibility age limit',
      'Odisha Public Service Commission recruitment notice'
    ]
  },
  {
    name: 'RPSC / RAS',
    jurisdiction: 'Rajasthan',
    aliases: ['RPSC', 'Rajasthan Public Service Commission', 'RAS', 'RTS'],
    queries: [
      'RPSC RAS notification recruitment exam',
      'RPSC RAS application last date deadline',
      'RPSC exam calendar schedule date',
      'RPSC RAS admit card answer key',
      'RPSC RAS prelims mains interview result cutoff',
      'RPSC corrigendum syllabus eligibility age limit',
      'Rajasthan Public Service Commission recruitment notice'
    ]
  },
  {
    name: 'ADA & Prosecution',
    jurisdiction: 'State Prosecution Departments',
    aliases: ['ADA', 'Assistant District Attorney', 'APO', 'Assistant Prosecution Officer', 'Prosecution Officer', 'ADPO', 'APP', 'Public Prosecutor', 'HPSC ADA', 'Punjab ADA', 'Bihar APO', 'BPSC APO', 'UP APO'],
    queries: [
      'Bihar Assistant Prosecution Officer APO prelims result',
      'Bihar APO Prosecution Officer result cutoff',
      'Assistant District Attorney notification recruitment exam',
      'HPSC ADA exam date admit card result',
      'Punjab ADA recruitment exam notification',
      'UP Assistant Prosecution Officer APO exam notification',
      'MP ADPO exam date admit card result',
      'Assistant Public Prosecutor recruitment notice'
    ]
  },
  {
    name: 'Bar Advocacy & AIBE',
    jurisdiction: 'Bar Council of India',
    aliases: ['AIBE', 'All India Bar Examination', 'Bar Council of India', 'BCI', 'Advocate-on-Record', 'AOR'],
    queries: [
      'All India Bar Examination AIBE registration notification',
      'AIBE exam date admit card result syllabus',
      'Bar Council of India BCI exam notification circular',
      'Supreme Court Advocate on Record examination notification'
    ]
  }
];

const JUDICIARY_QUERIES = [
  'Bihar Assistant Prosecution Officer APO prelims result',
  'Bihar Judicial Service BJS civil judge exam result',
  'Delhi Judicial Service DJS prelims mains result',
  'Rajasthan Judicial Service RJS civil judge result',
  'MP Civil Judge cadre prelims mains result',
  'judiciary exam notification civil judge recruitment India',
  'judicial services application deadline exam date India',
  'High Court recruitment notification judicial service',
  'Supreme Court recruitment exam notification India',
  'judiciary exam admit card answer key result cutoff',
  'judicial services syllabus eligibility age limit change',
  'High Court judge recruitment exam schedule',
  'judicial services mains interview result selection list',
  'Supreme Court High Court order judicial recruitment exam',
  'judicial service exam corrigendum postponement cancellation',
  'Assistant District Attorney ADA exam recruitment notification India',
  'All India Bar Examination AIBE notification exam date registration'
];

const EXAM_TERMS =
  /\b(exam|examination|recruit|recruitment|vacanc(?:y|ies)|commission|public service|civil judge|judicial service|judiciary|administrative service|selection|candidate|application|competitive|prelims|preliminary|mains|interview|personality test|assistant district attorney|ada|prosecution|apo|adpo|app|jlo|public prosecutor|aibe|bar council|advocate|law officer|hjs|dhjs|djs|bjs|rjs|ojs|wbjs|jmfc|cjjd|law clerk|legal assistant|legal researcher|research assistant|aor|advocate on record|board|madhyamik|upmsp|up board|high school|chartered accountant|icai|ca foundation|ca intermediate|ca inter|cbt)\b/i;

const UPDATE_TERMS =
  /\b(notification|notifies|notified|advertisement|released|release|announces|announced|schedule|calendar|date|dates|postponed|rescheduled|cancelled|canceled|deferred|admit card|hall ticket|answer key|response sheet|result|results|cut.?off|merit list|selection list|final list|provisional list|document verification|dv schedule|omr sheet|scorecard|marksheet|marks statement|city intimation|call letter|viva-voce|viva voce|application|registration|last date|deadline|extended|extension|corrigendum|correction window|edit window|syllabus|eligibility|age limit|reservation|vacancy|vacancies|interview|court order|judgment|judgement|stay order|revised|objection window|recruitment rules|datesheet|timetable|scrutiny|model paper|परिणाम|प्रवेश पत्र|उत्तर कुंजी|विज्ञप्ति|शुद्धिपत्र|मॉडल पेपर|परीक्षाफल|समय सारणी)\b/i;

const EXCLUDE_TERMS =
  /\b(railway|railways|ntpc|rrb|coast guard|cgept|navik|yantrik|hygienist|gramin dak sevak|gds|post office|postal assistant|ibps(?!\s*so|\s*specialist|\s*law)|sbi po|sbi clerk|sbi apprentice|rbi grade|ssc cgl|ssc chsl|ssc gd|ssc mts|agniveer|army recruitment|navy recruitment|air force recruitment|nda\b|cds\b|afcat|gate\b|neet\b|jee main|expected cut.?off|safe score|exam analysis|salary|job profile|how to (?:check|download|apply|prepare|access)|preparation tips|bail granted|bail rejected|anticipatory bail|fir\b|murder|accident|quashes constable|quashes dismissal|expected soon|likely soon|expected shortly|likely to release|likely to be (?:released|out|declared)|expected today|expected anytime|check download steps|steps to (?:check|download|apply|access)|will be (?:released|announced|out) soon|tentative schedule|tentative date|date announced soon|link soon|awaited|waiting for|any moment now|anticipated soon|out today\?)\b/i;


/* ==========================================================================
   SETUP & INITIALIZATION
   ========================================================================== */

function setupExamNewsMonitor() {
  const ss = getSpreadsheet_();
  if (!ss) {
    throw new Error(
      'Required: Add TRACKER_SHEET_ID in Project Settings > Script Properties, or attach this script to a Google Spreadsheet.'
    );
  }

  let sheet = ss.getSheetByName(CFG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CFG.SHEET_NAME);

  initializeTrackerSheet_(sheet);

  let logs = ss.getSheetByName(CFG.LOG_SHEET_NAME);
  if (!logs) logs = ss.insertSheet(CFG.LOG_SHEET_NAME);

  if (logs.getLastRow() === 0) {
    logs.appendRow(['Timestamp', 'Level', 'Message', 'Details']);
    styleHeader_(logs, 4);
  }

  // Prevent duplicate hourly triggers.
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'monitorExamNews') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('monitorExamNews')
    .timeBased()
    .everyHours(1)
    .create();

  log_('INFO', 'Setup complete. Hourly monitor trigger installed.', '');
  Logger.log('Setup complete. Run monitorExamNews() to test.');
}


/* ==========================================================================
   MAIN MONITOR ENGINE
   ========================================================================== */

function monitorExamNews() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    log_('WARN', 'Skipped overlapping execution.', '');
    return;
  }

  const started = new Date();

  try {
    const ss = getSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, CFG.SHEET_NAME);
    initializeTrackerSheet_(sheet);

    const known = loadKnownSet_(sheet);
    const jobs = buildFeedJobs_();
    const fetched = fetchFeeds_(jobs);

    const seen = new Set();
    const rawCandidates = [];
    const now = Date.now();

    fetched.items.forEach(item => {
      const url = cleanUrl_(item.url);
      if (!url) return;

      const uid = generateCompositeHash_(item.title, url);
      if (known.has(uid) || known.has(url) || seen.has(uid) || seen.has(url)) return;
      seen.add(uid);
      seen.add(url);

      const published = item.published ? new Date(item.published) : null;
      if (published && !isNaN(published.getTime())) {
        const todayIST = getTodayIST_();
        const pubDateIST = Utilities.formatDate(published, CFG.TIMEZONE, 'yyyy-MM-dd');
        if (pubDateIST !== todayIST) return; // Discard articles older than today
      }

      // Strict date filter: discard if date in title, URL, or content is older than today
      if (!isNoticeFromToday_(item)) return;

      const evaluation = evaluateItem_(item);
      if (!evaluation.keep) return;

      rawCandidates.push({
        ...item,
        uniqueId: uid,
        url: url,
        publishedDate: published && !isNaN(published.getTime()) ? published : null,
        exam: evaluation.exam,
        jurisdiction: evaluation.jurisdiction,
        category: evaluation.category,
        priority: evaluation.priority,
        status: evaluation.status,
        recipientEmail: evaluation.recipientEmail,
        targetEmail: evaluation.targetEmail,
        kind: evaluation.kind
      });
    });

    // Ingest 100% verified official commission circulars from GitHub Repository
    const officialNotices = fetchOfficialNoticesFromGitHub_(known);
    if (officialNotices.length > 0) {
      log_('INFO', `Ingested ${officialNotices.length} official notices from GitHub.`, '');
      rawCandidates.push(...officialNotices);
    }

    if (rawCandidates.length === 0) {
      log_('INFO', 'Run complete: 0 new items found.', '');
      if (CFG.SEND_EMAIL_WHEN_NO_NEWS) {
        MailApp.sendEmail({
          to: getEmailTo_(),
          subject: 'Exam Radar — No new items',
          body: 'No new exam updates discovered in this cycle.'
        });
      }
      return;
    }

    // Sort candidates: newest first, then by priority.
    rawCandidates.sort((a, b) => {
      const tA = a.publishedDate ? a.publishedDate.getTime() : 0;
      const tB = b.publishedDate ? b.publishedDate.getTime() : 0;
      if (tB !== tA) return tB - tA;
      return priorityRank_(b.priority) - priorityRank_(a.priority);
    });

    const selected = rawCandidates.slice(0, CFG.MAX_NEW_ROWS_PER_RUN);

    // Reset AI circuit breaker for this run
    _geminiDisabled = false;

    // Enrich items (AI only on Critical/High to save time, instant rule engine for others)
    const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    selected.forEach(item => {
      if (item.isOfficialVerified && item.marketingAction && item.summary) {
        // Keep pristine official scraper-generated hooks
        return;
      }
      if (item.kind === 'cmm_category' || isCmmOnlyItem_(item)) {
        // Preserve category, exam & recipient email for CMM categories
        const enrichment = enrichWithAIOrRules_(item, geminiKey);
        item.summary = enrichment.summary || item.summary || item.title;
        item.marketingAction = enrichment.marketingAction || item.marketingAction || 'Share update on PW channel';
        return;
      }
      const enrichment = enrichWithAIOrRules_(item, geminiKey);
      item.summary = enrichment.summary;
      item.marketingAction = enrichment.marketingAction;
      if (enrichment.refinedExam) item.exam = enrichment.refinedExam;
      if (enrichment.refinedCategory) item.category = enrichment.refinedCategory;
      if (enrichment.refinedPriority) item.priority = enrichment.refinedPriority;
    });

    // Dispatch Telegram Alerts
    dispatchTelegramAlerts_(selected);

    // Insert into Tracker Sheet (Clean 10-Column Executive Schema)
    const rows = selected.map(item => [
      item.publishedDate || new Date(),
      item.jurisdiction,
      item.exam,
      item.category,
      item.priority,
      item.summary,
      item.marketingAction,
      item.url,
      item.telegramStatus || 'SKIPPED',
      item.uniqueId
    ]);

    sheet.insertRowsBefore(2, rows.length);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    formatDataRows_(sheet, 2, rows.length);

    // Send Rich HTML Email (with Pointers & Action Cards)
    sendRichExecutiveEmail_(selected, ss.getUrl());

    log_('INFO', 'Monitor cycle successful.', JSON.stringify({
      newItems: selected.length,
      highPriority: selected.filter(i => i.priority === 'HIGH' || i.priority === 'CRITICAL').length,
      timeElapsedSec: Math.round((Date.now() - started.getTime()) / 1000)
    }));

  } catch (err) {
    log_('ERROR', 'Monitor failed.', String(err.stack || err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}


/* ==========================================================================
   TELEGRAM DISPATCH ENGINE (With Anti-Flood Circuit Breaker)
   ========================================================================== */

function dispatchTelegramAlerts_(items) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN') || CFG.TELEGRAM_BOT_TOKEN;
  const chatId = props.getProperty('TELEGRAM_CHAT_ID') || CFG.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    items.forEach(i => i.telegramStatus = 'NO_CONFIG');
    return;
  }

  // Filter urgent State PSC & Judiciary items ONLY (strictly exclude all CMM categories)
  const urgent = items.filter(i => 
    (i.priority === 'CRITICAL' || i.priority === 'HIGH') && 
    !isCmmOnlyItem_(i)
  );

  if (urgent.length === 0) {
    items.forEach(i => i.telegramStatus = 'SKIPPED_NORMAL');
    return;
  }

  // Circuit breaker: If more than MAX_TELEGRAM_ALERTS_PER_RUN, send a single digest
  if (urgent.length > CFG.MAX_TELEGRAM_ALERTS_PER_RUN) {
    const digestText = buildTelegramDigest_(urgent);
    const sent = sendTelegramRaw_(token, chatId, digestText);
    items.forEach(i => i.telegramStatus = sent ? 'DIGEST_SENT' : 'FAILED');
    return;
  }

  // Individual alerts for <= MAX_TELEGRAM_ALERTS_PER_RUN
  urgent.forEach(item => {
    const msg =
      `🚨 <b>[${escapeHtml_(item.jurisdiction)}] ${escapeHtml_(item.category.toUpperCase())}</b>\n\n` +
      `📋 <b>Exam:</b> ${escapeHtml_(item.exam)}\n` +
      `📰 <b>Title:</b> ${escapeHtml_(item.title)}\n` +
      `💡 <b>Summary:</b> ${escapeHtml_(item.summary)}\n\n` +
      `🎯 <b>MARKETING ACTION:</b>\n<i>"${escapeHtml_(item.marketingAction)}"</i>\n\n` +
      `🔗 <a href="${item.url}">Read Official / News Link</a>`;

    const success = sendTelegramRaw_(token, chatId, msg);
    item.telegramStatus = success ? 'SENT' : 'FAILED';
    Utilities.sleep(1200); // 1.2s delay to respect Telegram 1 msg/sec rate limit
  });
}

function buildTelegramDigest_(items) {
  let text = `📢 <b>EXAM RADAR DIGEST: ${items.length} Urgent Updates Detected</b>\n\n`;
  items.slice(0, 8).forEach((item, idx) => {
    text += `${idx + 1}. [${escapeHtml_(item.jurisdiction)}] <b>${escapeHtml_(item.exam)}</b>: ${escapeHtml_(item.summary)}\n`;
    text += `   👉 <i>Action:</i> ${escapeHtml_(item.marketingAction)}\n`;
    text += `   🔗 <a href="${item.url}">Link</a>\n\n`;
  });
  text += `<i>Review full tracker in Google Sheets.</i>`;
  return text;
}

function sendTelegramRaw_(token, chatId, htmlText) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
    return res.getResponseCode() === 200;
  } catch (e) {
    log_('WARN', 'Telegram dispatch failed', String(e));
    return false;
  }
}


/* ==========================================================================
   AI INTELLIGENCE (Gemini 1.5 Flash Free Tier + Heuristic Fallback)
   ========================================================================== */

let _geminiDisabled = false;

function enrichWithAIOrRules_(item, apiKey) {
  // Only call Gemini for Critical/High items if not circuit-broken
  const isUrgent = item.priority === 'CRITICAL' || item.priority === 'HIGH';
  if (apiKey && !_geminiDisabled && isUrgent) {
    try {
      const aiResult = callGeminiFlash_(item.title, item.description, item.jurisdiction, apiKey);
      if (aiResult) return aiResult;
    } catch (e) {
      log_('WARN', 'Gemini enrichment fallback', String(e));
    }
  }

  // Fast Instant Rule Fallback (<0.01 ms)
  return {
    summary: makeSummaryFallback_(item.title, item.category),
    marketingAction: generateMarketingActionFallback_(item.category, item.exam),
    refinedExam: null,
    refinedCategory: null,
    refinedPriority: null
  };
}

function callGeminiFlash_(title, description, jurisdiction, apiKey) {
  if (_geminiDisabled) return null;

  const prompt =
    `You are an EdTech Senior Product Manager for Physics Wallah (State PSC and Judiciary exams).\n` +
    `Analyze this exam notice and output strictly a valid JSON object.\n` +
    `Notice Title: "${title}"\n` +
    `Description: "${description || ''}"\n` +
    `Jurisdiction: "${jurisdiction}"\n\n` +
    `Output format:\n` +
    `{\n` +
    `  "summary": "5 to 6 words crisp English summary",\n` +
    `  "marketingAction": "1 clear actionable marketing campaign or content angle for PW team (e.g. Launch crash course ads, host YouTube Live analysis, schedule student deadline reminder)",\n` +
    `  "category": "Notification|Admit Card|Result|Exam Schedule|Answer Key|Deadline|Corrigendum|Policy",\n` +
    `  "priority": "CRITICAL|HIGH|NORMAL"\n` +
    `}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CFG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-goog-api-key': apiKey
    },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    _geminiDisabled = true; // Trip circuit breaker immediately on ANY error (401, 403, 404, 429, 500) to prevent stalling!
    log_('WARN', 'Gemini API returned ' + code + '. Circuit breaker tripped; switching to instant rule engine for this cycle.', '');
    return null;
  }

  const data = JSON.parse(response.getContentText());
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return null;

  const parsed = JSON.parse(rawJson);
  return {
    summary: parsed.summary || makeSummaryFallback_(title, 'General'),
    marketingAction: parsed.marketingAction || generateMarketingActionFallback_('General', jurisdiction),
    refinedCategory: parsed.category,
    refinedPriority: parsed.priority
  };
}

function generateMarketingActionFallback_(category, exam) {
  switch (category) {
    case 'Notification / Recruitment':
      return `Schedule YouTube Live notification breakdown (<45m) and launch Target Batch ad creatives.`;
    case 'Admit Card':
      return `Blast student app push notification with download guidelines; launch 7-day revision marathon promo.`;
    case 'Result':
      return `Broadcast PW student selections; push next-stage Mains/Interview mentorship batch.`;
    case 'Exam Schedule':
      return `Push 'Countdown Begins' campaign; offer 20% discount on test series and mock exams.`;
    case 'Answer Key / Objections':
      return `Host faculty Answer Key discussion stream; promote student rank predictor tool.`;
    case 'Deadline / Application':
      return `Send urgent deadline reminder on Telegram and app: 'Last 24 Hours to Apply'.`;
    default:
      return `Monitor student chatter and prepare revision/guidance community post.`;
  }
}

function makeSummaryFallback_(title, category) {
  const cleaned = cleanText_(title)
    .replace(/\b(UPPSC|BPSC|MPSC|MPPSC|OPSC|RPSC|RAS|notification|latest|breaking|update|official)\b/gi, '')
    .replace(/[|:;,\-()]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(' ');
  return (category.split('/')[0].trim() + ' ' + cleaned).split(/\s+/).slice(0, 6).join(' ');
}


/* ==========================================================================
   RICH EXECUTIVE EMAIL DISPATCH (Multi-Category CMM Routing)
   ========================================================================== */

function sendRichExecutiveEmail_(items, spreadsheetUrl) {
  sendCategorizedExecutiveEmails_(items, spreadsheetUrl);
}

/**
 * Routes email alerts category-wise so each CMM receives ONLY their tags,
 * and State PSC & Judiciary recipients receive ONLY PSC & Judiciary updates (ZERO Board/CA news).
 */
function sendCategorizedExecutiveEmails_(items, spreadsheetUrl) {
  if (!items || items.length === 0) return;

  const upBoardItems = [];
  const caItems = [];
  const gateItems = [];
  const aeJeItems = [];
  const agriItems = [];
  const pscJudiciaryItems = [];
  const otherCmmGroups = {};
  const coreEmail = getEmailTo_();

  items.forEach(item => {
    // 1. Check UP Board
    if (isUpBoardItem_(item) || item.targetEmail === 'anshu.mishra@pw.live' || item.recipientEmail === 'anshu.mishra@pw.live') {
      upBoardItems.push(item);
      return;
    }

    // 2. Check CA
    if (isCaItem_(item) || item.targetEmail === 'moksh.sharma@pw.live' || item.recipientEmail === 'moksh.sharma@pw.live') {
      caItems.push(item);
      return;
    }

    // 3. Check GATE
    if (isGateItem_(item)) {
      gateItems.push(item);
      return;
    }

    // 4. Check AE-JE
    if (isAeJeItem_(item)) {
      aeJeItems.push(item);
      return;
    }

    // 5. Check Agriculture
    if (isAgricultureItem_(item)) {
      agriItems.push(item);
      return;
    }

    // 6. Dynamic CMM or State PSC routing
    const email = getCmmEmailForCategory_(item);
    if (email === 'anshu.mishra@pw.live') {
      upBoardItems.push(item);
    } else if (email === 'moksh.sharma@pw.live') {
      caItems.push(item);
    } else if (/harsh\.ayush1/i.test(email) || (email.includes('falguni.gupta') && /gate/i.test(item.category || item.exam || ''))) {
      gateItems.push(item);
    } else if (/ae[- ]?je/i.test(item.category || item.exam || '')) {
      aeJeItems.push(item);
    } else if (/agri/i.test(item.category || item.exam || '')) {
      agriItems.push(item);
    } else if (email === coreEmail) {
      pscJudiciaryItems.push(item);
    } else {
      if (!otherCmmGroups[email]) otherCmmGroups[email] = [];
      otherCmmGroups[email].push(item);
    }
  });

  // 1. Dispatch UP State Board strictly to Anshu Mishra ONLY
  if (upBoardItems.length > 0) {
    dispatchSingleCategoryEmail_('anshu.mishra@pw.live', upBoardItems, spreadsheetUrl, 'UP State Board');
  }

  // 2. Dispatch CA strictly to Moksh Sharma ONLY
  if (caItems.length > 0) {
    dispatchSingleCategoryEmail_('moksh.sharma@pw.live', caItems, spreadsheetUrl, 'CA (Foundation & Intermediate)');
  }

  // 3. Dispatch GATE strictly to Falguni, Kashif, Harsh ONLY
  if (gateItems.length > 0) {
    dispatchSingleCategoryEmail_('falguni.gupta@pw.live, kashif.ahmed@pw.live, harsh.ayush1@pw.live', gateItems, spreadsheetUrl, 'GATE');
  }

  // 4. Dispatch AE-JE strictly to Falguni, Kashif, Ananya ONLY
  if (aeJeItems.length > 0) {
    dispatchSingleCategoryEmail_('falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live', aeJeItems, spreadsheetUrl, 'AE-JE');
  }

  // 5. Dispatch Agriculture strictly to Falguni, Kashif, Ananya ONLY
  if (agriItems.length > 0) {
    dispatchSingleCategoryEmail_('falguni.gupta@pw.live, kashif.ahmed@pw.live, ananya.rajak@pw.live', agriItems, spreadsheetUrl, 'Agriculture');
  }

  // 6. Dispatch any other dynamic CMM categories to their respective CMM only
  Object.keys(otherCmmGroups).forEach(email => {
    dispatchSingleCategoryEmail_(email, otherCmmGroups[email], spreadsheetUrl);
  });

  // 7. Dispatch State PSC & Judiciary strictly to CFG.EMAIL_TO (ZERO UP Board, ZERO CA, ZERO GATE/AE-JE/Agri)
  if (pscJudiciaryItems.length > 0) {
    dispatchSingleCategoryEmail_(coreEmail, pscJudiciaryItems, spreadsheetUrl, 'State PSC & Judiciary');
  }
}

function dispatchSingleCategoryEmail_(recipientEmail, items, spreadsheetUrl, titleOverride) {
  if (!items || items.length === 0) return;

  const highPriority = items.filter(i => i.priority === 'HIGH' || i.priority === 'CRITICAL');
  const normalCount = items.length - highPriority.length;

  // Determine Category Title
  let categoryTitle = titleOverride;
  if (!categoryTitle) {
    if (recipientEmail === 'anshu.mishra@pw.live') {
      categoryTitle = 'UP State Board';
    } else if (recipientEmail === 'moksh.sharma@pw.live') {
      categoryTitle = 'CA (Foundation & Intermediate)';
    } else if (recipientEmail.includes('harsh.ayush1')) {
      categoryTitle = 'GATE';
    } else if (items.some(i => /ae[- ]?je/i.test(i.category || i.exam || ''))) {
      categoryTitle = 'AE-JE';
    } else if (items.some(i => /agri/i.test(i.category || i.exam || ''))) {
      categoryTitle = 'Agriculture';
    } else if (items.every(i => i.jurisdiction === items[0].jurisdiction)) {
      categoryTitle = items[0].jurisdiction;
    } else {
      categoryTitle = 'PW Exam Intelligence';
    }
  }

  const subject = `⚡ ${categoryTitle} Radar: ${items.length} New Update(s) [${highPriority.length} Urgent]`;

  // 1. Build Scannable Quick-Pointers List (Only for items routed to this recipient!)
  let pointersHtml = '<ul style="margin:10px 0 20px 0;padding-left:18px;font-size:13px;line-height:1.7;color:#202124;">';
  items.forEach(item => {
    const tagBg = item.priority === 'CRITICAL' ? '#fce8e6' : (item.priority === 'HIGH' ? '#fef7e0' : '#f1f3f4');
    const tagColor = item.priority === 'CRITICAL' ? '#c5221f' : (item.priority === 'HIGH' ? '#b06000' : '#5f6368');
    
    pointersHtml += `
      <li style="margin-bottom:8px;">
        <span style="background:${tagBg};color:${tagColor};font-weight:bold;font-size:11px;padding:2px 6px;border-radius:3px;margin-right:4px;">
          ${escapeHtml_(item.priority)}
        </span>
        <span style="font-weight:bold;color:#1a73e8;">[${escapeHtml_(item.jurisdiction)}]</span>
        <b>${escapeHtml_(item.exam)}</b> — ${escapeHtml_(item.summary)}
        <span style="color:#5f6368;font-size:12px;">(${escapeHtml_(item.category)})</span>
        <a href="${item.url}" style="color:#1a73e8;text-decoration:none;font-weight:bold;margin-left:4px;">Link ↗</a>
      </li>
    `;
  });
  pointersHtml += '</ul>';

  // 2. Build High-Impact Action Cards for Urgent Items
  let cardsHtml = '';
  highPriority.slice(0, 6).forEach(item => {
    cardsHtml += `
      <div style="background:#ffffff;border-left:4px solid #ea4335;border-radius:6px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e8eaed;border-left:4px solid #ea4335;">
        <div style="font-size:11px;font-weight:bold;color:#ea4335;text-transform:uppercase;margin-bottom:4px;">
          [${escapeHtml_(item.jurisdiction)}] • ${escapeHtml_(item.category)}
        </div>
        <div style="font-size:15px;font-weight:bold;color:#202124;margin-bottom:6px;">
          ${escapeHtml_(item.exam)}: ${escapeHtml_(item.title)}
        </div>
        <div style="font-size:13px;color:#3c4043;margin-bottom:8px;">
          <b>Summary:</b> ${escapeHtml_(item.summary)}
        </div>
        <div style="background:#f1f8e9;border-left:3px solid #2e7d32;padding:8px 12px;font-size:13px;color:#1b5e20;border-radius:4px;margin-bottom:10px;">
          🎯 <b>Suggested Marketing Play:</b> ${escapeHtml_(item.marketingAction)}
        </div>
        <div>
          <a href="${item.url}" style="background:#1a73e8;color:#ffffff;padding:6px 14px;text-decoration:none;border-radius:4px;font-size:12px;font-weight:bold;display:inline-block;">
            Open Source Notice ↗
          </a>
        </div>
      </div>
    `;
  });

  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8f9fa;padding:20px;color:#202124;line-height:1.5;">
      <div style="max-width:650px;margin:0 auto;">
        
        <!-- Header Banner -->
        <div style="background:#1e293b;color:#ffffff;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:20px;color:#ffffff;">⚡ ${escapeHtml_(categoryTitle)} Radar</h2>
          <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Real-Time Marketing Intelligence Alerts</div>
        </div>

        <div style="background:#ffffff;padding:22px 24px;border:1px solid #dadce0;border-top:none;border-radius:0 0 8px 8px;">
          
          <!-- Summary Metrics -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin-bottom:18px;">
            <span style="font-size:14px;font-weight:bold;color:#0f172a;">
              Found ${items.length} new update(s)
            </span>
            <span style="color:#64748b;font-size:13px;margin-left:8px;">
              (${highPriority.length} urgent • ${normalCount} routine)
            </span>
          </div>

          <!-- Section 1: Scannable Pointers -->
          <h3 style="font-size:15px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:16px 0 10px 0;">
            📌 Quick Update Pointers
          </h3>
          ${pointersHtml}

          <!-- Section 2: Urgent Campaign Plays -->
          ${highPriority.length > 0 ? `
            <h3 style="font-size:15px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px 0;">
              🔥 High-Impact Campaign Plays (${highPriority.length})
            </h3>
            ${cardsHtml}
          ` : ''}

          <!-- CTA Button -->
          <div style="text-align:center;margin:30px 0 12px 0;">
            <a href="${escapeHtml_(spreadsheetUrl)}" style="background:#1a73e8;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;display:inline-block;box-shadow:0 1px 3px rgba(0,0,0,0.12);">
              📊 Open Google Tracking Sheet
            </a>
          </div>

        </div>

        <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">
          PW Marketing Internal Tool • Automated Intelligence Alert • Delivered exclusively to ${escapeHtml_(recipientEmail)}
        </div>
      </div>
    </div>
  `;

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: `Exam Radar (${categoryTitle}): ${items.length} new updates found (${highPriority.length} urgent).\n\nOpen spreadsheet: ${spreadsheetUrl}`,
      htmlBody: htmlBody,
      name: 'PW Exam Radar'
    });
    log_('INFO', `Dispatched category email for ${categoryTitle} to ${recipientEmail}`, `Items: ${items.length}`);
  } catch (err) {
    log_('ERROR', `Failed to send email to ${recipientEmail}: ${err.message}`, String(err));
  }
}


/* ==========================================================================
   FEED SEARCH & GATHERING
   ========================================================================== */

function buildFeedJobs_() {
  const jobs = [];
  const scopes = getActiveCategoryScopes_();

  scopes.forEach(scope => {
    (scope.queries || []).forEach(query => {
      jobs.push({
        query: query,
        scope: scope.name,
        jurisdiction: scope.jurisdiction,
        category: scope.category || scope.name,
        aliases: scope.aliases || [],
        includes: scope.includes || [],
        excludes: scope.excludes || [],
        recipientEmail: scope.recipientEmail || CFG.EMAIL_TO,
        kind: scope.kind || 'psc'
      });
    });
  });

  JUDICIARY_QUERIES.forEach(query => {
    jobs.push({
      query: query,
      scope: 'Judiciary',
      jurisdiction: 'India — Nationwide',
      category: 'Judiciary',
      aliases: ['judicial service', 'judiciary', 'civil judge', 'high court', 'supreme court'],
      includes: [],
      excludes: [],
      recipientEmail: CFG.EMAIL_TO,
      kind: 'judiciary'
    });
  });
  return jobs;
}

function fetchFeeds_(jobs) {
  const items = [];
  const failures = [];
  const batchSize = 15;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const requests = batch.map(job => ({
      url: `https://news.google.com/rss/search?q=${encodeURIComponent('(' + job.query + ') when:24h')}&hl=en-IN&gl=IN&ceid=IN:en`,
      method: 'get',
      followRedirects: true,
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 ExamNewsMonitor/2.0' }
    }));

    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (e) {
      responses = requests.map(r => {
        try { return UrlFetchApp.fetch(r.url, r); }
        catch (err) { return null; }
      });
    }

    responses.forEach((res, idx) => {
      if (!res || res.getResponseCode() !== 200) return;
      const job = batch[idx];
      try {
        const xml = XmlService.parse(res.getContentText());
        const channel = xml.getRootElement().getChild('channel');
        if (!channel) return;

        channel.getChildren('item').forEach(node => {
          const title = childText_(node, 'title');
          const link = childText_(node, 'link');
          if (!title || !link) return;

          items.push({
            title: cleanText_(title),
            url: link.trim(),
            publisher: cleanText_(childText_(node, 'source') || sourceFromUrl_(link)),
            published: childText_(node, 'pubDate'),
            description: stripHtml_(childText_(node, 'description') || ''),
            queryLabel: job.query,
            scope: job.scope,
            jurisdiction: job.jurisdiction,
            category: job.category,
            recipientEmail: job.recipientEmail,
            targetEmail: job.recipientEmail,
            aliases: job.aliases,
            includes: job.includes,
            excludes: job.excludes,
            kind: job.kind
          });
        });
      } catch (err) {
        failures.push({ query: job.query, error: String(err) });
      }
    });
  }
  return { items, failures };
}


/* ==========================================================================
   EVALUATION & CLASSIFICATION
   ========================================================================== */

function evaluateItem_(item) {
  const text = (item.title + ' ' + item.description + ' ' + item.publisher).toLowerCase();

  // 1. CMM Category Evaluation (Dynamic from Sheet + Built-in)
  if (item.kind === 'cmm_category') {
    // Check category-specific exclude tags (e.g. Mock test for CA)
    if (item.excludes && item.excludes.length > 0 && hasAny_(text, item.excludes)) {
      return { keep: false };
    }

    // Must match at least one include keyword or alias
    const hasCategoryInclude = item.includes && item.includes.length > 0 && hasAny_(text, item.includes);
    const hasCategoryAlias = item.aliases && item.aliases.length > 0 && hasAny_(text, item.aliases);
    if (!hasCategoryInclude && !hasCategoryAlias) {
      return { keep: false };
    }

    // National non-target spam gate
    if (EXCLUDE_TERMS.test(text)) return { keep: false };

    const category = classifyCategory_(text);
    const priority = classifyPriority_(text, category);

    return {
      keep: true,
      exam: item.exam || item.scope,
      jurisdiction: item.jurisdiction,
      category: item.category || category,
      priority: priority,
      status: 'CMM Alert Discovered',
      recipientEmail: item.recipientEmail || getCmmEmailForCategory_(item),
      targetEmail: item.targetEmail || item.recipientEmail || getCmmEmailForCategory_(item),
      kind: item.kind
    };
  }

  // 2. Standard State PSC & Judiciary Evaluation
  if (!EXAM_TERMS.test(text) || !UPDATE_TERMS.test(text)) return { keep: false };

  let exam = item.scope;
  if (item.kind === 'psc') {
    if (clearlyOtherCommission_(text, item.scope)) return { keep: false };

    // STRICT: Must mention the commission or state civil service alias!
    const hasAlias = hasAny_(text, item.aliases);
    if (!hasAlias) return { keep: false };

    // Exclude national non-target recruitment (Railways, GDS, Coast Guard, etc.)
    if (EXCLUDE_TERMS.test(text)) return { keep: false };
  } else {
    if (EXCLUDE_TERMS.test(text)) return { keep: false };
    const judiciaryContext = /\b(supreme court|high court|district court|judicial service|judiciary|civil judge|judicial officer|judicial magistrate|judge recruitment|judicial recruitment|judicial exam|district judge|law clerk)\b/i.test(text);
    if (!judiciaryContext) return { keep: false };
    exam = inferJudiciaryExam_(text);
  }

  const category = classifyCategory_(text);
  const priority = classifyPriority_(text, category);

  let status = 'Needs review';
  if (category === 'Result') status = 'Result update';
  if (category === 'Deadline / Application') status = 'Check deadline';
  if (category === 'Exam Schedule') status = 'Check schedule';
  if (category === 'Court / Policy Update') status = 'Verify official order';

  return {
    keep: true,
    exam,
    jurisdiction: item.jurisdiction,
    category,
    priority,
    status,
    recipientEmail: item.recipientEmail || getCmmEmailForCategory_(item),
    targetEmail: item.targetEmail || item.recipientEmail || getCmmEmailForCategory_(item),
    kind: item.kind
  };
}

function clearlyOtherCommission_(text, expected) {
  const commissions = [
    { name: 'UPPSC', re: /\b(uppsc|uttar pradesh public service commission)\b/i },
    { name: 'BPSC', re: /\b(bpsc|bihar public service commission)\b/i },
    { name: 'MPSC', re: /\b(mpsc|maharashtra public service commission)\b/i },
    { name: 'MPPSC', re: /\b(mppsc|madhya pradesh public service commission)\b/i },
    { name: 'OPSC', re: /\b(opsc|odisha public service commission|orissa public service commission)\b/i },
    { name: 'RPSC / RAS', re: /\b(rpsc|rajasthan public service commission|rajasthan administrative service)\b/i }
  ];
  return commissions.filter(c => c.re.test(text)).some(c => c.name !== expected);
}

function inferJudiciaryExam_(text) {
  if (/bihar.*(apo|prosecution)|bpsc.*(apo|prosecution)/i.test(text)) return 'Bihar Assistant Prosecution Officer (APO)';
  if (/up.*(apo|prosecution)|uppsc.*(apo|prosecution)/i.test(text)) return 'UP Assistant Prosecution Officer (APO)';
  if (/prosecution officer|\bapo\b|assistant prosecution officer/i.test(text)) return 'State Assistant Prosecution Officer (APO)';
  if (/delhi.*(judicial|djs|dhjs)/i.test(text)) return 'Delhi Judicial Service (DJS/DHJS)';
  if (/bihar.*(judicial|bjs|civil judge)/i.test(text)) return 'Bihar Judicial Service (PCS-J)';
  if (/rajasthan.*(judicial|rjs|civil judge)/i.test(text)) return 'Rajasthan Judicial Service (RJS)';
  if (/mp.*(civil judge|judicial)/i.test(text)) return 'MP Civil Judge Cadre';
  if (/\bsupreme court\b/i.test(text)) return 'Supreme Court / Judiciary';
  if (/\bhigh court\b/i.test(text)) return 'High Court / Judiciary';
  if (/\b(civil judge|judicial service|judiciary exam|judicial exam)\b/i.test(text)) return 'State Judiciary Exams';
  if (/\blaw clerk\b/i.test(text)) return 'Law Clerk Recruitment';
  return 'Judiciary / Court Recruitment';
}

function classifyCategory_(text) {
  if (/\b(result|results|merit list|selection list|final list|cut.?off|scorecard|score card|marks|marksheet|marks statement|omr sheet|shortlist|shortlisted|dv list|document verification|परिणाम|मेधा सूची|चयन सूची|प्राप्तांक)\b/i.test(text)) return 'Result';
  if (/\b(admit card|hall ticket|hall-ticket|call letter|interview letter|e-admit|city intimation|exam city slip|download admit|प्रवेश पत्र|बुलावा पत्र)\b/i.test(text)) return 'Admit Card';
  if (/\b(answer key|response sheet|objection window|model answer|provisional answer key|final answer key|master question paper|उत्तर कुंजी|आपत्ति)\b/i.test(text)) return 'Answer Key / Objections';
  if (/\b(last date|deadline|application begins|apply online|registration|extended|extension|application deadline|ऑनलाइन आवेदन)\b/i.test(text)) return 'Deadline / Application';
  if (/\b(exam calendar|exam schedule|exam date|timetable|time-table|postponed|rescheduled|deferred|dates of exam|date sheet|interview date|interview schedule|viva-voce|viva voce|परीक्षा कार्यक्रम|समय सारणी|स्थगित)\b/i.test(text)) return 'Exam Schedule';
  if (/\b(court order|judgment|stay order|supreme court|high court|quashed|interim order)\b/i.test(text)) return 'Court / Policy Update';
  if (/\b(syllabus|eligibility|age limit|exam pattern|scheme of examination|curriculum|पाठ्यक्रम|परीक्षा योजना)\b/i.test(text)) return 'Eligibility / Syllabus';
  if (/\b(corrigendum|addendum|amendment|errata|cancellation|cancelled|canceled|revised notification|correction notice|edit window|शुद्धिपत्र|संशोधन|निरस्त)\b/i.test(text)) return 'Corrigendum / Revision';
  if (/\b(advertisement|advt\.?\s*no|notification|vacanc(?:y|ies)|recruitment|direct recruitment|special recruitment|portal open|विज्ञप्ति|भर्ती|अधिसूचना)\b/i.test(text)) return 'Notification / Recruitment';
  return 'Important Exam Update';
}

function classifyPriority_(text, category) {
  if (/\b(postponed|rescheduled|cancelled|canceled|stay order|court order|result|cut.?off|scorecard|admit card|merit list|shortlist|परिणाम|प्रवेश पत्र|स्थगित)\b/i.test(text)) return 'CRITICAL';
  if (['Deadline / Application', 'Admit Card', 'Result', 'Exam Schedule', 'Notification / Recruitment'].includes(category)) return 'HIGH';
  return 'NORMAL';
}


/* ==========================================================================
   SHEET FORMATTING & DEDUPLICATION
   ========================================================================== */

function initializeTrackerSheet_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    // Update headers if different
    const existing = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
    if (String(existing[0]).trim() !== HEADERS[0] || sheet.getLastColumn() !== HEADERS.length) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }

  styleHeader_(sheet, HEADERS.length);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);

  // Column widths for 10-column layout
  // 1: Date, 2: State, 3: Exam, 4: Category, 5: Priority, 6: Summary, 7: Action, 8: Link, 9: Telegram, 10: ID (Hidden)
  const widths = [135, 115, 230, 140, 95, 220, 320, 130, 110, 50];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.hideColumns(10); // Hide Unique ID column from view
}

function styleHeader_(sheet, count) {
  sheet.getRange(1, 1, 1, count)
    .setFontFamily(CFG.FONT)
    .setFontSize(CFG.FONT_SIZE)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#1e293b') // Modern Slate Navy
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');
}

function formatDataRows_(sheet, startRow, count) {
  const range = sheet.getRange(startRow, 1, count, HEADERS.length);
  range
    .setFontFamily(CFG.FONT)
    .setFontSize(CFG.FONT_SIZE)
    .setFontColor('#202124')
    .setVerticalAlignment('middle')
    .setWrap(true);

  // Col 1: Date formatting
  sheet.getRange(startRow, 1, count, 1)
    .setNumberFormat('yyyy-mm-dd hh:mm')
    .setHorizontalAlignment('center');

  // Col 2: State / Body
  sheet.getRange(startRow, 2, count, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // Col 3: Exam Name
  sheet.getRange(startRow, 3, count, 1)
    .setFontWeight('bold');

  // Col 4: Category
  sheet.getRange(startRow, 4, count, 1)
    .setHorizontalAlignment('center');

  // Col 5: Priority color pills (Batch-applied in 1 remote RPC instead of loop)
  const priorityRange = sheet.getRange(startRow, 5, count, 1);
  priorityRange.setFontWeight('bold').setHorizontalAlignment('center');
  const priorities = priorityRange.getValues();
  const bgColors = [];
  const textColors = [];
  for (let i = 0; i < count; i++) {
    const p = priorities[i][0];
    if (p === 'CRITICAL') {
      bgColors.push(['#fce8e6']);
      textColors.push(['#c5221f']);
    } else if (p === 'HIGH') {
      bgColors.push(['#fef7e0']);
      textColors.push(['#b06000']);
    } else {
      bgColors.push(['#f1f3f4']);
      textColors.push(['#5f6368']);
    }
  }
  priorityRange.setBackgrounds(bgColors).setFontColors(textColors);

  // Col 7: Suggested Marketing Play highlight
  sheet.getRange(startRow, 7, count, 1)
    .setBackground('#f1f8e9')
    .setFontColor('#1b5e20');

  // Col 8: Clickable Link `=HYPERLINK(url, "Open Link ↗")`
  const urlVals = sheet.getRange(startRow, 8, count, 1).getValues();
  const formulas = urlVals.map(r => [r[0] ? `=HYPERLINK("${String(r[0]).replace(/"/g, '""')}","Open Link ↗")` : '']);
  sheet.getRange(startRow, 8, count, 1)
    .setFormulas(formulas)
    .setHorizontalAlignment('center')
    .setFontWeight('bold');

  // Col 9: Telegram Status
  sheet.getRange(startRow, 9, count, 1)
    .setHorizontalAlignment('center');
}

function loadKnownSet_(sheet) {
  const set = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;

  const lastCol = sheet.getLastColumn();
  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, lastCol).getValues();

  values.forEach(row => {
    // Unique ID check across possible columns (Col 10 in new schema, Col 14 in old)
    if (row.length >= 10 && row[9]) set.add(String(row[9]).trim());
    if (row.length >= 14 && row[13]) set.add(String(row[13]).trim());

    // URL checks across possible columns (Col 8 in new schema, Col 9 & 11 in old)
    [7, 8, 10, 11].forEach(colIdx => {
      if (row.length > colIdx && row[colIdx]) {
        const u = cleanUrl_(row[colIdx]);
        if (u) set.add(u);
      }
    });
  });
  return set;
}

function generateCompositeHash_(title, url) {
  const raw = (title.toLowerCase().trim() + '|' + cleanUrl_(url).toLowerCase().trim());
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').slice(0, 24);
}


/* ==========================================================================
   UTILITIES & LOGGING
   ========================================================================== */

function cleanUrl_(url) {
  let res = String(url || '').trim();
  if (!res) return '';
  res = res.replace(/([?&])(utm_[^=]+|oc|ved|usg|hl|gl|ceid)=[^&]*/gi, '$1');
  return res.replace(/[?&]+$/, '').replace(/\?&/, '?');
}

function cleanText_(v) {
  return String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
}

function stripHtml_(v) {
  return cleanText_(String(v || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, ' '));
}

function sourceFromUrl_(u) {
  const m = String(u || '').match(/^https?:\/\/([^/]+)/i);
  return m ? m[1].replace(/^www\./, '') : 'Google News';
}

function childText_(node, name) {
  const child = node.getChild(name);
  return child ? child.getText() : '';
}

function escapeHtml_(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hasAny_(text, values) {
  const lower = String(text || '').toLowerCase();
  return (values || []).some(val => lower.indexOf(String(val).toLowerCase()) !== -1);
}

function priorityRank_(p) {
  if (p === 'CRITICAL') return 3;
  if (p === 'HIGH') return 2;
  return 1;
}

function getSpreadsheet_() {
  // 1. Script Properties takes top priority
  const propId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (propId) {
    try { return SpreadsheetApp.openById(propId); } catch (e) {}
  }

  // 2. Container-bound active spreadsheet (when opened via Extensions > Apps Script)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  // 3. Fallback to CFG tracker sheet ID or tags sheet ID
  const fallbackId = CFG.TRACKER_SHEET_ID || CFG.TAGS_SHEET_ID;
  if (fallbackId) {
    try { return SpreadsheetApp.openById(fallbackId); } catch (e) {}
  }

  return null;
}

function getOrCreateSheet_(ss, name) {
  if (!ss) return null;
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getEmailTo_() {
  return PropertiesService.getScriptProperties().getProperty('EMAIL_TO') || CFG.EMAIL_TO;
}

function log_(level, msg, details) {
  Logger.log(`[${level}] ${msg} ${details || ''}`);
  try {
    const ss = getSpreadsheet_();
    if (!ss) return; // Silent return if no tracker sheet configured yet, avoiding false error lines

    let sheet = ss.getSheetByName(CFG.LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CFG.LOG_SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Level', 'Message', 'Details']);
      styleHeader_(sheet, 4);
    }
    sheet.appendRow([new Date(), level, msg, details || '']);
  } catch (e) {
    Logger.log('Sheet log notice: ' + e.message);
  }
}

/* ==========================================================================
   OFFICIAL COMMISSION NOTICES INGESTION (From GitHub Radar Repository)
   ========================================================================== */

function fetchOfficialNoticesFromGitHub_(known) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  let url = CFG.GITHUB_NOTICES_URL;
  const options = { muteHttpExceptions: true };

  if (token) {
    // Private repo authentication via GitHub API
    url = 'https://api.github.com/repos/deep4nsh/pw-exam-intelligence/contents/scraper/latest_official_notices.json';
    options.headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github.raw',
      'User-Agent': 'PW-Exam-Radar-AppsScript'
    };
  }

  const items = [];
  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      Logger.log('GitHub fetch returned status: ' + response.getResponseCode());
      return items;
    }

    const payload = JSON.parse(response.getContentText());
    const notices = payload.notices || [];

    notices.forEach(n => {
      // Strict date gate: only ingest notices published/issued TODAY
      if (!isNoticeFromToday_(n)) return;

      const compHash = generateCompositeHash_(n.title, n.url);
      const uid = n.hash || compHash;
      const cleanU = cleanUrl_(n.url);
      if (known.has(uid) || (n.hash && known.has(n.hash)) || known.has(compHash) || known.has(n.url) || (cleanU && known.has(cleanU))) return;
      known.add(uid);
      if (n.hash) known.add(n.hash);
      known.add(compHash);
      known.add(n.url);
      if (cleanU) known.add(cleanU);

      items.push({
        title: n.title,
        url: n.url,
        uniqueId: uid,
        publishedDate: n.publishedDate ? new Date(n.publishedDate) : (n.pubDate ? new Date(n.pubDate) : (parseSingleDate_(n.date) ? new Date(parseSingleDate_(n.date).y, parseSingleDate_(n.date).m - 1, parseSingleDate_(n.date).d) : new Date())),
        jurisdiction: n.jurisdiction || n.state || 'State Commission',
        exam: n.exam || 'Recruitment Exam',
        category: n.category || 'Notification / Recruitment',
        priority: n.priority || 'HIGH',
        summary: n.title,
        marketingAction: n.marketingAction,
        isOfficialVerified: true,
        targetEmail: n.targetEmail,
        telegramStatus: 'SENT_VIA_ACTIONS'
      });
    });
  } catch (err) {
    Logger.log('GitHub notices ingestion error: ' + err.message);
  }
  return items;
}

/**
 * Web App Webhook Receiver:
 * Allows the GitHub Action / scraper to POST brand-new verified official notices directly.
 * Appends them into the Google Sheet and dispatches the rich HTML email digest!
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Locked' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const postData = JSON.parse(e.postData.contents);
    if (postData.action === 'sendTagsConfirmation') {
      const filterParam = postData.categories ? (Array.isArray(postData.categories) ? postData.categories : postData.categories.split(',')) : null;
      const results = sendTagsConfirmationToCMMs(filterParam);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'Tags confirmation sent to CMMs',
        results: results
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const incoming = Array.isArray(postData) ? postData : (postData.notices || [postData]);
    if (!incoming || incoming.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', inserted: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = getSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, CFG.SHEET_NAME);
    initializeTrackerSheet_(sheet);
    const known = loadKnownSet_(sheet);

    const newItems = [];
    incoming.forEach(n => {
      // Strict date gate: only ingest notices published/issued TODAY
      if (!isNoticeFromToday_(n)) return;

      const compHash = generateCompositeHash_(n.title, n.url);
      const uid = n.hash || compHash;
      const cleanU = cleanUrl_(n.url);
      if (known.has(uid) || (n.hash && known.has(n.hash)) || known.has(compHash) || known.has(n.url) || (cleanU && known.has(cleanU))) return;
      known.add(uid);
      if (n.hash) known.add(n.hash);
      known.add(compHash);
      known.add(n.url);
      if (cleanU) known.add(cleanU);

      newItems.push({
        title: n.title,
        url: n.url,
        uniqueId: uid,
        publishedDate: n.publishedDate ? new Date(n.publishedDate) : (n.pubDate ? new Date(n.pubDate) : (parseSingleDate_(n.date) ? new Date(parseSingleDate_(n.date).y, parseSingleDate_(n.date).m - 1, parseSingleDate_(n.date).d) : new Date())),
        jurisdiction: n.jurisdiction || n.state || 'State Commission',
        exam: n.exam || 'Recruitment Exam',
        category: n.category || 'Notification / Recruitment',
        priority: n.priority || 'HIGH',
        summary: n.title,
        marketingAction: n.marketingAction,
        isOfficialVerified: true,
        targetEmail: n.targetEmail,
        telegramStatus: 'SENT_VIA_ACTIONS'
      });
    });

    if (newItems.length > 0) {
      newItems.sort((a, b) => priorityRank_(b.priority) - priorityRank_(a.priority));

      const rows = newItems.map(item => [
        item.publishedDate || new Date(),
        item.jurisdiction,
        item.exam,
        item.category,
        item.priority,
        item.summary,
        item.marketingAction,
        item.url,
        item.telegramStatus,
        item.uniqueId
      ]);

      sheet.insertRowsBefore(2, rows.length);
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
      formatDataRows_(sheet, 2, rows.length);

      sendRichExecutiveEmail_(newItems, ss.getUrl());
      log_('INFO', `Webhook inserted ${newItems.length} official notices into Google Sheet and dispatched email digest.`, '');
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', inserted: newItems.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    log_('ERROR', 'Webhook error', String(err.stack || err));
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Standalone manual trigger:
 * Run this function in Google Apps Script to instantly import all 56 official notices
 * from GitHub into your Google Sheet and send the rich email alert digest immediately!
 */
function syncOfficialNoticesNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    Logger.log('Execution lock could not be acquired.');
    return;
  }

  try {
    const ss = getSpreadsheet_();
    const sheet = getOrCreateSheet_(ss, CFG.SHEET_NAME);
    initializeTrackerSheet_(sheet);
    const known = loadKnownSet_(sheet);

    const officialNotices = fetchOfficialNoticesFromGitHub_(known);
    if (officialNotices.length === 0) {
      Logger.log('All official notices are already present in Google Sheet.');
      return;
    }

    // Sort: newest first, then by priority
    officialNotices.sort((a, b) => priorityRank_(b.priority) - priorityRank_(a.priority));

    const rows = officialNotices.map(item => [
      item.publishedDate || new Date(),
      item.jurisdiction,
      item.exam,
      item.category,
      item.priority,
      item.summary,
      item.marketingAction,
      item.url,
      item.telegramStatus || 'SENT_VIA_ACTIONS',
      item.uniqueId
    ]);

    sheet.insertRowsBefore(2, rows.length);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    formatDataRows_(sheet, 2, rows.length);

    sendRichExecutiveEmail_(officialNotices, ss.getUrl());
    log_('INFO', `Manually synced ${officialNotices.length} official notices to Google Sheet and dispatched email digest.`, '');
    Logger.log(`✅ Successfully synced ${officialNotices.length} official notices to Google Sheet!`);
  } catch (err) {
    log_('ERROR', 'Manual official notices sync failed.', String(err.stack || err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}




/**
 * GET Webhook Handler / Reverse Proxy Fallback
 * Allows cloud runners to fetch Indian portals through Google Workspace IPs
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'sendTagsConfirmation') {
    const filterParam = e.parameter.categories ? e.parameter.categories.split(',') : null;
    const results = sendTagsConfirmationToCMMs(filterParam);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Tags confirmation sent to CMMs',
      results: results
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (e && e.parameter && e.parameter.action === 'syncTags') {
    const scopes = syncTagsFromSheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Synced tags from Sheet',
      scopesCount: scopes.length,
      scopes: scopes.map(s => ({ name: s.name, tab: s.sheetTab, email: s.recipientEmail }))
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const targetUrl = (e && e.parameter && e.parameter.url);
  if (!targetUrl) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      service: "PW Exam Intelligence Radar Webhook & Proxy",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const res = UrlFetchApp.fetch(targetUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: false,
      followRedirects: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9"
      }
    });
    return ContentService.createTextOutput(res.getContentText())
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Utility: Sends confirmation email to all CMMs showing their active category tags.
 * @param {Array<string>} [categoriesFilter] Optional array of category/tab names to filter (e.g. ['GATE', 'AE-JE', 'Agriculture'])
 */
function sendTagsConfirmationToCMMs(categoriesFilter) {
  _cachedScopes = null;
  let scopes = getActiveCategoryScopes_().filter(s => s.kind === 'cmm_category');

  if (categoriesFilter && Array.isArray(categoriesFilter) && categoriesFilter.length > 0) {
    const filterLower = categoriesFilter.map(c => String(c).toLowerCase().trim());
    scopes = scopes.filter(s => 
      filterLower.some(f => 
        String(s.name || '').toLowerCase().includes(f) ||
        String(s.sheetTab || '').toLowerCase().includes(f)
      )
    );
  }

  const results = [];

  scopes.forEach(scope => {
    const toEmail = scope.recipientEmail;
    if (!toEmail || !toEmail.includes('@')) return;

    const subject = `✅ [PW Exam Radar] Tags Active: ${scope.name}`;

    let includeList = (scope.includes || []).map(t => `<li style="margin-bottom:4px;"><b>INCLUDE:</b> <code>${escapeHtml_(t)}</code></li>`).join('');
    let aliasList = (scope.aliases || []).map(t => `<li style="margin-bottom:4px;"><b>ALIAS:</b> <code>${escapeHtml_(t)}</code></li>`).join('');
    let excludeList = (scope.excludes || []).map(t => `<li style="margin-bottom:4px;color:#c5221f;"><b>EXCLUDE:</b> <code>${escapeHtml_(t)}</code></li>`).join('');

    const totalTags = (scope.includes || []).length + (scope.aliases || []).length + (scope.excludes || []).length;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;background:#f8f9fa;padding:24px;color:#202124;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #dadce0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <div style="background:#1e293b;color:#ffffff;padding:20px 24px;">
            <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#38bdf8;margin-bottom:4px;">Physics Wallah Growth & Marketing Intelligence</div>
            <h2 style="margin:0;font-size:18px;">⚡ PW Exam Intelligence Radar</h2>
            <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Category Monitoring Activated: <b>${escapeHtml_(scope.name)}</b></div>
          </div>
          <div style="padding:24px;">
            <p style="font-size:14px;color:#3c4043;">Hello,</p>
            <p style="font-size:14px;color:#3c4043;line-height:1.6;">
              Your category tags for <b>${escapeHtml_(scope.name)}</b> are now active on the <b>PW Exam Intelligence Radar</b>.
              Our automated 24/7 scrapers and news crawlers are monitoring official portals and real-time updates for these tags.
            </p>
            <div style="background:#f1f8e9;border-left:4px solid #2e7d32;padding:12px 16px;border-radius:4px;margin:16px 0;">
              <b>📬 Routing Confirmation:</b> All breaking notices, official circulars, and results for this category will be delivered directly to: <code>${escapeHtml_(toEmail)}</code>.
            </div>
            <h4 style="font-size:14px;color:#0f172a;margin:20px 0 8px 0;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">
              📋 Registered Monitoring Tags (${totalTags} active):
            </h4>
            <ul style="font-size:13px;line-height:1.6;padding-left:20px;">
              ${includeList}
              ${aliasList}
              ${excludeList}
            </ul>
            <p style="font-size:12px;color:#5f6368;margin-top:24px;">
              To add or update tags, update your tab in the shared Google Sheet: <a href="https://docs.google.com/spreadsheets/d/1IIdA-chEZvTRT4xPKmvFp_U-6mCv6t2VdPTXOOhooYQ/edit">Tags Sheet</a>.
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      MailApp.sendEmail({
        to: toEmail,
        subject: subject,
        body: `Your tags for ${scope.name} are active on the PW Exam Intelligence Radar.\nAlerts will be delivered directly to: ${toEmail}`,
        htmlBody: htmlBody,
        name: 'PW Exam Intelligence Radar'
      });
      results.push({ category: scope.name, email: toEmail, status: 'SENT', totalTags: totalTags });
    } catch (e) {
      results.push({ category: scope.name, email: toEmail, status: 'FAILED', error: e.message });
    }
  });

  log_('INFO', 'Dispatched tags confirmation to CMMs', JSON.stringify(results));
  Logger.log('Tags confirmation dispatched: ' + JSON.stringify(results));
  return results;
}

/**
 * Utility: Sends confirmation email specifically for the 3 newly added categories
 */
function sendTagsConfirmationToNewCMMs() {
  return sendTagsConfirmationToCMMs(['GATE', 'AE-JE', 'Agriculture']);
}

/**
 * Utility: Inspect and verify categories and tags loaded from the Google Sheet
 */
function syncTagsFromSheet() {
  _cachedScopes = null;
  const scopes = getActiveCategoryScopes_();
  Logger.log(`Found ${scopes.length} active scopes:`);
  scopes.forEach(s => {
    Logger.log(` - [${s.kind || 'psc'}] ${s.name} (${s.sheetTab || ''}) -> Email: ${s.recipientEmail || CFG.EMAIL_TO}`);
  });
  return scopes;
}

/**
 * Automatically creates custom menu in Google Sheets UI
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🏛️ PW Exam Intelligence')
      .addItem('📧 Send Tags Confirmation (All CMMs)', 'sendTagsConfirmationToCMMs')
      .addItem('📧 Send Tags Confirmation (3 New: GATE, AE-JE, Agri)', 'sendTagsConfirmationToNewCMMs')
      .addItem('🔄 Refresh & Sync Tags from Sheet', 'syncTagsFromSheet')
      .addSeparator()
      .addItem('⚡ Sync Official Notices Now', 'syncOfficialNoticesNow')
      .addItem('🔍 Run News Intelligence Cycle', 'monitorExamNews')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen notice: ' + e.message);
  }
}
