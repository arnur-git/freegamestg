export type Store = "epic" | "steam" | "playstation" | "gog" | "xbox";

export type Game = {
  id: string;
  title: string;
  description: string;
  image: string;
  store: Store;
  normalPrice: number;
  currentPrice: number;
  giveawayStart: string;
  giveawayEnd: string;
  storeUrl: string;
  genres: string[];
  createdAt: string;
  updatedAt: string;
  discoveredAt: string;
};

export type TelegramUser = {
  id: string;
  telegramId: string;
  username?: string;
  subscribed: boolean;
  steamNotifications: boolean;
  epicNotifications: boolean;
  playstationNotifications: boolean;
  gogNotifications: boolean;
  xboxNotifications: boolean;
  newOnly: boolean;
  endingSoon: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationLog = {
  id: string;
  telegramUserId: string;
  giveawayId: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
  attempts: number;
};

export type Database = {
  games: Game[];
  telegramUsers: TelegramUser[];
  notificationLogs: NotificationLog[];
  giveawayHistory: Game[];
  sourceStatus: Record<Store, { ok: boolean; checkedAt?: string; error?: string }>;
};
