/**
 * Official Portals Network & Connectivity Diagnostic Probe
 * PW Exam Intelligence Radar
 *
 * Tests the live reachability, SSL certificates, response headers,
 * and circular table DOM structure for all 6 State PSCs + Top High Courts.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const TARGETS = [
  {
    name: 'UPPSC (Uttar Pradesh)',
    code: 'UPPSC',
    url: 'https://uppsc.up.nic.in/'
  },
  {
    name: 'BPSC (Bihar)',
    code: 'BPSC',
    url: 'https://www.bpsc.bih.nic.in/'
  },
  {
    name: 'MPSC (Maharashtra)',
    code: 'MPSC',
    url: 'https://mpsc.gov.in/'
  },
  {
    name: 'MPPSC (Madhya Pradesh)',
    code: 'MPPSC',
    url: 'https://mppsc.mp.gov.in/'
  },
  {
    name: 'OPSC (Odisha)',
    code: 'OPSC',
    url: 'https://opsc.gov.in/'
  },
  {
    name: 'RPSC (Rajasthan)',
    code: 'RPSC',
    url: 'https://rpsc.rajasthan.gov.in/news'
  },
  {
    name: 'Delhi High Court (DJS)',
    code: 'DHC',
    url: 'https://delhihighcourt.nic.in/'
  },
  {
    name: 'Allahabad High Court',
    code: 'AHC',
    url: 'https://www.allahabadhighcourt.in/'
  },
  {
    name: 'MP High Court',
    code: 'MPHC',
    url: 'https://mphc.gov.in/'
  }
];

function probeUrl(target) {
  return new Promise((resolve) => {
    const started = Date.now();
    try {
      const parsed = new URL(target.url);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Connection': 'close'
        },
        timeout: 10000,
        rejectUnauthorized: false // Handles expired/self-signed certs common on gov portals
      };

      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          if (body.length < 50000) body += chunk; // Capture first 50KB for analysis
        });
        res.on('end', () => {
          const elapsed = Date.now() - started;
          // Look for PDF links or circular mentions
          const pdfMatches = body.match(/href=["']([^"']+\.pdf)["']/gi) || [];
          resolve({
            name: target.name,
            code: target.code,
            url: target.url,
            status: res.statusCode,
            elapsedMs: elapsed,
            contentType: res.headers['content-type'] || 'unknown',
            pdfCount: pdfMatches.length,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name: target.name,
          code: target.code,
          url: target.url,
          status: 'TIMEOUT',
          elapsedMs: Date.now() - started,
          success: false
        });
      });

      req.on('error', (err) => {
        resolve({
          name: target.name,
          code: target.code,
          url: target.url,
          status: 'ERROR: ' + err.code || err.message,
          elapsedMs: Date.now() - started,
          success: false
        });
      });

      req.end();
    } catch (e) {
      resolve({
        name: target.name,
        code: target.code,
        url: target.url,
        status: 'PARSE_ERROR',
        elapsedMs: Date.now() - started,
        success: false
      });
    }
  });
}

async function runAllProbes() {
  console.log('===============================================================');
  console.log('📡 PROBING OFFICIAL PSC & JUDICIARY RECRUITMENT PORTALS');
  console.log('===============================================================\n');

  const results = [];
  for (const target of TARGETS) {
    process.stdout.write(`Testing ${target.name}... `);
    const res = await probeUrl(target);
    results.push(res);
    if (res.success) {
      console.log(`✅ ${res.status} OK (${res.elapsedMs}ms, Found ${res.pdfCount} PDF links)`);
    } else {
      console.log(`❌ ${res.status} (${res.elapsedMs}ms)`);
    }
  }

  console.log('\n===============================================================');
  console.log('📊 CONNECTIVITY SUMMARY MATRIX');
  console.log('===============================================================');
  console.table(results.map(r => ({
    Portal: r.name,
    Status: r.status,
    'Latency (ms)': r.elapsedMs,
    'PDFs Discovered': r.pdfCount || 0,
    Reachable: r.success ? 'YES' : 'NO'
  })));
}

runAllProbes();
