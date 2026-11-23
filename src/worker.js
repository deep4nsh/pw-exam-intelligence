const DASHBOARD_URL = "https://pw-exam-intelligence.deepansh-gup124.workers.dev";
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/deep4nsh/pw-exam-intelligence/main/scraper/latest_official_notices.json";

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
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip bureaucratic prefixes
  t = t.replace(/^(important\s+notice[s]?\s*[:\-]+\s*)/i, '');
  t = t.replace(/^(notice\s*[:\-]+\s*)/i, '');
  t = t.replace(/^(press\s+note\s*[:\-]+\s*)/i, '');
  t = t.replace(/^(regarding\s+)/i, '');
  t = t.trim();

  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

function getLatestHeadline(notices, key) {
  const found = notices.find(n =>
    (n.jurisdiction && n.jurisdiction.toLowerCase().includes(key.toLowerCase())) ||
    (n.state && n.state.toLowerCase().includes(key.toLowerCase()))
  );
  if (!found) return "Circulars verified & monitored";
  return cleanTitle(found.title);
}

async function fetchLatestNotices(env, origin) {
  // 1. Prioritize live notices from GitHub main (updated continuously by 24/7 CI/CD)
  try {
    const ghRes = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`, {
      headers: { "User-Agent": "PW-Exam-Radar-Worker" }
    });
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (data.notices && data.notices.length > 0) return data.notices;
    }
  } catch (e) {}

  // 2. Fallback to bundled ASSETS if GitHub is unreachable
  if (env && env.ASSETS) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(`${origin}/notices.json`));
      if (assetRes.ok) {
        const data = await assetRes.json();
        if (data.notices && data.notices.length > 0) return data.notices;
      }
    } catch (e) {}
  }

  return [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 0. Live dynamic notices feed for React Dashboard
    if (url.pathname === "/notices.json") {
      const notices = await fetchLatestNotices(env, url.origin);
      if (notices && notices.length > 0) {
        return new Response(JSON.stringify({
          lastUpdated: new Date().toISOString(),
          totalNotices: notices.length,
          notices: notices
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // 1. Existing Proxy for RPSC & Portal Ingestion
    if (url.pathname === "/api/proxy") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) return new Response("Missing url", { status: 400 });
      try {
        const res = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        const html = await res.text();
        return new Response(html, {
          status: res.status,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      } catch (e) {
        return new Response("Proxy error: " + e.message, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
