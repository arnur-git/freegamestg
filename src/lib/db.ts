import fs from "node:fs";
import path from "node:path";
import type { Database, Game, NotificationLog, Store, TelegramUser } from "./types.ts";

const filePath = path.join(process.cwd(), "data", "db.json");
const emptyDb: Database = {
  games: [],
  telegramUsers: [],
  notificationLogs: [],
  giveawayHistory: [],
  sourceStatus: { epic: { ok: false }, steam: { ok: false }, playstation: { ok: false }, gog: { ok: false }, xbox: { ok: false }, nintendo: { ok: false }, itchio: { ok: false }, ubisoft: { ok: false }, battlenet: { ok: false } },
};

function ensureFile() {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(emptyDb, null, 2));
}

export function readDb(): Database {
  ensureFile();
  try {
    return { ...emptyDb, ...JSON.parse(fs.readFileSync(filePath, "utf8")) } as Database;
  } catch {
    return structuredClone(emptyDb);
  }
}

export function writeDb(db: Database) {
  ensureFile();
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2));
  fs.renameSync(temporary, filePath);
}

export function upsertGame(game: Game): { game: Game; isNew: boolean } {
  const db = readDb();
  const index = db.games.findIndex((item) => item.id === game.id);
  if (index === -1) {
    db.games.push(game);
    writeDb(db);
    return { game, isNew: true };
  }
  db.games[index] = { ...db.games[index], ...game, createdAt: db.games[index].createdAt };
  writeDb(db);
  return { game: db.games[index], isNew: false };
}

export function updateSource(store: Store, status: { ok: boolean; error?: string }) {
  const db = readDb();
  db.sourceStatus[store] = { ...status, checkedAt: new Date().toISOString() };
  writeDb(db);
}

export function getUsersForGame(game: Game) {
  return readDb().telegramUsers.filter((user) => user.subscribed && (user[`${game.store}Notifications` as keyof TelegramUser] !== false));
}

export function hasSuccessfulNotification(userId: string, gameId: string) {
  return readDb().notificationLogs.some((log) => log.telegramUserId === userId && log.giveawayId === gameId && log.status === "sent");
}

export function addNotificationLog(log: NotificationLog) {
  const db = readDb();
  db.notificationLogs.push(log);
  writeDb(db);
}

export function upsertTelegramUser(input: Partial<TelegramUser> & Pick<TelegramUser, "telegramId">) {
  const db = readDb();
  const now = new Date().toISOString();
  const index = db.telegramUsers.findIndex((user) => user.telegramId === input.telegramId);
  const existing = index === -1 ? undefined : db.telegramUsers[index];
  const user: TelegramUser = {
    id: existing?.id ?? crypto.randomUUID(),
    telegramId: input.telegramId,
    username: input.username ?? existing?.username,
    subscribed: input.subscribed ?? existing?.subscribed ?? true,
    steamNotifications: input.steamNotifications ?? existing?.steamNotifications ?? true,
    epicNotifications: input.epicNotifications ?? existing?.epicNotifications ?? true,
    playstationNotifications: input.playstationNotifications ?? existing?.playstationNotifications ?? true,
    gogNotifications: input.gogNotifications ?? existing?.gogNotifications ?? true,
    xboxNotifications: input.xboxNotifications ?? existing?.xboxNotifications ?? true,
    nintendoNotifications: input.nintendoNotifications ?? existing?.nintendoNotifications ?? true,
    itchioNotifications: input.itchioNotifications ?? existing?.itchioNotifications ?? true,
    ubisoftNotifications: input.ubisoftNotifications ?? existing?.ubisoftNotifications ?? true,
    battlenetNotifications: input.battlenetNotifications ?? existing?.battlenetNotifications ?? true,
    newOnly: input.newOnly ?? existing?.newOnly ?? true,
    endingSoon: input.endingSoon ?? existing?.endingSoon ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (index === -1) db.telegramUsers.push(user); else db.telegramUsers[index] = user;
  writeDb(db);
  return user;
}
