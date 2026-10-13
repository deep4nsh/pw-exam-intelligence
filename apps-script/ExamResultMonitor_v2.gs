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
  EMAIL_TO: 'deepansh.gupta@pw.live,akshay.vaishnav@pw.live,aditya.kiran@pw.live',
  TELEGRAM_BOT_TOKEN: '8962093670:AAGoDyQX553VbSAOh_35ntPQN96QtflWhOg',
  TELEGRAM_CHAT_ID: '-5324420343', // Deepansh & Aditya Sir, Akshay Pw Group
  TIMEZONE: 'Asia/Kolkata',
  MAX_AGE_HOURS: 72,
  MAX_NEW_ROWS_PER_RUN: 150,
  MAX_TELEGRAM_ALERTS_PER_RUN: 5, // Circuit breaker against alert storms
  SEND_EMAIL_WHEN_NO_NEWS: false,
  FONT: 'Arial',
  FONT_SIZE: 10,
  GEMINI_MODEL: 'gemini-flash-latest',
  GITHUB_NOTICES_URL: 'https://raw.githubusercontent.com/deep4nsh/pw-exam-intelligence/main/scraper/latest_official_notices.json'
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
    aliases: ['BPSC', 'Bihar Public Service Commission', 'BPSC CCE', 'BPSC TRE', '70th BPSC', '69th BPSC'],
    queries: [
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
  }
];

const JUDICIARY_QUERIES = [
  'judiciary exam notification civil judge recruitment India',
  'judicial services application deadline exam date India',
  'High Court recruitment notification judicial service',
  'Supreme Court recruitment exam notification India',
  'judiciary exam admit card answer key result cutoff',
  'judicial services syllabus eligibility age limit change',
  'High Court judge recruitment exam schedule',
  'judicial services mains interview result selection list',
  'Supreme Court High Court order judicial recruitment exam',
  'judicial service exam corrigendum postponement cancellation'
];

const EXAM_TERMS =
  /\b(exam|examination|recruit|recruitment|vacanc(?:y|ies)|commission|public service|civil judge|judicial service|judiciary|administrative service|selection|candidate|application|competitive|prelims|preliminary|mains|interview|personality test)\b/i;

const UPDATE_TERMS =
  /\b(notification|notifies|notified|advertisement|released|release|announces|announced|schedule|calendar|date|dates|postponed|rescheduled|cancelled|canceled|deferred|admit card|hall ticket|answer key|response sheet|result|results|cut.?off|merit list|selection list|final list|provisional list|document verification|application|registration|last date|deadline|extended|extension|corrigendum|correction window|edit window|syllabus|eligibility|age limit|reservation|vacancy|vacancies|interview|court order|judgment|judgement|stay order|revised|objection window|recruitment rules)\b/i;

const EXCLUDE_TERMS =
  /\b(railway|railways|ntpc|rrb|coast guard|cgept|navik|yantrik|hygienist|gramin dak sevak|gds|post office|postal assistant|ibps|sbi po|sbi clerk|sbi apprentice|rbi grade|ssc cgl|ssc chsl|ssc gd|ssc mts|agniveer|army recruitment|navy recruitment|air force recruitment|nda\b|cds\b|afcat|gate\b|neet\b|jee main)\b/i;


/* ==========================================================================
   SETUP & INITIALIZATION
   ========================================================================== */

function setupExamNewsMonitor() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('TRACKER_SHEET_ID');

  if (!id) {
    throw new Error(
      'Required: Add TRACKER_SHEET_ID in Project Settings > Script Properties.'
    );
  }

  const ss = SpreadsheetApp.openById(id);
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
        const ageHours = (now - published.getTime()) / 3600000;
        if (ageHours > CFG.MAX_AGE_HOURS || ageHours < -36) return;
      }

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
        status: evaluation.status
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

  // Filter urgent items
  const urgent = items.filter(i => i.priority === 'CRITICAL' || i.priority === 'HIGH');

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
    if (code === 401 || code === 403 || code === 429) {
      _geminiDisabled = true; // Trip circuit breaker immediately! Don't stall future items.
      log_('WARN', 'Gemini API returned ' + code + '. Circuit breaker tripped; switching to instant rule engine for this cycle.', '');
    }
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
   RICH EXECUTIVE EMAIL DISPATCH
   ========================================================================== */

function sendRichExecutiveEmail_(items, spreadsheetUrl) {
  if (!items || items.length === 0) return;

  const highPriority = items.filter(i => i.priority === 'HIGH' || i.priority === 'CRITICAL');
  const normalCount = items.length - highPriority.length;

  const subject = `⚡ Exam Radar: ${items.length} New Update(s) [${highPriority.length} Urgent]`;

  // 1. Build Scannable Quick-Pointers List (Every single update gets a crisp pointer)
  let pointersHtml = '<ul style="margin:10px 0 20px 0;padding-left:18px;font-size:13px;line-height:1.7;color:#202124;">';
  items.forEach(item => {
    const isUrgent = item.priority === 'CRITICAL' || item.priority === 'HIGH';
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
          <h2 style="margin:0;font-size:20px;color:#ffffff;">⚡ PW Exam Intelligence Radar</h2>
          <div style="font-size:13px;color:#94a3b8;margin-top:4px;">State PSC & Judiciary Marketing Updates</div>
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
          PW Marketing Internal Tool • Automated Intelligence Alert
        </div>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: getEmailTo_(),
    subject: subject,
    body: `Exam Radar: ${items.length} new updates found (${highPriority.length} urgent).\n\nOpen spreadsheet: ${spreadsheetUrl}`,
    htmlBody: htmlBody,
    name: 'PW Exam Radar'
  });
}


/* ==========================================================================
   FEED SEARCH & GATHERING
   ========================================================================== */

function buildFeedJobs_() {
  const jobs = [];
  EXAM_SCOPES.forEach(scope => {
    scope.queries.forEach(query => {
      jobs.push({
        query: query,
        scope: scope.name,
        jurisdiction: scope.jurisdiction,
        aliases: scope.aliases,
        kind: 'psc'
      });
    });
  });

  JUDICIARY_QUERIES.forEach(query => {
    jobs.push({
      query: query,
      scope: 'Judiciary',
      jurisdiction: 'India — Nationwide',
      aliases: ['judicial service', 'judiciary', 'civil judge', 'high court', 'supreme court'],
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
            aliases: job.aliases,
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

  return { keep: true, exam, jurisdiction: item.jurisdiction, category, priority, status };
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
  if (/\bsupreme court\b/i.test(text)) return 'Supreme Court / Judiciary';
  if (/\bhigh court\b/i.test(text)) return 'High Court / Judiciary';
  if (/\b(civil judge|judicial service|judiciary exam|judicial exam)\b/i.test(text)) return 'State Judiciary Exams';
  if (/\blaw clerk\b/i.test(text)) return 'Law Clerk Recruitment';
  return 'Judiciary / Court Recruitment';
}

function classifyCategory_(text) {
  if (/\b(result|results|merit list|selection list|final list|cut.?off|scorecard)\b/i.test(text)) return 'Result';
  if (/\b(admit card|hall ticket|call letter)\b/i.test(text)) return 'Admit Card';
  if (/\b(answer key|response sheet|objection window)\b/i.test(text)) return 'Answer Key / Objections';
  if (/\b(last date|deadline|application begins|apply online|registration|extended|extension)\b/i.test(text)) return 'Deadline / Application';
  if (/\b(exam calendar|exam schedule|exam date|timetable|postponed|rescheduled|deferred)\b/i.test(text)) return 'Exam Schedule';
  if (/\b(court order|judgment|stay order|supreme court|high court)\b/i.test(text)) return 'Court / Policy Update';
  if (/\b(syllabus|eligibility|age limit|exam pattern)\b/i.test(text)) return 'Eligibility / Syllabus';
  if (/\b(corrigendum|addendum|revised notification|correction notice)\b/i.test(text)) return 'Corrigendum / Revision';
  if (/\b(advertisement|notification|vacanc(?:y|ies)|recruitment)\b/i.test(text)) return 'Notification / Recruitment';
  return 'Important Exam Update';
}

function classifyPriority_(text, category) {
  if (/\b(postponed|rescheduled|cancelled|canceled|stay order|court order|result|cut.?off|admit card)\b/i.test(text)) return 'CRITICAL';
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

  // Col 5: Priority color pills
  const priorityRange = sheet.getRange(startRow, 5, count, 1);
  priorityRange.setFontWeight('bold').setHorizontalAlignment('center');
  const priorities = priorityRange.getValues();
  for (let i = 0; i < count; i++) {
    const p = priorities[i][0];
    const cell = sheet.getRange(startRow + i, 5);
    if (p === 'CRITICAL') {
      cell.setBackground('#fce8e6').setFontColor('#c5221f');
    } else if (p === 'HIGH') {
      cell.setBackground('#fef7e0').setFontColor('#b06000');
    } else {
      cell.setBackground('#f1f3f4').setFontColor('#5f6368');
    }
  }

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
  const id = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!id) throw new Error('Missing TRACKER_SHEET_ID in Script Properties.');
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getEmailTo_() {
  return PropertiesService.getScriptProperties().getProperty('EMAIL_TO') || CFG.EMAIL_TO;
}

function log_(level, msg, details) {
  try {
    const ss = getSpreadsheet_();
    let sheet = ss.getSheetByName(CFG.LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CFG.LOG_SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Level', 'Message', 'Details']);
      styleHeader_(sheet, 4);
    }
    sheet.appendRow([new Date(), level, msg, details || '']);
  } catch (e) {
    console.error('Log failed: ' + e);
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
      const uid = n.hash || generateCompositeHash_(n.title, n.url);
      if (known.has(uid) || known.has(n.url)) return;
      known.add(uid);
      known.add(n.url);

      items.push({
        title: n.title,
        url: n.url,
        uniqueId: uid,
        publishedDate: new Date(),
        jurisdiction: n.jurisdiction || n.state || 'State Commission',
        exam: n.exam || 'Recruitment Exam',
        category: n.category || 'Notification / Recruitment',
        priority: n.priority || 'HIGH',
        summary: n.title,
        marketingAction: n.marketingAction,
        isOfficialVerified: true,
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
      const uid = n.hash || generateCompositeHash_(n.title, n.url);
      if (known.has(uid) || known.has(n.url)) return;
      known.add(uid);
      known.add(n.url);

      newItems.push({
        title: n.title,
        url: n.url,
        uniqueId: uid,
        publishedDate: new Date(),
        jurisdiction: n.jurisdiction || n.state || 'State Commission',
        exam: n.exam || 'Recruitment Exam',
        category: n.category || 'Notification / Recruitment',
        priority: n.priority || 'HIGH',
        summary: n.title,
        marketingAction: n.marketingAction,
        isOfficialVerified: true,
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
