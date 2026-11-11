#!/bin/bash
# Mac 版のリリース: dmg を作り、GitHub Release(yanoryuu/cc-hub-mac)に上げ、Homebrew の tap(yanoryuu/homebrew-tap)の Cask を更新する。
#   ./scripts/release-mac.sh              ビルドから
#   ./scripts/release-mac.sh --skip-build いまある release/ の dmg を使う
# 使う人は: brew install --cask yanoryuu/tap/cc-hub
# バージョンは packages/desktop/package.json の version(タグは mac-v<version>)。上げてから実行する
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="yanoryuu/cc-hub-mac"
TAP="yanoryuu/homebrew-tap"
SKIP_BUILD=0
for a in "$@"; do [ "$a" = "--skip-build" ] && SKIP_BUILD=1; done

VERSION=$(node -p "require('$ROOT/packages/desktop/package.json').version")
ARCH=$(uname -m | sed s/x86_64/x64/)
TAG="mac-v$VERSION"
DMG="$ROOT/release/CC-Hub-$VERSION-$ARCH.dmg"

if [ "$SKIP_BUILD" = 0 ]; then
  (cd "$ROOT" && npm run build && npm run dist:mac -w @cc-hub/desktop)
fi
[ -f "$DMG" ] || { echo "dmg がありません: $DMG"; exit 1; }
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "コミットしていない変更があります。コミットしてから実行してください"; exit 1
fi
SHA=$(shasum -a 256 "$DMG" | cut -d' ' -f1)
echo "== $TAG  $(basename "$DMG")  sha256 $SHA"

# 1. GitHub Release(同じタグがあれば dmg を差し替える)
git -C "$ROOT" push -q origin HEAD
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$DMG" --repo "$REPO" --clobber
else
  gh release create "$TAG" "$DMG" --repo "$REPO" --target "$(git -C "$ROOT" rev-parse HEAD)" \
    --title "CC Hub for Mac $VERSION" \
    --notes "Apple Silicon 用。\`brew install --cask yanoryuu/tap/cc-hub\` で入れられます(dmg から入れる場合は README を参照)。"
fi

# 2. tap の Cask を更新
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
gh repo clone "$TAP" "$WORK/tap" -- -q
mkdir -p "$WORK/tap/Casks"
cat > "$WORK/tap/Casks/cc-hub.rb" <<EOF
cask "cc-hub" do
  version "$VERSION"
  sha256 "$SHA"

  url "https://github.com/$REPO/releases/download/mac-v#{version}/CC-Hub-#{version}-arm64.dmg"
  name "CC Hub"
  desc "Hub for running and watching many Claude Code sessions"
  homepage "https://github.com/$REPO"

  depends_on arch: :arm64
  depends_on :macos

  app "CC Hub.app"

  # 署名していないので、ダウンロードで付く quarantine を外す(外さないと初回の起動で止められる)。
  # Homebrew 6 の install steps は引数を展開しないので、既定の /Applications を前提にする(--appdir を変えた場合は手で外す)
  postflight_steps do
    run "/usr/bin/xattr",
        args:           ["-dr", "com.apple.quarantine", "/Applications/CC Hub.app"],
        must_succeed:   false,
        writable_paths: ["CC Hub.app"],
        writable_base:  :appdir
  end

  # アプリを閉じ、同梱の node で動いているデーモンも止める
  uninstall quit:   "com.yanoryuu.cchub",
            script: {
              executable:   "/usr/bin/pkill",
              args:         ["-f", "CC Hub.app/Contents/Resources/hub/"],
              must_succeed: false,
            }

  zap trash: [
    "~/Library/Application Support/CC Hub",
    "~/Library/Application Support/cc-hub",
    "~/Library/Preferences/com.yanoryuu.cchub.plist",
    "~/Library/Saved Application State/com.yanoryuu.cchub.savedState",
  ]

  caveats <<~EOS
    初回の起動で Claude Code との連携(mod・MCP・スキル)を設定します。
    連携を外すときは、アンインストールの前にアプリ内の手順か README を参照してください。
  EOS
end
EOF
cd "$WORK/tap"
git add Casks/cc-hub.rb
if git diff --cached --quiet; then
  echo "Cask は最新です"
else
  git commit -q -m "cc-hub $VERSION"
  git push -q
  echo "Cask を更新しました: $TAP Casks/cc-hub.rb"
fi
echo "完了: brew install --cask yanoryuu/tap/cc-hub"
