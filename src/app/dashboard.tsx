"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/types";

const formatTime = (date: string) => {
  const hours = Math.max(0, new Date(date).getTime() - Date.now()) / 3600000;
  if (hours >= 24) return `${Math.floor(hours / 24)}д ${Math.floor(hours % 24)}ч`;
  return `${Math.floor(hours)}ч ${Math.floor((hours % 1) * 60)}м`;
};

export default function Dashboard() {
  const [deals, setDeals] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("all");
  const [endingSoon, setEndingSoon] = useState(false);
  const [stats, setStats] = useState({ active: 0, completed: 0, detected: 0, notifications: 0 });
  const load = () => {
    fetch(`/api/deals?q=${encodeURIComponent(query)}&store=${store}&endingSoon=${endingSoon}`).then((response) => response.json()).then((data) => setDeals(data.deals ?? []));
    fetch("/api/stats").then((response) => response.json()).then(setStats);
  };
  const showCurrentDeals = (event: React.MouseEvent<HTMLAnchorElement>, selectedStore = "all") => {
    event.preventDefault();
    fetch(`/api/deals?store=${selectedStore}`).then((response) => response.json()).then((data) => {
      setQuery("");
      setStore(selectedStore);
      setEndingSoon(false);
      setDeals(data.deals ?? []);
      document.getElementById("deals")?.scrollIntoView({ behavior: "smooth" });
    });
  };
  useEffect(load, [query, store, endingSoon]);
  return <main className="shell">
    <nav className="nav"><Link href="/" className="brand"><span className="brand-mark">FR</span><span>FreeGame <b>Radar</b><small>Для геймеров, от геймеров</small></span></Link><div className="nav-links"><a href="#deals">Раздачи</a><a href="#hot">Горящие</a><Link href="/admin">Система</Link></div><button className="sync" onClick={() => fetch("/api/sync", { method: "POST" }).then(load)}>Обновить источники</button></nav>
    <section className="hero"><div><p className="eyebrow">LIVE TRACKER / 24—7</p><h1>Не пропусти ни одной<br /><em>бесплатной игры.</em></h1><p className="hero-copy">FreeGame Radar собирает реальные раздачи из Epic Games Store, Steam, PlayStation, GOG и Xbox, пока они не закончились.</p><div className="hero-actions"><div className="hero-buttons"><a className="primary" href="#deals" onClick={(event) => showCurrentDeals(event, "all")}>Смотреть все <span>↘</span></a><a className="store-button" href="#deals" onClick={(event) => showCurrentDeals(event, "steam")}>Смотреть раздачи Steam <span>↘</span></a><a className="store-button" href="#deals" onClick={(event) => showCurrentDeals(event, "epic")}>Смотреть раздачи Epic <span>↘</span></a><a className="store-button" href="#deals" onClick={(event) => showCurrentDeals(event, "playstation")}>Смотреть раздачи PlayStation <span>↘</span></a><a className="store-button" href="#deals" onClick={(event) => showCurrentDeals(event, "gog")}>Смотреть раздачи GOG <span>↘</span></a><a className="store-button" href="#deals" onClick={(event) => showCurrentDeals(event, "xbox")}>Смотреть раздачи Xbox <span>↘</span></a></div><span className="signal"><i /> Источники проверяются автоматически</span></div></div><div className="hero-orbit"><div className="orbit-ring" /><div className="orbit-core">FREE<br /><strong>NOW</strong></div><span className="orbit-label label-one">EPIC</span><span className="orbit-label label-two">STEAM</span></div></section>
    <section className="stats">{[[stats.active, "активных раздач"], [stats.completed, "завершено"], [stats.detected, "обнаружено всего"], [stats.notifications, "уведомлений отправлено"]].map(([value, label]) => <div className="stat" key={label as string}><strong>{value}</strong><span>{label}</span></div>)}</section>
    <section id="deals" className="section-head"><div><p className="eyebrow">CURRENT DROPS</p><h2>Активные раздачи <small>{deals.length}</small></h2></div><div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск игры..." /><select value={store} onChange={(event) => setStore(event.target.value)}><option value="all">Все магазины</option><option value="epic">Epic Games</option><option value="steam">Steam</option><option value="playstation">PlayStation</option></select><button className={endingSoon ? "filter active" : "filter"} onClick={() => setEndingSoon(!endingSoon)}>⏰ Скоро заканчиваются</button></div></section>
    <div className="deal-grid">{deals.map((game) => <article className="deal-card" key={game.id}><div className="cover"><img src={game.image} alt={game.title} /><span className="store-tag">{game.store === "epic" ? "EPIC GAMES" : "STEAM"}</span><span className="free-tag">-100%</span></div><div className="deal-body"><div className="deal-meta"><span>РАЗДАЧА</span><span>ДО {new Date(game.giveawayEnd).toLocaleDateString("ru-RU")}</span></div><h3>{game.title}</h3><p>{game.description}</p><div className="price"><s>${game.normalPrice.toFixed(2)}</s><b>БЕСПЛАТНО</b></div><div className="deal-footer"><span className="countdown">⏱ {formatTime(game.giveawayEnd)}</span><Link className="claim" href={`/games/${encodeURIComponent(game.id)}`}>Забрать игру <span>→</span></Link></div></div></article>)}{deals.length === 0 && <div className="empty"><span>◌</span><h3>Раздач пока нет</h3><p>Нажмите «Обновить источники», чтобы запросить реальные данные магазинов.</p></div>}</div>
    <section id="hot" className="hot-section"><div><p className="eyebrow">DON'T MISS IT</p><h2>⏰ Скоро закончится</h2><p>Поймай последние часы активных предложений.</p></div>{deals.filter((game) => new Date(game.giveawayEnd).getTime() - Date.now() < 3 * 86400000).slice(0, 2).map((game) => <Link className="hot-item" href={`/games/${encodeURIComponent(game.id)}`} key={game.id}><img src={game.image} alt="" /><span><b>{game.title}</b><small>{formatTime(game.giveawayEnd)} осталось</small></span><strong>→</strong></Link>)}</section>
    <footer><span>© 2026 FREEGAME RADAR</span><span>REAL DATA · NO NOISE · <a href="https://www.gamerpower.com" target="_blank" rel="noreferrer">DATA BY GAMERPOWER</a></span></footer>
  </main>;
}
