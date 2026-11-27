/**
 * PRAPHUL SINGH — DEDICATED OFFICIAL PORTALS INTELLIGENCE RADAR
 * Recipient: praphul.singh@pw.live
 *
 * Isolated and decoupled pipeline monitoring 119+ official government,
 * commission, entrance exam, banking, defence, and board websites.
 * Dedicated deduplication cache: seen_hashes_praphul.json
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRAPHUL_RECIPIENT = 'praphul.singh@pw.live';
const CACHE_FILE = path.join(__dirname, 'seen_hashes_praphul.json');

// Complete List of Official Hostnames (normalized, no www.)
const PRAPHUL_OFFICIAL_HOSTNAMES = [
  'accaglobal.com',
  'afcat.cdac.in',
  'afmc.nic.in',
  'agnipathvayu.cdac.in',
  'ahsec.assam.gov.in',
  'aiimsexams.ac.in',
  'allindiabarexamination.com',
  'bankofbaroda.in',
  'bankofindia.co.in',
  'bie.ap.gov.in',
  'biharboardonline.com',
  'biharcetbed-brabu.in',
  'bpsc.bihar.gov.in',
  'bpssc.bihar.gov.in',
  'bse.ap.gov.in',
  'bse.telangana.gov.in',
  'bsebdeled.com',
  'bseodisha.nic.in',
  'canarabank.com',
  'cbse.gov.in',
  'centralbankofindia.co.in',
  'cetcell.mahacet.org',
  'cfainstitute.org',
  'cgbse.nic.in',
  'chse.odisha.gov.in',
  'consortiumofnlus.ac.in',
  'csbc.bihar.gov.in',
  'csirnet.nta.nic.in',
  'ctet.nic.in',
  'cuet.nta.nic.in',
  'dhsekerala.in',
  'dpue-exam.karnataka.gov.in',
  'drdo.gov.in',
  'exams.nta.nic.in',
  'gate2027.iitm.ac.in',
  'gpat.nta.nic.in',
  'gseb.org',
  'gsebeservice.com',
  'iapt.org.in',
  'ibps.in',
  'icai.org',
  'icsi.edu',
  'idp.com',
  'iibf.org.in',
  'iimcat.ac.in',
  'indianbank.in',
  'indiancoastguard.gov.in',
  'intermediate.biharboardonline.com',
  'iob.in',
  'ioqm.mtai.org.in',
  'irdai.gov.in',
  'jac.jharkhand.gov.in',
  'jam.iitkgp.ac.in',
  'jeeadv.ac.in',
  'jeemain.nta.nic.in',
  'jkbose.jk.gov.in',
  'joinindianarmy.nic.in',
  'joinindiannavy.gov.in',
  'keralaboard.net',
  'kseeb.karnataka.gov.in',
  'licindia.in',
  'mahahsscboard.in',
  'mba.com',
  'mcc.nic.in',
  'mpbse.nic.in',
  'mppsc.mp.gov.in',
  'mpsc.gov.in',
  'nabard.org',
  'nata.in',
  'nationalinsurance.nic.co.in',
  'nationallawuniversitydelhi.in',
  'nbe.edu.in',
  'neet.nta.nic.in',
  'newindia.co.in',
  'nid.edu',
  'nift.ac.in',
  'nimcet.admissions.nic.in',
  'nmat.nmims.edu',
  'ojee.nic.in',
  'opsc.gov.in',
  'ouat.ac.in',
  'pfrda.org.in',
  'pnbindia.in',
  'portal.iibf.org.in',
  'rajeduboard.rajasthan.gov.in',
  'rbi.org.in',
  'recruitment.uplegisassembly.gov.in',
  'rpsc.rajasthan.gov.in',
  'rrb.indianrailways.gov.in',
  'rrbapply.gov.in',
  'rssb.rajasthan.gov.in',
  'ruhsraj.org',
  'sbi.co.in',
  'sebi.gov.in',
  'sidbi.in',
  'site.sebaonline.org',
  'slat-test.org',
  'snaptest.org',
  'sofworld.org',
  'ssc.gov.in',
  'tamilnadustateboard.org',
  'territorialarmy.in',
  'tgbienew.cgg.gov.in',
  'uceed.iitb.ac.in',
  'ugcnet.nta.nic.in',
  'uiic.co.in',
  'unionbankofindia.co.in',
  'upessc.up.gov.in',
  'upmsp.edu.in',
  'uppbpb.gov.in',
  'uppsc.up.nic.in',
  'upsc.gov.in',
  'upsssc.gov.in',
  'vidhanparishad.bihar.gov.in',
  'wbbse.wb.gov.in',
  'wbchse.wb.gov.in',
  'wbjeeb.nic.in',
  'wbmcc.nic.in',
  'xatonline.in'
];

// Curated Targeted Crawl Queries across Praphul's Official Portals (Official Gov/Org site searches)
const PRAPHUL_CRAWL_QUERIES = [
  // 1. Central Recruitments & Commissions
  'site:ssc.gov.in (Notification OR Result OR "Admit Card" OR Answer Key OR Schedule) when:24h',
  'site:upsc.gov.in (Notification OR Result OR "Admit Card" OR Interview OR Schedule) when:24h',
  'site:rrbapply.gov.in OR site:rrb.indianrailways.gov.in (Recruitment OR "Admit Card" OR Result OR "City Intimation") when:24h',
  'site:ibps.in (Notification OR Result OR Scorecard OR "Admit Card" OR "Call Letter") when:24h',
  'site:drdo.gov.in (Recruitment OR CEPTAM OR Result OR Advertisement) when:24h',

  // 2. NTA & Medical / Engineering Entrances
  'site:neet.nta.nic.in OR site:mcc.nic.in (Notification OR Registration OR Dates OR Counselling OR Result) when:24h',
  'site:jeemain.nta.nic.in OR site:jeeadv.ac.in (Notification OR "Admit Card" OR Session OR Result OR "Answer Key") when:24h',
  'site:cuet.nta.nic.in OR site:exams.nta.nic.in (Notification OR Registration OR Dates OR Scorecard) when:24h',
  'site:ugcnet.nta.nic.in OR site:csirnet.nta.nic.in (Notification OR "City Intimation" OR "Admit Card" OR Result) when:24h',
  'site:aiimsexams.ac.in OR site:nbe.edu.in (Notice OR Result OR "Admit Card" OR Schedule) when:24h',
  'site:ctet.nic.in (Notification OR "Admit Card" OR "Answer Key" OR Result) when:24h',

  // 3. Banking, Insurance & Regulatory
  'site:sbi.co.in/web/careers OR site:rbi.org.in (Recruitment OR Result OR "Admit Card" OR Marks) when:24h',
  'site:sebi.gov.in OR site:nabard.org OR site:pfrda.org.in OR site:irdai.gov.in (Recruitment OR Vacancy OR Result) when:24h',
  'site:licindia.in OR site:newindia.co.in OR site:uiic.co.in (Recruitment OR Notification OR Result) when:24h',
  'site:iibf.org.in (Notice OR JAIIB OR CAIIB OR Examination OR Schedule) when:24h',

  // 4. Defence & Police Services
  'site:joinindianarmy.nic.in OR site:joinindiannavy.gov.in (Notification OR Rally OR Agniveer OR Result) when:24h',
  'site:afcat.cdac.in OR site:agnipathvayu.cdac.in (Notification OR Result OR "Admit Card") when:24h',
  'site:indiancoastguard.gov.in OR site:territorialarmy.in (Notification OR Result) when:24h',
  'site:uppbpb.gov.in (विज्ञप्ति OR परिणाम OR प्रवेश पत्र OR भर्ती) when:24h',
  'site:csbc.bihar.gov.in OR site:bpssc.bihar.gov.in (Notice OR Result OR Admit Card OR Advt) when:24h',

  // 5. Law, Design & Professional
  'site:consortiumofnlus.ac.in OR site:nationallawuniversitydelhi.in (CLAT OR AILET OR Notification OR Result) when:24h',
  'site:allindiabarexamination.com (AIBE OR Result OR "Answer Key" OR Notification) when:24h',
  'site:icsi.edu (CS Foundation OR Executive OR Professional OR Result OR Examination) when:24h',
  'site:nid.edu OR site:nift.ac.in OR site:uceed.iitb.ac.in OR site:nata.in (Admit Card OR Result OR Entrance) when:24h',

  // 6. National & State School Boards
  'site:cbse.gov.in (Datesheet OR Circular OR "Sample Paper" OR Result OR "Admit Card") when:24h',
  'site:biharboardonline.com (विज्ञप्ति OR परीक्षा OR परिणाम OR "डमी एडमिट कार्ड") when:24h',
  'site:kseeb.karnataka.gov.in OR site:wbbse.wb.gov.in OR site:gseb.org (Time Table OR Result OR Notice) when:24h',
  'site:bseodisha.nic.in OR site:mahahsscboard.in OR site:jac.jharkhand.gov.in (Time Table OR Notification OR Result) when:24h'
];

/**
 * Checks if a given URL or text matches any of Praphul's official websites
 */
function matchesPraphulPortal(url) {
  if (!url) return false;
  try {
    const raw = String(url).toLowerCase();
    for (const host of PRAPHUL_OFFICIAL_HOSTNAMES) {
      if (raw.includes(host)) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Generates an MD5/SHA-256 hash for deduplication
 */
function generateHash(title, url) {
  return crypto.createHash('sha256').update(`${title.trim()}|${url.trim()}`).digest('hex').substring(0, 24);
}

function loadPraphulSeenCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return new Set(Array.isArray(data) ? data : data.hashes || []);
    } catch (e) {
      return new Set();
    }
  }
  return new Set();
}

function savePraphulSeenCache(seenSet) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Array.from(seenSet), null, 2), 'utf8');
  } catch (e) {
    console.error('[PraphulRadar] Error saving seen cache:', e.message);
  }
}

function fetchHtml(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const req = client.get(url, {
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8'
      },
      timeout: timeoutMs
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const base = new URL(url);
          redirectUrl = `${base.protocol}//${base.host}${redirectUrl}`;
        }
        return resolve(fetchHtml(redirectUrl, timeoutMs));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on('error', reject);
  });
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyCategory(title) {
  if (!title) return 'Important Notice';
  const lower = title.toLowerCase();
  if (/\b(result|results|merit list|scorecard|cut.?off|marksheet|selection list|उत्तीर्ण|परिणाम)\b/i.test(lower)) return 'Result';
  if (/\b(admit card|hall ticket|call letter|city intimation|exam slip|प्रवेश पत्र)\b/i.test(lower)) return 'Admit Card';
  if (/\b(answer key|response sheet|objection window|उत्तर कुंजी)\b/i.test(lower)) return 'Answer Key';
  if (/\b(schedule|date sheet|timetable|exam date|calendar|समय सारणी)\b/i.test(lower)) return 'Exam Schedule';
  if (/\b(notification|recruitment|vacancy|advertisement|apply online|registration|आवेदन|विज्ञप्ति|भर्ती)\b/i.test(lower)) return 'Notification / Recruitment';
  return 'Official Notice';
}

/**
 * Crawls official announcements matching the 119 official portals
 */
async function crawlPraphulOfficialPortals() {
  const items = [];
  const seenUrls = new Set();

  for (const query of PRAPHUL_CRAWL_QUERIES) {
    try {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetchHtml(feedUrl, 12000);
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(res)) !== null && items.length < 150) {
        let title = cleanText(match[1]).replace(/ - [^-]+$/g, '').trim();
        const link = match[2].trim();
        const pubDate = match[3].trim();

        if (seenUrls.has(link)) continue;
        seenUrls.add(link);

        // Check against official hostnames
        let matchedHost = null;
        for (const h of PRAPHUL_OFFICIAL_HOSTNAMES) {
          if (link.toLowerCase().includes(h) || title.toLowerCase().includes(h.split('.')[0])) {
            matchedHost = h;
            break;
          }
        }

        const category = classifyCategory(title);
        items.push({
          jurisdiction: matchedHost ? matchedHost.toUpperCase() : 'Official Portal',
          state: 'National / Official',
          exam: title.split(/[-–|:]/)[0].trim().slice(0, 40) || 'Official Notice',
          title: title,
          url: link,
          date: pubDate ? pubDate.split(' ').slice(1, 4).join(' ') : '',
          pubDate: pubDate,
          publishedDate: pubDate,
          category: category,
          priority: category === 'Result' || category === 'Admit Card' || category === 'Notification / Recruitment' ? 'CRITICAL' : 'HIGH',
          marketingAction: `Review official portal circular and distribute key student updates.`,
          targetEmail: PRAPHUL_RECIPIENT,
          recipientEmail: PRAPHUL_RECIPIENT,
          cmm: 'Praphul Singh',
          hash: generateHash(title, link),
          isOfficialPortalFeed: true
        });
      }
    } catch (err) {
      // Non-blocking query failure
    }
  }

  return items;
}

/**
 * Mirrors/tags matching official notices from other scrapers into Praphul's isolated stream
 */
function processNoticesForPraphul(allNotices) {
  if (!allNotices || !Array.isArray(allNotices)) return [];
  const praphulMatches = [];
  const seenCache = loadPraphulSeenCache();
  let newlyDiscovered = 0;

  allNotices.forEach(notice => {
    if (matchesPraphulPortal(notice.url) || matchesPraphulPortal(notice.jurisdiction)) {
      const hash = notice.hash || generateHash(notice.title, notice.url);
      if (!seenCache.has(hash)) {
        seenCache.add(hash);
        newlyDiscovered++;
        praphulMatches.push({
          ...notice,
          targetEmail: PRAPHUL_RECIPIENT,
          recipientEmail: PRAPHUL_RECIPIENT,
          cmm: 'Praphul Singh',
          isOfficialPortalFeed: true
        });
      }
    }
  });

  if (newlyDiscovered > 0) {
    savePraphulSeenCache(seenCache);
  }

  return praphulMatches;
}

/**
 * Dispatches isolated HTML alerts to praphul.singh@pw.live via Google Apps Script WebApp
 */
async function dispatchPraphulAlerts(newNotices, webAppUrl) {
  if (!newNotices || newNotices.length === 0) return { status: 'skipped', count: 0 };
  const targetUrl = webAppUrl || process.env.GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbxHxjKogREmGK0El7qaHXyxFCpNPFFX370aoo27R2HBBmOcWtQ7hZ5l3RKK2FN6zte0/exec';

  const payload = {
    action: 'dispatchPraphulAlerts',
    recipientEmail: PRAPHUL_RECIPIENT,
    categoryTitle: '🏛️ Official Portals Radar',
    notices: newNotices
  };

  try {
    const postData = JSON.stringify(payload);
    await new Promise((resolve, reject) => {
      const u = new URL(targetUrl);
      const req = https.request(u, {
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 25000
      }, res => {
        let resp = '';
        res.on('data', chunk => resp += chunk);
        res.on('end', () => resolve(resp));
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', err => { console.error('[PraphulRadar] Webhook dispatch error:', err.message); resolve(null); });
      req.write(postData);
      req.end();
    });
    return { status: 'dispatched', count: newNotices.length };
  } catch (e) {
    console.error('[PraphulRadar] Dispatch failure:', e.message);
    return { status: 'error', error: e.message };
  }
}

/**
 * Standalone Master Runner for Praphul's Official Portals Pipeline
 */
async function runPraphulPipeline() {
  console.log('===============================================================');
  console.log(`🏛️ PRAPHUL SINGH — OFFICIAL PORTALS RADAR (119+ SITES)`);
  console.log(`📬 Dedicated Recipient: ${PRAPHUL_RECIPIENT}`);
  console.log('===============================================================\n');

  const crawled = await crawlPraphulOfficialPortals();
  console.log(`🌐 Crawled ${crawled.length} updates across official domains.`);

  const newItems = processNoticesForPraphul(crawled);
  console.log(`🚨 Identified ${newItems.length} brand-new official circulars.`);

  if (newItems.length > 0) {
    console.log(`📧 Dispatching dedicated digest to ${PRAPHUL_RECIPIENT}...`);
    await dispatchPraphulAlerts(newItems);
    console.log(`✅ Dedicated dispatch complete.`);
  } else {
    console.log(`ℹ️ All notices previously dispatched. Cache is up to date.`);
  }

  return newItems;
}

if (require.main === module) {
  runPraphulPipeline();
}

module.exports = {
  PRAPHUL_RECIPIENT,
  PRAPHUL_OFFICIAL_HOSTNAMES,
  matchesPraphulPortal,
  crawlPraphulOfficialPortals,
  processNoticesForPraphul,
  dispatchPraphulAlerts,
  runPraphulPipeline
};
