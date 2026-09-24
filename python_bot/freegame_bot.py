"""FreeGame Radar Telegram bot. Python 3.10+; standard library only."""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "python_bot" / "freegame_radar.sqlite3"
DEFAULT_POLL_INTERVAL = 7
STORE_NAMES = {
    "steam": "Steam",
    "epic": "Epic Games Store",
    "playstation": "PlayStation",
    "gog": "GOG",
    "xbox": "Xbox",
    "nintendo": "Nintendo",
    "itchio": "itch.io",
    "ubisoft": "Ubisoft",
    "battlenet": "Battle.net",
}
STORE_PLATFORMS = {
    "steam": ["steam"],
    "epic": ["epic-games-store"],
    "playstation": ["ps4", "ps5"],
    "gog": ["gog"],
    "xbox": ["xbox-one", "xbox-series-xs"],
    "nintendo": ["switch"],
    "itchio": ["itchio"],
    "ubisoft": ["ubisoft"],
    "battlenet": ["battle-net"],
}


def load_env() -> None:
    for env_file in (ROOT / "python_bot" / ".env.local", ROOT / ".env.local"):
        if not env_file.exists():
            continue
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
            image TEXT NOT NULL, store TEXT NOT NULL, normal_price REAL NOT NULL,
            giveaway_end TEXT NOT NULL, store_url TEXT NOT NULL, discovered_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            telegram_id TEXT PRIMARY KEY, username TEXT, subscribed INTEGER NOT NULL DEFAULT 1,
            steam INTEGER NOT NULL DEFAULT 1, epic INTEGER NOT NULL DEFAULT 1,
            playstation INTEGER NOT NULL DEFAULT 1, gog INTEGER NOT NULL DEFAULT 1,
            xbox INTEGER NOT NULL DEFAULT 1, nintendo INTEGER NOT NULL DEFAULT 1,
            itchio INTEGER NOT NULL DEFAULT 1, ubisoft INTEGER NOT NULL DEFAULT 1,
            battlenet INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notification_logs (
            telegram_id TEXT NOT NULL, game_id TEXT NOT NULL, status TEXT NOT NULL,
            sent_at TEXT NOT NULL, error TEXT, attempts INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (telegram_id, game_id)
        );
        """
    )
    existing_columns = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
    for column in ("nintendo", "itchio", "ubisoft", "battlenet"):
        if column not in existing_columns:
            connection.execute(f"ALTER TABLE users ADD COLUMN {column} INTEGER NOT NULL DEFAULT 1")
    return connection


def http_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any] | list[Any]:
    body = None
    headers = {"User-Agent": "FreeGameRadar-Python/1.0"}
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8"))


def telegram(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN не настроен")
    result = http_json(f"https://api.telegram.org/bot{token}/{method}", payload)
    if not result.get("ok"):
        raise RuntimeError(str(result.get("description", "Telegram API error")))
    return result


def normalize_game(item: dict[str, Any], store: str) -> dict[str, Any] | None:
    if item.get("status") != "Active" or str(item.get("type", "")).lower() != "game":
        return None
    end_date = item.get("end_date")
    if not item.get("id") or not end_date or end_date == "N/A":
        return None
    platform_text = str(item.get("platforms", "")).lower()
    expected = "epic games store" if store == "epic" else "playstation" if store == "playstation" else STORE_NAMES[store].lower()
    if expected not in platform_text:
        return None
    title = re.sub(r"\s*\((Epic Games|Steam)\)\s*Giveaway\s*$", "", str(item.get("title", "")), flags=re.I).strip()
    try:
        end = datetime.strptime(str(end_date), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        end = str(end_date)
    worth = re.sub(r"[^0-9.]", "", str(item.get("worth", "")))
    return {
        "id": f"{store}:{item['id']}",
        "title": title or "Без названия",
        "description": str(item.get("description") or f"Бесплатная раздача в {STORE_NAMES[store]}.")[:1000],
        "image": str(item.get("image") or item.get("thumbnail") or ""),
        "store": store,
        "normal_price": float(worth or 0),
        "giveaway_end": end,
        "store_url": str(item.get("open_giveaway_url") or item.get("gamerpower_url") or "https://www.gamerpower.com"),
        "discovered_at": utc_now(),
    }


def fetch_games(store: str) -> list[dict[str, Any]]:
    games: list[dict[str, Any]] = []
    seen: set[str] = set()
    for platform in STORE_PLATFORMS[store]:
        url = "https://www.gamerpower.com/api/giveaways?" + urllib.parse.urlencode({"platform": platform, "type": "game"})
        payload = http_json(url)
        for item in payload if isinstance(payload, list) else []:
            game = normalize_game(item, store)
            if game and game["id"] not in seen:
                seen.add(game["id"])
                games.append(game)
    return games


def sync_all() -> list[dict[str, Any]]:
    new_games: list[dict[str, Any]] = []
    connection = db()
    try:
        for store in STORE_NAMES:
            try:
                games = fetch_games(store)
                for game in games:
                    existing = connection.execute("SELECT id FROM games WHERE id = ?", (game["id"],)).fetchone()
                    connection.execute("""INSERT INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
                        image=excluded.image, normal_price=excluded.normal_price, giveaway_end=excluded.giveaway_end,
                        store_url=excluded.store_url""", tuple(game.values()))
                    if existing is None:
                        new_games.append(game)
                print(f"[{datetime.now().isoformat(timespec='seconds')}] {store}: {len(games)} active")
            except Exception as error:
                print(f"[{datetime.now().isoformat(timespec='seconds')}] {store}: ERROR {error}")
        connection.commit()
    finally:
        connection.close()
    return new_games


def keyboard() -> dict[str, Any]:
    return {"inline_keyboard": [
        [{"text": "🎮 Раздачи Steam", "callback_data": "deals:steam"}, {"text": "🟢 Раздачи Epic", "callback_data": "deals:epic"}],
        [{"text": "🎮 PlayStation", "callback_data": "deals:playstation"}],
        [{"text": "🟡 GOG", "callback_data": "deals:gog"}, {"text": "🟢 Xbox", "callback_data": "deals:xbox"}],
        [{"text": "🔴 Nintendo", "callback_data": "deals:nintendo"}, {"text": "🕹 itch.io", "callback_data": "deals:itchio"}],
        [{"text": "🔵 Ubisoft", "callback_data": "deals:ubisoft"}, {"text": "🟠 Battle.net", "callback_data": "deals:battlenet"}],
        [{"text": "🔥 Смотреть все", "callback_data": "deals:all"}],
    ]}


def settings_keyboard(user: sqlite3.Row) -> dict[str, Any]:
    mark = lambda enabled: "✅" if enabled else "◻️"
    return {"inline_keyboard": [
        [{"text": f"{'🔔' if user['subscribed'] else '🔕'} Уведомления: {'ВКЛ' if user['subscribed'] else 'ВЫКЛ'}", "callback_data": "toggle:subscription"}],
        [{"text": f"{mark(user['steam'])} Steam", "callback_data": "toggle:steam"}, {"text": f"{mark(user['epic'])} Epic", "callback_data": "toggle:epic"}],
        [{"text": f"{mark(user['playstation'])} PlayStation", "callback_data": "toggle:playstation"}],
        [{"text": f"{mark(user['gog'])} GOG", "callback_data": "toggle:gog"}, {"text": f"{mark(user['xbox'])} Xbox", "callback_data": "toggle:xbox"}],
        [{"text": f"{mark(user['nintendo'])} Nintendo", "callback_data": "toggle:nintendo"}, {"text": f"{mark(user['itchio'])} itch.io", "callback_data": "toggle:itchio"}],
        [{"text": f"{mark(user['ubisoft'])} Ubisoft", "callback_data": "toggle:ubisoft"}, {"text": f"{mark(user['battlenet'])} Battle.net", "callback_data": "toggle:battlenet"}],
    ]}


def games_text(store: str = "all") -> str:
    connection = db()
    try:
        rows = connection.execute("SELECT * FROM games WHERE giveaway_end > ? ORDER BY giveaway_end LIMIT 10", (utc_now(),)).fetchall()
    finally:
        connection.close()
    rows = [row for row in rows if store == "all" or row["store"] == store]
    if not rows:
        return "Сейчас активных раздач этого магазина нет."
    return "\n\n".join(f"🎮 {row['title']}\n🏪 {STORE_NAMES[row['store']]}\n🎁 {row['store_url']}" for row in rows)


def save_user(telegram_id: str, username: str | None, subscribed: bool | None = None) -> sqlite3.Row:
    connection = db()
    now = utc_now()
    connection.execute("""INSERT INTO users (telegram_id, username, created_at, updated_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,
        updated_at=excluded.updated_at""", (telegram_id, username, now, now))
    if subscribed is not None:
        connection.execute("UPDATE users SET subscribed = ?, updated_at = ? WHERE telegram_id = ?", (int(subscribed), now, telegram_id))
    connection.commit()
    row = connection.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)).fetchone()
    connection.close()
    return row


def send_deals(chat_id: str, store: str = "all") -> None:
    telegram("sendMessage", {"chat_id": chat_id, "text": games_text(store), "reply_markup": keyboard()})


def handle_update(update: dict[str, Any]) -> None:
    callback = update.get("callback_query")
    if callback:
        data = str(callback.get("data", ""))
        if data.startswith("deals:"):
            telegram("answerCallbackQuery", {"callback_query_id": callback["id"]})
            send_deals(str(callback.get("message", {}).get("chat", {}).get("id", callback["from"]["id"])), data.split(":", 1)[1])
        elif data.startswith("toggle:"):
            telegram_id = str(callback.get("message", {}).get("chat", {}).get("id", callback["from"]["id"]))
            store = data.split(":", 1)[1]
            if store == "subscription":
                connection = db()
                current = connection.execute("SELECT subscribed FROM users WHERE telegram_id = ?", (telegram_id,)).fetchone()
                next_value = not bool(current["subscribed"]) if current else True
                connection.execute("UPDATE users SET subscribed = ?, updated_at = ? WHERE telegram_id = ?", (int(next_value), utc_now(), telegram_id))
                connection.commit()
                user = connection.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)).fetchone()
                connection.close()
                telegram("answerCallbackQuery", {"callback_query_id": callback["id"], "text": "Уведомления включены" if next_value else "Уведомления выключены"})
                telegram("editMessageReplyMarkup", {"chat_id": telegram_id, "message_id": callback["message"]["message_id"], "reply_markup": settings_keyboard(user)})
            elif store in STORE_NAMES:
                connection = db()
                connection.execute(f"UPDATE users SET {store} = 1 - {store}, updated_at = ? WHERE telegram_id = ?", (utc_now(), telegram_id))
                connection.commit()
                user = connection.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)).fetchone()
                connection.close()
                telegram("answerCallbackQuery", {"callback_query_id": callback["id"]})
                telegram("editMessageReplyMarkup", {"chat_id": telegram_id, "message_id": callback["message"]["message_id"], "reply_markup": settings_keyboard(user)})
        return
    message = update.get("message", {})
    text = str(message.get("text", ""))
    if not text:
        return
    chat_id = str(message["chat"]["id"])
    user = save_user(chat_id, message.get("from", {}).get("username"))
    command = text.strip().split()[0].split("@", 1)[0].lower()
    if command == "/start":
        telegram("sendMessage", {"chat_id": chat_id, "text": "🎮 FreeGame Radar\nДля геймеров, от геймеров.\n\nВыберите актуальные раздачи:", "reply_markup": keyboard()})
    elif command == "/stop":
        save_user(chat_id, user["username"], False)
        telegram("sendMessage", {"chat_id": chat_id, "text": "🔕 Уведомления отключены."})
    elif command == "/status":
        telegram("sendMessage", {"chat_id": chat_id, "text": "✅ Подписка активна" if user["subscribed"] else "🔕 Подписка отключена"})
    elif command == "/deals":
        send_deals(chat_id)
    elif command == "/settings":
        telegram("sendMessage", {"chat_id": chat_id, "text": "Настройки уведомлений:", "reply_markup": settings_keyboard(user)})
    elif command == "/help":
        telegram("sendMessage", {"chat_id": chat_id, "text": "🎮 FreeGame Radar\nДля геймеров, от геймеров.\n\n/start — главное меню\n/stop — отключить уведомления\n/status — статус подписки\n/settings — магазины для уведомлений\n/deals — все актуальные раздачи\n/help — помощь"})
    else:
        telegram("sendMessage", {"chat_id": chat_id, "text": "Неизвестная команда. Используй /help"})


def notify_new_games(games: list[dict[str, Any]]) -> None:
    if not games:
        return
    connection = db()
    try:
        users = connection.execute("SELECT * FROM users WHERE subscribed = 1").fetchall()
        for game in games:
            for user in users:
                if not user[game["store"]]:
                    continue
                try:
                    payload = {"chat_id": user["telegram_id"], "caption": f"🎁 НОВАЯ БЕСПЛАТНАЯ ИГРА!\n\n🎮 {game['title']}\n🏪 {STORE_NAMES[game['store']]}\n⏰ До: {game['giveaway_end']}", "reply_markup": {"inline_keyboard": [[{"text": "🎁 ЗАБРАТЬ ИГРУ", "url": game["store_url"]}]]}}
                    if game["image"]:
                        payload["photo"] = game["image"]
                        telegram("sendPhoto", payload)
                    else:
                        telegram("sendMessage", {"chat_id": user["telegram_id"], "text": payload["caption"], "reply_markup": payload["reply_markup"]})
                    connection.execute("INSERT OR REPLACE INTO notification_logs VALUES (?, ?, 'sent', ?, NULL, 1)", (user["telegram_id"], game["id"], utc_now()))
                except Exception as error:
                    connection.execute("INSERT OR REPLACE INTO notification_logs VALUES (?, ?, 'failed', ?, ?, 1)", (user["telegram_id"], game["id"], utc_now(), str(error)))
        connection.commit()
    finally:
        connection.close()


def main() -> None:
    load_env()
    poll_interval = max(1, int(os.environ.get("POLL_INTERVAL_SECONDS", DEFAULT_POLL_INTERVAL)))
    if not os.environ.get("TELEGRAM_BOT_TOKEN"):
        raise SystemExit("Добавь TELEGRAM_BOT_TOKEN в .env.local")
    telegram("setMyCommands", {"commands": [{"command": "start", "description": "Главное меню"}, {"command": "stop", "description": "Отключить уведомления"}, {"command": "status", "description": "Статус подписки"}, {"command": "settings", "description": "Настройки магазинов"}, {"command": "deals", "description": "Актуальные раздачи"}, {"command": "help", "description": "Помощь"}]})
    offset = 0
    while True:
        try:
            new_games = sync_all()
            notify_new_games(new_games)
            updates = telegram("getUpdates", {"timeout": 5, "offset": offset}).get("result", [])
            for update in updates:
                offset = int(update["update_id"]) + 1
                handle_update(update)
        except Exception as error:
            print(f"Worker error: {error}")
        time.sleep(poll_interval)


if __name__ == "__main__":
    main()
