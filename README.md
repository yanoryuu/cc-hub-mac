# CC Hub for Mac

複数の Claude Code セッションを 1 つの画面でまとめて扱うアプリ [CC Hub](https://github.com/yanoryuu/cc-hub)(Windows 用)の macOS 版です。

## 必要なもの

Apple Silicon の Mac(M1 以降)で動きます。ターミナルで次を順に実行してください。

```sh
# 1. Homebrew(まだ入っていなければ)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Claude Code(入れたら一度 claude を起動してログインする)
curl -fsSL https://claude.ai/install.sh | bash
claude

# 3. Git と GitHub CLI(GitHub のリポジトリの取り込み・PR の機能に使う)
brew install git gh
gh auth login
```

使うプロジェクトに合わせて、必要なら次も入れます。

| 使うもの | 入れ方 |
|---|---|
| Git LFS(大きなファイルを LFS で管理しているリポジトリ。Unity のプロジェクトなど) | `brew install git-lfs && git lfs install` |
| Unity のプロジェクト | [Unity Hub](https://unity.com/download) と、プロジェクトのバージョンのエディタ |
| Firebase へのデプロイ | `brew install firebase-cli && firebase login` |

## インストール

```sh
brew tap yanoryuu/tap
brew trust yanoryuu/tap   # Homebrew 6 以降: 公式以外の tap は一度だけ信頼の登録が要る
brew install --cask yanoryuu/tap/cc-hub
```

- 更新: `brew upgrade --cask cc-hub`
- 削除: `brew uninstall --cask cc-hub`(設定やデータごと消すなら `--zap`)

Homebrew を使わない場合は、[Releases](https://github.com/yanoryuu/cc-hub-mac/releases) の `CC-Hub-<バージョン>-arm64.dmg` を開き、
`CC Hub.app` を「アプリケーション」へドラッグします。署名していないため、初回は Finder で右クリック →「開く」で起動してください
(または `xattr -dr com.apple.quarantine "/Applications/CC Hub.app"`)。

## 起動

- 「アプリケーション」フォルダの **CC Hub** を開きます(Launchpad や Spotlight で「CC Hub」と打っても開けます)。
  ターミナルからなら `open -a "CC Hub"`。
- 初回の起動で Claude Code との連携(mod「cc-hub」・MCP「cc-hub」・スキル `hub-commander`)を自動で設定し、
  次からはログイン時に自動で起動します(メニューバーの CC Hub のアイコン →「ログイン時に起動」で切り替え)。
- ウィンドウを閉じてもメニューバーに残り、裏で動き続けます。もう一度出すには、メニューバーのアイコンか Dock のアイコンを押すか、⌘⇧Space。
  完全に止めるときは、メニューバーのアイコン →「終了」。
- ブラウザからは http://127.0.0.1:7861 で同じ画面を開けます(PIN を聞かれたら `~/Library/Application Support/cc-hub/config.json` の `pin`)。
- ターミナルや VS Code で使っている Claude Code も、起動し直したものから一覧に出ます。

データは `~/Library/Application Support/cc-hub` に置きます(デーモンのログは `daemon.log`、連携の設定の記録は `setup.log`)。

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
