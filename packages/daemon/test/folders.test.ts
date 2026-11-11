// フォルダのプロジェクト(Git なしでもよい)の登録のテスト。
// 実行: npm run test -w @cc-hub/daemon
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FolderProjects } from '../src/project/folders';

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}\n     ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

const mem = new Map<string, unknown>();
const store = { getSetting: (k: string) => (mem.get(k) ?? null) as any, setSetting: (k: string, v: unknown) => void mem.set(k, v) } as any;
// 一時フォルダに Git の無いフォルダを作る(以前は D:/AITEST の固定のフォルダを使っていた)
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-hub-folders-'));
const DIR = path.join(BASE, 'no-git');
fs.mkdirSync(DIR);
/** 同じフォルダの別の書き方(大文字・区切り・末尾の区切り) */
const ALT = process.platform === 'win32' ? DIR.replace(/\//g, '\\').toUpperCase() + '\\' : DIR.toUpperCase().replace(/NO-GIT$/, 'no-git') + '/';

test('Git の無いフォルダも登録できる。同じフォルダ(書き方違い)は重ねない', () => {
  const f = new FolderProjects(store);
  assert.equal(f.add(DIR, 1).length, 1);
  assert.equal(f.add(ALT, 2).length, 1);
  assert.equal(f.list()[0].addedAt, 1);
});

test('無いフォルダ・相対パス・空は断る', () => {
  const f = new FolderProjects(store);
  assert.throws(() => f.add(path.join(BASE, 'none')), /見つかりません/);
  assert.throws(() => f.add('relative/dir'), /絶対パス/);
  assert.throws(() => f.add(''), /指定してください/);
});

test('登録を外す(書き方が違っても外れる)', () => {
  const f = new FolderProjects(store);
  assert.equal(f.remove(ALT).length, 0);
});

fs.rmSync(BASE, { recursive: true, force: true });
console.log(`folders: ${passed} passed`);
