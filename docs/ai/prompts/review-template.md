# コードレビュー依頼テンプレート

以下をコピーして使う。

---

## 変更概要

- ブランチ / PR: 
- 目的: 

## レビューしてほしい観点

- [ ] セキュリティ（IPC の入力検証・`contextIsolation` / `nodeIntegration` 設定・preload で公開する API の範囲）
- [ ] 既存パターンとの一貫性（main / preload / renderer の責務分離・IPC チャネル命名）
- [ ] パフォーマンス（main プロセスのブロッキング処理、不要な I/O）
- [ ] ドキュメント（changelog / ADR が必要か）

## 関連ファイル

- 

## 既知の妥協点

（任意）

---
