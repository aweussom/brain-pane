export type BrainItem = {
  bucket: string
  id: string
  cost: string
  slug: string
  ageDays: number | null
}

export type BrainSnapshot = {
  scannedAt: number
  statusDate: string
  statusHeadline: string
  proposedCount: number
  items: BrainItem[]
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    'brain-pane': { snapshot: BrainSnapshot }
  }
}
