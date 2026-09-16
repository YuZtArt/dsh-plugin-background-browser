export interface BrowserFrame {
  status: 'idle' | 'ready'
  tabs: { index: number; title: string; url: string }[]
  selected: number
  image?: string
}
