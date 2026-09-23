import type { Metadata } from "next";
import Dashboard from "./dashboard";

export const metadata: Metadata = { title: "FreeGame Radar — бесплатные игры", description: "Для геймеров, от геймеров. Реальные бесплатные раздачи игр с уведомлениями в Telegram.", openGraph: { title: "FreeGame Radar — для геймеров, от геймеров", description: "Не пропусти ни одной бесплатной игры." } };

export default function Home() { return <Dashboard />; }
