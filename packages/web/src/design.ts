// 画面のデザイン(A: Liquid Glass / C: ネイティブ macOS)の切り替え。
// html[data-design] と html[data-scheme](OS のライト / ダーク)を付け、design-*.css がそれを見て色と形を変える。
// 選んだものはこの画面(ブラウザ / アプリ)ごとに localStorage に覚える
import { useSyncExternalStore } from 'react';
import { readLocal, writeLocal } from './util';

export type Design = 'glass' | 'native';
export const DESIGNS: { id: Design; label: string; desc: string }[] = [
  {
    id: 'glass',
    label: 'A: Liquid Glass',
    desc: '半透明のガラスのパネルが浮く、macOS 26 らしい見た目。操作する部分だけガラスで、会話は不透明のまま',
  },
  {
    id: 'native',
    label: 'C: ネイティブ macOS',
    desc: 'Xcode や Mail のような純正アプリ風。半透明のサイドバー、ツールバー、右側のインスペクタ',
  },
];
const KEY = 'cchub.design';
const DEFAULT: Design = 'native';

function read(): Design {
  const v = readLocal(KEY, DEFAULT);
  return v === 'glass' || v === 'native' ? v : DEFAULT;
}

let current: Design = read();
const listeners = new Set<() => void>();

export function setDesign(d: Design): void {
  current = d;
  writeLocal(KEY, d);
  document.documentElement.dataset.design = d;
  for (const l of listeners) l();
}

/** 起動時に一度呼ぶ: デザインと、OS のライト / ダークを html に付ける(切り替わったら追従する) */
export function initDesign(): void {
  const html = document.documentElement;
  html.dataset.design = current;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const sync = () => {
    html.dataset.scheme = mq.matches ? 'dark' : 'light';
  };
  sync();
  mq.addEventListener('change', sync);
}

export function useDesign(): Design {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
