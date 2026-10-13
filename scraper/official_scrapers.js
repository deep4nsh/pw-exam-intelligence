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
  token: process.env.TELEGRAM_BOT_TOKEN || '8962093670:AAGoDyQX553VbSAOh_35ntPQN96QtflWhOg',
  chatId: process.env.TELEGRAM_CHAT_ID || '-5324420343' // Deepansh & Aditya Sir, Akshay Pw
};

const GOOGLE_WEBAPP_CONFIG = {
  deploymentId: 'AKfycbyRZAvIjfSSTzmQgB1-WVjoSsXmBv80Tu0zeEuofNJ3gbFvFbPmCVlvbPbExKwE3_e6',
  url: process.env.GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyRZAvIjfSSTzmQgB1-WVjoSsXmBv80Tu0zeEuofNJ3gbFvFbPmCVlvbPbExKwE3_e6/exec'
};

function fetchHtml(url, retryCount = 1) {
  return new Promise((resolve, reject) => {
    function attempt(targetUrl, redirectsLeft, retriesLeft) {
      try {
        const parsed = new URL(targetUrl);
        const isHttps = parsed.protocol === "https:";
        const transport = isHttps ? https : require("http");
        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + (parsed.search || ""),
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
            "Sec-Ch-Ua": "\"Google Chrome\";v=\"123\", \"Chromium\";v=\"123\"",
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": "\"Windows\"",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
          },
          timeout: 35000,
          rejectUnauthorized: false
        };

        const req = transport.request(options, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            res.resume();
            return attempt(redirectUrl, redirectsLeft - 1, retriesLeft);
          }
          let data = "";
          res.setEncoding("utf8");
          res.on("data", chunk => data += chunk);
          res.on("end", () => {
            if (res.statusCode >= 400 && retriesLeft > 0) {
              setTimeout(() => attempt(targetUrl, redirectsLeft, retriesLeft - 1), 1500);
            } else {
              resolve(data);
            }
          });
        });

        req.on("timeout", () => {
          req.destroy();
          if (retriesLeft > 0) {
            setTimeout(() => attempt(targetUrl, redirectsLeft, retriesLeft - 1), 2000);
          } else {
            reject(new Error("Timeout (35s)"));
          }
        });

        req.on("error", (err) => {
          if (retriesLeft > 0) {
            setTimeout(() => attempt(targetUrl, redirectsLeft, retriesLeft - 1), 1500);
          } else {
            reject(err);
          }
        });

        req.end();
      } catch (err) {
        if (retriesLeft > 0) {
          setTimeout(() => attempt(targetUrl, redirectsLeft, retriesLeft - 1), 1500);
        } else {
          reject(err);
        }
      }
    }

    attempt(url, 3, retryCount);
  });
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
  const html = await fetchHtml('https://mppsc.mp.gov.in/');
  const items = [];
  // Match: href="https://mppsc.mp.gov.in/uploads/...pdf"
  const regex = /href="(https:\/\/mppsc\.mp\.gov\.in\/uploads\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && items.length < 8) {
    const pdfUrl = match[1];
    let anchorText = cleanText(match[2]);
    // Extract filename if anchor text is generic
    const fileName = pdfUrl.split('/').pop().replace(/\.pdf$/i, '').replace(/_/g, ' ');
    const title = anchorText.length > 5 ? anchorText : fileName;

    if (!items.some(i => i.url === pdfUrl)) {
      const category = classifyCategory(title);
      items.push({
        jurisdiction: 'MPPSC',
        state: 'Madhya Pradesh',
        exam: title.includes('State Service') ? 'MPPSC State Service Exam' : 'MPPSC State Recruitment',
        title: title,
        url: pdfUrl,
        category: category,
        priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'MPPSC'),
        hash: generateHash(title, pdfUrl)
      });
    }
  }
  return items;
}

// 4. Scrape RPSC (Rajasthan)
async function scrapeRPSC() {
  const html = await fetchHtml('https://rpsc.rajasthan.gov.in/');
  const items = [];
  // Match: <a href='Static/News/....pdf'...>...title</a>
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
        jurisdiction: 'RPSC',
        state: 'Rajasthan',
        exam: title.includes('RAS') ? 'RPSC RAS / RTS Exam' : 'RPSC State Recruitment',
        title: title,
        url: pdfUrl,
        category: category,
        priority: category === 'Result' || category === 'Admit Card' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'RPSC'),
        hash: generateHash(title, pdfUrl)
      });
    }
  }
  return items;
}

// 5. Scrape Allahabad High Court (Judiciary)
async function scrapeAllahabadHC() {
  const html = await fetchHtml('https://www.allahabadhighcourt.in/calendar/itemWiseList.jsp?group=7');
  const items = [];
  // Match: <A HREF='(/event/[^']+)'[^>]*>[^<]*</A> ... <TD ALIGN='left'...>([\s\S]*?)</TD>
  const regex = /<A\s+HREF=['"](\/event\/[^'"]+\.pdf)['"][^>]*>[\s\S]*?<\/TD>\s*<TD[^>]*ALIGN=['"]left['"][^>]*>([\s\S]*?)<\/TD>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && items.length < 8) {
    const pdfPath = match[1];
    const rawTitle = cleanText(match[2]);
    const pdfUrl = `https://www.allahabadhighcourt.in${pdfPath}`;

    if (rawTitle.length > 5 && !items.some(i => i.url === pdfUrl)) {
      const category = classifyCategory(rawTitle);
      items.push({
        jurisdiction: 'Allahabad High Court',
        state: 'Judiciary (UP)',
        exam: rawTitle.includes('HJS') ? 'UP Higher Judicial Service (HJS)' : (rawTitle.includes('Civil Judge') ? 'UP Civil Judge (PCS-J)' : 'High Court Judicial Recruitment'),
        title: rawTitle,
        url: pdfUrl,
        category: category,
        priority: category === 'Result' || category === 'Admit Card' ? 'CRITICAL' : 'HIGH',
        marketingAction: generateMarketingHook(category, 'Judiciary'),
        hash: generateHash(rawTitle, pdfUrl)
      });
    }
  }
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
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

  try {
    process.stdout.write('2. Scraping UPPSC (Uttar Pradesh)... ');
    const uppsc = await scrapeUPPSC();
    console.log(`✅ Discovered ${uppsc.length} notices`);
    allUpdates.push(...uppsc);
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

  try {
    process.stdout.write('3. Scraping MPPSC (Madhya Pradesh)... ');
    const mppsc = await scrapeMPPSC();
    console.log(`✅ Discovered ${mppsc.length} notices`);
    allUpdates.push(...mppsc);
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

  try {
    process.stdout.write('4. Scraping RPSC (Rajasthan)... ');
    const rpsc = await scrapeRPSC();
    console.log(`✅ Discovered ${rpsc.length} notices`);
    allUpdates.push(...rpsc);
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

  try {
    process.stdout.write('5. Scraping OPSC (Odisha)... ');
    const opsc = await scrapeOPSC();
    console.log(`✅ Discovered ${opsc.length} notices`);
    allUpdates.push(...opsc);
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

  try {
    process.stdout.write('6. Scraping MPSC (Maharashtra)... ');
    const mpsc = await scrapeMPSC();
    console.log(`✅ Discovered ${mpsc.length} notices`);
    allUpdates.push(...mpsc);
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

  try {
    process.stdout.write('7. Scraping Allahabad High Court (Judiciary)... ');
    const ahc = await scrapeAllahabadHC();
    console.log(`✅ Discovered ${ahc.length} notices`);
    allUpdates.push(...ahc);
  } catch (e) { console.log(`❌ Failed: ${e.message}`); }

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

function sendTelegramNotice(item) {
  return new Promise((resolve) => {
    const text =
      `🏛️ <b>[OFFICIAL VERIFIED] ${item.jurisdiction.toUpperCase()}</b>\n` +
      `📌 <b>${item.category.toUpperCase()}</b> • ${item.exam}\n\n` +
      `📋 <b>Notice:</b> ${item.title}\n\n` +
      `🎯 <b>SUGGESTED MARKETING PLAY:</b>\n<i>"${item.marketingAction}"</i>\n\n` +
      `📄 <a href="${item.url}">Download Official Notice / PDF ↗</a>`;

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
  scrapeAllahabadHC,
  runAllOfficialScrapers
};

