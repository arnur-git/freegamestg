import type { Metadata } from "next";
import Dashboard from "./dashboard";

export const metadata: Metadata = { title: "FreeGame Radar — бесплатные игры", description: "Реальные бесплатные раздачи Epic Games Store и Steam с уведомлениями в Telegram.", openGraph: { title: "FreeGame Radar", description: "Не пропусти ни одной бесплатной игры." } };

export default function Home() { return <Dashboard />; }
