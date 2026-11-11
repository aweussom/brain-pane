export type BrainItem = {
  bucket: string
  id: string
  cost: string
  slug: string
  path: string
  ageDays: number | null
}

export type BrainSnapshot = {
  scannedAt: number
  cwd: string
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
