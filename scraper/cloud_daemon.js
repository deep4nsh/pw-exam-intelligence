/**
 * 24/7 CLOUD RADAR DAEMON (2-MINUTE REFRESH CYCLE)
 * Runs continuously in any free cloud container (Render, Koyeb, Railway, etc.)
 * Zero local load on Mac.
 */

const http = require("http");
const { runAllOfficialScrapers } = require("./official_scrapers");

const INTERVAL_MS = 2 * 60 * 1000; // Exact 2 Minutes
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
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: "healthy",
    service: "PW Exam Intelligence 24/7 Radar Daemon",
    refreshInterval: "120 seconds (2 mins)",
    cycleCount,
    lastRunTimestamp,
    uptimeSeconds: Math.floor(process.uptime())
  }, null, 2));
});

server.listen(PORT, () => {
  console.log(`🚀 [Radar Daemon] Healthcheck server listening on port ${PORT}`);
  console.log(`⏱️ [Radar Daemon] Configured refresh interval: 2 Minutes (120,000ms)`);
  // Run first cycle immediately
  executeCycle();
  // Schedule recurring cycle every 2 minutes
  setInterval(executeCycle, INTERVAL_MS);
});
