import Link from "next/link";
import { notFound } from "next/navigation";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = readDb().games.find((item) => item.id === decodeURIComponent(id));
  if (!game) notFound();
  return <main className="detail-shell"><Link href="/" className="back">← Все раздачи</Link><article className="detail"><img className="detail-cover" src={game.image} alt={game.title} /><div className="detail-content"><p className="eyebrow">{game.store === "epic" ? "EPIC GAMES STORE" : "STEAM"} / FREE DROP</p><h1>{game.title}</h1><p className="detail-description">{game.description}</p><div className="detail-grid"><span>Обычная цена <b>${game.normalPrice.toFixed(2)}</b></span><span>Начало <b>{new Date(game.giveawayStart).toLocaleString("ru-RU")}</b></span><span>Окончание <b>{new Date(game.giveawayEnd).toLocaleString("ru-RU")}</b></span><span>Обнаружено <b>{new Date(game.discoveredAt).toLocaleString("ru-RU")}</b></span></div><a className="primary claim-large" href={game.storeUrl} target="_blank" rel="noreferrer">🎁 Забрать игру <span>↗</span></a></div></article></main>;
}
