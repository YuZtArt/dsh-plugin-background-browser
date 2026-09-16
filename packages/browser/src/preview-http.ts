import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { BrowserFrame } from './browser-session.js'

export const previewPath = '/api/dsh-background-browser/frame'

export function registerPreview(ctx: Context, frame: (sessionId: string) => Promise<BrowserFrame>): void {
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
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      const sessionId = new URL(req.url!, `http://${host}`).searchParams.get('sessionId')
      if (!sessionId) { res.writeHead(400).end(JSON.stringify({ error: 'Missing sessionId' })); return }
      try {
        res.end(JSON.stringify(await frame(sessionId)))
      } catch (error) {
        res.writeHead(503).end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
    },
  })
}
