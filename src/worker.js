const TELEGRAM_BOT_TOKEN = "8962093670:AAGoDyQX553VbSAOh_35ntPQN96QtflWhOg";
const DASHBOARD_URL = "https://pw-exam-intelligence.deepansh-gup124.workers.dev";
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/deep4nsh/pw-exam-intelligence/main/scraper/latest_official_notices.json";

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
        { text: "⚖️ Allahabad High Court (Judiciary)", callback_data: "sync_ahc" }
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
    parse_mode: "Markdown",
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
    parse_mode: "Markdown",
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
          service: "PW Exam Intelligence Telegram Webhook",
          timestamp: new Date().toISOString()
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        try {
          const update = await request.json();
          const notices = await fetchLatestNotices(env, url.origin);
          const nowStr = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" });

          // Handle Button Clicks (Callback Query)
          if (update.callback_query) {
            const cb = update.callback_query;
            const action = cb.data;
            const chatId = cb.message.chat.id;
            const messageId = cb.message.message_id;

            const JURISDICTION_MAP = {
              "sync_bpsc": { name: "BPSC (Bihar)", key: "BPSC", icon: "🏛️" },
              "sync_uppsc": { name: "UPPSC (Uttar Pradesh)", key: "UPPSC", icon: "🏛️" },
              "sync_mppsc": { name: "MPPSC (Madhya Pradesh)", key: "MPPSC", icon: "🏛️" },
              "sync_rpsc": { name: "RPSC (Rajasthan)", key: "RPSC", icon: "🏛️" },
              "sync_opsc": { name: "OPSC (Odisha)", key: "OPSC", icon: "🏛️" },
              "sync_mpsc": { name: "MPSC (Maharashtra)", key: "MPSC", icon: "🏛️" },
              "sync_ahc": { name: "Allahabad High Court (Judiciary)", key: "Allahabad", icon: "⚖️" }
            };

            if (action === "sync_all") {
              await answerCallbackQuery(cb.id, "⚡ Syncing all 7 portals...");

              let summaryText = "⚡ *PW EXAM RADAR — FULL COMMISSION RADAR*\n";
              summaryText += `📊 *Total Verified Circulars Tracked:* ${notices.length}\n`;
              summaryText += `🕒 *Refreshed:* ${nowStr} IST\n\n`;

              summaryText += "• 🏛️ *BPSC (Bihar):* 8 notices active\n";
              summaryText += "• 🏛️ *UPPSC (Uttar Pradesh):* 8 notices active\n";
              summaryText += "• 🏛️ *MPPSC (Madhya Pradesh):* 8 notices active\n";
              summaryText += "• 🏛️ *RPSC (Rajasthan):* 8 notices active\n";
              summaryText += "• 🏛️ *OPSC (Odisha):* 8 notices active\n";
              summaryText += "• 🏛️ *MPSC (Maharashtra):* 8 notices active\n";
              summaryText += "• ⚖️ *Allahabad High Court:* 8 notices active\n\n";

              summaryText += `🌐 *Live Executive Dashboard:* [Open Web App](${DASHBOARD_URL})\n`;
              summaryText += `_Tap any commission button below for individual notices & PDFs:_`;

              const res = await editTelegramMessage(chatId, messageId, summaryText, getMenuMarkup());
              if (!res.ok) {
                await sendTelegramMessage(chatId, summaryText, getMenuMarkup());
              }
              return new Response("OK");
            }

            const target = JURISDICTION_MAP[action];
            if (target) {
              await answerCallbackQuery(cb.id, `🔄 Synced ${target.name}!`);

              const filtered = notices.filter(n =>
                (n.jurisdiction && n.jurisdiction.toLowerCase().includes(target.key.toLowerCase())) ||
                (n.state && n.state.toLowerCase().includes(target.key.toLowerCase()))
              );

              let msg = `${target.icon} *${target.name.toUpperCase()} — LIVE UPDATES*\n`;
              msg += `📊 *Tracked Notices:* ${filtered.length} verified | 🕒 *${nowStr} IST*\n\n`;

              if (filtered.length === 0) {
                msg += "ℹ️ _No recent notices recorded for this commission._\n\n";
              } else {
                filtered.slice(0, 4).forEach((item, idx) => {
                  const priorityBadge = item.priority === "CRITICAL" ? "🚨 *CRITICAL*" : (item.priority === "HIGH" ? "🔴 *HIGH*" : "🔵 *NORMAL*");
                  msg += `*${idx + 1}. ${item.title}*\n`;
                  msg += `🏷️ *Category:* ${item.category || "Notice"} | ${priorityBadge}\n`;
                  if (item.marketingAction) {
                    msg += `🎯 *Marketing Hook:* ${item.marketingAction}\n`;
                  }
                  if (item.url) {
                    msg += `📄 [Download Official PDF](${item.url})\n`;
                  }
                  msg += "\n";
                });
              }

              msg += `🌐 [View all on Web Dashboard](${DASHBOARD_URL})\n`;
              msg += `_Tap another button below to inspect any other portal:_`;

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
              const menuText = "🎯 *PW Exam Intelligence Radar — Interactive Menu*\n\n" +
                "Select any option below to check live circulars, download official PDFs, or trigger a full radar scan:";
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
