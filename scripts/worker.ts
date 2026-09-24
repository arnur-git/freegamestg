import { configureBot, handleUpdate, sendGameNotification } from "../src/lib/telegram.ts";
import { readDb } from "../src/lib/db.ts";
import { syncAll } from "../src/lib/sources.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;
let cycleRunning = false;

async function pollTelegram() {
  if (!token) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${offset}`);
  const result = await response.json();
  for (const update of result.result ?? []) { offset = update.update_id + 1; await handleUpdate(update, readDb().games); }
}

async function cycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    const result = await syncAll();
    const stores = Object.entries(result);
    for (const [, storeResult] of stores) {
      for (const game of storeResult.created) await sendGameNotification(game);
    }
    await pollTelegram();
    const counts = stores.map(([store, storeResult]) => `${store}=${storeResult.games.length}`).join(" ");
    console.log(`[${new Date().toISOString()}] sync ${counts}`);
  } finally {
    cycleRunning = false;
  }
}

configureBot().catch(console.error);
cycle().catch(console.error);
setInterval(() => cycle().catch(console.error), Number(process.env.POLL_INTERVAL_MS ?? 7000));
