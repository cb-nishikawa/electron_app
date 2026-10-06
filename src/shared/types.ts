export const OVERLAY_MODES = ['normal', 'record', 'edit', 'run'] as const

export type OverlayMode = (typeof OVERLAY_MODES)[number]

export type ScreenPoint = { x: number; y: number }

export type ScreenRect = { x: number; y: number; width: number; height: number }

/** 画面座標（DIP）。物理ピクセルへは scaleFactor を掛けて変換する */
export type CoordinateTarget = {
  type: 'coordinate'
  x: number
  y: number
  displayId: number
  scaleFactor: number
}

/** 保存・再読み込み後にウィンドウを探し直すための識別情報（windowId / processId は起動ごとに変わるため含めない） */
export type AppWindowRef = {
  ownerName: string
  bundleId?: string
  path?: string
  title: string
}

/** 現在開いているウィンドウ。windowId は Windows ではウィンドウハンドル */
export type AppWindowInfo = AppWindowRef & {
  windowId: number
  processId: number
  bounds: ScreenRect
}

/** ウィンドウ左上からの相対座標（DIP） */
export type WindowCoordinateTarget = {
  type: 'windowCoordinate'
  x: number
  y: number
  window: AppWindowRef
}

/** normalized / image / text は Phase 7 までに追加する */
export type ClickTarget = CoordinateTarget | WindowCoordinateTarget

/** Phase 2 で使う: 実際のカーソルで操作するか、対象アプリへ直接イベントを送るか */
export type ActionDelivery = 'foreground' | 'background'

export type OverlayTarget = { kind: 'screen' } | { kind: 'window'; window: AppWindowInfo }

export type OverlayTargetRequest = { kind: 'screen' } | { kind: 'window'; windowId: number }

export type OverlayTargetStatus = 'ok' | 'lost'

export const CLICK_ACTION_TYPES = ['click', 'doubleClick', 'rightClick'] as const

export type ClickActionType = (typeof CLICK_ACTION_TYPES)[number]

export const DEFAULT_WAIT_AFTER_MS = 1000
export const MAX_WAIT_AFTER_MS = 60000

export type Marker = {
  id: string
  label: string
  target: ClickTarget
  action: ClickActionType
  /** 操作後、次のマーカーへ進むまでの待機時間 */
  waitAfterMs: number
}

export type MarkerPatch = Partial<Pick<Marker, 'action' | 'waitAfterMs'>>

export type RunStatus = 'idle' | 'running' | 'paused' | 'error'

export type RunState = {
  status: RunStatus
  total: number
  currentIndex: number | null
  currentMarkerId: string | null
  /** 実行中の位置（画面座標 DIP）。オーバーレイの表示用 */
  currentPoint: ScreenPoint | null
  completedIds: string[]
  error: string | null
  lastResult: 'completed' | 'stopped' | null
}

export type OverlayState = {
  mode: OverlayMode
  visible: boolean
  /** オーバーレイウィンドウの画面上の位置（DIP） */
  bounds: ScreenRect
  target: OverlayTarget
  targetStatus: OverlayTargetStatus
}

export type Unsubscribe = () => void

export type LiveLensApi = {
  getOverlayState: () => Promise<OverlayState>
  setMode: (mode: OverlayMode) => Promise<OverlayState>
  setOverlayVisible: (visible: boolean) => Promise<OverlayState>
  listWindows: () => Promise<AppWindowInfo[]>
  setTarget: (request: OverlayTargetRequest) => Promise<OverlayState>
  onOverlayStateChanged: (listener: (state: OverlayState) => void) => Unsubscribe
  listMarkers: () => Promise<Marker[]>
  /** オーバーレイ上のクライアント座標を渡すと main で画面座標に変換して登録する */
  addMarkerAt: (clientPoint: ScreenPoint) => Promise<Marker | null>
  updateMarker: (id: string, patch: MarkerPatch) => Promise<void>
  /** オーバーレイ内のローカル座標を渡すと、編集モードでマーカーの位置を移動する */
  moveMarker: (id: string, point: ScreenPoint) => Promise<void>
  removeMarker: (id: string) => Promise<void>
  clearMarkers: () => Promise<void>
  onMarkersChanged: (listener: (markers: Marker[]) => void) => Unsubscribe
  getCursorPosition: () => Promise<ScreenPoint>
  getRunState: () => Promise<RunState>
  startRun: () => Promise<RunState>
  pauseRun: () => Promise<RunState>
  resumeRun: () => Promise<RunState>
  stopRun: () => Promise<RunState>
  retryRun: () => Promise<RunState>
  onRunStateChanged: (listener: (state: RunState) => void) => Unsubscribe
}
