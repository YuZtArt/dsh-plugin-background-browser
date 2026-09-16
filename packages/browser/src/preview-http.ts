import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { BrowserFrame, BrowserAction } from './protocol.js'
import { parseAction } from './protocol.js'

export const previewPath = '/api/dsh-background-browser/frame'

export function registerPreview(ctx: Context, frame: (sessionId: string) => Promise<BrowserFrame>, action: (sessionId: string, action: BrowserAction, revision: number) => Promise<void>): void {
  ctx.webServer.register({
    kind: 'exact', path: previewPath,
    async handler(req, res) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'application/json')
      const host = req.headers.host
      const allowedHosts = [`127.0.0.1:${ctx.webServer.port}`, `localhost:${ctx.webServer.port}`]
      if (!host || !allowedHosts.includes(host) || req.headers['x-dsh-browser-preview'] !== '1'
        || (req.headers.origin && req.headers.origin !== `http://${host}`)
        || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
        res.writeHead(403).end(JSON.stringify({ error: 'Same-origin preview request required' }))
        return
      }
      if (req.method !== 'GET' && req.method !== 'POST') { res.writeHead(405).end(); return }
      const sessionId = new URL(req.url!, `http://${host}`).searchParams.get('sessionId')
      if (!sessionId) { res.writeHead(400).end(JSON.stringify({ error: 'Missing sessionId' })); return }
      try {
        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk))
            size += chunk.length
            if (size > 65536) { res.writeHead(413).end(); return }
          }
          let input: BrowserAction
          let revision: number
          try {
            const request = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            input = parseAction(request.action)
            revision = request.revision
            if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision')
          } catch { res.writeHead(400).end(JSON.stringify({ error: 'Invalid browser action' })); return }
          await action(sessionId, input, revision)
          res.end(JSON.stringify({ ok: true }))
          return
        }
        res.end(JSON.stringify(await frame(sessionId)))
      } catch (error) {
        res.writeHead(503).end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
    },
  })
}
