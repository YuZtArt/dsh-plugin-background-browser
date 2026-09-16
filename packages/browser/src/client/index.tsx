import { useEffect, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { BrowserAction, BrowserFrame } from '../protocol.js'
import { styles } from './style.js'

export const inject = ['slots', 'sidebarRightTabs']
const id = 'dsh-background-browser'
const paths = {
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  back: 'm14 6-6 6 6 6M8 12h12', forward: 'm10 6 6 6-6 6M4 12h12',
  reload: 'M20 7v5h-5M20 12a8 8 0 1 0-2 5M20 7v5',
  close: 'm6 6 12 12M6 18 18 6', plus: 'M12 5v14M5 12h14',
  arrow: 'M7 17 17 7M7 7h10v10', more: 'M5 12h.01M12 12h.01M19 12h.01',
  keyboard: 'M3 6h18v12H3zM6 9h1m3 0h1m3 0h1m3 0h.01M6 12h1m3 0h1m3 0h1m3 0h.01M7 15h10',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  pause: 'M8 5v14M16 5v14', play: 'm8 5 11 7-11 7z',
  fit: 'M3 8V3h5m8 0h5v5M3 16v5h5m13-5v5h-5M8 12h8',
} as const
function Icon({ name }: { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

export function BrowserPanel({ browserSessionId }: { browserSessionId: string }) {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(0)
  const [frame, setFrame] = useState<BrowserFrame>()
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [menu, setMenu] = useState(false)
  const [inputOpen, setInputOpen] = useState(false)
  const [originalSize, setOriginalSize] = useState(false)
  const [address, setAddress] = useState('')
  const [editingAddress, setEditingAddress] = useState(false)
  const tail = useRef(Promise.resolve())
  const session = useRef(browserSessionId)
  const panel = useRef<HTMLElement>(null)
  session.current = browserSessionId
  const active = frame?.tabs.find(tab => tab.index === frame.selected)
  const blank = !active || active.url === 'about:blank'
  const ready = frame?.status === 'ready'
  const interactive = ready && !paused
  useEffect(() => {
    setFrame(undefined); setError(''); setInput(''); setInputOpen(false); setMenu(false); setAddress(''); setEditingAddress(false); setPaused(false)
  }, [browserSessionId])
  useEffect(() => { if (!editingAddress) setAddress(active?.url === 'about:blank' ? '' : active?.url ?? '') }, [active?.url, editingAddress])
  useEffect(() => { if (!interactive) { setInputOpen(false); setInput('') } }, [interactive])
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
          if (!controller.signal.aborted) { setFrame(value) }
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
  function send(action: BrowserAction) {
    const owner = browserSessionId
    const revision = frame?.revision
    setPending(n => n + 1)
    tail.current = tail.current.then(async () => {
      if (session.current !== owner) return
      const response = await fetch(`/api/dsh-background-browser/frame?sessionId=${encodeURIComponent(owner)}`, {
        method: 'POST', headers: { 'X-DSH-Browser-Preview': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ action, revision }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
      if (session.current === owner) { setError(''); setRefresh(n => n + 1) }
    }).catch(error => { if (session.current === owner) setError(error.message) }).finally(() => setPending(n => n - 1))
  }
  const pageAction = (type: 'back' | 'forward' | 'reload') => { if (active) send({ type, pageId: active.id }) }
  function navigate() {
    if (!active || !address.trim()) return
    const value = address.trim()
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/]+:\d+(?:\/|$)/.test(value) ? value : `https://${value}`)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('请输入 http 或 https 网址')
      send({ type: 'navigate', pageId: active.id, url: url.href })
      setEditingAddress(false)
    } catch { setError('请输入有效的网址，例如 https://example.com') }
  }
  return <section ref={panel} className="dsh-browser" aria-label="后台浏览器" onKeyDown={event => { if (event.key === 'Escape' && (menu || inputOpen)) { setMenu(false); setInputOpen(false); setInput(''); event.stopPropagation() } }}>
    <style>{styles}</style>
    <div className="bb-tabs">
      <div className="bb-tablist" role="tablist" aria-label="网页标签页">
        {frame?.tabs.length ? frame.tabs.map(tab => <div className={`bb-tab ${tab.index === frame.selected ? 'is-active' : ''}`} key={tab.id}>
          <button className="bb-tab-select" role="tab" aria-selected={tab.index === frame.selected} disabled={!interactive} title={tab.url} onClick={() => { setInputOpen(false); send({ type: 'tab', pageId: tab.id }) }}><Icon name="globe" /><span>{tab.title || '新标签页'}</span></button>
          <button className="bb-icon" title="关闭标签页" aria-label={`关闭标签页：${tab.title || '新标签页'}`} disabled={!interactive || pending > 0} onClick={() => send({ type: 'close', pageId: tab.id })}><Icon name="close" /></button>
        </div>) : <div className="bb-tab is-active"><span className="bb-tab-select"><Icon name="globe" /><span>新标签页</span></span></div>}
      </div>
      <button className="bb-icon" title="新建标签页" aria-label="新建标签页" disabled={!interactive || pending > 0} onClick={() => send({ type: 'new' })}><Icon name="plus" /></button>
      <span className="bb-tabs-spacer" />
    </div>
    <div className="bb-toolbar">
      <button className="bb-icon" title="后退" aria-label="后退" disabled={!interactive || !active || pending > 0} onClick={() => pageAction('back')}><Icon name="back" /></button>
      <button className="bb-icon" title="前进" aria-label="前进" disabled={!interactive || !active || pending > 0} onClick={() => pageAction('forward')}><Icon name="forward" /></button>
      <button className="bb-icon" title={interactive ? '重新加载网页' : '刷新画面'} aria-label={interactive ? '重新加载网页' : '刷新画面'} disabled={interactive && (!active || pending > 0)} onClick={() => { if (interactive) pageAction('reload'); else { setPaused(false); setRefresh(n => n + 1) } }}><Icon name="reload" /></button>
      <form className="bb-address" onSubmit={event => { event.preventDefault(); navigate() }}>
        <Icon name="globe" />
        <input aria-label="网址" title="输入网址并按回车" placeholder="输入网址" value={address} readOnly={!interactive || !active} onFocus={event => { setEditingAddress(true); event.currentTarget.select() }} onBlur={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.parentElement?.contains(event.relatedTarget)) setEditingAddress(false) }} onChange={event => setAddress(event.target.value)} />
        {interactive && <button className="bb-icon" type="submit" aria-label="打开网址" title="打开网址" disabled={!active || !address.trim() || pending > 0}><Icon name="arrow" /></button>}
      </form>
      {interactive && <button className="bb-icon" title="输入文本或密码" aria-label="输入文本或密码" aria-expanded={inputOpen} onClick={() => { setInputOpen(v => !v); setMenu(false); setInput('') }}><Icon name="keyboard" /></button>}
      <button className="bb-icon" title="更多选项" aria-label="更多选项" aria-expanded={menu} onClick={() => { setMenu(v => !v); setInputOpen(false); setInput('') }}><Icon name="more" /></button>
    </div>
    {menu && <div className="bb-menu" aria-label="浏览器选项">
      <button onClick={() => { setPaused(v => !v); setMenu(false) }}><Icon name={paused ? 'play' : 'pause'} />{paused ? '继续预览' : '暂停预览'}</button>
      <button onClick={() => { setOriginalSize(v => !v); setMenu(false) }}><Icon name="fit" />{originalSize ? '适应面板宽度' : '网页原始大小'}</button>
      <button onClick={() => { setMenu(false); const operation = document.fullscreenElement ? document.exitFullscreen() : panel.current?.requestFullscreen(); void operation?.catch(() => setError('当前宿主不支持全屏，请拖宽侧栏查看')) }}><Icon name="expand" />全屏查看</button>
    </div>}
    {interactive && inputOpen && <form className="bb-input-panel" onSubmit={event => { event.preventDefault(); if (active && input) { send({ type: 'text', pageId: active.id, text: input }); setInput('') } }}>
      <div className="bb-input-heading">输入到网页<button type="button" className="bb-icon" aria-label="关闭输入面板" onClick={() => { setInputOpen(false); setInput('') }}><Icon name="close" /></button></div>
      <p>先点击网页输入框，再输入或粘贴内容。<br />内容只发送到网页，不会进入聊天。</p>
      <div className="bb-input-row"><input type="password" autoComplete="off" aria-label="输入到网页" placeholder="支持中文、账号和密码" value={input} onChange={event => setInput(event.target.value)} /><button type="submit" disabled={!input || !active}>输入</button></div>
      <div className="bb-input-actions"><button type="button" disabled={!active} onClick={() => active && send({ type: 'key', pageId: active.id, key: 'Tab' })}>下一项 ⇥</button><button type="button" disabled={!active} onClick={() => active && send({ type: 'key', pageId: active.id, key: 'Enter' })}>回车 ↵</button></div>
    </form>}
    {error && <div className="bb-error" role="alert"><span>{error}</span><button className="bb-icon" aria-label="关闭提示" onClick={() => setError('')}><Icon name="close" /></button></div>}
    <div className={`bb-canvas ${interactive ? 'is-interactive' : ''} ${originalSize ? 'is-original' : ''}`}>
      {frame?.image && !blank ? <img src={frame.image} alt={active?.title ? `网页预览：${active.title}` : '当前网页预览'} draggable={false} tabIndex={interactive ? 0 : -1}
        onClick={event => { if (!interactive || !active) return; setInputOpen(false); setInput(''); setMenu(false); event.currentTarget.focus(); const r = event.currentTarget.getBoundingClientRect(); send({ type: 'click', pageId: active.id, x: (event.clientX - r.left) / r.width, y: (event.clientY - r.top) / r.height }) }}
        onWheel={event => { if (interactive && active) send({ type: 'scroll', pageId: active.id, dx: Math.max(-10000, Math.min(10000, event.deltaX)), dy: Math.max(-10000, Math.min(10000, event.deltaY)) }) }}
        onPaste={event => { if (interactive && active) { event.preventDefault(); send({ type: 'text', pageId: active.id, text: event.clipboardData.getData('text') }) } }}
        onKeyDown={event => {
          if (!interactive || !active || event.nativeEvent.isComposing) return
          let key = event.key
          if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'a') key = 'ControlOrMeta+A'
          else if (event.ctrlKey || event.metaKey || event.altKey) return
          else if (key === 'Tab' && event.shiftKey) key = 'Shift+Tab'
          if (['Enter', 'Tab', 'Shift+Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'ControlOrMeta+A'].includes(key)) { event.preventDefault(); send({ type: 'key', pageId: active.id, key }) }
          else if (key.length === 1) { event.preventDefault(); send({ type: 'text', pageId: active.id, text: key }) }
        }} /> : <div className="bb-empty"><Icon name="globe" /><strong>{ready ? '开始浏览' : '等待浏览'}</strong><p>{ready ? '输入网址，开始浏览网页。' : '让助手打开网页后，画面会显示在这里。'}</p></div>}
    </div>
    <footer className="bb-status"><span className="bb-status-label"><i className={`bb-dot ${ready && !paused ? 'is-live' : ''}`} />{frame?.agentBusy ? 'AI 正在操作' : pending ? '正在操作' : paused ? '预览已暂停' : ready ? '共享浏览' : '等待助手'}</span><span className="bb-status-hint">可直接操作 · AI 优先</span></footer>
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
