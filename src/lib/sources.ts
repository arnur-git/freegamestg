import { updateSource, upsertGame } from "./db.ts";
import type { Game, Store } from "./types.ts";

const now = () => new Date().toISOString();

function gamerPowerGames(payload: any, store: Store): Game[] {
  return (Array.isArray(payload) ? payload : []).flatMap((item: any) => {
    const platformName = store === "epic" ? "Epic Games Store" : store === "steam" ? "Steam" : store === "playstation" ? "Playstation" : store === "gog" ? "GOG" : "Xbox";
    if (!item.id || item.status !== "Active" || item.type?.toLowerCase() !== "game" || !item.end_date || item.end_date === "N/A" || !String(item.platforms ?? "").toLowerCase().includes(platformName.toLowerCase())) return [];
    const title = String(item.title ?? "").replace(/\s*\((Epic Games|Steam)\)\s*Giveaway\s*$/i, "").trim();
    const price = Number(String(item.worth ?? "").replace(/[^0-9.]/g, "")) || 0;
    return [{
      id: `${store}:${item.id}`,
      title: title || "Без названия",
      description: item.description ?? `Бесплатная раздача в ${platformName}.`,
      image: item.image ?? item.thumbnail ?? "",
      store,
      normalPrice: price,
      currentPrice: 0,
      giveawayStart: new Date(item.published_date ?? now()).toISOString(),
      giveawayEnd: new Date(item.end_date).toISOString(),
      storeUrl: item.open_giveaway_url ?? item.gamerpower_url,
      genres: [], createdAt: now(), updatedAt: now(), discoveredAt: now(),
    } satisfies Game];
  });
}

async function getJson(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "FreeGameRadar/1.0" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Источник ответил ${response.status}`);
  return response.json();
}

export async function syncStore(store: Store) {
  try {
    const platforms = store === "epic" ? ["epic-games-store"] : store === "steam" ? ["steam"] : store === "playstation" ? ["ps4", "ps5"] : store === "gog" ? ["gog"] : ["xbox-one", "xbox-series-xs"];
    const payloads = await Promise.all(platforms.map((platform) => getJson(`https://www.gamerpower.com/api/giveaways?platform=${platform}&type=game`)));
    const payload = payloads.flat();
    const games = gamerPowerGames(payload, store);
    const created = games.map((game) => upsertGame(game)).filter((result) => result.isNew).map((result) => result.game);
    updateSource(store, { ok: true });
    return { games, created };
  } catch (error) {
    updateSource(store, { ok: false, error: error instanceof Error ? error.message : "Неизвестная ошибка" });
    return { games: [], created: [], error: error instanceof Error ? error.message : "Неизвестная ошибка" };
  }
}

export async function syncAll() {
  const [epic, steam, playstation, gog, xbox] = await Promise.all([syncStore("epic"), syncStore("steam"), syncStore("playstation"), syncStore("gog"), syncStore("xbox")]);
  return { epic, steam, playstation, gog, xbox };
}
