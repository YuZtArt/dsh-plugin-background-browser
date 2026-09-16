export interface BrowserFrame {
  status: 'idle' | 'ready'
  tabs: { id: string; index: number; title: string; url: string }[]
  selected: number
  revision?: number
  agentBusy?: boolean
  image?: string
}

export type BrowserAction =
  | { type: 'click'; pageId: string; x: number; y: number }
  | { type: 'scroll'; pageId: string; dx: number; dy: number }
  | { type: 'text'; pageId: string; text: string }
  | { type: 'key'; pageId: string; key: string }
  | { type: 'tab' | 'back' | 'forward' | 'reload' | 'close'; pageId: string }
  | { type: 'new' }
  | { type: 'navigate'; pageId: string; url: string }

export function parseAction(value: unknown): BrowserAction {
  if (!value || typeof value !== 'object') throw new Error('Invalid action')
  const a = value as Record<string, unknown>
  if (a.type === 'new') return { type: 'new' }
  if (typeof a.pageId !== 'string') throw new Error('Missing pageId')
  if (a.type === 'navigate' && typeof a.url === 'string' && a.url.length <= 8192) {
    const url = new URL(a.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only HTTP and HTTPS URLs are supported')
    return { type: 'navigate', pageId: a.pageId, url: url.href }
  }
  if (a.type === 'tab' || a.type === 'back' || a.type === 'forward' || a.type === 'reload' || a.type === 'close') return { type: a.type, pageId: a.pageId }
  if (a.type === 'text' && typeof a.text === 'string' && a.text.length <= 10000) return { type: a.type, pageId: a.pageId, text: a.text }
  if (a.type === 'key' && typeof a.key === 'string' && ['Enter', 'Tab', 'Shift+Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'ControlOrMeta+A'].includes(a.key)) return { type: a.type, pageId: a.pageId, key: a.key }
  if (a.type === 'click' && typeof a.x === 'number' && typeof a.y === 'number' && a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1) return { type: a.type, pageId: a.pageId, x: a.x, y: a.y }
  if (a.type === 'scroll' && typeof a.dx === 'number' && typeof a.dy === 'number' && Number.isFinite(a.dx) && Number.isFinite(a.dy) && Math.abs(a.dx) <= 10000 && Math.abs(a.dy) <= 10000) return { type: a.type, pageId: a.pageId, dx: a.dx, dy: a.dy }
  throw new Error('Invalid action')
}
