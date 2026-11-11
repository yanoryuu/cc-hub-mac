// 秘密情報(サーバーのパスワード / Discord の Webhook URL)の暗号化。
// - Windows: DPAPI(CurrentUser)を PowerShell で呼ぶ
// - macOS: AES-256-GCM。鍵はキーチェーン(security コマンド)に置く。キーチェーンが使えなければ、データフォルダの 0600 のファイル
// - 秘密はコマンドラインに載せない(Windows は標準入力で渡す。macOS の鍵は security の引数に出るが暗号文・平文は出ない)
// - ログに中身を出さない(エラー時も出力は要約だけ)
// - 復号した値は呼び出し側で使い終わったら捨てること(長く保持しない)
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IS_WIN } from './platform';

const PS_TIMEOUT_MS = 20_000;

// 標準入力の base64 を読み、DPAPI で Protect / Unprotect して base64 で出力する
const SCRIPT = (op: 'Protect' | 'Unprotect') =>
  [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Security',
    '$in = [Console]::In.ReadToEnd().Trim()',
    '$b = [Convert]::FromBase64String($in)',
    `$o = [System.Security.Cryptography.ProtectedData]::${op}($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
    '[Console]::Out.Write([Convert]::ToBase64String($o))',
  ].join('; ');

/** 暗号化・復号の実装(テストでは差し替える) */
export interface SecretBox {
  protect(plain: string): Promise<string>;
  unprotect(blob: string): Promise<string>;
}

function runPs(op: 'Protect' | 'Unprotect', inputB64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    let done = false;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT(op)], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      reject(new Error(`DPAPI(${op})がタイムアウトしました`));
    }, PS_TIMEOUT_MS);
    child.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.stderr.on('data', (c: Buffer) => {
      if (err.length < 4000) err += c.toString('utf8');
    });
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error(`PowerShell を起動できません: ${e.message}`));
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const s = out.trim();
      if (code === 0 && /^[A-Za-z0-9+/=]+$/.test(s)) resolve(s);
      // 入力は秘密なのでエラーメッセージには含めない(PowerShell の例外の 1 行目だけ)
      else reject(new Error(`DPAPI(${op})に失敗しました (code ${code}): ${err.split(/\r?\n/)[0]?.slice(0, 200) ?? ''}`));
    });
    child.stdin.on('error', () => {
      /* 先に終了した場合。結果は close で判定する */
    });
    child.stdin.end(inputB64 + '\n', 'utf8');
  });
}

/** Windows DPAPI(CurrentUser スコープ)。暗号文は base64 */
export const dpapi: SecretBox = {
  async protect(plain: string): Promise<string> {
    return runPs('Protect', Buffer.from(String(plain), 'utf8').toString('base64'));
  },
  async unprotect(blob: string): Promise<string> {
    const b64 = await runPs('Unprotect', String(blob));
    return Buffer.from(b64, 'base64').toString('utf8');
  },
};

// ------------------------------------------------------------ macOS: キーチェーンの鍵 + AES-256-GCM
const KEYCHAIN_SERVICE = 'cc-hub';
const KEYCHAIN_ACCOUNT = 'secrets-key';
const KEY_PREFIX = 'v1:';

function keyFile(): string {
  const dir = process.env.CC_HUB_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'cc-hub');
  return path.join(dir, 'secrets-key');
}

function keychainGet(): string | null {
  const r = spawnSync('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'], { encoding: 'utf8' });
  const s = (r.stdout ?? '').trim();
  return r.status === 0 && /^[0-9a-f]{64}$/.test(s) ? s : null;
}

function keychainSet(hex: string): boolean {
  const r = spawnSync('security', ['add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w', hex], { encoding: 'utf8' });
  return r.status === 0;
}

let cachedKey: Buffer | null = null;

/** 暗号鍵(32 バイト)。キーチェーン → 鍵ファイルの順に探し、無ければ作る */
function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  // テストや CI でキーチェーンを使わないとき
  const useKeychain = process.env.CC_HUB_NO_KEYCHAIN !== '1';
  let hex = useKeychain ? keychainGet() : null;
  if (!hex) {
    try {
      const f = fs.readFileSync(keyFile(), 'utf8').trim();
      if (/^[0-9a-f]{64}$/.test(f)) hex = f;
    } catch {
      /* 無ければ作る */
    }
  }
  if (!hex) {
    hex = crypto.randomBytes(32).toString('hex');
    if (!(useKeychain && keychainSet(hex))) {
      fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
      fs.writeFileSync(keyFile(), hex, { mode: 0o600 });
    }
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

/** macOS: 暗号文は "v1:" + base64(iv 12 + tag 16 + 本文) */
export const keychainBox: SecretBox = {
  async protect(plain: string): Promise<string> {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
    const body = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    return KEY_PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
  },
  async unprotect(blob: string): Promise<string> {
    const s = String(blob);
    if (!s.startsWith(KEY_PREFIX)) throw new Error('復号に失敗しました(この Mac で暗号化されたものではありません。設定し直してください)');
    const raw = Buffer.from(s.slice(KEY_PREFIX.length), 'base64');
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', masterKey(), raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
    } catch {
      throw new Error('復号に失敗しました(鍵が違うか、データが壊れています。設定し直してください)');
    }
  },
};

/** このマシンの暗号化(main.ts が使う) */
export const secrets: SecretBox = IS_WIN ? dpapi : keychainBox;
