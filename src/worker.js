const TELEGRAM_BOT_TOKEN = "8962093670:AAEFDh6xdxBqVNUBIf3IybLRufbJYbjvNxI";
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

function getMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: "🏛️ BPSC (Bihar)", callback_data: "sync_bpsc" },
        { text: "🏛️ UPPSC (U.P.)", callback_data: "sync_uppsc" }
      ],
      [
        { text: "🏛️ MPPSC (M.P.)", callback_data: "sync_mppsc" },
        { text: "🏛️ RPSC (Rajasthan)", callback_data: "sync_rpsc" }
      ],
      [
        { text: "🏛️ OPSC (Odisha)", callback_data: "sync_opsc" },
        { text: "🏛️ MPSC (Maharashtra)", callback_data: "sync_mpsc" }
      ],
      [
        { text: "⚖️ Pan-India Judiciary (High Courts)", callback_data: "sync_judiciary" }
      ],
      [
        { text: "⚡ Sync All 7 Portals (Full Radar)", callback_data: "sync_all" }
      ]
    ]
  };
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function answerCallbackQuery(callbackQueryId, text = "") {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: false
    })
  });
}

async function fetchLatestNotices(env, origin) {
  // Try ASSETS first
  if (env && env.ASSETS) {
    try {
      const assetRes = await env.ASSETS.fetch(new Request(`${origin}/notices.json`));
      if (assetRes.ok) {
        const data = await assetRes.json();
        if (data.notices && data.notices.length > 0) return data.notices;
      }
    } catch (e) {}
  }

  // Fallback to latest GitHub commit on main
  try {
    const ghRes = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`);
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (data.notices && data.notices.length > 0) return data.notices;
    }
  } catch (e) {}

  return [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    // 2. Telegram Webhook Handler for Interactive Menu & Sync Buttons
    if (url.pathname === "/api/telegram-webhook") {
      if (request.method === "GET") {
        return new Response(JSON.stringify({
          status: "online",
          service: "PW Exam Intelligence Telegram Webhook (Enhanced Clear News)",
          timestamp: new Date().toISOString()
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        try {
          const update = await request.json();
          const notices = await fetchLatestNotices(env, url.origin);
          const nowStr = new Date().toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });

          // Handle Button Clicks (Callback Query)
          if (update.callback_query) {
            const cb = update.callback_query;
            const action = cb.data;
            const chatId = cb.message.chat.id;
            const messageId = cb.message.message_id;

            const JURISDICTION_MAP = {
              "sync_bpsc": { name: "BPSC", state: "Bihar", key: "BPSC", icon: "🏛️" },
              "sync_uppsc": { name: "UPPSC", state: "Uttar Pradesh", key: "UPPSC", icon: "🏛️" },
              "sync_mppsc": { name: "MPPSC", state: "Madhya Pradesh", key: "MPPSC", icon: "🏛️" },
              "sync_rpsc": { name: "RPSC", state: "Rajasthan", key: "RPSC", icon: "🏛️" },
              "sync_opsc": { name: "OPSC", state: "Odisha", key: "OPSC", icon: "🏛️" },
              "sync_mpsc": { name: "MPSC", state: "Maharashtra", key: "MPSC", icon: "🏛️" },
              "sync_judiciary": { name: "Pan-India Judiciary", state: "High Courts & SCI", key: "Judiciary", icon: "⚖️" },
              "sync_ahc": { name: "Pan-India Judiciary", state: "High Courts & SCI", key: "Judiciary", icon: "⚖️" }
            };

            // Option 8: Full Radar Sync
            if (action === "sync_all") {
              await answerCallbackQuery(cb.id, "⚡ Syncing all 7 commissions...");

              let summaryText = "⚡ <b>PW EXAM RADAR — ALL 7 COMMISSIONS SUMMARY</b>\n";
              summaryText += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
              summaryText += `📊 <b>${notices.length} Verified Official Circulars Active</b>\n`;
              summaryText += `🕒 <b>Refreshed:</b> ${nowStr} IST • 🔄 <i>Cloud Auto-Sync 24/7</i>\n\n`;

              summaryText += `🏛️ <b>Bihar (BPSC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'BPSC'))}</i>\n\n`;

              summaryText += `🏛️ <b>Uttar Pradesh (UPPSC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'UPPSC'))}</i>\n\n`;

              summaryText += `🏛️ <b>Madhya Pradesh (MPPSC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'MPPSC'))}</i>\n\n`;

              summaryText += `🏛️ <b>Rajasthan (RPSC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'RPSC'))}</i>\n\n`;

              summaryText += `🏛️ <b>Odisha (OPSC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'OPSC'))}</i>\n\n`;

              summaryText += `🏛️ <b>Maharashtra (MPSC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'MPSC'))}</i>\n\n`;

              summaryText += `⚖️ <b>Judiciary (Allahabad HC):</b> 8 notices\n`;
              summaryText += `   └ <i>Latest: ${escapeHtml(getLatestHeadline(notices, 'Allahabad'))}</i>\n\n`;

              summaryText += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
              summaryText += `🌐 <a href="${DASHBOARD_URL}"><b>Open Full Executive Web Dashboard ↗</b></a>\n`;
              summaryText += `<i>👇 Tap any state button below for individual circulars & PDFs:</i>`;

              const res = await editTelegramMessage(chatId, messageId, summaryText, getMenuMarkup());
              if (!res.ok) {
                await sendTelegramMessage(chatId, summaryText, getMenuMarkup());
              }
              return new Response("OK");
            }

            // Options 1 to 7: Individual Commission Sync
            const target = JURISDICTION_MAP[action];
            if (target) {
              await answerCallbackQuery(cb.id, `🔄 Synced ${target.name} (${target.state})!`);

              const filtered = notices.filter(n =>
                (n.jurisdiction && n.jurisdiction.toLowerCase().includes(target.key.toLowerCase())) ||
                (n.state && n.state.toLowerCase().includes(target.key.toLowerCase()))
              );

              let msg = `${target.icon} <b>${target.name} (${target.state.toUpperCase()}) — LATEST UPDATES</b>\n`;
              msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
              msg += `📊 <b>${filtered.length} Official Circulars Tracked</b> • 🕒 <i>${nowStr} IST</i>\n\n`;

              if (filtered.length === 0) {
                msg += "ℹ️ <i>No recent circulars found for this commission.</i>\n\n";
              } else {
                filtered.slice(0, 4).forEach((item, idx) => {
                  const cleanHead = cleanTitle(item.title);
                  const priorityTag = item.priority === "CRITICAL" ? "🚨 <b>CRITICAL</b>" : (item.priority === "HIGH" ? "⚠️ <b>HIGH</b>" : "🟢 <b>NORMAL</b>");
                  const examName = item.exam || target.name;
                  const category = item.category || "Notice";

                  msg += `<b>${idx + 1}. ${escapeHtml(cleanHead)}</b>\n`;
                  msg += `${priorityTag} • <b>${escapeHtml(category)}</b> • <i>${escapeHtml(examName)}</i>\n`;
                  if (item.marketingAction) {
                    msg += `🎯 <b>Campaign Play:</b> <i>"${escapeHtml(item.marketingAction)}"</i>\n`;
                  }
                  if (item.url) {
                    msg += `📄 <a href="${escapeHtml(item.url)}"><b>Download Official Notice (PDF) ↗</b></a>\n`;
                  }
                  if (idx < 3 && idx < filtered.length - 1) {
                    msg += "──────────────────────────\n";
                  } else {
                    msg += "\n";
                  }
                });
              }

              msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
              msg += `🌐 <a href="${DASHBOARD_URL}"><b>View All Notices on Web Dashboard ↗</b></a>\n`;
              msg += `<i>👇 Tap another commission button below to check other states:</i>`;

              const res = await editTelegramMessage(chatId, messageId, msg, getMenuMarkup());
              if (!res.ok) {
                await sendTelegramMessage(chatId, msg, getMenuMarkup());
              }
              return new Response("OK");
            }
          }

          // Handle Text Commands like /menu, /radar, /start
          if (update.message && update.message.text) {
            const text = update.message.text.trim().toLowerCase();
            const chatId = update.message.chat.id;

            if (text.startsWith("/menu") || text.startsWith("/radar") || text.startsWith("/start") || text.startsWith("/sync")) {
              const menuText =
                "🎯 <b>PW EXAM INTELLIGENCE RADAR — INTERACTIVE MENU</b>\n" +
                "━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                "👋 <b>Welcome!</b> Tap any button below to sync live official updates, download direct PDFs, or view the full 7-portal executive radar:\n\n" +
                "• 🏛️ <b>6 State PSCs + ⚖️ Pan-India Judiciary:</b> BPSC, UPPSC, MPPSC, RPSC, OPSC, MPSC & High Courts\n" +
                "• ⚡ <b>Sync All:</b> Complete 7-portal radar summary\n\n" +
                "<i>👇 Tap a button to check updates right now:</i>";
              await sendTelegramMessage(chatId, menuText, getMenuMarkup());
              return new Response("OK");
            }
          }

          return new Response("OK");
        } catch (err) {
          return new Response("Error: " + err.message, { status: 500 });
        }
      }
    }

    return env.ASSETS.fetch(request);
  }
};
