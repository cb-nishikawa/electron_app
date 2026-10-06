# ADR-001: オーバーレイのウィンドウ構成と状態管理

- ステータス: 採用
- 日付: 2026-10-06

## コンテキスト

らいぶレンズは、他のアプリの画面上に透明なオーバーレイを重ねて操作対象を登録・表示し、最終的には自動操作を実行する（[要件](../../specs/live-lens-requirements.md)）。オーバーレイは、背後のアプリの操作を邪魔しない（クリック透過）状態と、クリックを受け取る（記録・編集）状態を切り替える必要がある。また、後から自動操作（Phase 2）・画像認識（Phase 6）を main プロセスに追加しても、UI 側を作り直さずに済む構造にしたい。対応 OS は macOS / Windows。

## 決定

- **ウィンドウを 2 枚に分ける**
  - 操作パネル（`index.html`）: 通常のウィンドウ。モード切替・マーカー一覧など
  - オーバーレイ（`overlay.html`）: プライマリディスプレイ全体を覆う透明・枠なし・最前面（`screen-saver` レベル）のウィンドウ。macOS ではフルスクリーンアプリ上・全ワークスペースにも表示する
- **状態（モード・表示・マーカー）は main プロセスだけで持つ**。`OverlayModeManager` と `MarkerStore` が変更を両方のウィンドウへ通知し、renderer はそれを描画するだけにする
- **モードごとのクリック透過**
  - `normal` / `run`: `setIgnoreMouseEvents(true, { forward: true })` + `setFocusable(false)`（背後のアプリへ透過）
  - `record` / `edit`: `setIgnoreMouseEvents(false)` + フォーカスを渡す（オーバーレイがクリック・キーを受け取る）
  - オーバーレイを非表示にしたときは `normal` に戻す（見えないウィンドウがクリックを奪わないようにする）
- **抜け出す手段を必ず用意する**: オーバーレイ上の Esc、グローバルショートカット `CommandOrControl+Shift+N`（通常モードへ）と `CommandOrControl+Shift+L`（表示切替）。`Ctrl+Shift+Esc` は Windows のタスクマネージャーに予約されているため使わない
- **座標は画面座標（DIP）で持つ**。オーバーレイのクライアント座標を main で `overlay.getBounds()` の原点と足し合わせて変換し、`displayId` と `scaleFactor` を一緒に保存する。物理ピクセルへの変換は、OS 操作を入れる Phase 2 で行う
- **クリック対象は `target.type` で切り替えられる型にする**（現時点は `coordinate` のみ。`normalized` / `image` / `text` は後で追加する）
- マーカーの登録（`marker:add`）は、オーバーレイの webContents から、かつ `record` モード中のときだけ受け付ける

## 結果

- 操作パネルとオーバーレイの見た目・責務が分かれ、自動操作エンジン（`AutomationRunner` など）を main に追加しても renderer 側の変更は表示部分だけで済む
- 記録モード中はオーバーレイが画面全体のクリックを受け取るため、操作パネルも一時的に操作できない。Esc やショートカットで抜ける必要がある
- 対象はプライマリディスプレイのみ。マルチディスプレイ対応時は、ディスプレイごとにオーバーレイを作るかどうかを改めて判断する
- 特定のアプリのウィンドウだけを対象にする「アプリ指定」と、ウィンドウ相対座標は [ADR-002](ADR-002-app-window-target.md) で追加した

## 関連

- 仕様たたき台: [`../../specs/live-lens-requirements.md`](../../specs/live-lens-requirements.md)
- 実装: `src/main/windows/overlayWindow.ts`、`src/main/overlay/overlayModeManager.ts`、`src/main/ipc.ts`
- changelog: [`../../../changelog/2026-10-06.md`](../../../changelog/2026-10-06.md)
