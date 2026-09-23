import Link from "next/link";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const db = readDb();
  return <main className="admin-shell"><Link href="/" className="back">← На сайт</Link><p className="eyebrow">CONTROL ROOM</p><h1>Состояние системы</h1><div className="admin-grid"><section><h2>Источники</h2>{Object.entries(db.sourceStatus).map(([store, status]) => <div className="source-row" key={store}><span className={status.ok ? "dot online" : "dot"} /> <b>{store === "epic" ? "Epic Games Store" : "Steam"}</b><small>{status.ok ? `Проверен ${status.checkedAt ? new Date(status.checkedAt).toLocaleString("ru-RU") : ""}` : status.error ?? "Нет данных"}</small></div>)}</section><section><h2>База данных</h2><div className="admin-number"><strong>{db.games.length}</strong><span>активных игр</span></div><div className="admin-number"><strong>{db.notificationLogs.length}</strong><span>логов уведомлений</span></div></section></div><h2 className="admin-subtitle">Последние уведомления</h2><div className="logs">{db.notificationLogs.slice(-10).reverse().map((log) => <div className="log" key={log.id}><span className={log.status === "sent" ? "log-status sent" : "log-status failed"}>{log.status}</span><code>{log.giveawayId}</code><small>{new Date(log.sentAt).toLocaleString("ru-RU")}</small></div>)}{db.notificationLogs.length === 0 && <p>Логов пока нет. Это реальные данные, здесь не создаются тестовые записи.</p>}</div></main>;
}
