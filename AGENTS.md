# AGENTS.md（このリポジトリの正）

Electron アプリ（アプリ名: `TODO`）向けの AI・人間共通ルール。  
矛盾がある場合は **本書を `docs/ai/shared-rules.md` より優先**する。

## 守ること

- 依頼範囲外のリファクタやドキュメント乱立をしない
- ユーザー向け文言・コミット説明・changelog / ADR は **日本語**が既定
- git commit / push は、エージェントに別途 git ルールがある場合それに従う（Cursor では明示依頼時のみ commit）
- `_sample/` は運用ルールの参照元。**参照専用**で変更しない

## 作業前に読む

1. 本ファイル（`AGENTS.md`）
2. ルート [`changelog/`](changelog/) を日付が新しいファイルから
3. 関連する [`docs/ai/decisions/`](docs/ai/decisions/) の ADR

## 作業後に書く

| 変更の種類 | 保存先 |
| --- | --- |
| 軽い変更（1 セッション・小修正） | [`changelog/YYYY-MM-DD.md`](changelog/) に追記（なければ新規） |
| 設計に影響する判断 | [`docs/ai/decisions/`](docs/ai/decisions/) に ADR を追加し、changelog からリンク |
| 仕様のたたき台・API メモ | [`docs/specs/`](docs/specs/) |
| 運用ルール自体の変更 | `AGENTS.md` と [`docs/ai/shared-rules.md`](docs/ai/shared-rules.md) 等を更新 |

## ファイル名の慣例

- Changelog: 1 日 1 ファイル `changelog/YYYY-MM-DD.md`（先頭 `# YYYY-MM-DD`、`##` 見出し + 箇条書き）
- ADR: `docs/ai/decisions/ADR-NNN-短い英語スラッグ.md`（テンプレート: [`ADR-000-template.md`](docs/ai/decisions/ADR-000-template.md)）
- Specs: 英語ファイル名または日付プレフィックス可。確定した「なぜ」は ADR へ移す

## Electron 開発

- プロセスは **main / preload / renderer** に分離する
  - main: ウィンドウ管理・OS / ファイル I/O・IPC ハンドラ
  - preload: `contextBridge` で renderer に公開する API のみを定義
  - renderer: UI。Node.js API へ直接アクセスしない
- `BrowserWindow` は `contextIsolation: true` / `nodeIntegration: false` を既定とし、IPC は preload 経由に限定する
- コマンド（プロジェクト作成後に確定させる）
  - 開発起動: `npm run dev`（TODO）
  - ビルド: `npm run build`（TODO）
  - パッケージ: `npm run package`（TODO）
