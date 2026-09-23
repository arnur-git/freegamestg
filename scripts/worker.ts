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
    for (const game of [...result.epic.created, ...result.steam.created]) await sendGameNotification(game);
    await pollTelegram();
    console.log(`[${new Date().toISOString()}] sync epic=${result.epic.games.length} steam=${result.steam.games.length}`);
  } finally {
    cycleRunning = false;
  }
}

configureBot().catch(console.error);
cycle().catch(console.error);
setInterval(() => cycle().catch(console.error), Number(process.env.POLL_INTERVAL_MS ?? 7000));
