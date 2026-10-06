import type { AppWindowRef } from './types'

/** bundleId → path → アプリ名の順に、分かる情報で同じアプリかを判定する */
export function isSameApp(a: AppWindowRef, b: AppWindowRef): boolean {
  if (a.bundleId && b.bundleId) return a.bundleId === b.bundleId
  if (a.path && b.path) return a.path === b.path
  return a.ownerName === b.ownerName
}

export function describeWindow(w: AppWindowRef): string {
  return w.title ? `${w.ownerName} — ${w.title}` : w.ownerName
}
