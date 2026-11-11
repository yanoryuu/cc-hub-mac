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

/**
 * macOS: Finder / Dock / ログイン時に起動したアプリの PATH は短い(/usr/bin:/bin:/usr/sbin:/sbin)ので、
 * ログインシェルの PATH を足す(gh・git-lfs・node・firebase などを見つけられるように)。子プロセスにも引き継がれる
 */
export function fixMacPath(env: NodeJS.ProcessEnv = process.env): void {
  if (!IS_MAC) return;
  const have = new Set(String(env.PATH || '').split(':').filter(Boolean));
  const add: string[] = [];
  const r = spawnSync(env.SHELL || '/bin/zsh', ['-lic', 'printf "%s" "$PATH"'], { encoding: 'utf8', timeout: 10_000 });
  // .zshrc が何か出力しても、最後の行だけを PATH とみなす
  const shellPath = r.status === 0 ? (r.stdout || '').trim().split('\n').pop() || '' : '';
  for (const p of [...shellPath.split(':'), '/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', `${env.HOME}/.local/bin`]) {
    if (p && p.startsWith('/') && !have.has(p)) {
      have.add(p);
      add.push(p);
    }
  }
  if (add.length) env.PATH = [String(env.PATH || ''), ...add].filter(Boolean).join(':');
}

/**
 * macOS: git が GitHub のログイン情報を使えるようにする(Windows の Git Credential Manager の代わり)。
 * gh にログインしていれば、github.com の認証を gh に任せる設定を、このデーモン(と子プロセス)の git にだけ足す。
 * ユーザーの ~/.gitconfig は書き換えない。すでに github.com 用の helper があれば何もしない
 */
export function useGhForGitAuth(env: NodeJS.ProcessEnv = process.env): void {
  if (!IS_MAC) return;
  const cur = spawnSync('git', ['config', '--get-urlmatch', 'credential.helper', 'https://github.com'], { encoding: 'utf8', env });
  if (/gh(\.exe)? auth git-credential|manager/.test(cur.stdout || '')) return;
  const gh = spawnSync('/usr/bin/which', ['gh'], { encoding: 'utf8', env }).stdout?.trim();
  if (!gh || spawnSync(gh, ['auth', 'status'], { encoding: 'utf8', env, timeout: 10_000 }).status !== 0) return;
  // GIT_CONFIG_COUNT / KEY_n / VALUE_n: 環境変数で設定を足す(git 2.31+)。既にあれば後ろに足す
  // github.com だけ、先に空の helper で一覧を空にしてから gh を足す。
  // osxkeychain に古いトークンが残っていると git はそれを使って失敗し、後ろの helper を試さないため
  const n = Number(env.GIT_CONFIG_COUNT) || 0;
  env[`GIT_CONFIG_KEY_${n}`] = 'credential.https://github.com.helper';
  env[`GIT_CONFIG_VALUE_${n}`] = '';
  env[`GIT_CONFIG_KEY_${n + 1}`] = 'credential.https://github.com.helper';
  env[`GIT_CONFIG_VALUE_${n + 1}`] = `!${gh} auth git-credential`;
  env.GIT_CONFIG_COUNT = String(n + 2);
}

/** 大きなフォルダを複製する(macOS は APFS の clonefile でほぼ一瞬・容量も増えない。それ以外は通常のコピー) */
export function cloneDir(src: string, dst: string): boolean {
  if (IS_MAC) return spawnSync('/bin/cp', ['-Rc', `${src}/.`, dst], { stdio: 'ignore' }).status === 0;
  try {
    require('node:fs').cpSync(src, dst, { recursive: true, force: false, errorOnExist: false });
    return true;
  } catch {
    return false;
  }
}
