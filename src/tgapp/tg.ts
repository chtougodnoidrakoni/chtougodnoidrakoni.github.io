// Тонкая обёртка над Telegram WebApp: вне Telegram всё молча работает как обычный сайт.
interface TgBtn { setText(t: string): TgBtn; show(): TgBtn; hide(): TgBtn; onClick(f: () => void): TgBtn; offClick(f: () => void): TgBtn; enable(): TgBtn; disable(): TgBtn; showProgress(l?: boolean): TgBtn; hideProgress(): TgBtn; setParams(p: Record<string, unknown>): TgBtn }
interface TgWebApp {
  initData: string; initDataUnsafe: { user?: { id: number; first_name: string; username?: string } }; platform: string;
  ready(): void; expand(): void; setHeaderColor(c: string): void; setBackgroundColor(c: string): void; disableVerticalSwipes?(): void;
  MainButton: TgBtn; BackButton: { show(): void; hide(): void; onClick(f: () => void): void; offClick(f: () => void): void };
  HapticFeedback?: { notificationOccurred(t: 'success' | 'error' | 'warning'): void; impactOccurred(t: 'light' | 'medium'): void };
  openLink(u: string): void; openTelegramLink(u: string): void; showConfirm(m: string, cb: (ok: boolean) => void): void; showAlert(m: string, cb?: () => void): void;
}
declare global { interface Window { Telegram?: { WebApp?: TgWebApp } } }

export const tg: TgWebApp | undefined = window.Telegram?.WebApp?.platform && window.Telegram.WebApp.platform !== 'unknown' ? window.Telegram.WebApp : undefined;

export function initData(): string {
  if (tg?.initData) return tg.initData;
  try { return localStorage.getItem('dev-init') ?? ''; } catch { return ''; }
}
export function setupTelegram() {
  if (!tg) return;
  tg.ready(); tg.expand();
  try { tg.setHeaderColor('#1f2521'); tg.setBackgroundColor('#1f2521'); tg.disableVerticalSwipes?.(); } catch { /* старый клиент */ }
}
export const haptic = (t: 'success' | 'error' | 'warning' | 'light') => { try { if (t === 'light') tg?.HapticFeedback?.impactOccurred('light'); else tg?.HapticFeedback?.notificationOccurred(t); } catch { /* нет вибрации */ } };
export const confirmBox = (m: string) => new Promise<boolean>((res) => (tg ? tg.showConfirm(m, res) : res(window.confirm(m))));
export function openLink(u: string) {
  if (/^https:\/\/t\.me\//.test(u) && tg) tg.openTelegramLink(u);
  else if (tg && !u.startsWith(location.origin)) tg.openLink(u);
  else location.href = u;
}
