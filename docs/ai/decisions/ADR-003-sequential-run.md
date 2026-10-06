# ADR-003: マーカーの順次実行（実カーソルによる操作）

- ステータス: 採用
- 日付: 2026-10-06

## コンテキスト

記録したマーカー（操作対象）を、登録順に自動でクリックしたい。マーカーごとにクリックの種類と、次のマーカーへ進むまでの待機時間を変えられる必要がある。実行中は一時停止・再開・停止ができ、対象が見つからないなどのエラーでは、ユーザーが再試行するか停止するかを選べるようにする。

[ADR-002](ADR-002-app-window-target.md) では、実カーソルを動かす `ForegroundDriver` と、対象アプリへ直接イベントを送る `BackgroundDriver` を設計した。今回はまず `ForegroundDriver` だけを実装する。

## 決定

### マウス操作

- [@nut-tree-fork/nut-js](https://www.npmjs.com/package/@nut-tree-fork/nut-js)（4.2.x）を採用する。macOS / Windows のビルド済みバイナリが同梱されていて、ネイティブのビルドが要らない。本家 `@nut-tree/nut-js` は npm で配布されなくなったのでフォーク版を使う
- main から動的 `import()` で必要になったときだけ読み込む。待機はランナー側で管理するので、`mouse.config.autoDelayMs` は 20ms にする
- `AutomationController`（`ensureReady` / `activate` / `perform`）を介して呼ぶ。今回の実装は `ForegroundDriver` だけ
- アクションは `click` / `doubleClick` / `rightClick` の 3 種類。マーカーごとに `action`（既定はクリック）と `waitAfterMs`（既定 1 秒、最大 60 秒）を持たせる
- 座標: libnut は macOS ではポイント（DIP）、Windows では物理ピクセルを受け取るので、Windows だけ `screen.dipToScreenPoint` で変換する
- macOS では「アクセシビリティ」の権限が要る。実行の開始時に `systemPreferences.isTrustedAccessibilityClient(true)` で確認し、権限がなければシステムのダイアログを出したうえで、案内付きのエラーで開始を断る

### 実行の流れ（`AutomationRunner`）

- 開始時にマーカー一覧のスナップショットを取り、上から順に実行する。実行中はマーカーの編集・削除・モード変更・対象の変更を main で拒否する
- 1 ステップの流れ: 対象を解決する → 状態の `currentPoint` を更新してオーバーレイに表示する → 150ms 待つ → 操作する → `waitAfterMs` だけ待つ
- `windowCoordinate` のマーカーは、実行のたびに `AppWindowRef` からウィンドウを探し直し、ウィンドウの左上に相対座標を足して画面座標にする
  - オーバーレイが同じアプリのウィンドウを追従中なら、そのウィンドウ（`windowId`）だけを使う。見つからなければエラーにする。追従中のウィンドウが閉じたり最小化されたりしたときに、同じアプリの別のウィンドウ（別インスタンスを含む）を誤ってクリックしないため
  - それ以外は、タイトルが同じウィンドウ、なければ同じアプリの最初のウィンドウを使う
  - 対象ウィンドウが最前面でなければ、nut.js の `Window.focus()`（`windowId` で指定）で前面に出し、300ms 待ってから位置を取り直す。macOS で失敗したときは `open -b <bundleId>`（なければ `.app` のパスに `open -a`）にフォールバックする
- 一時停止はステップの境目と待機中に効く。一時停止中は待機の残り時間を減らさない
- 停止はいつでも受け付け、以降のステップは実行しない。操作の途中で停止が要求されたステップは完了扱いにしない
- エラーが起きたら状態を `error` にして、ユーザーの選択を待つ。再試行なら同じステップをやり直し、停止なら終了する
- 実行中はオーバーレイを `run` モードにしてプライマリディスプレイ全体に広げ、クリック透過のまま、実行中の位置と番号を表示する。終了したら通常モードに戻す

### 緊急停止

- 実行中だけグローバルショートカット `Esc` を登録して停止できるようにする。`Cmd/Ctrl+Shift+N`（通常モードへ戻る）でも停止する

## 結果

- 記録した手順を、マーカーごとのクリック種類と待機時間で再生できる
- 実行中の状態（進捗・現在のマーカー・一時停止・エラー）が操作パネルとオーバーレイの両方に表示される
- 既知の制約
  - 実カーソルを動かすので、実行中はユーザーのマウス操作と干渉する。バックグラウンド操作は Phase 2 以降
  - 操作パネルがクリック位置に重なっていると、パネルをクリックしてしまう（パネルの自動退避はしていない）
  - 実行中は `Esc` をグローバルに奪うので、ほかのアプリで `Esc` が効かなくなる
  - 実際のクリック（nut.js）は、開発環境の Electron にアクセシビリティ権限がなかったため未確認。順次実行・一時停止・停止・エラーからの再試行は、ドライバをダミーに差し替えて確認した
  - Windows の実機では未確認

## 関連

- 実装: `src/main/automation/automationController.ts`、`src/main/automation/automationRunner.ts`、`src/main/ipc.ts`、`src/main/shortcuts.ts`、`src/renderer/src/control/RunSection.tsx`、`src/renderer/src/control/MarkerRow.tsx`、`src/renderer/src/overlay/OverlayApp.tsx`
- 要件: [`../../specs/live-lens-requirements.md`](../../specs/live-lens-requirements.md)（15 章 自動操作エンジン）
- changelog: [`../../../changelog/2026-10-06.md`](../../../changelog/2026-10-06.md)
