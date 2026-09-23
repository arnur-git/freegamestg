import { addNotificationLog, getUsersForGame, hasSuccessfulNotification, upsertTelegramUser } from "./db.ts";
import type { Game, TelegramUser } from "./types.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
const api = token ? `https://api.telegram.org/bot${token}` : "";
const helpText = `🎮 *FreeGame Radar*\n\n/start — подписаться на уведомления\n/stop — отключить уведомления\n/status — проверить статус подписки\n/settings — настроить магазины и типы уведомлений\n/deals — показать актуальные раздачи\n/help — показать эту справку\n\nНастройки сохраняются автоматически.`;

async function telegram(method: string, body: Record<string, unknown>) {
  if (!api) throw new Error("TELEGRAM_BOT_TOKEN не настроен");
  const response = await fetch(`${api}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description ?? `Telegram ${response.status}`);
  return result;
}

function message(game: Game) {
  const end = new Date(game.giveawayEnd).toLocaleDateString("ru-RU");
  const storeName = game.store === "epic" ? "Epic Games Store" : game.store === "steam" ? "Steam" : game.store === "playstation" ? "PlayStation" : game.store === "gog" ? "GOG" : "Xbox";
  return `🎁 *НОВАЯ БЕСПЛАТНАЯ ИГРА!*\n\n🎮 *${game.title}*\n🏪 ${storeName}\n💰 Обычная цена: $${game.normalPrice.toFixed(2)}\n🆓 *СЕЙЧАС БЕСПЛАТНО*\n⏰ До: ${end}`;
}

function dealsKeyboard() {
  return { inline_keyboard: [[{ text: "🎮 Раздачи Steam", callback_data: "deals_steam" }, { text: "🟢 Раздачи Epic", callback_data: "deals_epic" }], [{ text: "🎮 Раздачи PlayStation", callback_data: "deals_playstation" }], [{ text: "🟡 Раздачи GOG", callback_data: "deals_gog" }, { text: "🟢 Раздачи Xbox", callback_data: "deals_xbox" }], [{ text: "🔥 Смотреть все", callback_data: "deals_all" }]] };
}

function dealsText(games: Game[], store?: string) {
  const filtered = store && store !== "all" ? games.filter((game) => game.store === store) : games;
  return filtered.length ? filtered.slice(0, 10).map((game) => `🎮 ${game.title}\n🏪 ${game.store === "epic" ? "Epic Games Store" : game.store === "steam" ? "Steam" : game.store === "playstation" ? "PlayStation" : game.store === "gog" ? "GOG" : "Xbox"}\n${game.storeUrl}`).join("\n\n") : "Сейчас активных раздач этого магазина нет.";
}

export async function sendGameNotification(game: Game) {
  const users = getUsersForGame(game);
  for (const user of users) {
    if (hasSuccessfulNotification(user.id, game.id)) continue;
    try {
      await telegram("sendPhoto", { chat_id: user.telegramId, photo: game.image, caption: message(game), parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🎁 ЗАБРАТЬ ИГРУ", url: game.storeUrl }]] } });
      addNotificationLog({ id: crypto.randomUUID(), telegramUserId: user.id, giveawayId: game.id, sentAt: new Date().toISOString(), status: "sent", attempts: 1 });
    } catch (error) {
      addNotificationLog({ id: crypto.randomUUID(), telegramUserId: user.id, giveawayId: game.id, sentAt: new Date().toISOString(), status: "failed", error: error instanceof Error ? error.message : "Ошибка Telegram", attempts: 1 });
    }
  }
}

export async function configureBot() {
  if (!token) return false;
  await telegram("setMyCommands", { commands: [{ command: "start", description: "Подписаться на уведомления" }, { command: "stop", description: "Отключить уведомления" }, { command: "status", description: "Статус подписки" }, { command: "settings", description: "Настройки" }, { command: "deals", description: "Актуальные раздачи" }, { command: "help", description: "Помощь" }] });
  return true;
}

export async function handleUpdate(update: any, games: Game[]) {
  if (update.callback_query) {
    const callback = update.callback_query;
    const telegramId = String(callback.message?.chat?.id ?? callback.from?.id);
    const store = callback.data === "deals_steam" ? "steam" : callback.data === "deals_epic" ? "epic" : callback.data === "deals_playstation" ? "playstation" : callback.data === "deals_gog" ? "gog" : callback.data === "deals_xbox" ? "xbox" : callback.data === "deals_all" ? "all" : undefined;
    if (store) {
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      await telegram("sendMessage", { chat_id: telegramId, text: dealsText(games, store), reply_markup: dealsKeyboard() });
    }
    return;
  }
  const messageData = update.message;
  if (!messageData?.text) return;
  const telegramId = String(messageData.chat.id);
  const username = messageData.from?.username;
  const existing = upsertTelegramUser({ telegramId, username });
  const command = messageData.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (command === "/start") await telegram("sendMessage", { chat_id: telegramId, text: "🎮 FreeGame Radar\n\nВыберите, какие актуальные раздачи посмотреть:", reply_markup: dealsKeyboard() });
  else if (command === "/stop") { const user = upsertTelegramUser({ telegramId, subscribed: false }); await telegram("sendMessage", { chat_id: telegramId, text: "🔕 Уведомления отключены.", reply_markup: settingsKeyboard(user) }); }
  else if (command === "/status") await telegram("sendMessage", { chat_id: telegramId, text: `Статус: ${existing.subscribed ? "✅ подписка активна" : "🔕 отключена"}` });
  else if (command === "/deals") await telegram("sendMessage", { chat_id: telegramId, text: dealsText(games), reply_markup: dealsKeyboard() });
  else if (command === "/settings") await telegram("sendMessage", { chat_id: telegramId, text: "Настройки уведомлений:", reply_markup: settingsKeyboard(existing) });
  else if (command === "/help") await telegram("sendMessage", { chat_id: telegramId, text: helpText, parse_mode: "Markdown" });
  else await telegram("sendMessage", { chat_id: telegramId, text: `Неизвестная команда.\n\n${helpText}`, parse_mode: "Markdown" });
}

function settingsKeyboard(user: TelegramUser) {
  const mark = (value: boolean) => value ? "✅" : "◻️";
  return { inline_keyboard: [[{ text: `${mark(user.epicNotifications)} Epic Games`, callback_data: "toggle_epic" }, { text: `${mark(user.steamNotifications)} Steam`, callback_data: "toggle_steam" }], [{ text: `${mark(user.playstationNotifications)} PlayStation`, callback_data: "toggle_playstation" }], [{ text: `${mark(user.newOnly)} Только новые`, callback_data: "toggle_new" }, { text: `${mark(user.endingSoon)} Скоро заканчиваются`, callback_data: "toggle_ending" }]] };
}
