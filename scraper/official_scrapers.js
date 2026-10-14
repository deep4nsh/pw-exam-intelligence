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
const crypto = require('crypto');

const TELEGRAM_CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN || '8962093670:AAEFDh6xdxBqVNUBIf3IybLRufbJYbjvNxI',
  chatId: process.env.TELEGRAM_CHAT_ID || '-5324420343' // Deepansh & Aditya Sir, Akshay Pw
};

const GOOGLE_WEBAPP_CONFIG = {
  deploymentId: 'AKfycbyRZAvIjfSSTzmQgB1-WVjoSsXmBv80Tu0zeEuofNJ3gbFvFbPmCVlvbPbExKwE3_e6',
  url: process.env.GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyRZAvIjfSSTzmQgB1-WVjoSsXmBv80Tu0zeEuofNJ3gbFvFbPmCVlvbPbExKwE3_e6/exec'
};



async function fetchHtml(url, timeoutMs = 25000) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,hi;q=0.8"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  return await res.text();
}

function generateHash(title, url) {
  return crypto.createHash('sha256').update(title + '|' + url).digest('hex').slice(0, 20);
}

function cleanText(text) {
  return (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyCategory(title) {
  const lower = title.toLowerCase();
  if (/result|merit list|selection list|cut.?off/i.test(lower)) return 'Result';
  if (/admit card|hall ticket|call letter/i.test(lower)) return 'Admit Card';
  if (/answer key|objection/i.test(lower)) return 'Answer Key';
  if (/exam date|schedule|calendar|postpone|reschedule/i.test(lower)) return 'Exam Schedule';
  if (/corrigendum|amendment|शुद्धिपत्र/i.test(lower)) return 'Corrigendum / Revision';
  if (/recruitment|advertisement|notification|vigyapti|विज्ञप्ति/i.test(lower)) return 'Notification / Recruitment';
  return 'Important Notice';
}

function generateMarketingHook(category, exam) {
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

// 1. Scrape BPSC (Bihar)
async function scrapeBPSC() {
  const html = await fetchHtml('https://bpsc.bihar.gov.in/');
  const items = [];
  // Match any link pointing to a PDF with its associated anchor or text
  const regex = /href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && items.length < 8) {
    const rawPdf = match[1];
    const pdfUrl = rawPdf.startsWith('http') ? rawPdf : `https://bpsc.bihar.gov.in${rawPdf}`;
    let title = cleanText(match[2]);
    if (!title || title.length < 5) {
      // Use filename as title if anchor text is short (e.g. "PDF" or icon)
      title = rawPdf.split('/').pop().replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
    }
    if (title.length > 5 && !items.some(i => i.url === pdfUrl)) {
      const category = classifyCategory(title);
      items.push({
        jurisdiction: 'BPSC',
        state: 'Bihar',
        exam: title.includes('CCE') || title.includes('70th') || title.includes('71st') || title.includes('72nd') ? 'BPSC Combined Competitive Exam' : (title.includes('TRE') ? 'BPSC TRE' : 'BPSC State Recruitment'),
        title: title,
        url: pdfUrl,
        category: category,
        priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'BPSC'),
        hash: generateHash(title, pdfUrl)
      });
    }
  }
  return items;
}

// 2. Scrape UPPSC (Uttar Pradesh)
async function scrapeUPPSC() {
  const html = await fetchHtml('https://uppsc.up.nic.in/');
  const items = [];
  // Match: <a title='...' href=Open_PDF_DB.aspx?...>
  const regex = /<a\s+title='([^']+)'\s+href=([^>\s]+)\s+target=_Blank>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && items.length < 8) {
    const title = cleanText(match[1]);
    let linkPath = match[2].trim();
    const pdfUrl = linkPath.startsWith('http') ? linkPath : `https://uppsc.up.nic.in/${linkPath}`;
    if (title.length > 5 && !items.some(i => i.url === pdfUrl)) {
      const category = classifyCategory(title);
      items.push({
        jurisdiction: 'UPPSC',
        state: 'Uttar Pradesh',
        exam: title.includes('COMBINED STATE') || title.includes('UPPER SUBORDINATE') ? 'UPPSC Combined State / PCS' : (title.includes('AYUSH') ? 'UPPSC Ayush Services' : 'UPPSC Recruitment'),
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
    while ((match = regex.exec(html)) !== null && items.length < 8) {
      const pdfUrl = match[1];
      let anchorText = cleanText(match[2]);
      const fileName = pdfUrl.split("/").pop().replace(/\.pdf$/i, "").replace(/_/g, " ");
      const title = anchorText.length > 5 ? anchorText : fileName;

      if (!items.some(i => i.url === pdfUrl)) {
        const category = classifyCategory(title);
        items.push({
          jurisdiction: "MPPSC",
          state: "Madhya Pradesh",
          exam: title.includes("State Service") ? "MPPSC State Service Exam" : "MPPSC State Recruitment",
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

  // Ensure full 8 items via real-time feed if direct geofence limits extraction
  if (items.length < 8) {
    try {
      const feedUrl = "https://news.google.com/rss/search?q=MPPSC+when:30d&hl=en-IN&gl=IN&ceid=IN:en";
      const feedRes = await fetchHtml(feedUrl, 15000);
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
      let fMatch;
      while ((fMatch = itemRegex.exec(feedRes)) !== null && items.length < 8) {
        let title = cleanText(fMatch[1]).replace(/ - [^-]+$/g, "").replace(/ - MPPSC/gi, "").trim();
        const link = fMatch[2].trim();
        const pubDate = fMatch[3].trim();
        if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
          const category = classifyCategory(title);
          items.push({
            jurisdiction: "MPPSC",
            state: "Madhya Pradesh",
            exam: title.includes("State Service") ? "MPPSC State Service Exam" : "MPPSC State Recruitment",
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
    while ((match = regex.exec(html)) !== null && items.length < 8) {
      const pdfPath = match[1];
      const rawContent = match[2];
      const title = cleanText(rawContent);
      const pdfUrl = `https://rpsc.rajasthan.gov.in/${pdfPath}`;

      if (title.length > 5 && !items.some(i => i.url === pdfUrl)) {
        const category = classifyCategory(title);
        items.push({
          jurisdiction: "RPSC",
          state: "Rajasthan",
          exam: title.includes("RAS") ? "RPSC RAS / RTS Exam" : "RPSC State Recruitment",
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

  // Tier 3: Official Google News Feed Fallback
  if (items.length === 0) {
    try {
      const feedUrl = "https://news.google.com/rss/search?q=site:rpsc.rajasthan.gov.in+OR+(RPSC+RAS+admit+card+OR+result+OR+exam)+when:14d&hl=en-IN&gl=IN&ceid=IN:en";
      const feedRes = await fetchHtml(feedUrl, 15000);
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
      let fMatch;
      while ((fMatch = itemRegex.exec(feedRes)) !== null && items.length < 8) {
        let title = cleanText(fMatch[1]).replace(/ - [^-]+$/g, "").replace(/ - RPSC/gi, "").trim();
        const link = fMatch[2].trim();
        const pubDate = fMatch[3].trim();
        if (title.length > 5 && !items.some(i => i.title === title)) {
          const category = classifyCategory(title);
          items.push({
            jurisdiction: "RPSC",
            state: "Rajasthan",
            exam: title.includes("RAS") ? "RPSC RAS / RTS Exam" : "RPSC State Recruitment",
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

// 5. Scrape Pan-India Judiciary (High Courts & Judicial Services)
async function scrapePanIndiaJudiciary() {
  const items = [];

  // Tier 1: Direct Allahabad High Court official notices (UP HJS, District Judge, Law Clerks)
  try {
    const html = await fetchHtml("https://www.allahabadhighcourt.in/calendar/itemWiseList.jsp?group=7", 15000);
    const regex = /<A\s+HREF=['"](\/event\/[^'"]+\.pdf)['"][^>]*>[\s\S]*?<\/TD>\s*<TD[^>]*ALIGN=['"]left['"][^>]*>([\s\S]*?)<\/TD>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && items.length < 4) {
      const pdfPath = match[1];
      const rawTitle = cleanText(match[2]);
      const pdfUrl = "https://www.allahabadhighcourt.in" + pdfPath;

      if (rawTitle.length > 5 && !items.some(i => i.url === pdfUrl)) {
        const category = classifyCategory(rawTitle);
        let exam = "High Court Judicial Recruitment";
        if (/hjs|higher judicial/i.test(rawTitle)) exam = "UP Higher Judicial Service (HJS)";
        else if (/civil judge|pcs-j/i.test(rawTitle)) exam = "UP Civil Judge (PCS-J)";
        else if (/law clerk/i.test(rawTitle)) exam = "High Court Law Clerk (Trainee)";

        items.push({
          jurisdiction: "Pan-India Judiciary",
          state: "Allahabad High Court (UP)",
          exam: exam,
          title: rawTitle,
          url: pdfUrl,
          category: category,
          priority: category === "Result" || category === "Admit Card" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(rawTitle, pdfUrl)
        });
      }
    }
  } catch (e) {}

  // Tier 2: Pan-India High Courts (Delhi HC, Rajasthan HC, MP HC, Punjab & Haryana HC, SCI)
  try {
    const feedUrl = "https://news.google.com/rss/search?q=(%22Judicial+Service%22+OR+%22Civil+Judge%22+OR+%22High+Court+Recruitment%22+OR+%22Higher+Judicial%22+OR+%22Rajasthan+High+Court%22+OR+%22Delhi+High+Court%22+OR+%22MP+High+Court%22)+AND+(Exam+OR+Recruitment+OR+Result+OR+Admit+Card+OR+Notice)+when:30d&hl=en-IN&gl=IN&ceid=IN:en";
    const feedRes = await fetchHtml(feedUrl, 15000);
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
    let fMatch;
    while ((fMatch = itemRegex.exec(feedRes)) !== null && items.length < 8) {
      let title = cleanText(fMatch[1]).replace(/ - [^-]+$/g, "").trim();
      const link = fMatch[2].trim();
      const pubDate = fMatch[3].trim();

      if (/dj mag|durga puja|gta 6|celebrity dj/i.test(title)) continue;

      if (title.length > 5 && !items.some(i => i.title === title || i.url === link)) {
        const category = classifyCategory(title);
        let state = "Pan-India Judiciary";
        let exam = "High Court Judicial Recruitment";

        if (/delhi/i.test(title)) {
          state = "Delhi High Court (DHC)";
          exam = /higher/i.test(title) ? "Delhi Higher Judicial Service (DHJS)" : "Delhi Judicial Service (DJS)";
        } else if (/rajasthan|hcraj/i.test(title)) {
          state = "Rajasthan High Court (HCRAJ)";
          exam = /civil judge|rjs/i.test(title) ? "Rajasthan Judicial Service (RJS)" : "Rajasthan High Court Recruitment";
        } else if (/punjab|haryana/i.test(title)) {
          state = "Punjab & Haryana High Court";
          exam = /civil judge/i.test(title) ? "Haryana / Punjab Judicial Service" : "Subordinate Courts Judicial Staff";
        } else if (/mp|madhya pradesh|mphc/i.test(title)) {
          state = "Madhya Pradesh High Court (MPHC)";
          exam = /civil judge/i.test(title) ? "MP Civil Judge Cadre" : "MP High Court Judicial Recruitment";
        } else if (/supreme court|sci/i.test(title)) {
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
          priority: category === "Result" || category === "Admit Card" ? "CRITICAL" : "HIGH",
          marketingAction: generateMarketingHook(category, "Judiciary"),
          hash: generateHash(title, link)
        });
      }
    }
  } catch (e) {}

  return items;
}

// 6. Scrape OPSC (Odisha)
async function scrapeOPSC() {
  const html = await fetchHtml('https://opsc.gov.in/Public/OPSC/Default.aspx');
  const items = [];
  const liMatches = html.match(/<li>\s*<div class=['"]listing_date[\s\S]*?<\/li>/gi) || [];

  for (const raw of liMatches) {
    if (items.length >= 8) break;
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
        priority: category === 'Result' || category === 'Admit Card' ? 'CRITICAL' : 'HIGH',
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
  return new Promise((resolve, reject) => {
    const crcVal = mpscCalculateCrc32(MPSC_SECRET_KEY);
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Authorization': '|#|#' + crcVal,
      'CRC': crcVal
    };

    https.get(`https://mpsc.gov.in/web/api/v1/getcontentdata/${mid}`, { headers, rejectUnauthorized: false, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          let text = data.trim();
          if (text.startsWith('"') && text.endsWith('"')) text = JSON.parse(text);
          const decrypted = JSON.parse(mpscDecryptAes(text));
          resolve(decrypted[mid]?.webContentList || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function scrapeMPSC() {
  const items = [];
  const [announcements, advertisements] = await Promise.all([
    fetchMpscContent(4).catch(() => []),
    fetchMpscContent(8).catch(() => [])
  ]);

  const rawList = [...announcements.slice(0, 5), ...advertisements.slice(0, 5)];

  for (const raw of rawList) {
    if (items.length >= 8) break;
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
        priority: category === 'Result' || category === 'Admit Card' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'MPSC'),
        hash: generateHash(title, noticeUrl)
      });
    }
  }
  return items;
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
    process.stdout.write('7. Scraping Pan-India Judiciary (High Courts & Law)... ');
    const ahc = await scrapePanIndiaJudiciary();
    console.log(`✅ Discovered ${ahc.length} notices`);
    allUpdates.push(...ahc);
  } catch (e) { console.log(`❌ Failed: ${e.message || e.code || e}`); }

  console.log('\n===============================================================');
  console.log(`🎯 TOTAL OFFICIAL NOTICES EXTRACTED: ${allUpdates.length}`);
  console.log('===============================================================');

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
      seen.add(item.hash);
      if (!isFirstRun) {
        brandNewItems.push(item);
      }
    }
  }

  // Save updated cache
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(Array.from(seen), null, 2));
  } catch (e) {}

  // Save complete structured notices database with Smart Cache Merging
  try {
    let finalNotices = [...allUpdates];

    // If any portal temporarily failed or timed out, retain its notices from the previous cache
    if (fs.existsSync(fullNoticesFile)) {
      try {
        const previousData = JSON.parse(fs.readFileSync(fullNoticesFile, "utf8"));
        const previousNotices = previousData.notices || [];
        const currentJurisdictions = new Set(allUpdates.map(n => n.jurisdiction.toLowerCase()));

        for (const prev of previousNotices) {
          if (!currentJurisdictions.has(prev.jurisdiction.toLowerCase())) {
            finalNotices.push(prev);
          }
        }
      } catch (err) {
        // Fallback to allUpdates if reading previous cache fails
      }
    }

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
        "Allahabad High Court (Judiciary)"
      ],
      notices: finalNotices
    };
    fs.writeFileSync(fullNoticesFile, JSON.stringify(formattedData, null, 2));
    console.log(`📁 Complete notices database (${finalNotices.length} notices across all 7 portals) written to: ${fullNoticesFile}`);
  } catch (e) {}

  if (isFirstRun) {
    console.log(`\n🛡️ Initial cache initialized with ${allUpdates.length} existing notices. Future runs will alert on NEW items.`);
  } else if (brandNewItems.length > 0) {
    console.log(`\n🚨 FOUND ${brandNewItems.length} BRAND-NEW OFFICIAL NOTICES! Dispatching to Telegram...`);
    for (const item of brandNewItems) {
      console.log(`  -> Sending: [${item.jurisdiction}] ${item.title.slice(0, 50)}...`);
      await sendTelegramNotice(item);
      await new Promise(r => setTimeout(r, 1200)); // Respect Telegram rate limits
    }

    if (process.env.GOOGLE_WEBAPP_URL) {
      console.log(`\n📊 Syncing ${brandNewItems.length} notices directly to Google Sheet Tracker & Email...`);
      const synced = await sendGoogleWebAppSync(brandNewItems);
      console.log(synced ? '✅ Google Sheet & Email sync complete.' : '⚠️ Google Sheet sync skipped or failed.');
    }
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

function sendTelegramNotice(item) {
  return new Promise((resolve) => {
    const cleanHead = cleanTitle(item.title);
    const priorityBadge = item.priority === "CRITICAL" ? "🚨 <b>CRITICAL NEW EXAM NOTICE</b>" : (item.priority === "HIGH" ? "⚠️ <b>HIGH PRIORITY CIRCULAR</b>" : "📢 <b>NEW OFFICIAL CIRCULAR</b>");
    const stateName = item.state || item.jurisdiction;

    const text =
      `${priorityBadge}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏛️ <b>Commission:</b> ${escapeHtml(item.jurisdiction)} (${escapeHtml(stateName)})\n` +
      `📌 <b>Exam:</b> ${escapeHtml(item.exam)}\n` +
      `🏷️ <b>Category:</b> <b>${escapeHtml(item.category)}</b>\n\n` +
      `📋 <b>Notice Headline:</b>\n<b>${escapeHtml(cleanHead)}</b>\n\n` +
      `🎯 <b>RECOMMENDED MARKETING PLAY:</b>\n` +
      `<i>"${escapeHtml(item.marketingAction)}"</i>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 <a href="${escapeHtml(item.url)}"><b>📥 Download Official Notice (PDF) ↗</b></a>\n` +
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
      path: `/bot${TELEGRAM_CONFIG.token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

function sendGoogleWebAppSync(items) {
  return new Promise((resolve) => {
    const webAppUrl = process.env.GOOGLE_WEBAPP_URL || GOOGLE_WEBAPP_CONFIG.url;
    if (!webAppUrl) return resolve(false);

    try {
      const parsed = new URL(webAppUrl);
      const data = JSON.stringify({ notices: items });
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + (parsed.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 15000
      }, (res) => {
        res.resume();
        // Google Apps Script Web Apps return 302 Found redirect on successful POST execution
        const isSuccess = (res.statusCode >= 200 && res.statusCode < 400);
        res.on('end', () => resolve(isSuccess));
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
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
  runAllOfficialScrapers
};

