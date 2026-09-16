import { useEffect, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { BrowserFrame } from '../protocol.js'

export const inject = ['slots', 'sidebarRightTabs']
const id = 'dsh-background-browser'

export function BrowserPanel({ browserSessionId }: { browserSessionId: string }) {
  const [frame, setFrame] = useState<BrowserFrame>()
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => { setFrame(undefined); setError('') }, [browserSessionId])
  useEffect(() => {
    if (paused) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        if (document.visibilityState !== 'hidden') {
          const response = await fetch(`/api/dsh-background-browser/frame?sessionId=${encodeURIComponent(browserSessionId)}`, {
            headers: { 'X-DSH-Browser-Preview': '1' }, signal: controller.signal, cache: 'no-store',
          })
          const value = await response.json()
          if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`)
          if (!controller.signal.aborted) { setFrame(value); setError('') }
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 750)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [browserSessionId, paused, refresh])
  const active = frame?.tabs.find(tab => tab.index === frame.selected)
  return <section style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #17191e)', color: 'var(--text-primary, #e5e7eb)', font: '13px system-ui' }} aria-label="后台浏览器">
    <header style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, borderBottom: '1px solid #ffffff20' }}>
      <span style={{ color: paused ? '#a1a1aa' : '#4ade80' }}>●</span>
      <strong style={{ flex: 1 }}>浏览器 · {paused ? '预览已暂停' : '实时预览'}</strong>
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={paused} title="刷新画面">刷新</button>
      <button type="button" onClick={() => setPaused(value => !value)}>{paused ? '继续预览' : '暂停预览'}</button>
    </header>
    <div style={{ padding: '9px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #ffffff20' }} title={active?.url}>
      {active?.url ?? '等待当前会话使用浏览器'}
    </div>
    {!!frame?.tabs.length && <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px' }}>
      {frame.tabs.map(tab => <span key={tab.index} title={tab.url} style={{ padding: '5px 9px', borderRadius: 6, whiteSpace: 'nowrap', background: tab.index === frame.selected ? '#2563eb' : '#ffffff12' }}>{tab.title || '新标签页'}</span>)}
    </div>}
    {error && <div role="alert" style={{ padding: 12, color: '#fca5a5' }}>画面暂不可用：{error}</div>}
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', alignContent: 'start' }}>
      {frame?.image ? <img src={frame.image} alt={active?.title ? `网页预览：${active.title}` : '当前网页预览'} style={{ width: '100%', display: 'block' }} />
        : <div style={{ padding: '48px 24px', textAlign: 'center', color: '#a1a1aa', lineHeight: 1.8 }}>让助手打开网页后，画面会显示在这里。<br />关闭此面板不会关闭后台浏览器。</div>}
    </div>
    <footer style={{ padding: '8px 12px', color: '#a1a1aa', borderTop: '1px solid #ffffff20', fontSize: 11 }}>跟随当前会话 · 仅查看，网页仍由助手操作</footer>
  </section>
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id, kind: id, title: () => '浏览器',
    guide: [{ order: 30, title: () => '浏览器', description: () => '查看助手正在操作的网页' }],
  }))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: id,
    inject: browserSessionId => ({ browserSessionId }),
  }, BrowserPanel)))
}
