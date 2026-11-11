# CC Hub for Mac

複数の Claude Code セッションを 1 つの画面でまとめて扱うアプリ [CC Hub](https://github.com/yanoryuu/cc-hub)(Windows 用)の macOS 版です。

## インストール(macOS)

1. 先に次の 2 つを入れておきます。
   - **Claude Code**: ターミナルで `curl -fsSL https://claude.ai/install.sh | bash` を実行し、一度 `claude` を起動してログインします。
   - **Git**: `xcode-select --install`(または `brew install git`)。
   - (任意)PR の機能を使うなら [GitHub CLI](https://cli.github.com/) を入れて `gh auth login` しておきます。
2. Homebrew で入れます(Apple Silicon の Mac):

   ```
   brew install --cask yanoryuu/tap/cc-hub
   ```

   更新は `brew upgrade --cask cc-hub`、削除は `brew uninstall --cask cc-hub`(設定ごと消すなら `--zap`)。

   Homebrew を使わない場合は、[Releases](https://github.com/yanoryuu/cc-hub-mac/releases) の `CC-Hub-<バージョン>-arm64.dmg` を開き、
   `CC Hub.app` を「アプリケーション」へドラッグします。署名していないため、初回は Finder で右クリック →「開く」で起動してください
   (または `xattr -dr com.apple.quarantine "/Applications/CC Hub.app"`)。
3. 起動すると Claude Code との連携(mod「cc-hub」・MCP「cc-hub」・スキル `hub-commander`)を自動で設定します。

データは `~/Library/Application Support/cc-hub` に置きます(設定の記録は `setup.log`)。

## Windows 版との違い

| | Windows | macOS |
|---|---|---|
| データフォルダ | `%APPDATA%\cc-hub` | `~/Library/Application Support/cc-hub` |
| 秘密情報の暗号化 | DPAPI | AES-256-GCM(鍵はキーチェーン。使えなければ 0600 のファイル) |
| 「ターミナルで開く」 | 新しい PowerShell ウィンドウ | Terminal.app の新しいウィンドウ(osascript) |
| CC Hub 内の端末 | PowerShell | ログインシェル(`$SHELL -l`) |
| 「アプリを開く」ボタン | `cmd /c start …` | `/bin/sh -c …`(GUI アプリは `open -a アプリ名` と書く) |
| フォルダを開く | エクスプローラー | Finder |
| Unity エディタ | `C:\Program Files\Unity\Hub\Editor` | `/Applications/Unity/Hub/Editor` |
| ゲーム画面の共有(gamecap) | 対応 | 未対応 |
| 作業ツリーの既定の場所 | `D:\WorkTree`(無ければ `%USERPROFILE%\WorkTree`) | `~/WorkTree` |
| ショートカット | Ctrl+Shift+Space | ⌘+Shift+Space |

## 開発

```
npm install
npm run build
npm run daemon                # デーモンだけ動かす
npm run desktop               # Electron で開く
npm test -w @cc-hub/daemon    # テスト
```

ログイン時にデーモンを起動する(開発版。launchd に登録):

```
./scripts/install-mac.sh          # 登録
./scripts/install-mac.sh --uninstall
./scripts/deploy.sh               # ビルドしてデーモンを再起動
```

### リリース(dmg → GitHub Release → Homebrew)

`packages/desktop/package.json` の version を上げてコミットしてから:

```
./scripts/release-mac.sh
```

dmg を作り、`mac-v<バージョン>` の Release に上げ、[yanoryuu/homebrew-tap](https://github.com/yanoryuu/homebrew-tap) の `Casks/cc-hub.rb` を更新します。

### dmg の作り方

```
npm install
npm run build
npm run dist:mac -w @cc-hub/desktop
```

`release/CC-Hub-<バージョン>-<arch>.dmg` ができます。いま動いている node と同じバージョンの公式の node(nodejs.org の単体バイナリ)を同梱します
(Homebrew の node は動的リンクのため同梱できません。`scripts/stage-hub.cjs`)。ネイティブモジュールはビルドした Mac の CPU 用だけなので、
Apple Silicon 用と Intel 用はそれぞれの Mac で作ってください。

設計は `docs/design.md`、要件は `docs/requirements.md`(Windows 版のもの)にあります。
