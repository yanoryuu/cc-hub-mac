// OS ごとの違い(Windows / macOS)をここに集める。呼び出し側は process.platform を直接見ない。
import { spawn, spawnSync } from 'node:child_process';

export const IS_WIN = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';

/** 子プロセスごと終了させる(npm などはシェルの下に孫がいる)。detached で起動したものは別プロセスグループなので -pid に送る */
export function killTree(pid: number | undefined, opts: { group?: boolean } = {}): void {
  if (!pid) return;
  if (IS_WIN) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => undefined);
    return;
  }
  try {
    if (opts.group) process.kill(-pid, 'SIGKILL');
    else {
      // グループにしていない子の孫: pkill -P で子孫を先に落としてから本体を落とす
      spawnSync('pkill', ['-KILL', '-P', String(pid)], { stdio: 'ignore' });
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    /* 既に終了 */
  }
}

/** 対話シェル(「ほかの端末から開く」端末)の起動内容 */
export function defaultShell(): { file: string; args: string[]; label: string } {
  if (IS_WIN) return { file: 'powershell.exe', args: ['-NoLogo'], label: 'PowerShell' };
  const file = process.env.SHELL || '/bin/zsh';
  return { file, args: ['-l'], label: file.split('/').pop() || 'shell' };
}

/** フォルダをファイルマネージャー(Finder / エクスプローラー)で開く */
export function openFolder(dir: string): void {
  const [file, args] = IS_WIN ? ['explorer.exe', [dir]] : ['open', [dir]];
  spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: false }).on('error', () => undefined).unref();
}

/** ファイルマネージャーの名前(画面に出す文) */
export const FILE_MANAGER = IS_WIN ? 'エクスプローラー' : 'Finder';
