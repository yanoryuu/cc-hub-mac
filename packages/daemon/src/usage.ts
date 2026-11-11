// Usage: プラン使用率(5 時間枠 / 週次)。rate_limits はアカウント共通なので「最後に受信した値」を全体の値とする。
import type { RateWindow, Usage } from '@cc-hub/shared';
import { bus } from './bus';
import type { Store } from './store/db';

/**
 * 回復時刻を epoch ミリ秒にする(分からなければ 0)。
 * statusLine の JSON は Unix 秒、mod(session.measure)経由は ISO 8601 の文字列("2026-11-11T13:00:00.000Z")で来る
 */
export function toEpochMs(v: unknown): number {
  if (typeof v === 'string' && v.trim() && !/^\d+(\.\d+)?$/.test(v.trim())) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n) || n <= 0) return 0;
  // Unix 秒。念のためミリ秒で来た場合はそのまま使う
  return n < 1e12 ? n * 1000 : n;
}

export function toWindow(w: any): RateWindow | null {
  if (!w || typeof w !== 'object') return null;
  const pct = Number(w.used_percentage);
  if (w.used_percentage == null || !Number.isFinite(pct)) return null;
  return { pct, resetsAt: toEpochMs(w.resets_at) };
}

export class UsageTracker {
  usage: Usage | null;

  constructor(private readonly store: Store) {
    this.usage = store.getSetting<Usage>('usage');
  }

  /** statusLine の JSON から rate_limits を取り込む。片方の窓が無ければ前回値を残す */
  update(data: any): void {
    const rl = data?.rate_limits;
    if (!rl || typeof rl !== 'object') return;
    const five = toWindow(rl.five_hour);
    const seven = toWindow(rl.seven_day);
    if (!five && !seven) return;
    const prev = this.usage;
    const next: Usage = {
      fiveHour: five ?? prev?.fiveHour ?? null,
      sevenDay: seven ?? prev?.sevenDay ?? null,
      updatedAt: Date.now(),
    };
    const changed =
      !prev || JSON.stringify([prev.fiveHour, prev.sevenDay]) !== JSON.stringify([next.fiveHour, next.sevenDay]);
    this.usage = next;
    if (changed) {
      this.store.setSetting('usage', next);
      bus.state({ t: 'usage', usage: next });
    }
  }
}
