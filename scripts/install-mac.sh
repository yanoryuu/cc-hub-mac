#!/bin/bash
# CC Hub インストール(macOS): ログイン時の起動 + 死活監視を launchd(LaunchAgent)に登録する。
#   ./scripts/install-mac.sh              インストール
#   ./scripts/install-mac.sh --what-if    実行内容を表示するだけ
#   ./scripts/install-mac.sh --uninstall  登録解除
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.yanoryuu.cchub.daemon"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DATA_DIR="${CC_HUB_DATA_DIR:-$HOME/Library/Application Support/cc-hub}"
WHATIF=0; UNINSTALL=0
for a in "$@"; do
  case "$a" in --what-if) WHATIF=1 ;; --uninstall) UNINSTALL=1 ;; esac
done
say() { if [ "$WHATIF" = 1 ]; then echo "[WhatIf] $1"; else echo "$1"; fi; }

if [ "$UNINSTALL" = 1 ]; then
  say "登録解除: $PLIST"
  if [ "$WHATIF" = 0 ]; then
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
  fi
  exit 0
fi

[ -f "$REPO/packages/daemon/dist/main.js" ] || { echo "デーモンが未ビルドです(npm run build を実行してください)"; exit 1; }
NODE="$(command -v node)" || { echo "node が見つかりません"; exit 1; }

say "書き出し: $PLIST (ログイン時に起動 / 異常終了したら再起動)"
if [ "$WHATIF" = 0 ]; then
  mkdir -p "$HOME/Library/LaunchAgents" "$DATA_DIR"
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$REPO/packages/daemon/dist/main.js</string></array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>AbandonProcessGroup</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(dirname "$NODE"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StandardOutPath</key><string>$DATA_DIR/daemon.log</string>
  <key>StandardErrorPath</key><string>$DATA_DIR/daemon.err.log</string>
</dict>
</plist>
PLISTEOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
fi
echo "完了"
