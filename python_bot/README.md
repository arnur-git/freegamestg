# FreeGame Radar на Python

Версия Telegram-бота без Node.js и сторонних Python-пакетов. Работает на Python 3.10+ и использует стандартные библиотеки: `urllib`, `sqlite3`, `json`.

## Запуск на Termux

```bash
pkg update
pkg install python git
git clone https://github.com/arnur-git/freegamestg.git
cd freegamestg
cp .env.example .env.local
nano .env.local
python python_bot/freegame_bot.py
```

В `python_bot/.env.local` укажи токен без кавычек:

```env
TELEGRAM_BOT_TOKEN=токен_от_BotFather
```

Бот проверяет GamerPower, Steam, Epic, PlayStation, GOG и Xbox каждые 7 секунд, хранит данные в `python_bot/freegame_radar.sqlite3`, поддерживает `/start`, `/stop`, `/status`, `/settings`, `/deals`, `/help` и inline-кнопки магазинов.

Для работы без отключения Termux:

```bash
termux-wake-lock
nohup python python_bot/freegame_bot.py > freegame.log 2>&1 &
```

Проверить лог:

```bash
tail -f freegame.log
```

Остановить:

```bash
pkill -f freegame_bot.py
```