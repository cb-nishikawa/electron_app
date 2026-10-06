import type { LiveLensApi } from '../shared/types'

declare global {
  interface Window {
    liveLens: LiveLensApi
  }
}
