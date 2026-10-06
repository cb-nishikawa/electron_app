import { randomUUID } from 'crypto'
import {
  DEFAULT_WAIT_AFTER_MS,
  type ClickTarget,
  type Marker,
  type MarkerPatch
} from '@shared/types'

export class MarkerStore {
  private markers: Marker[] = []
  private serial = 0

  constructor(private readonly onChange: (markers: Marker[]) => void) {}

  list(): Marker[] {
    return [...this.markers]
  }

  add(target: ClickTarget): Marker {
    this.serial += 1
    const marker: Marker = {
      id: randomUUID(),
      label: `操作対象 ${this.serial}`,
      target,
      action: 'click',
      waitAfterMs: DEFAULT_WAIT_AFTER_MS
    }
    this.markers.push(marker)
    this.emit()
    return marker
  }

  update(id: string, patch: MarkerPatch): void {
    const index = this.markers.findIndex((m) => m.id === id)
    if (index === -1) return
    this.markers[index] = { ...this.markers[index], ...patch }
    this.emit()
  }

  updateTarget(id: string, target: ClickTarget): void {
    const index = this.markers.findIndex((m) => m.id === id)
    if (index === -1) return
    this.markers[index] = { ...this.markers[index], target }
    this.emit()
  }

  remove(id: string): void {
    const next = this.markers.filter((m) => m.id !== id)
    if (next.length === this.markers.length) return
    this.markers = next
    this.emit()
  }

  clear(): void {
    this.serial = 0
    if (this.markers.length === 0) return
    this.markers = []
    this.emit()
  }

  private emit(): void {
    this.onChange(this.list())
  }
}
