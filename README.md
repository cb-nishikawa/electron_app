# らいぶレンズ（live-lens）

PC 画面上に透明なオーバーレイを表示し、画面上の操作を登録・記録・実行する自動操作ツール（Electron + React + TypeScript）。

- 要件: [docs/specs/live-lens-requirements.md](docs/specs/live-lens-requirements.md)
- 開発ルール・作業ログの運用: [AGENTS.md](AGENTS.md)

## セットアップ

```bash
npm install
npm run dev
```

## 主なコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発起動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 型チェック |
| `npm run build` | 型チェック + ビルド |
| `npm run build:mac` / `npm run build:win` | パッケージ作成 |

## ショートカット

- `Cmd/Ctrl+Shift+L`: オーバーレイの表示 / 非表示
- `Cmd/Ctrl+Shift+N`: 通常モードに戻る / 実行を停止（記録・編集モード中はオーバーレイ上の Esc でも可）
- `Esc`: 実行を停止（実行中のみ）

## 権限（macOS）

- 実行（マウス操作）: 「システム設定 > プライバシーとセキュリティ > アクセシビリティ」でアプリ（開発中は `node_modules/electron/dist/Electron.app`）を許可する
- アプリ指定でウィンドウのタイトルを表示する: 同じく「画面収録」を許可する
