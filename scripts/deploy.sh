#!/bin/bash
# CC Hub を最新のコードで本番に反映する(macOS 版 deploy.ps1)。
#   1. 全パッケージをビルドする(web / daemon / desktop の dist を作り直す)
#   2. 設定のポートで動いている CC Hub のデーモン(node ...daemon/dist/main.js)だけを止める
#   3. デーモンを起動し、応答するまで待つ
# CC Hub から起動したセッションは、デーモン再起動後に --resume で自動再開される。
#   --what-if    何もせず、実行する内容だけを表示する
#   --skip-build ビルドを省略して再起動だけ行う
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${CC_HUB_DATA_DIR:-$HOME/Library/Application Support/cc-hub}"
WHATIF=0; SKIP_BUILD=0
for a in "$@"; do
  case "$a" in
    --what-if) WHATIF=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
  esac
done

PORT=7861
if [ -f "$DATA_DIR/config.json" ]; then
  P=$(/usr/bin/python3 -c "import json,sys; print(int(json.load(open(sys.argv[1])).get('port') or 0))" "$DATA_DIR/config.json" 2>/dev/null)
  [ -n "${P:-}" ] && [ "$P" -gt 0 ] && PORT=$P
fi

say() { if [ "$WHATIF" = 1 ]; then echo "[WhatIf] $1"; else echo "$1"; fi; }

# 1. ビルド
if [ "$SKIP_BUILD" = 0 ]; then
  say "ビルド: npm run build ($ROOT)"
  if [ "$WHATIF" = 0 ]; then
    (cd "$ROOT" && npm run build) || { echo "ビルドに失敗しました"; exit 1; }
  fi
fi

# 2. 停止(CC Hub のデーモンだけ)
PID=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
if [ -n "$PID" ]; then
  CMD=$(ps -p "$PID" -o command= 2>/dev/null)
  case "$CMD" in
    *daemon/dist/main.js*) ;;
    *) echo "ポート $PORT は CC Hub 以外 (PID $PID: $CMD) が使っているため中断します。"; exit 1 ;;
  esac
  say "デーモンを停止: PID $PID"
  if [ "$WHATIF" = 0 ]; then kill "$PID"; sleep 1; kill -0 "$PID" 2>/dev/null && kill -9 "$PID"; fi
else
  say "ポート $PORT で動いているデーモンはありません"
fi

# 3. 起動して応答を待つ
say "デーモンを起動: node packages/daemon/dist/main.js"
if [ "$WHATIF" = 0 ]; then
  mkdir -p "$DATA_DIR"
  # Claude Code のシェルから実行した場合の環境変数(CLAUDE* / NO_COLOR)をデーモンに引き継がない
  for v in $(env | sed -n -E 's/^((CLAUDE[A-Za-z0-9_]*|NO_COLOR))=.*/\1/p'); do unset "$v"; done
  (cd "$ROOT" && nohup node packages/daemon/dist/main.js >> "$DATA_DIR/daemon.log" 2>> "$DATA_DIR/daemon.err.log" < /dev/null &)
  for _ in $(seq 1 30); do
    sleep 0.5
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/")" = "200" ]; then
      echo "起動しました: http://127.0.0.1:$PORT/ (デスクトップアプリはトレイの「再読み込み」で新しい画面になります)"
      exit 0
    fi
  done
  echo "起動を確認できませんでした。$DATA_DIR/daemon.err.log を確認してください。"
  exit 1
fi
