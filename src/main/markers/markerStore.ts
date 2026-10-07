import { randomUUID } from 'crypto'
import {
  DEFAULT_WAIT_AFTER_MS,
  type ActionItemType,
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

  add(target?: ClickTarget, itemType?: ActionItemType): Marker {
    this.serial += 1
    const type = itemType ?? 'click'
    const marker: Marker = {
      id: randomUUID(),
      label: `操作対象 ${this.serial}`,
      target: target as ClickTarget,
      action: 'click',
      waitAfterMs: DEFAULT_WAIT_AFTER_MS,
      itemType: type
    }
    if (type === 'text') {
      marker.text = ''
    } else if (type === 'hotkey') {
      marker.keys = []
    } else if (type === 'delay') {
      marker.delayMs = 1000
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

  reorder(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= this.markers.length ||
      toIndex >= this.markers.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const [item] = this.markers.splice(fromIndex, 1)
    this.markers.splice(toIndex, 0, item)
    this.emit()
  }

  private emit(): void {
    this.onChange(this.list())
  }
}
