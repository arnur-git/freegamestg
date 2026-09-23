import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();
  return NextResponse.json({ active: db.games.length, completed: db.giveawayHistory.length, detected: db.games.length + db.giveawayHistory.length, notifications: db.notificationLogs.filter((log) => log.status === "sent").length });
}
