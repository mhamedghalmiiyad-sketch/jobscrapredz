import express from "express";
import cron from "node-cron";
import { runOnce } from "./run-once.mjs";

const app = express();
const PORT = Number(process.env.PORT || 10000);

// --- Configuration ---
const RUN_TOKEN = process.env.RUN_TOKEN || "test"; // Secret token for manual runs
const AUTO_RUN = (process.env.AUTO_RUN ?? "true").toLowerCase() === "true";
// Schedule: 20:00 (8 PM) daily
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 20 * * *"; 
const TZ = process.env.TZ || "Africa/Algiers";

// Optional: Self-ping to keep Render awake (if using free tier)
const SELF_PING_URL = process.env.SELF_PING_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/health`;
const SELF_PING_INTERVAL_MIN = Number(process.env.SELF_PING_INTERVAL_MIN || 14); // < 15 min to prevent sleep

// State
let isRunning = false;
let lastResult = null;

// --- Routes ---

// 1. Health Check (for Render/UptimeRobot)
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// 2. Root (Info)
app.get("/", (req, res) => {
  const status = isRunning ? "BUSY (Running scan...)" : "IDLE";
  res.send(`
    <h1>JobScraperDZ Command Center</h1>
    <p>Status: <strong>${status}</strong></p>
    <p>Next Scheduled Run: <strong>8:00 PM (${TZ})</strong></p>
    ${lastResult ? `<p>Last Run: ${JSON.stringify(lastResult)}</p>` : ""}
    <p>To run manually: <a href="/run?token=${RUN_TOKEN}">/run?token=YOUR_TOKEN</a></p>
  `);
});

// 3. Manual Trigger
app.get("/run", async (req, res) => {
  const token = req.query.token;

  if (token !== RUN_TOKEN) {
    return res.status(403).send("⛔ ACCESS DENIED: Invalid Token");
  }

  if (isRunning) {
    return res.status(409).send("⚠️ BUSY: A scan is already in progress.");
  }

  // Start the scan (don't wait for it to finish to respond to browser)
  res.send("🚀 Mission Started! The bot is scanning in the background. Check Telegram for updates.");

  isRunning = true;
  console.log("[Manual] Triggered via Web.");
  
  try {
    const result = await runOnce({ reason: "manual_web" });
    lastResult = { date: new Date().toISOString(), ...result };
    console.log("[Manual] Finished:", result);
  } catch (e) {
    console.error("[Manual] Failed:", e);
    lastResult = { date: new Date().toISOString(), error: e.message };
  } finally {
    isRunning = false;
  }
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`🌍 Server listening on port ${PORT}`);
  console.log(`[Config] Timezone: ${TZ}`);
  console.log(`[Config] Cron Schedule: ${CRON_SCHEDULE}`);
  
  // Initialize Scheduler
  if (AUTO_RUN) {
    console.log(`[Scheduler] Initialized for ${CRON_SCHEDULE} (${TZ})`);
    cron.schedule(CRON_SCHEDULE, async () => {
      if (isRunning) {
        console.log("[Scheduler] Skipped (Already running)");
        return;
      }
      console.log("⏰ Scheduled Run Started...");
      isRunning = true;
      try {
        const result = await runOnce({ reason: "scheduled" });
        lastResult = { date: new Date().toISOString(), ...result };
        console.log("[Scheduler] Finished:", result);
      } catch (e) {
        console.error("[Scheduler] Error:", e);
      } finally {
        isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: TZ
    });
  }
});

// --- Self-Ping Logic (Optional) ---
// Keeps the app alive on Render's free tier
if (SELF_PING_URL && SELF_PING_URL.startsWith("http")) {
    console.log(`[SelfPing] Enabled for ${SELF_PING_URL} every ${SELF_PING_INTERVAL_MIN}m`);
    setInterval(() => {
        fetch(SELF_PING_URL).catch(e => console.error(`[SelfPing] Error: ${e.message}`));
    }, SELF_PING_INTERVAL_MIN * 60 * 1000);
}