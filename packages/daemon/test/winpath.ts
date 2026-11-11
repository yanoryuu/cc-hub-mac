// テストの Windows のパス(D:\x\y)を、macOS では POSIX のパス(/D/x/y)に読み替える。Windows ではそのまま
export function P(s: string): string {
  if (process.platform === 'win32') return s;
  const p = s.replace(/^([A-Za-z]):[\\/]?/, '/$1/').replace(/\\/g, '/');
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}
