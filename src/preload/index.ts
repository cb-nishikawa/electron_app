import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import type { LiveLensApi, Marker, OverlayState, RunState, Unsubscribe } from '@shared/types'

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: LiveLensApi = {
  getOverlayState: () => ipcRenderer.invoke(IpcChannels.overlayGetState),
  setMode: (mode) => ipcRenderer.invoke(IpcChannels.overlaySetMode, mode),
  setOverlayVisible: (visible) => ipcRenderer.invoke(IpcChannels.overlaySetVisible, visible),
  listWindows: () => ipcRenderer.invoke(IpcChannels.windowsList),
  setTarget: (request) => ipcRenderer.invoke(IpcChannels.overlaySetTarget, request),
  onOverlayStateChanged: (listener) =>
    subscribe<OverlayState>(IpcChannels.overlayStateChanged, listener),
  listMarkers: () => ipcRenderer.invoke(IpcChannels.markerList),
  addMarkerAt: (clientPoint) => ipcRenderer.invoke(IpcChannels.markerAdd, clientPoint),
  updateMarker: (id, patch) => ipcRenderer.invoke(IpcChannels.markerUpdate, id, patch),
  moveMarker: (id, point) => ipcRenderer.invoke(IpcChannels.markerMove, id, point),
  removeMarker: (id) => ipcRenderer.invoke(IpcChannels.markerRemove, id),
  clearMarkers: () => ipcRenderer.invoke(IpcChannels.markerClear),
  onMarkersChanged: (listener) => subscribe<Marker[]>(IpcChannels.markersChanged, listener),
  getCursorPosition: () => ipcRenderer.invoke(IpcChannels.cursorGetPosition),
  getRunState: () => ipcRenderer.invoke(IpcChannels.runGetState),
  startRun: () => ipcRenderer.invoke(IpcChannels.runStart),
  pauseRun: () => ipcRenderer.invoke(IpcChannels.runPause),
  resumeRun: () => ipcRenderer.invoke(IpcChannels.runResume),
  stopRun: () => ipcRenderer.invoke(IpcChannels.runStop),
  retryRun: () => ipcRenderer.invoke(IpcChannels.runRetry),
  onRunStateChanged: (listener) => subscribe<RunState>(IpcChannels.runStateChanged, listener)
}

contextBridge.exposeInMainWorld('liveLens', api)
