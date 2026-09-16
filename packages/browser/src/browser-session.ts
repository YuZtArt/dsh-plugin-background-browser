import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page, type BrowserContext } from 'playwright'

import type { BrowserAction, BrowserFrame } from './protocol.js'
export type { BrowserFrame } from './protocol.js'

export class BrowserSession {
  private pageIds = new WeakMap<Page, string>()
  private nextPage = 0
  private id(page: Page): string {
    if (!this.pageIds.has(page)) this.pageIds.set(page, String(++this.nextPage))
    return this.pageIds.get(page)!
  }
  private closed?: Promise<void>
  private framePending?: Promise<BrowserFrame>
  private constructor(readonly context: BrowserContext, readonly endpoint: string, private readonly directory: string) {}

  static async open(executablePath?: string): Promise<BrowserSession> {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-browser-'))
    let context: BrowserContext | undefined
    try {
      context = await chromium.launchPersistentContext(directory, {
        channel: 'chromium-headless-shell', headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'],
        viewport: { width: 1280, height: 800 },
      })
      const port = Number((await readFile(join(directory, 'DevToolsActivePort'), 'utf8')).split('\n')[0])
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Chromium debugging port')
      return new BrowserSession(context, `http://127.0.0.1:${port}`, directory)
    } catch (error) {
      await context?.close()
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  frame(): Promise<BrowserFrame> {
    return this.framePending ??= this.capture().finally(() => { this.framePending = undefined })
  }

  private async capture(): Promise<BrowserFrame> {
    const pages = this.context.pages().filter(page => !page.isClosed())
    if (!pages.length) return { status: 'idle', tabs: [], selected: -1 }
    const focused = await Promise.all(pages.map(page => page.evaluate(() => document.hasFocus()).catch(() => false)))
    const selected = focused.lastIndexOf(true) < 0 ? pages.length - 1 : focused.lastIndexOf(true)
    const tabs = await Promise.all(pages.map(async (page, index) => ({ id: this.id(page), index, title: await page.title(), url: page.url() })))
    const image = await pages[selected]!.screenshot({ type: 'jpeg', quality: 65, timeout: 5000 })
    return { status: 'ready', tabs, selected, image: `data:image/jpeg;base64,${image.toString('base64')}` }
  }

  async interact(action: Exclude<BrowserAction, { type: 'take' | 'release' }>): Promise<void> {
    const page = this.context.pages().find(page => this.id(page) === action.pageId && !page.isClosed())
    if (!page) throw new Error('Page is closed; refresh the browser panel')
    await page.bringToFront()
    if (action.type === 'click') {
      const viewport = page.viewportSize()!
      await page.mouse.click(Math.min(viewport.width - 1, action.x * viewport.width), Math.min(viewport.height - 1, action.y * viewport.height))
    } else if (action.type === 'scroll') {
      await page.mouse.wheel(action.dx, action.dy)
    } else if (action.type === 'text') {
      await page.keyboard.insertText(action.text)
    } else if (action.type === 'key') {
      await page.keyboard.press(action.key)
    }
  }

  close(): Promise<void> {
    return this.closed ??= (async () => {
      await this.context.close()
      await this.framePending?.catch(() => {})
      await rm(this.directory, { recursive: true, force: true })
    })()
  }
}
