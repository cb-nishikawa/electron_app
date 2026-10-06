# 共有ルール（補足）

本書は [`AGENTS.md`](../../AGENTS.md) の補足である。矛盾がある場合は **AGENTS.md を優先**する。

## コードスタイル

- TypeScript を既定とし、既存コードの型・ファイル分割・命名に合わせる
- IPC チャネル名は `領域:動作` 形式（例: `file:open` / `settings:get`）で統一し、main / preload / renderer で共有する型定義を置く
- `nodeIntegration` は無効のまま。renderer から必要な機能は preload の `contextBridge` で最小限だけ公開する
- main 側の IPC ハンドラでは renderer からの入力を必ず検証する

## ドキュメント

- 作業ログはリポジトリ直下 [`changelog/`](../../changelog/)（`docs/ai/changelog/` ではない）
- 仕様のたたき台は [`docs/specs/`](../specs/)
- 「なぜそうしたか」は [`docs/ai/decisions/`](decisions/) の ADR に残す

## テスト・確認

- 大きな変更後は、`npm run dev` でアプリを起動して主要操作を目視確認した旨を changelog に書いてよい
