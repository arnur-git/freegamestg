import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store");
  const query = searchParams.get("q")?.toLowerCase();
  const endingSoon = searchParams.get("endingSoon") === "true";
  const history = searchParams.get("history") === "true";
  const db = readDb();
  const source = history ? db.giveawayHistory : db.games;
  const deals = source.filter((game) => (!store || store === "all" || game.store === store) && (!query || game.title.toLowerCase().includes(query)) && (!endingSoon || new Date(game.giveawayEnd).getTime() - Date.now() < 3 * 86400000));
  return NextResponse.json({ deals, sourceStatus: db.sourceStatus });
}
