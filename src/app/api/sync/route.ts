import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { sendGameNotification } from "@/lib/telegram";
import { syncAll } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-key");
  if (process.env.ADMIN_KEY && secret !== process.env.ADMIN_KEY) return NextResponse.json({ error: "Недостаточно прав" }, { status: 401 });
  const result = await syncAll();
  for (const storeResult of Object.values(result)) {
    for (const game of storeResult.created) await sendGameNotification(game);
  }
  return NextResponse.json({ result, status: readDb().sourceStatus });
}
