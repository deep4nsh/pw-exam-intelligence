process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * OFFICIAL COMMISSION PORTALS INGESTION ENGINE
 * PW Exam Intelligence Radar
 *
 * Scrapes direct circular tables and announcement tickers for:
 * 1. BPSC (Bihar) - bpsc.bihar.gov.in
 * 2. UPPSC (Uttar Pradesh) - uppsc.up.nic.in
 * 3. MPPSC (Madhya Pradesh) - mppsc.mp.gov.in
 * 4. RPSC (Rajasthan) - rpsc.rajasthan.gov.in
 * 5. OPSC (Odisha) - opsc.gov.in
 * 6. MPSC (Maharashtra) - mpsc.gov.in
 * 7. Allahabad High Court (Judiciary) - allahabadhighcourt.in
 *
 * Zero dependencies: pure Node.js https/crypto.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Auto-load local .env file if process.env keys are missing
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (e) {}

const FALLBACK_TOKEN = '8962093670:AAEFDh6xdxBqVNUBIf3IybLRufbJYbjvNxI';
const REVOKED_TOKEN = '8962093670:AAGoDyQX553VbSAOh_35ntPQN96QtflWhOg';

let envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
if (!envToken || envToken === REVOKED_TOKEN || envToken.includes('WhOg')) {
  envToken = FALLBACK_TOKEN;
}

const TELEGRAM_CONFIG = {
  token: envToken,
  chatId: (process.env.TELEGRAM_CHAT_ID || '-5324420343').trim()
};

const GOOGLE_WEBAPP_CONFIG = {
  deploymentId: 'AKfycbyRZAvIjfSSTzmQgB1-WVjoSsXmBv80Tu0zeEuofNJ3gbFvFbPmCVlvbPbExKwE3_e6',
  url: process.env.GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyRZAvIjfSSTzmQgB1-WVjoSsXmBv80Tu0zeEuofNJ3gbFvFbPmCVlvbPbExKwE3_e6/exec'
};

/**
 * Strict Noise Gate: Filter out clickbait SEO blogs, foreign stories, and irrelevant court cases
 */
function isClickbaitOrIrrelevantNews(title) {
  if (!title || typeof title !== 'string') return true;
  const lower = title.toLowerCase();

  // 1. Exclude clickbait SEO coaching filler, YouTube classes, Daily Current Affairs, and human interest stories
  const isClickbait = /\b(expected cut.?off|safe score|exam analysis|paper analysis|analysis of|how to (?:check|download|apply|prepare)|preparation (?:tips|strategy|guide)|salary|in hand salary|pay scale|job profile|mock test|sample paper|model paper|best books|books for|syllabus breakdown|unofficial answer key|rank predictor|difficulty level|review petitions?|challenging (?:three|3)-year practice|cut off 20\d\d: expected|daughter tops|son of|overcame hardships|paan seller|hardships to become|current affairs|daily.*current affairs|special class|live class|marathon class|reshu jain|institute|smj institute|coaching|target batch|crash course|success story|motivation|motivational|against all odds|overcame adversity|jailed|handcuffs|home burnt|topper|topper story|meet the topper|secured.*rank|tribal youths|twice a year|2 lakh jobs)\b/i.test(lower);
  if (isClickbait) return true;

  // 2. Exclude general court crime / bail / non-exam litigation / disciplinary drama
  const isNonExamLegal = /\b(bail granted|bail rejected|anticipatory bail|fir\b|murder|rape|arrest|accident|quashes constable|plea (?:filed|dismissed|rejected|challenging)|lawyer protest|advocate protest|strike|boycott|scuffle|dispute|contempt of court|custody|potholes|encroachment|demolition|misconduct|stays.*reinstatement|dismissal of|acquitted 3 without|cannot intimidate|visits.*police)\b/i.test(lower);
  if (isNonExamLegal) return true;

  // 3. Exclude foreign jurisdictions (US, Europe, South America, etc.)
  const isForeign = /\b(orange county|luxembourg|brazil|warwick|california|new york|vinicius|white house|senate|united states|uk judiciary)\b/i.test(lower);
  if (isForeign) return true;

  // 4. Exclude unrelated national mass recruitment (Railways, Coast Guard, etc.)
  const isNonTargetExam = /\b(railway|rrb\b|coast guard|cgept|post office|postal assistant|ssc gd|ssc mts|agniveer)\b/i.test(lower);
  if (isNonTargetExam) return true;

  return false;
}



async function fetchHtml(url, timeoutMs = 25000) {
  // Tier 1: Direct Node.js fetch with browser headers and redirect following
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8"
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 200) return text;
    }
  } catch (err) {}

  // Tier 2: curl fallback with SSL flexibility
  try {
    const { execSync } = require('child_process');
    const stdout = execSync(`curl -s -k -L --max-time ${Math.round(timeoutMs / 1000)} "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (stdout && stdout.length > 200) return stdout;
  } catch (e2) {}

  // Tier 3: Edge Proxy Fallback for geoblocked or firewall-protected portals
  try {
    const proxyUrl = `https://pw-exam-intelligence.deepansh-gup124.workers.dev/api/proxy?url=${encodeURIComponent(url)}`;
    const pRes = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (pRes.ok) {
      const pText = await pRes.text();
      if (pText && pText.length > 200) return pText;
    }
  } catch (e3) {}

  throw new Error(`Failed to fetch HTML from ${url} across all direct & proxy tiers`);
}

function generateHash(title, url) {
  return crypto.createHash('sha256').update(title + '|' + url).digest('hex').slice(0, 20);
}

function cleanText(text) {
  return (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyCategory(title) {
  if (!title || typeof title !== 'string') return 'Important Notice';
  const lower = title.toLowerCase();

  // 1. Result & Merit Lists (including Marks, Scorecards, Selection Lists, Recommendations, OMRs)
  if (/\b(result|results|merit list|selection list|select list|final list|shortlist|shortlisted|cut.?off|score.?card|scorecard|marks|marksheet|marks statement|omr sheet|omr download|roll numbers? of|qualified candidates?|recommendation list|candidature list|interview result|dv list|document verification list|final recommendation|परिणाम|मेधा सूची|चयन सूची|प्राप्तांक|अनुशंसित|उत्तीर्ण)\b/i.test(lower)) {
    return 'Result';
  }

  // 2. Admit Card & Hall Tickets (including Call Letters, Exam City Slips, Interview Letters)
  if (/\b(admit card|hall ticket|hall-ticket|call letter|interview letter|e-admit|city intimation|exam city slip|download admit|admit-card|प्रवेश पत्र|बुलावा पत्र)\b/i.test(lower)) {
    return 'Admit Card';
  }

  // 3. Answer Key & Objections
  if (/\b(answer key|response sheet|objection window|model answer|provisional answer key|final answer key|master question paper|inviting objections|representation on answer|answer-key|उत्तर कुंजी|आपत्ति)\b/i.test(lower)) {
    return 'Answer Key';
  }

  // 4. Exam Schedule & Dates (including Timetable, Postponement, Reschedule, Interview Dates)
  if (/\b(exam date|schedule|calendar|timetable|time-table|postpone|postponed|postponement|reschedule|rescheduled|deferred|exam program|programme of examination|dates of exam|date sheet|tentative schedule|interview date|interview schedule|viva-voce|viva voce|personal hearing|परीक्षा कार्यक्रम|समय सारणी|स्थगित|परीक्षा तिथि)\b/i.test(lower)) {
    return 'Exam Schedule';
  }

  // 5. Corrigendum, Revision & Vacancy Updates
  if (/\b(corrigendum|amendment|addendum|errata|cancellation|cancelled|canceled|modification|revised vacancy|vacancy increase|correction notice|edit window|शुद्धिपत्र|संशोधन|निरस्त)\b/i.test(lower)) {
    return 'Corrigendum / Revision';
  }

  // 6. Recruitment Notifications, Advertisements & Application Deadlines
  if (/\b(recruitment|advertisement|advt\.?\s*no|notification|vigyapti|registration|apply online|online application|invite applications|application deadline|last date extended|vacanc(?:y|ies)|direct recruitment|special recruitment|portal open|विज्ञप्ति|भर्ती|आवेदन|अधिसूचना)\b/i.test(lower)) {
    return 'Notification / Recruitment';
  }

  // 7. Syllabus & Exam Pattern
  if (/\b(syllabus|exam pattern|scheme of examination|curriculum|marking scheme|पाठ्यक्रम|परीक्षा योजना)\b/i.test(lower)) {
    return 'Important Notice';
  }

  return 'Important Notice';
}

function generateMarketingHook(category, exam = '') {
  const ex = (exam || '').toLowerCase();

  // 1. ADA (Assistant District Attorney)
  if (/ada|assistant district attorney/i.test(ex)) {
    if (category === 'Notification / Recruitment') return 'Urgent: Launch ADA Target Screening Batch, announce bare act marathon & live syllabus breakdown.';
    if (category === 'Admit Card') return 'Send student push alert for ADA Hall Ticket; start 5-day rapid MCQ marathon on Law & General Studies.';
    if (category === 'Result') return 'Celebrate PW student selections; immediately open ADA Subject Knowledge (Mains) / Interview batch.';
    return 'Highlight ADA exam pattern changes (50%+ law syllabus weightage) and share free test series.';
  }

  // 2. Prosecution & Public Prosecutors (APO, ADPO, APP, JLO)
  if (/apo|adpo|prosecution|app|jlo|public prosecutor/i.test(ex)) {
    if (category === 'Notification / Recruitment') return 'Host live Prosecution batch launch; emphasize Criminal Major Acts (CrPC/BNSS, IPC/BNS, BSA).';
    if (category === 'Result') return 'Broadcast APO qualifiers; launch interview mentorship program with former prosecutors.';
    return 'Share updated prosecution syllabus & previous year paper analysis on PW Judiciary channel.';
  }

  // 3. Bar Advocacy & Legal Qualification (AIBE, Bar Council)
  if (/aibe|bar council|advoca/i.test(ex)) {
    if (category === 'Notification / Recruitment') return 'Broadcast AIBE registration deadline countdown; push AIBE Bare Act Mastery crash course.';
    if (category === 'Admit Card') return 'Release AIBE Exam Day Do\'s and Don\'ts video; share PDF of index bare acts list.';
    if (category === 'Result') return 'Congratulate cleared advocates on obtaining Certificate of Practice (COP); guide them toward Judiciary Foundation.';
    return 'Share AIBE qualifying strategy and bare act carrying rules.';
  }

  // 4. Judiciary (Civil Judge, PCS-J, HJS)
  if (/judiciary|civil judge|pcs-j|hjs|judicial/i.test(ex)) {
    if (category === 'Notification / Recruitment') return 'Schedule YouTube Live notification breakdown (<45m) and launch Target Batch ad creatives.';
    if (category === 'Admit Card') return 'Blast student app push notification with direct download instructions; launch 7-day revision marathon.';
    if (category === 'Result') return 'Broadcast PW student selections; push next-stage Mains/Interview mentorship batch.';
    return 'Host faculty live strategy session; offer mock test series and model answers.';
  }

  // 5. Regulatory & Banking Law (SEBI Legal, IBPS SO Law Officer)
  if (/sebi|ibps|law officer|regulatory/i.test(ex)) {
    if (category === 'Notification / Recruitment') return 'Host SEBI/IBPS Law Officer batch launch; cover Securities Laws, Company Law & Banking Regulations.';
    if (category === 'Admit Card') return 'Release last-minute commercial bare acts revision notes; promote mock test series.';
    if (category === 'Result') return 'Broadcast PW Law selections; open Mains/Interview mentorship with former banking legal managers.';
    return 'Share legal officer exam pattern breakdown & previous year cutoff analysis on PW Law Wallah.';
  }

  switch (category) {
    case 'Notification / Recruitment':
      return `Schedule YouTube Live notification breakdown (<45m) and launch Target Batch ad creatives.`;
    case 'Admit Card':
      return `Blast student app push notification with direct download instructions; launch 7-day revision marathon promo.`;
    case 'Result':
      return `Broadcast PW student selections; push next-stage Mains/Interview mentorship batch.`;
    case 'Exam Schedule':
      return `Push 'Countdown Begins' campaign; offer 20% discount on test series and mock exams.`;
    case 'Answer Key':
      return `Host faculty live Answer Key discussion stream; promote student rank predictor tool.`;
    default:
      return `Review circular details and prepare student guidance/community update.`;
  }
}

// 1. Scrape BPSC (Bihar) - Live Direct Official Dynamic API
async function scrapeBPSC() {
  const items = [];
  try {
    const postData = 'action=fetch_category_data&category=all&subcategory=&page_group=home&page=1&post_per_page=60';
    const rawRes = await new Promise((resolve, reject) => {
      const req = https.request('https://bpsc.bihar.gov.in/wp-admin/admin-ajax.php', {
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        },
        timeout: 20000
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('BPSC AJAX timeout')); });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const json = JSON.parse(rawRes);
    const posts = json?.data?.posts || [];

    for (const p of posts) {
      if (items.length >= 60) break;

      const advt = cleanText(p.fields?.home_advertisement_no || '');
      const subject = cleanText(p.fields?.home_subject_details || '');
      const subcat = cleanText(p.subcategory || '');
      const dateStr = cleanText(p.date || p.fields?.home_date || '');

      if (!subject || subject.length < 5) continue;

      const title = advt ? `${advt}: ${subject}` : subject;

      // Extract direct PDF link from download column HTML
      const dlHtml = p.fields?.home_view_download || '';
      const pdfMatches = [...dlHtml.matchAll(/href=["']([^"']+\.pdf)["']/gi)];
      const pdfUrl = pdfMatches.length > 0 ? pdfMatches[0][1] : 'https://bpsc.bihar.gov.in/';

      if (items.some(i => i.url === pdfUrl && i.title === title)) continue;

      let category = classifyCategory(subject + ' ' + subcat);
      if (/result/i.test(subcat) || /result/i.test(subject)) category = 'Result';

      let exam = 'BPSC State Recruitment';
      let isJudiciaryTrack = false;

      if (/prosecution officer|\bapo\b/i.test(title)) {
        exam = 'Bihar Assistant Prosecution Officer (APO)';
        isJudiciaryTrack = true;
      } else if (/judicial service|\bjudicial\b|civil judge|\bbjs\b/i.test(title)) {
        exam = 'Bihar Judicial Service (PCS-J)';
        isJudiciaryTrack = true;
      } else if (/cce|combined competitive/i.test(title)) {
        exam = 'BPSC Combined Competitive Exam (CCE)';
      } else if (/tre|school teacher/i.test(title)) {
        exam = 'BPSC TRE (School Teacher)';
      }

      const priority = (category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment')
        ? 'CRITICAL'
        : 'HIGH';

      items.push({
        jurisdiction: 'BPSC',
        state: 'Bihar',
        exam: exam,
        title: title,
        url: pdfUrl,
        date: dateStr,
        category: category,
        priority: priority,
        marketingAction: generateMarketingHook(category, isJudiciaryTrack ? 'Prosecution' : 'BPSC'),
        hash: generateHash(title, pdfUrl),
        isLegalTrack: isJudiciaryTrack,
        routedTo: isJudiciaryTrack ? 'PW Judiciary Wallah' : 'PW State PSC'
      });
    }
  } catch (err) {
    console.warn('⚠️ Direct BPSC AJAX failed, attempting HTML fallback:', err.message);
    try {
      const html = await fetchHtml('https://bpsc.bihar.gov.in/');
      const regex = /href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) !== null && items.length < 60) {
        const rawPdf = match[1];
        const pdfUrl = rawPdf.startsWith('http') ? rawPdf : `https://bpsc.bihar.gov.in${rawPdf}`;
        let title = cleanText(match[2]);
        if (!title || title.length < 5) {
          title = rawPdf.split('/').pop().replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
        }
        if (title.length > 5 && !items.some(i => i.url === pdfUrl)) {
          const category = classifyCategory(title);
          items.push({
            jurisdiction: 'BPSC',
            state: 'Bihar',
            exam: /prosecution|apo/i.test(title) ? 'Bihar Assistant Prosecution Officer (APO)' : (title.includes('CCE') ? 'BPSC Combined Competitive Exam' : 'BPSC State Recruitment'),
            title: title,
            url: pdfUrl,
            category: category,
            priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
            marketingAction: generateMarketingHook(category, 'BPSC'),
            hash: generateHash(title, pdfUrl)
          });
        }
      }
    } catch (e2) {}
  }
  return items;
}

// 2. Scrape UPPSC (Uttar Pradesh) - Uncapped Direct Extractor
async function scrapeUPPSC() {
  const html = await fetchHtml('https://uppsc.up.nic.in/');
  const items = [];
  // Match: <a title='...' href=Open_PDF_DB.aspx?...>
  const regex = /<a\s+title='([^']+)'\s+href=([^>\s]+)\s+target=_Blank>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && items.length < 50) {
    const title = cleanText(match[1]);
    let linkPath = match[2].trim();
    const pdfUrl = linkPath.startsWith('http') ? linkPath : `https://uppsc.up.nic.in/${linkPath}`;
    if (title.length > 5 && !items.some(i => i.url === pdfUrl)) {
      const category = classifyCategory(title);
      let exam = 'UPPSC Recruitment';
      if (title.includes('COMBINED STATE') || title.includes('UPPER SUBORDINATE') || title.includes('PCS')) {
        exam = 'UPPSC Combined State / PCS';
      } else if (/prosecution|apo\b/i.test(title)) {
        exam = 'UP Assistant Prosecution Officer (APO)';
      } else if (/judicial|civil judge|pcs-j/i.test(title)) {
        exam = 'UP Civil Judge (PCS-J)';
      } else if (title.includes('AYUSH')) {
        exam = 'UPPSC Ayush Services';
      }

      items.push({
        jurisdiction: 'UPPSC',
        state: 'Uttar Pradesh',
        exam: exam,
        title: title,
        url: pdfUrl,
        category: category,
        priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'UPPSC'),
        hash: generateHash(title, pdfUrl)
      });
    }
  }
  return items;
}

// 3. Scrape MPPSC (Madhya Pradesh)
async function scrapeMPPSC() {
  let items = [];
  try {
    const html = await fetchHtml("https://mppsc.mp.gov.in/", 12000);
    const regex = /href="(https:\/\/mppsc\.mp\.gov\.in\/uploads\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && items.length < 50) {
      const pdfUrl = match[1];
      let anchorText = cleanText(match[2]);
      const fileName = pdfUrl.split("/").pop().replace(/\.pdf$/i, "").replace(/_/g, " ");
      const title = anchorText.length > 5 ? anchorText : fileName;

      if (!items.some(i => i.url === pdfUrl)) {
        const category = classifyCategory(title);
        let exam = "MPPSC State Recruitment";
        if (title.includes("State Service")) exam = "MPPSC State Service Exam";
        else if (/adpo|prosecution/i.test(title)) exam = "MP Assistant District Public Prosecution Officer (ADPO)";
        else if (/civil judge|judicial/i.test(title)) exam = "MP Civil Judge";

        items.push({
          jurisdiction: "MPPSC",
          state: "Madhya Pradesh",
          exam: exam,
          title: title,
          url: pdfUrl,
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "MPPSC"),
          hash: generateHash(title, pdfUrl)
        });
      }
    }
  } catch (e) {}

  // Fallback to real-time feed ONLY if direct portal extraction returned 0 notices (e.g. commission server down)
  if (items.length === 0) {
    try {
      const feedUrl = "https://news.google.com/rss/search?q=MPPSC+when:24h&hl=en-IN&gl=IN&ceid=IN:en";
      const feedRes = await fetchHtml(feedUrl, 15000);
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
      let fMatch;
      while ((fMatch = itemRegex.exec(feedRes)) !== null && items.length < 50) {
        let title = cleanText(fMatch[1]).replace(/ - [^-]+$/g, "").replace(/ - MPPSC/gi, "").trim();
        const link = fMatch[2].trim();
        const pubDate = fMatch[3].trim();

        if (isClickbaitOrIrrelevantNews(title)) continue;

        if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
          const category = classifyCategory(title);
          let exam = "MPPSC State Recruitment";
          if (title.includes("State Service")) exam = "MPPSC State Service Exam";
          else if (/adpo|prosecution/i.test(title)) exam = "MP Assistant District Public Prosecution Officer (ADPO)";
          else if (/civil judge|judicial/i.test(title)) exam = "MP Civil Judge";

          items.push({
            jurisdiction: "MPPSC",
            state: "Madhya Pradesh",
            exam: exam,
            title: title,
            url: link,
            date: pubDate ? pubDate.split(" ").slice(1, 4).join(" ") : "",
            category: category,
            priority: category === "Result" || category === "Admit Card" ? "CRITICAL" : "HIGH",
            marketingAction: generateMarketingHook(category, "MPPSC"),
            hash: generateHash(title, link)
          });
        }
      }
    } catch (feedErr) {}
  }

  return items;
}

// 4. Scrape RPSC (Rajasthan)
async function scrapeRPSC() {
  let html = "";
  const items = [];

  // Tier 1: Direct fetch
  try {
    html = await fetchHtml("https://rpsc.rajasthan.gov.in/", 12000);
  } catch (e) {
    // Tier 2: Cloudflare Indian Edge Proxy
    try {
      html = await fetchHtml("https://pw-exam-intelligence.deepansh-gup124.workers.dev/api/proxy?url=https%3A%2F%2Frpsc.rajasthan.gov.in%2F", 25000);
    } catch (err) {}
  }

  if (html && html.length > 500) {
    const regex = /<a\s+href=['"](Static\/News\/[^'"]+\.pdf)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && items.length < 50) {
      const pdfPath = match[1];
      const rawContent = match[2];
      const title = cleanText(rawContent);
      const pdfUrl = `https://rpsc.rajasthan.gov.in/${pdfPath}`;

      if (title.length > 5 && !items.some(i => i.url === pdfUrl)) {
        const category = classifyCategory(title);
        let exam = "RPSC State Recruitment";
        if (title.includes("RAS")) exam = "RPSC RAS / RTS Exam";
        else if (/jlo|junior legal/i.test(title)) exam = "Rajasthan Junior Legal Officer (JLO)";
        else if (/app|prosecut/i.test(title)) exam = "Rajasthan Assistant Public Prosecutor (APP)";

        items.push({
          jurisdiction: "RPSC",
          state: "Rajasthan",
          exam: exam,
          title: title,
          url: pdfUrl,
          category: category,
          priority: category === "Result" || category === "Admit Card" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "RPSC"),
          hash: generateHash(title, pdfUrl)
        });
      }
    }
  }

  // Tier 3: Official Google News Feed Fallback (ONLY if direct portal extraction returned 0 notices)
  if (items.length === 0) {
    try {
      const feedUrl = "https://news.google.com/rss/search?q=site:rpsc.rajasthan.gov.in+OR+(RPSC+RAS+admit+card+OR+result+OR+exam)+when:24h&hl=en-IN&gl=IN&ceid=IN:en";
      const feedRes = await fetchHtml(feedUrl, 15000);
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
      let fMatch;
      while ((fMatch = itemRegex.exec(feedRes)) !== null && items.length < 50) {
        let title = cleanText(fMatch[1]).replace(/ - [^-]+$/g, "").replace(/ - RPSC/gi, "").trim();
        const link = fMatch[2].trim();
        const pubDate = fMatch[3].trim();

        if (isClickbaitOrIrrelevantNews(title)) continue;

        if (title.length > 5 && !items.some(i => i.title === title)) {
          const category = classifyCategory(title);
          let exam = "RPSC State Recruitment";
          if (title.includes("RAS")) exam = "RPSC RAS / RTS Exam";
          else if (/jlo|junior legal/i.test(title)) exam = "Rajasthan Junior Legal Officer (JLO)";
          else if (/app|prosecut/i.test(title)) exam = "Rajasthan Assistant Public Prosecutor (APP)";

          items.push({
            jurisdiction: "RPSC",
            state: "Rajasthan",
            exam: exam,
            title: title,
            url: link,
            date: pubDate ? pubDate.split(" ").slice(1, 4).join(" ") : "",
            category: category,
            priority: category === "Result" || category === "Admit Card" ? "CRITICAL" : "HIGH",
            marketingAction: generateMarketingHook(category, "RPSC"),
            hash: generateHash(title, link)
          });
        }
      }
    } catch (e) {}
  }

  return items;
}

// 5. Scrape Pan-India Judiciary (Direct Official High Court Circulars + Clean Feeds)
async function scrapePanIndiaJudiciary() {
  const items = [];

  // Tier 1A: Direct Allahabad High Court official notices (UP HJS, District Judge, Law Clerks, Staff)
  try {
    const html = await fetchHtml("https://www.allahabadhighcourt.in/calendar/itemWiseList.jsp?group=7", 15000);
    const rowRegex = /<TD[^>]*WIDTH=['"]74%['"][^>]*>([\s\S]*?)<A\s+HREF=['"](\/event\/[^'"]+\.pdf)['"][\s\S]*?<TD[^>]*WIDTH=['"]20%['"][^>]*>([\s\S]*?)<\/TD>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null && items.length < 30) {
      const rawTitle = cleanText(match[1]).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      const pdfPath = match[2].trim();
      const dateText = cleanText(match[3]).replace(/Last Date:.*$/i, '').trim();
      const pdfUrl = "https://www.allahabadhighcourt.in" + pdfPath;

      if (rawTitle.length > 5 && !items.some(i => i.url === pdfUrl)) {
        const category = classifyCategory(rawTitle);
        let exam = "High Court Judicial Recruitment";
        if (/hjs|higher judicial/i.test(rawTitle)) exam = "UP Higher Judicial Service (HJS)";
        else if (/civil judge|pcs-j/i.test(rawTitle)) exam = "UP Civil Judge (PCS-J)";
        else if (/law clerk/i.test(rawTitle)) exam = "High Court Law Clerk (Trainee)";
        else if (/private secretar/i.test(rawTitle)) exam = "High Court Private Secretary";

        items.push({
          jurisdiction: "Pan-India Judiciary",
          state: "Allahabad High Court (UP)",
          exam: exam,
          title: rawTitle,
          url: pdfUrl,
          date: dateText,
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(rawTitle, pdfUrl),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {
    console.warn("Allahabad HC scraper warning:", e.message);
  }

  // Tier 1B: Direct Delhi High Court Official Recruitment Portal (DJS, DHJS, Judicial Assistants)
  try {
    const dhcUrls = [
      "https://delhihighcourt.nic.in/web/recruitment-results-current",
      "https://delhihighcourt.nic.in/web/job-openings"
    ];
    for (const dUrl of dhcUrls) {
      try {
        const html = await fetchHtml(dUrl, 15000);
        const matches = [...html.matchAll(/href=["'](\/files\/[^\s"']+\.pdf)["'][^>]*>[\s\S]*?alt=["']([^"']+)["']/gi)];
        for (const m of matches) {
          if (items.filter(i => i.state?.includes("Delhi")).length >= 25) break;
          const pdfPath = m[1].trim();
          const title = cleanText(m[2]);
          const pdfUrl = `https://delhihighcourt.nic.in${pdfPath}`;

          if (title.length > 8 && !items.some(i => i.url === pdfUrl || i.title === title)) {
            const category = classifyCategory(title);
            let exam = "Delhi High Court Recruitment";
            if (/higher judicial|dhjs/i.test(title)) exam = "Delhi Higher Judicial Service (DHJS)";
            else if (/judicial service|djs\b/i.test(title)) exam = "Delhi Judicial Service (DJS)";
            else if (/judicial assistant|restorer/i.test(title)) exam = "Delhi HC Junior Judicial Assistant (JJA)";

            items.push({
              jurisdiction: "Pan-India Judiciary",
              state: "Delhi High Court (DHC)",
              exam: exam,
              title: title,
              url: pdfUrl,
              category: category,
              priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
              marketingAction: generateMarketingHook(category, "Judiciary"),
              hash: generateHash(title, pdfUrl),
              isLegalTrack: true,
              routedTo: "PW Judiciary Wallah"
            });
          }
        }
      } catch (err) {}
    }
  } catch (e) {}

  // Tier 1C: Direct Patna High Court (Bihar Judicial Service & District Judge)
  try {
    const html = await fetchHtml("https://patnahighcourt.gov.in/notices/recruitments", 15000);
    const pMatches = [...html.matchAll(/<span[^>]+class=["']new-item["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<a[^>]+href=["'](\.\.\/getfile\/[^"']+)["']/gi)];
    for (const m of pMatches) {
      if (items.filter(i => i.state?.includes("Patna")).length >= 25) break;
      const title = cleanText(m[1]);
      const pdfPath = m[2].replace('../', '');
      const pdfUrl = `https://patnahighcourt.gov.in/${pdfPath}`;

      if (title.length > 8 && !items.some(i => i.url === pdfUrl || i.title === title)) {
        const category = classifyCategory(title);
        let exam = "Patna High Court Recruitment";
        if (/district judge|entry level/i.test(title)) exam = "Bihar Higher Judicial Service (District Judge)";
        else if (/civil judge|judicial service|bjs/i.test(title)) exam = "Bihar Judicial Service (PCS-J)";
        else if (/research assistant|law/i.test(title)) exam = "Patna High Court Research Assistant (Law)";

        items.push({
          jurisdiction: "Pan-India Judiciary",
          state: "Patna High Court (Bihar)",
          exam: exam,
          title: title,
          url: pdfUrl,
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(title, pdfUrl),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {}

  // Tier 1D: Direct Madhya Pradesh High Court (MP Civil Judge & Higher Judicial Service)
  try {
    const html = await fetchHtml("https://mphc.gov.in", 15000);
    const mpMatches = [...html.matchAll(/<a[^>]+href=["'](https:\/\/mphc\.gov\.in\/storage\/PDF\/[^\s"']+\.pdf)["'][^>]*>[\s\S]*?<span[^>]*style=["'][^"']*text-align:\s*justify;?[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
    for (const m of mpMatches) {
      if (items.filter(i => i.state?.includes("Madhya Pradesh")).length >= 25) break;
      const pdfUrl = m[1].trim();
      const title = cleanText(m[2]);

      if (title.length > 8 && !items.some(i => i.url === pdfUrl || i.title === title)) {
        const category = classifyCategory(title);
        let exam = "MP High Court Recruitment";
        if (/higher judicial|district judge|suitability/i.test(title)) exam = "MP Higher Judicial Service (HJS)";
        else if (/civil judge/i.test(title)) exam = "MP Civil Judge Cadre";
        else if (/assistant grade/i.test(title)) exam = "MP District Court Assistant Grade-III";

        items.push({
          jurisdiction: "Pan-India Judiciary",
          state: "Madhya Pradesh High Court (MPHC)",
          exam: exam,
          title: title,
          url: pdfUrl,
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(title, pdfUrl),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {}

  // Tier 1E: Direct Rajasthan High Court (RJS & Legal Research)
  try {
    const html = await fetchHtml("https://hcraj.nic.in/hcraj/recruitment.php", 15000);
    const rMatches = [...html.matchAll(/<li[^>]+class=["']my-page-li["'][^>]*>[\s\S]*?<a[^>]+href=["'](recruitment_detail\.php\?id=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of rMatches) {
      if (items.filter(i => i.state?.includes("Rajasthan High Court")).length >= 25) break;
      const relPath = m[1].trim();
      const title = cleanText(m[2]);
      const detailUrl = `https://hcraj.nic.in/hcraj/${relPath}`;

      if (title.length > 5 && !items.some(i => i.url === detailUrl || i.title === title)) {
        const category = classifyCategory(title);
        let exam = "Rajasthan High Court Recruitment";
        if (/civil judge|rjs/i.test(title)) exam = "Rajasthan Judicial Service (RJS)";
        else if (/district judge|dj/i.test(title)) exam = "Rajasthan District Judge Cadre";
        else if (/legal research/i.test(title)) exam = "Rajasthan HC Legal Researcher";

        items.push({
          jurisdiction: "Pan-India Judiciary",
          state: "Rajasthan High Court (HCRAJ)",
          exam: exam,
          title: `Rajasthan High Court: ${title}`,
          url: detailUrl,
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(title, detailUrl),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {}

  // Tier 2: Filtered High Courts & Supreme Court Real-Time Feed (Cleaned of court crime & clickbait)
  try {
    const feedUrl = "https://news.google.com/rss/search?q=(%22Delhi+Judicial+Service%22+OR+%22DJS%22+OR+%22DHJS%22+OR+%22Bihar+Judicial+Service%22+OR+%22BJS%22+OR+%22Rajasthan+Judicial+Service%22+OR+%22RJS%22+OR+%22MP+Civil+Judge%22+OR+%22UP+PCS-J%22+OR+%22UP+HJS%22+OR+%22Civil+Judge+Recruitment%22+OR+%22High+Court+Recruitment%22+OR+%22Bombay+High+Court%22+OR+%22Gujarat+High+Court%22+OR+%22Calcutta+High+Court%22+OR+%22Punjab+and+Haryana+High+Court%22+OR+%22Supreme+Court+of+India+Recruitment%22)+AND+(Exam+OR+Result+OR+%22Admit+Card%22+OR+Notification+OR+Recruitment+OR+Interview)+when:24h&hl=en-IN&gl=IN&ceid=IN:en";
    const feedRes = await fetchHtml(feedUrl, 15000);
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
    let fMatch;
    while ((fMatch = itemRegex.exec(feedRes)) !== null && items.length < 60) {
      let title = cleanText(fMatch[1]).replace(/ - [^-]+$/g, "").trim();
      const link = fMatch[2].trim();
      const pubDate = fMatch[3].trim();

      // Strict noise gate: Exclude court judgments, bail, crime, and clickbait SEO
      if (isClickbaitOrIrrelevantNews(title)) continue;

      if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
        const category = classifyCategory(title);
        let state = "Pan-India Judiciary";
        let exam = "High Court Judicial Recruitment";

        if (/delhi/i.test(title)) {
          state = "Delhi High Court (DHC)";
          exam = /higher/i.test(title) ? "Delhi Higher Judicial Service (DHJS)" : "Delhi Judicial Service (DJS)";
        } else if (/bihar|patna/i.test(title)) {
          state = "Patna High Court (Bihar)";
          exam = "Bihar Judicial Service (PCS-J)";
        } else if (/rajasthan|hcraj/i.test(title)) {
          state = "Rajasthan High Court (HCRAJ)";
          exam = /civil judge|rjs/i.test(title) ? "Rajasthan Judicial Service (RJS)" : "Rajasthan High Court Recruitment";
        } else if (/punjab|haryana/i.test(title)) {
          state = "Punjab & Haryana High Court";
          exam = /civil judge/i.test(title) ? "Haryana / Punjab Judicial Service" : "Subordinate Courts Judicial Staff";
        } else if (/mp|madhya pradesh|mphc/i.test(title)) {
          state = "Madhya Pradesh High Court (MPHC)";
          exam = /civil judge/i.test(title) ? "MP Civil Judge Cadre" : "MP High Court Judicial Recruitment";
        } else if (/bombay/i.test(title)) {
          state = "Bombay High Court";
          exam = /civil judge|cjjd|jmfc/i.test(title) ? "Maharashtra Judicial Service (CJJD)" : "Bombay High Court Recruitment";
        } else if (/gujarat/i.test(title)) {
          state = "Gujarat High Court";
          exam = /civil judge/i.test(title) ? "Gujarat Judicial Service (Civil Judge)" : "Gujarat High Court Recruitment";
        } else if (/calcutta|bengal/i.test(title)) {
          state = "Calcutta High Court";
          exam = /judicial service|wbjs/i.test(title) ? "West Bengal Judicial Service (WBJS)" : "Calcutta High Court Recruitment";
        } else if (/allahabad|uttar pradesh/i.test(title)) {
          state = "Allahabad High Court (UP)";
          exam = /hjs/i.test(title) ? "UP Higher Judicial Service (HJS)" : "UP Civil Judge (PCS-J)";
        } else if (/supreme court|sci\b/i.test(title)) {
          state = "Supreme Court of India (SCI)";
          exam = "Supreme Court Judicial Registry / Law Clerk";
        }

        items.push({
          jurisdiction: "Pan-India Judiciary",
          state: state,
          exam: exam,
          title: title,
          url: link,
          date: pubDate ? pubDate.split(" ").slice(1, 4).join(" ") : "",
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(title, link),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {}

  return items;
}

// 6. Scrape ADA & State Prosecution Services (Assistant District Attorney / APO / ADPO / APP)
async function scrapeADAAndProsecution() {
  const items = [];

  // Tier 1: Direct Official HPSC Portal Ingestion (Haryana ADA Official Circulars & Score Lists)
  try {
    const hpscUrls = [
      "https://hpsc.gov.in/en-us/Announcements",
      "https://hpsc.gov.in/en-us/Results"
    ];

    for (const pageUrl of hpscUrls) {
      try {
        const html = await fetchHtml(pageUrl, 15000);
        const linkRegex = /<a[^>]+href=["\x27]([^"\x27]+\.pdf)["\x27][^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null && items.length < 30) {
          const rawPdf = match[1].trim();
          const pdfUrl = rawPdf.startsWith("http") ? rawPdf : `https://hpsc.gov.in${rawPdf}`;
          const rawTitle = cleanText(match[2]).replace(/&#39;/g, "'").replace(/&quot;/g, '"');

          if (/ADA|Assistant District Attorney|Prosecution Department|Civil Judge|Judicial|HCS\s*\(JB\)|Superintendent\s*\(Legal\)/i.test(rawTitle) || /_ADA_|_JUD_/i.test(rawPdf)) {
            if (!items.some(i => i.url === pdfUrl || i.title === rawTitle)) {
              let category = classifyCategory(rawTitle);
              if (/marks|score/i.test(rawTitle)) category = "Result";
              let exam = "Haryana Assistant District Attorney (ADA)";
              if (/civil judge|judicial|hcs\s*\(jb\)/i.test(rawTitle)) {
                exam = "Haryana Civil Judge (Junior Division)";
              } else if (/superintendent/i.test(rawTitle)) {
                exam = "HPSC Superintendent (Legal)";
              }

              items.push({
                jurisdiction: "ADA & Prosecution",
                state: "Haryana (HPSC)",
                exam: exam,
                title: rawTitle,
                url: pdfUrl,
                date: "Recent",
                category: category,
                priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
                marketingAction: generateMarketingHook(category, exam),
                hash: generateHash(rawTitle, pdfUrl),
                isLegalTrack: true,
                routedTo: "PW Judiciary Wallah"
              });
            }
          }
        }
      } catch (err) {}
    }
  } catch (e) {}

  // Tier 2: Pan-India ADA, Prosecution & State Legal Feeds (Punjab ADA, UP APO, MP ADPO, Bihar APO, HPSC ADA, RPSC JLO)
  try {
    const feedUrl = "https://news.google.com/rss/search?q=(%22BPSC+APO%22+OR+%22Bihar+APO%22+OR+%22UP+APO%22+OR+%22UPPSC+APO%22+OR+%22HPSC+ADA%22+OR+%22Punjab+ADA%22+OR+%22PPSC+ADA%22+OR+%22Haryana+ADA%22+OR+%22MP+ADPO%22+OR+%22RPSC+JLO%22+OR+%22Assistant+Prosecution+Officer+India%22)+AND+(Recruitment+OR+Exam+OR+Result+OR+%22Admit+Card%22+OR+Notification)+when:24h&hl=en-IN&gl=IN&ceid=IN:en";
    const feedRes = await fetchHtml(feedUrl, 15000);
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(feedRes)) !== null && items.length < 50) {
      let title = cleanText(match[1]).replace(/ - [^-]+$/g, "").trim();
      const link = match[2].trim();
      const pubDate = match[3].trim();

      // Strict noise gate
      if (isClickbaitOrIrrelevantNews(title)) continue;

      if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
        let category = classifyCategory(title);
        if (/marks|score/i.test(title)) category = "Result";
        let state = "State Prosecution Department";
        let exam = "Assistant District Attorney (ADA)";

        // Precise state mapping (checked before generic terms)
        if (/bihar|bpsc/i.test(title)) {
          state = "Bihar (BPSC)";
          exam = "Bihar Assistant Prosecution Officer (APO)";
        } else if (/up|uttar pradesh|uppsc/i.test(title)) {
          state = "Uttar Pradesh (UPPSC)";
          exam = "UP Assistant Prosecution Officer (APO)";
        } else if (/mp|madhya pradesh|mppsc|adpo/i.test(title)) {
          state = "Madhya Pradesh (MPPSC)";
          exam = "MP Assistant District Public Prosecution Officer (ADPO)";
        } else if (/hpsc|haryana/i.test(title)) {
          state = "Haryana (HPSC)";
          exam = "Haryana Assistant District Attorney (ADA)";
        } else if (/punjab|psssb|ppsc/i.test(title)) {
          state = "Punjab (PPSC / PSSSB)";
          exam = "Punjab Assistant District Attorney (ADA)";
        } else if (/odisha|opsc|app/i.test(title)) {
          state = "Odisha (OPSC)";
          exam = "Assistant Public Prosecutor (APP)";
        } else if (/jlo|junior legal/i.test(title)) {
          state = "Rajasthan (RPSC)";
          exam = "Junior Legal Officer (JLO)";
        } else if (/prosecution officer|\bapo\b/i.test(title)) {
          state = "State Prosecution Department";
          exam = "Assistant Prosecution Officer (APO)";
        } else if (/public prosecutor|cbi|nia/i.test(title)) {
          state = "Central / State Prosecution";
          exam = "Public Prosecutor Recruitment";
        }

        items.push({
          jurisdiction: "ADA & Prosecution",
          state: state,
          exam: exam,
          title: title,
          url: link,
          date: pubDate ? pubDate.split(" ").slice(1, 4).join(" ") : "",
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, exam),
          hash: generateHash(title, link),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {
    console.error("Error scraping ADA & Prosecution:", e.message);
  }

  return items;
}

// 7. Scrape Bar Advocacy, AIBE & Regulatory Law (All India Bar Examination, SEBI Legal & IBPS SO Law)
async function scrapeBarAdvocacyAndAIBE() {
  const items = [];

  // Tier 1: Direct Official AIBE Portal Scraping (allindiabarexamination.com)
  try {
    const aibeHtml = await fetchHtml("https://www.allindiabarexamination.com/", 15000);
    const pRegex = /<a[^>]+href=["\x27]([^"\x27]+\.pdf)["\x27][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = pRegex.exec(aibeHtml)) !== null && items.length < 20) {
      const pdfPath = match[1].trim();
      const pdfUrl = pdfPath.startsWith("http") ? pdfPath : `https://www.allindiabarexamination.com/${pdfPath}`;
      let rawTitle = cleanText(match[2]).replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      if (!rawTitle || rawTitle.length < 4) {
        rawTitle = pdfPath.split("/").pop().replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
      }

      if (/AIBE|Syllabus|Answer|Schedule|COP|Result|Notification|Objection/i.test(rawTitle) || /AIBE/i.test(pdfPath)) {
        if (!items.some(i => i.url === pdfUrl)) {
          let category = classifyCategory(rawTitle);
          if (/syllabus/i.test(rawTitle)) category = "Important Notice";
          if (/answer key/i.test(rawTitle)) category = "Answer Key";
          if (/schedule/i.test(rawTitle)) category = "Exam Schedule";

          const cleanName = `AIBE Official Circular: ${rawTitle}`;
          const exam = /XXII/i.test(rawTitle) ? "All India Bar Examination (AIBE XXII)" : "All India Bar Examination (AIBE)";

          items.push({
            jurisdiction: "Bar Advocacy & Law",
            state: "Bar Council of India (BCI)",
            exam: exam,
            title: cleanName,
            url: pdfUrl,
            date: "Recent",
            category: category,
            priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
            marketingAction: generateMarketingHook(category, exam),
            hash: generateHash(cleanName, pdfUrl),
            isLegalTrack: true,
            routedTo: "PW Judiciary Wallah"
          });
        }
      }
    }
  } catch (e) {
    console.error("Error scraping AIBE official portal:", e.message);
  }

  // Tier 2A: Direct Official IBPS CRP Specialist Officers (Law Officer Scale I)
  try {
    const ibpsHtml = await fetchHtml("https://www.ibps.in/index.php/specialist-officers-xvi/", 15000);
    const linkMatches = ibpsHtml.match(/<a[^>]+href=[\'\"][^\'\"]*[\'\"][^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const raw of linkMatches) {
      if (items.filter(i => i.exam && i.exam.includes("IBPS")).length >= 15) break;
      const title = cleanText(raw);
      const href = (raw.match(/href=[\'\"]([^\'\"]*)[\'\"]/) || [])[1];
      if (!title || !href || title.length < 10) continue;
      if (/crp\s*[-–]?\s*spl|specialist\s+officer|law\s+officer|preliminary|corrigendum/i.test(title) && !/elementor|guidelines|faq/i.test(title)) {
        if (!items.some(i => i.title === title || i.url === href)) {
          const category = classifyCategory(title);
          const exam = "IBPS SO (Law Officer)";
          items.push({
            jurisdiction: "Bar Advocacy & Law",
            state: "Institute of Banking Personnel Selection (IBPS)",
            exam: exam,
            title: title,
            url: href,
            date: "Recent",
            category: category,
            priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
            marketingAction: generateMarketingHook(category, exam),
            hash: generateHash(title, href),
            isLegalTrack: true,
            routedTo: "PW Judiciary Wallah"
          });
        }
      }
    }
  } catch (e) {
    console.error("Error scraping direct IBPS portal:", e.message);
  }

  // Tier 2B: Direct Official SEBI Careers (Officer Grade A Legal Stream)
  try {
    const sebiHtml = await fetchHtml("https://www.sebi.gov.in/sebiweb/about/AboutAction.do?doVacancies=yes", 15000);
    const linkMatches = sebiHtml.match(/<a[^>]+href=[\'\"][^\'\"]*[\'\"][^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const raw of linkMatches) {
      if (items.filter(i => i.exam && i.exam.includes("SEBI")).length >= 15) break;
      const title = cleanText(raw);
      let href = (raw.match(/href=[\'\"]([^\'\"]*)[\'\"]/) || [])[1];
      if (!title || !href || title.length < 15) continue;
      if (/grade\s*[\'\"’]?a[\'\"’]?|legal\s+stream|officer\s+grade\s*a/i.test(title) && !/functions|departments|recreational/i.test(title)) {
        if (href.startsWith("/")) href = "https://www.sebi.gov.in" + href;
        if (!items.some(i => i.title === title || i.url === href)) {
          const category = classifyCategory(title);
          const exam = "SEBI Grade A (Legal)";
          items.push({
            jurisdiction: "Bar Advocacy & Law",
            state: "Securities and Exchange Board of India (SEBI)",
            exam: exam,
            title: title,
            url: href,
            date: "Recent",
            category: category,
            priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
            marketingAction: generateMarketingHook(category, exam),
            hash: generateHash(title, href),
            isLegalTrack: true,
            routedTo: "PW Judiciary Wallah"
          });
        }
      }
    }
  } catch (e) {
    console.error("Error scraping direct SEBI portal:", e.message);
  }

  // Tier 2C: Direct Banking & Regulatory Legal Streams (Real-Time Fallback & Breaking News)
  try {
    const regQuery = "https://news.google.com/rss/search?q=(%22IBPS+SO%22+OR+%22SEBI+Grade+A%22)+AND+(Law+OR+Legal)+when:24h&hl=en-IN&gl=IN&ceid=IN:en";
    const regRes = await fetchHtml(regQuery, 15000);
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(regRes)) !== null && items.length < 30) {
      let title = cleanText(match[1]).replace(/ - [^-]+$/g, "").trim();
      const link = match[2].trim();
      const pubDate = match[3].trim();

      if (/celebrity|gta|trailer|party/i.test(title)) continue;

      if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
        const category = classifyCategory(title);
        let exam = "SEBI Grade A (Legal)";
        let state = "Securities and Exchange Board of India (SEBI)";

        if (/ibps/i.test(title)) {
          exam = "IBPS SO (Law Officer)";
          state = "Institute of Banking Personnel Selection (IBPS)";
        }

        items.push({
          jurisdiction: "Bar Advocacy & Law",
          state: state,
          exam: exam,
          title: title,
          url: link,
          date: pubDate ? pubDate.split(" ").slice(1, 4).join(" ") : "",
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, exam),
          hash: generateHash(title, link),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {
    console.error("Error scraping Regulatory Law news feed:", e.message);
  }

  // Tier 3: Bar Council of India, Supreme Court AOR & General Bar Admissions
  try {
    const barQuery = "https://news.google.com/rss/search?q=(%22All+India+Bar+Examination%22+OR+%22AIBE%22+OR+%22Bar+Council+of+India%22+OR+%22Advocate+on+Record%22)+AND+(Exam+OR+Admit+Card+OR+Result+OR+Registration+OR+Notification)+when:24h&hl=en-IN&gl=IN&ceid=IN:en";
    const barRes = await fetchHtml(barQuery, 15000);
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(barRes)) !== null && items.length < 50) {
      let title = cleanText(match[1]).replace(/ - [^-]+$/g, "").trim();
      const link = match[2].trim();
      const pubDate = match[3].trim();

      if (isClickbaitOrIrrelevantNews(title)) continue;

      if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
        const category = classifyCategory(title);
        let state = "Bar Council of India (BCI)";
        let exam = "All India Bar Examination (AIBE)";

        if (/advocate on record|aor/i.test(title)) {
          state = "Supreme Court of India (SCI)";
          exam = "Supreme Court Advocate-on-Record (AOR)";
        }

        items.push({
          jurisdiction: "Bar Advocacy & Law",
          state: state,
          exam: exam,
          title: title,
          url: link,
          date: pubDate ? pubDate.split(" ").slice(1, 4).join(" ") : "",
          category: category,
          priority: category === "Result" || category === "Admit Card" || category === "Notification / Recruitment" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, exam),
          hash: generateHash(title, link),
          isLegalTrack: true,
          routedTo: "PW Judiciary Wallah"
        });
      }
    }
  } catch (e) {
    console.error("Error scraping BCI/AOR news feed:", e.message);
  }

  return items;
}

// 8. Scrape OPSC (Odisha)
async function scrapeOPSC() {
  const html = await fetchHtml('https://opsc.gov.in/Public/OPSC/Default.aspx');
  const items = [];
  const liMatches = html.match(/<li>\s*<div class=['"]listing_date[\s\S]*?<\/li>/gi) || [];

  for (const raw of liMatches) {
    if (items.length >= 50) break;
    let dateStr = '';
    const dateMatch = raw.match(/<div class=['"]datebox['"]>[\s\S]*?<span class=['"]month['"]>(\d+)<\/span>[\s\S]*?<span class=['"]Date['"]>([a-zA-Z]+)<\/span>/i);
    if (dateMatch) {
      dateStr = `${dateMatch[1]} ${dateMatch[2]}`;
    }

    const titleMatch = raw.match(/<span class=['"]content_title['"]>([\s\S]*?)<\/span>/i);
    let title = titleMatch ? cleanText(titleMatch[1]) : cleanText(raw);
    title = title.replace(/\bView Pdf\b/gi, '').replace(/\bSubmit Objection.*$/gi, '').trim();

    if (title.length > 5 && !items.some(i => i.title === title)) {
      const category = classifyCategory(title);
      let exam = 'OPSC Recruitment';
      if (/odisha civil services|oas|ocs/i.test(title)) exam = 'Odisha Civil Services (OAS)';
      else if (/judicial service|ojs|civil judge/i.test(title)) exam = 'Odisha Judicial Service (OJS)';
      else if (/assistant executive engineer|aee/i.test(title)) exam = 'OPSC Engineering Services (AEE)';
      else if (/assistant agriculture engineer/i.test(title)) exam = 'OPSC Agriculture Services';
      else if (/veterinary assistant/i.test(title)) exam = 'OPSC Veterinary Services';

      const noticeUrl = 'https://www.opsc.gov.in/Public/OPSC/Default.aspx';

      items.push({
        jurisdiction: 'OPSC (Odisha)',
        state: 'Odisha',
        exam: exam,
        title: title,
        url: noticeUrl,
        date: dateStr,
        category: category,
        priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'OPSC'),
        hash: generateHash(title, noticeUrl)
      });
    }
  }
  return items;
}

// 7. Scrape MPSC (Maharashtra)
const MPSC_SECRET_KEY = "S300cr3t!@#Key$%^&*()_+[]{}|;':,.<>?/~`";

function mpscCalculateCrc32(str) {
  let c = -1;
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      c = (c ^ code) & 1 ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
      code >>>= 1;
    }
  }
  return ((-1 ^ c) >>> 0).toString(16);
}

function mpscDecryptAes(cipherText) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', '1234567812345678', '1234567812345678');
  let decrypted = decipher.update(cipherText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function fetchMpscContent(mid) {
  return new Promise((resolve) => {
    const crcVal = mpscCalculateCrc32(MPSC_SECRET_KEY);
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Authorization': '|#|#' + crcVal,
      'CRC': crcVal
    };

    const req = https.get(`https://mpsc.gov.in/web/api/v1/getcontentdata/${mid}`, { headers, rejectUnauthorized: false, timeout: 12000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          let text = data.trim();
          if (text.startsWith('"') && text.endsWith('"')) text = JSON.parse(text);
          const decrypted = JSON.parse(mpscDecryptAes(text));
          resolve(decrypted[mid]?.webContentList || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.on('error', () => resolve([]));
  });
}

async function scrapeMPSC() {
  const items = [];
  const [announcements, advertisements] = await Promise.all([
    fetchMpscContent(4).catch(() => []),
    fetchMpscContent(8).catch(() => [])
  ]);

  const rawList = [...announcements, ...advertisements];

  for (const raw of rawList) {
    if (items.length >= 50) break;
    const title = cleanText(raw.descInEnglish || raw.descMr || raw.name);
    if (!title || title.length < 5) continue;

    const noticeUrl = raw.id 
      ? `https://mpsc.gov.in/web/api/v1/downloadFileImage/english/${raw.id}`
      : 'https://mpsc.gov.in/recent_announcements';

    if (!items.some(i => i.title === title)) {
      const category = classifyCategory(title);
      let exam = 'MPSC Recruitment';
      if (/state services|rajyaseva|gazetted civil services/i.test(title)) {
        exam = 'Maharashtra Civil Services (Rajyaseva)';
      } else if (/civil judge|judicial magistrate|cjjd/i.test(title)) {
        exam = 'Maharashtra Judicial Service (CJJD)';
      } else if (/group.?c|group.?b|clerk typist|tax assistant/i.test(title)) {
        exam = 'Maharashtra Non-Gazetted Group B & C';
      } else if (/police sub-inspector|psi/i.test(title)) {
        exam = 'Maharashtra Police Sub-Inspector (PSI)';
      }

      items.push({
        jurisdiction: 'MPSC (Maharashtra)',
        state: 'Maharashtra',
        exam: exam,
        title: title,
        url: noticeUrl,
        date: raw.publicationDate ? raw.publicationDate.split(' ')[0] : (raw.issueDate || ''),
        category: category,
        priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'MPSC'),
        hash: generateHash(title, noticeUrl)
      });
    }
  }
  return items;
}

// Smart Cross-Commission Legal Router
// If any commission (BPSC, UPPSC, HPSC, OPSC, MPPSC, RPSC, MPSC, etc.) issues a notice containing
// Judicial Service, Civil Judge, APO, ADPO, ADA, APP, JLO, or Regulatory Law,
// automatically tag and route it to PW Judiciary Wallah with law-specific campaign playbooks.
function applySmartLegalRouting(item) {
  if (!item) return item;
  const title = (item.title || '').trim();
  const rawExam = (item.exam || '').trim();
  const jur = (item.jurisdiction || '').toUpperCase();
  const fullText = `${jur} ${rawExam} ${title}`;

  // Broad legal keywords detection
  const isJudicial = /judicial service|civil judge|\bpcs-j\b|\bpcs\s*\(j\)\b|\bmjs\b|\bbjs\b|\bojs\b|\bupjs\b|hcs\s*\(jb\)|hcs\s*judicial|district judge|higher judicial|\bhjs\b|\bcjjd\b|\bjmfc\b|judicial officer|law clerk|legal assistant|research assistant|research scholar/i.test(fullText);
  const isAda = /\bada\b|assistant district attorney|superintendent\s*\(legal\)/i.test(fullText);
  const isApo = /prosecution officer|\bapo\b|assistant prosecution officer/i.test(fullText);
  const isAdpo = /\badpo\b|assistant district public prosecution/i.test(fullText);
  const isApp = /\bapp\b|assistant public prosecutor|public prosecutor/i.test(fullText);
  const isJlo = /\bjlo\b|junior legal officer/i.test(fullText);
  const isAibe = /\baibe\b|all india bar examination|bar council|bci\b|advocate-on-record|advocate on record/i.test(fullText);
  const isRegulatoryLaw = /(sebi.*legal|ibps.*law|law officer|scale.*law|specialist.*law)/i.test(fullText);
  const isGeneralLaw = (/\blegal\b|\blaw\b/i.test(fullText)) && !/law and order/i.test(fullText);

  const isLegalTrack = isJudicial || isAda || isApo || isAdpo || isApp || isJlo || isAibe || isRegulatoryLaw || isGeneralLaw;

  if (isLegalTrack) {
    item.isLegalTrack = true;
    item.routedTo = 'PW Judiciary Wallah';

    // Cross-Commission Exam Refinement
    if (jur.includes('BPSC') || /bihar/i.test(fullText)) {
      if (isApo || isApp) item.exam = 'Bihar Assistant Prosecution Officer (APO)';
      else if (isJudicial) item.exam = 'Bihar Judicial Service (PCS-J)';
    } else if (jur.includes('UPPSC') || /uttar pradesh|up\b/i.test(fullText)) {
      if (isApo) item.exam = 'UP Assistant Prosecution Officer (APO)';
      else if (isJudicial) item.exam = 'UP Civil Judge (PCS-J)';
    } else if (jur.includes('HPSC') || /haryana/i.test(fullText)) {
      if (isAda) item.exam = 'Haryana Assistant District Attorney (ADA)';
      else if (isJudicial) item.exam = 'Haryana Civil Judge (Junior Division)';
    } else if (jur.includes('OPSC') || /odisha/i.test(fullText)) {
      if (isApp || isApo) item.exam = 'Odisha Assistant Public Prosecutor (APP)';
      else if (isJudicial) item.exam = 'Odisha Judicial Service (OJS)';
    } else if (jur.includes('MPPSC') || /madhya pradesh|\bmp\b/i.test(fullText)) {
      if (isAdpo || isApo) item.exam = 'MP Assistant District Public Prosecution Officer (ADPO)';
      else if (isJudicial) item.exam = 'MP Civil Judge';
    } else if (jur.includes('RPSC') || /rajasthan/i.test(fullText)) {
      if (isJlo) item.exam = 'Rajasthan Junior Legal Officer (JLO)';
      else if (isApp) item.exam = 'Rajasthan Assistant Public Prosecutor (APP)';
      else if (isJudicial) item.exam = 'Rajasthan Judicial Service (RJS)';
    } else if (jur.includes('MPSC') || /maharashtra/i.test(fullText)) {
      if (isJudicial) item.exam = 'Maharashtra Judicial Service (CJJD / JMFC)';
    } else if (isAibe) {
      if (!item.exam || item.exam.includes('Recruitment')) item.exam = 'All India Bar Examination (AIBE)';
    } else if (isRegulatoryLaw) {
      if (/ibps/i.test(fullText)) item.exam = 'IBPS SO (Law Officer)';
      else item.exam = 'SEBI Grade A (Legal)';
    }

    // Generate Law-Specific Campaign Playbook
    item.marketingAction = generateMarketingHook(item.category, item.exam);

    // Escalate priority for all legal notices so Judiciary Wallah never misses one
    if (item.priority !== 'CRITICAL') {
      item.priority = (item.category === 'Result' || item.category === 'Admit Card' || item.category === 'Notification / Recruitment') 
        ? 'CRITICAL' 
        : 'HIGH';
    }
  }

  return item;
}

// Master Runner
async function runAllOfficialScrapers() {
  console.log('===============================================================');
  console.log('🏛️ RUNNING OFFICIAL COMMISSION & HIGH COURT SCRAPERS');
  console.log('===============================================================\n');

  const allUpdates = [];

  try {
    process.stdout.write('1. Scraping BPSC (Bihar)... ');
    const bpsc = await scrapeBPSC();
    console.log(`✅ Discovered ${bpsc.length} notices`);
    allUpdates.push(...bpsc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('2. Scraping UPPSC (Uttar Pradesh)... ');
    const uppsc = await scrapeUPPSC();
    console.log(`✅ Discovered ${uppsc.length} notices`);
    allUpdates.push(...uppsc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('3. Scraping MPPSC (Madhya Pradesh)... ');
    const mppsc = await scrapeMPPSC();
    console.log(`✅ Discovered ${mppsc.length} notices`);
    allUpdates.push(...mppsc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('4. Scraping RPSC (Rajasthan)... ');
    const rpsc = await scrapeRPSC();
    console.log(`✅ Discovered ${rpsc.length} notices`);
    allUpdates.push(...rpsc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('5. Scraping OPSC (Odisha)... ');
    const opsc = await scrapeOPSC();
    console.log(`✅ Discovered ${opsc.length} notices`);
    allUpdates.push(...opsc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('6. Scraping MPSC (Maharashtra)... ');
    const mpsc = await scrapeMPSC();
    console.log(`✅ Discovered ${mpsc.length} notices`);
    allUpdates.push(...mpsc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('7. Scraping Pan-India Judiciary (High Courts & SCI)... ');
    const ahc = await scrapePanIndiaJudiciary();
    console.log(`✅ Discovered ${ahc.length} notices`);
    allUpdates.push(...ahc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('8. Scraping ADA & State Prosecution (HPSC, PPSC, APO, ADPO)... ');
    const ada = await scrapeADAAndProsecution();
    console.log(`✅ Discovered ${ada.length} notices`);
    allUpdates.push(...ada);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  try {
    process.stdout.write('9. Scraping Bar Advocacy & Legal Qualification (AIBE / BCI)... ');
    const bar = await scrapeBarAdvocacyAndAIBE();
    console.log(`✅ Discovered ${bar.length} notices`);
    allUpdates.push(...bar);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  console.log('\n===============================================================');
  console.log(`🎯 TOTAL OFFICIAL NOTICES EXTRACTED: ${allUpdates.length}`);
  console.log('===============================================================');

  // Smart Cross-Commission Legal Router: Route all legal updates to PW Judiciary Wallah
  for (let i = 0; i < allUpdates.length; i++) {
    allUpdates[i] = applySmartLegalRouting(allUpdates[i]);
  }
  const legalNoticesCount = allUpdates.filter(n => n.routedTo === 'PW Judiciary Wallah').length;
  console.log(`⚖️ Smart Legal Router Active: ${legalNoticesCount} notices tagged & routed to PW Judiciary Wallah with law campaign playbooks.\n`);

  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(__dirname, 'seen_hashes.json');
  const fullNoticesFile = path.join(__dirname, 'latest_official_notices.json');

  let seen = new Set();
  const isFirstRun = !fs.existsSync(cacheFile);

  if (!isFirstRun) {
    try {
      seen = new Set(JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
    } catch (e) {}
  }

  const brandNewItems = [];

  for (const item of allUpdates) {
    if (!seen.has(item.hash)) {
      if (!isFirstRun) {
        brandNewItems.push(item);
      } else {
        seen.add(item.hash);
      }
    }
  }

  // Save complete structured notices database with Smart Cache Merging
  try {
    let finalNotices = [...allUpdates];

    // If any portal temporarily failed or timed out, retain its valid notices from previous cache
    if (fs.existsSync(fullNoticesFile)) {
      try {
        const previousData = JSON.parse(fs.readFileSync(fullNoticesFile, "utf8"));
        const previousNotices = previousData.notices || [];
        const currentJurisdictions = new Set(allUpdates.map(n => (n.jurisdiction || '').toLowerCase()));

        for (const prev of previousNotices) {
          // Ignore buggy legacy entries with date column as title
          if (/\d\d\/\d\d\/\d{4}\s*Last Date/i.test(prev.title || '')) continue;
          if ((prev.jurisdiction || '').toLowerCase() === 'allahabad high court') continue; // Subsumed into Pan-India Judiciary
          if (!currentJurisdictions.has((prev.jurisdiction || '').toLowerCase())) {
            finalNotices.push(prev);
          }
        }
      } catch (err) {}
    }

    // Filter any clickbait or malformed items that may have lingered in cache
    finalNotices = finalNotices.filter(n => !isClickbaitOrIrrelevantNews(n.title));

    const formattedData = {
      lastUpdated: new Date().toISOString(),
      totalNotices: finalNotices.length,
      commissionsCovered: [
        "BPSC (Bihar)",
        "UPPSC (Uttar Pradesh)",
        "MPPSC (Madhya Pradesh)",
        "RPSC (Rajasthan)",
        "OPSC (Odisha)",
        "MPSC (Maharashtra)",
        "Pan-India Judiciary (High Courts & SCI)",
        "ADA & State Prosecution (HPSC, PPSC, APO, ADPO)",
        "Bar Advocacy & Regulatory Law (AIBE, SEBI Legal, IBPS SO Law)"
      ],
      notices: finalNotices
    };
    fs.writeFileSync(fullNoticesFile, JSON.stringify(formattedData, null, 2));
    console.log(`📁 Complete notices database (${finalNotices.length} notices across all 9 portals & legal tracks) written to: ${fullNoticesFile}`);
  } catch (e) {}

  if (isFirstRun) {
    console.log(`\n🛡️ Initial cache initialized with ${allUpdates.length} existing notices. Future runs will alert on NEW items.`);
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(Array.from(seen), null, 2));
    } catch (e) {}
  } else if (brandNewItems.length > 0) {
    console.log(`\n🚨 FOUND ${brandNewItems.length} BRAND-NEW OFFICIAL NOTICES!`);

    // 1. Google WebApp & Email Sync FIRST (Primary Enterprise Channel)
    const targetWebAppUrl = process.env.GOOGLE_WEBAPP_URL || GOOGLE_WEBAPP_CONFIG.url;
    if (targetWebAppUrl) {
      console.log(`📊 Syncing ${brandNewItems.length} notices directly to Google Sheet Tracker & Email...`);
      const synced = await sendGoogleWebAppSync(brandNewItems);
      console.log(synced ? '✅ Google Sheet & Email sync complete.' : '⚠️ Google Sheet sync skipped or failed.');
    }

    // 2. Telegram Dispatch with Circuit Breaker (Anti-Freeze & Anti-Flood)
    let dispatchedCount = 0;
    let consecutiveFailures = 0;
    const noticesToDispatch = brandNewItems.slice(0, 10); // Dispatch top 10 new notices

    for (const item of noticesToDispatch) {
      if (consecutiveFailures >= 2) {
        console.warn(`⚠️ Telegram dispatch paused: consecutive errors encountered (bot restricted or chat ID invalid). Skipping remaining Telegram alerts to maintain system throughput.`);
        break;
      }
      console.log(`  -> Dispatching Telegram: [${item.jurisdiction}] ${item.title.slice(0, 50)}...`);
      const sent = await sendTelegramNotice(item);
      if (sent) {
        dispatchedCount++;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // Persist cache with all discovered notices so we do not spam or loop repeatedly
    for (const item of brandNewItems) {
      seen.add(item.hash);
    }
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(Array.from(seen), null, 2));
      console.log(`💾 Successfully updated seen_hashes.json with ${brandNewItems.length} notices.`);
    } catch (e) {}
  } else {
    console.log('\n✅ All official portals checked. 0 new notices since last check.');
  }

  return allUpdates;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanTitle(raw) {
  if (!raw) return "Official Notice";
  let t = raw
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  t = t.replace(/^(important\s+notice[s]?\s*[:\-]+\s*)/i, "");
  t = t.replace(/^(notice\s*[:\-]+\s*)/i, "");
  t = t.replace(/^(press\s+note\s*[:\-]+\s*)/i, "");
  t = t.replace(/^(regarding\s+)/i, "");
  t = t.trim();

  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

function sendTelegramNotice(item, tokenOverride = null) {
  return new Promise((resolve) => {
    const tokenToUse = tokenOverride || TELEGRAM_CONFIG.token;
    const cleanHead = cleanTitle(item.title);
    const priorityBadge = item.priority === "CRITICAL" ? "🚨 <b>CRITICAL NEW EXAM NOTICE</b>" : (item.priority === "HIGH" ? "⚠️ <b>HIGH PRIORITY CIRCULAR</b>" : "📢 <b>NEW OFFICIAL CIRCULAR</b>");
    const stateName = item.state || item.jurisdiction;

    const verticalLine = item.routedTo ? `⚖️ <b>Routed Vertical:</b> <b>${escapeHtml(item.routedTo)}</b>\n` : '';

    const text =
      `${priorityBadge}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏛️ <b>Commission / Body:</b> ${escapeHtml(item.jurisdiction)} (${escapeHtml(stateName)})\n` +
      verticalLine +
      `📌 <b>Exam / Role:</b> ${escapeHtml(item.exam)}\n` +
      `🏷️ <b>Category:</b> <b>${escapeHtml(item.category)}</b>\n\n` +
      `📋 <b>Notice Headline:</b>\n<b>${escapeHtml(cleanHead)}</b>\n\n` +
      `🎯 <b>RECOMMENDED MARKETING PLAY:</b>\n` +
      `<i>"${escapeHtml(item.marketingAction)}"</i>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 <a href="${escapeHtml(item.url)}"><b>📥 Download Official Notice (PDF / Link) ↗</b></a>\n` +
      `🌐 <a href="https://pw-exam-intelligence.deepansh-gup124.workers.dev"><b>Open Live Web Dashboard ↗</b></a>`;

    const data = JSON.stringify({
      chat_id: TELEGRAM_CONFIG.chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${tokenToUse}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 12000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (res.statusCode === 401 && tokenToUse !== FALLBACK_TOKEN) {
          console.warn(`⚠️ Token unauthorized (401). Retrying with active fallback token...`);
          TELEGRAM_CONFIG.token = FALLBACK_TOKEN;
          sendTelegramNotice(item, FALLBACK_TOKEN).then(resolve);
        } else if (res.statusCode === 429) {
          try {
            const errObj = JSON.parse(body);
            const retrySec = (errObj.parameters && errObj.parameters.retry_after) || 5;
            console.warn(`⏳ Rate limited by Telegram (429). Backing off for ${retrySec + 1}s...`);
            setTimeout(() => {
              sendTelegramNotice(item, tokenToUse).then(resolve);
            }, (retrySec + 1) * 1000);
          } catch (e) {
            resolve(false);
          }
        } else {
          console.error(`❌ Telegram dispatch error [HTTP ${res.statusCode}]: ${body}`);
          resolve(false);
        }
      });
    });

    req.on('timeout', () => {
      console.error('❌ Telegram request timed out.');
      req.destroy();
      resolve(false);
    });
    req.on('error', (err) => {
      console.error('❌ Telegram network error:', err.message);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function sendGoogleWebAppSync(items) {
  const webAppUrl = process.env.GOOGLE_WEBAPP_URL || GOOGLE_WEBAPP_CONFIG.url;
  if (!webAppUrl) return false;

  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notices: items }),
      redirect: 'follow',
      signal: AbortSignal.timeout(30000)
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.status === 'success' || json.status === 'ok') {
        return true;
      }
      return json.inserted !== undefined;
    } catch (e) {
      return text.includes('"status":"success"') || text.includes('"status":"ok"');
    }
  } catch (err) {
    console.warn(`⚠️ Google WebApp sync error:`, err.message);
    return false;
  }
}

if (require.main === module) {
  runAllOfficialScrapers();
}

module.exports = {
  scrapeBPSC,
  scrapeUPPSC,
  scrapeMPPSC,
  scrapeRPSC,
  scrapeOPSC,
  scrapeMPSC,
  scrapePanIndiaJudiciary,
  scrapeADAAndProsecution,
  scrapeBarAdvocacyAndAIBE,
  applySmartLegalRouting,
  isClickbaitOrIrrelevantNews,
  sendTelegramNotice,
  runAllOfficialScrapers
};

