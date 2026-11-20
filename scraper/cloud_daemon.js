/**
 * 24/7 CLOUD RADAR DAEMON (2-MINUTE REFRESH CYCLE)
 * Runs continuously in any free cloud container (Render, Koyeb, Railway, etc.)
 * Zero local load on Mac.
 */

const http = require("http");
const { runAllOfficialScrapers } = require("./official_scrapers");

const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || process.env.SCRAPE_INTERVAL_MS || String(2 * 60 * 1000), 10); // Exact 2 Minutes (120,000ms)
let cycleCount = 0;
let lastRunTimestamp = null;
let lastResults = null;
let isRunning = false;

async function executeCycle() {
  if (isRunning) {
    console.log("[Daemon] Previous scrape cycle still in progress. Skipping duplicate tick.");
    return;
  }
  isRunning = true;
  cycleCount++;
  const startTime = Date.now();
  console.log(`\n[Radar Daemon] === Starting Scrape Cycle #${cycleCount} at ${new Date().toISOString()} ===`);

  try {
    const results = await runAllOfficialScrapers();
    lastResults = results;
    lastRunTimestamp = new Date().toISOString();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Radar Daemon] === Cycle #${cycleCount} completed in ${duration}s. Next check in 120s ===\n`);
  } catch (err) {
    console.error(`[Radar Daemon] Error during cycle #${cycleCount}:`, err.message);
  } finally {
    isRunning = false;
  }
}

// Minimal HTTP health-check server so free cloud platforms keep it alive
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  const urlPath = (req.url || "").split("?")[0];

  // Manual / webhook scrape trigger: /scrape or /trigger
  if (urlPath === "/scrape" || urlPath === "/trigger") {
    executeCycle();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "scrape_triggered",
      cycleCount,
      timestamp: new Date().toISOString()
    }));
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: "healthy",
    service: "PW Exam Intelligence 24/7 Radar Daemon",
    refreshInterval: `${INTERVAL_MS / 1000} seconds`,
    cycleCount,
    lastRunTimestamp,
    uptimeSeconds: Math.floor(process.uptime())
  }, null, 2));
});

server.listen(PORT, () => {
  console.log(`🚀 [Radar Daemon] Healthcheck server listening on port ${PORT}`);
  console.log(`⏱️ [Radar Daemon] Configured refresh interval: ${INTERVAL_MS / 1000}s (${INTERVAL_MS}ms)`);
  // Run first cycle immediately
  executeCycle();
  // Schedule recurring cycle
  setInterval(executeCycle, INTERVAL_MS);

  // Smart Anti-Sleep Keep-Alive: Ping external URL every 8 mins to prevent Render 15-min idle sleep
  const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
  if (publicUrl) {
    console.log(`🛡️ [Radar Daemon] Self-keepalive active for: ${publicUrl} (every 8 mins)`);
    setInterval(async () => {
      try {
        await fetch(publicUrl);
        console.log(`📡 [Radar Daemon] Anti-sleep ping delivered to ${publicUrl}`);
      } catch (err) {}
    }, 8 * 60 * 1000);
  }
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => process.exit(0));
});
