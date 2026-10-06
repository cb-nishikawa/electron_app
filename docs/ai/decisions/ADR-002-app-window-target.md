# ADR-002: アプリ指定（ウィンドウ対象）オーバーレイとバックグラウンド操作の前提

- ステータス: 採用
- 日付: 2026-10-06

## コンテキスト

[ADR-001](ADR-001-overlay-window-architecture.md) では、オーバーレイはプライマリディスプレイ全体を覆い、座標は画面座標（DIP）で持っていた。しかし実際の操作対象は特定のアプリのウィンドウであることが多く、ウィンドウが移動・リサイズされると絶対座標では別の場所を押してしまう。ユーザーは「画面全体」に加えて「アプリ指定」でも操作対象を登録したい。

将来的には、対象アプリを前面に出さずに直接クリックやキーを送る「バックグラウンド操作」も行いたい。これは Phase 2（OS 操作）で実装するが、そのとき必要になる情報を、今の段階でデータ構造に入れておきたい。

## 決定

### 対象の切り替え

- `OverlayTarget` を `{ kind: 'screen' }` と `{ kind: 'window'; window: AppWindowInfo }` の 2 種類にする。操作パネルの「対象」で切り替える
- `window` の場合、オーバーレイウィンドウの bounds を対象ウィンドウに合わせ、`AppWindowTracker` が 200ms ごとにポーリングして移動・リサイズに追従する
  - 前回の取得が終わるまで次の取得は始めない（macOS では 1 回あたり約 100ms かかる）
  - 対象が見つからない（最小化・終了・別のデスクトップへの移動）ときは `targetStatus: 'lost'` にしてオーバーレイを隠し、記録・編集モードなら通常モードに戻す。見つかり直したら自動で表示を戻す
  - bounds の更新だけでは `apply()`（フォーカス移動を含む）を呼ばない。記録モード中にフォーカスを奪い続けないため

### ウィンドウの取得

- [get-windows](https://github.com/sindresorhus/get-windows) を採用する。macOS は同梱の Swift バイナリ、Windows は N-API アドオンで、どちらもネイティブのビルドが要らない
- ESM 専用のパッケージなので、main からは動的 `import()` で読み込む。パッケージ化に備えて `asarUnpack` に入れておく
- 自分のプロセスのウィンドウと、40px 未満の極小ウィンドウは一覧から除く
- macOS でウィンドウのタイトルを取るには「画面収録」の権限が要る（権限がなければアプリ名だけを表示する）。アクセシビリティ権限はブラウザの URL を取るためだけのものなので求めない
- Windows は物理ピクセルを返すので、`screen.screenToDipRect` で DIP に変換する

### 座標とアプリの識別

- アプリ指定中に登録したマーカーは `WindowCoordinateTarget`（ウィンドウ左上からの相対座標、DIP）とする
- ウィンドウの識別は `AppWindowRef`（アプリ名・bundleId・実行ファイルのパス・タイトル）で持つ。`windowId` と `processId` は起動ごとに変わるので保存しない。保存した手順を再生するときは `isSameApp`（bundleId、なければパス、なければアプリ名の順に照合）でウィンドウを探し直す
- オーバーレイは、いまの対象に属するマーカーだけを描画する

### バックグラウンド操作の前提（Phase 2 で実装）

- `ActionDelivery = 'foreground' | 'background'` をアクションごとに持たせる
- `AutomationController` の下に 2 つのドライバを置く
  - `ForegroundDriver`: nut.js などで実際のカーソルを動かす。どのアプリでも効くが、ユーザーの操作と干渉する
  - `BackgroundDriver`: 対象アプリへ直接イベントを送る
    - macOS: `CGEventPostToPid`（`processId` を使う。アクセシビリティ権限が要る）
    - Windows: ウィンドウハンドル（get-windows の `windowId`）への `PostMessage`（`WM_LBUTTONDOWN` など、クライアント座標を使う）
- Chromium 系・ゲーム・UWP などは、バックグラウンドのイベントを無視することが多い。届かないときは foreground に戻すか、エラーにしてユーザーに選ばせる
- 実行時は `AppWindowRef` からウィンドウを探し直して `windowId` と `processId` を得てから、相対座標を画面座標やクライアント座標に変換する

## 結果

- ウィンドウを動かしても、登録した位置がそのウィンドウ上の同じ場所を指す
- 画面全体の対象は今までどおり使える
- 既知の制約
  - オーバーレイは最前面に出るため、対象ウィンドウが他のウィンドウの後ろにあっても、その上にマーカーが描かれる（前面判定は後回し）
  - 追従はポーリングなので、最大 200ms ほど遅れる。最小化アニメーション中の途中の bounds を一瞬拾うことがある
  - Windows の実機では未確認

## 関連

- 実装: `src/main/targets/appWindowTracker.ts`、`src/main/overlay/overlayModeManager.ts`、`src/main/ipc.ts`、`src/shared/appWindow.ts`、`src/renderer/src/control/TargetSection.tsx`
- 要件: [`../../specs/live-lens-requirements.md`](../../specs/live-lens-requirements.md)（8 章 クリック位置、15 章 自動操作エンジン）
- changelog: [`../../../changelog/2026-10-06.md`](../../../changelog/2026-10-06.md)
