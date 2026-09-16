import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { BrowserSession, type BrowserFrame } from './browser-session.js'

interface Options {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  toolCallTimeoutMs: number
  executablePath?: string
}

interface Connection {
  scope: { ctx: Context; dispose(): Promise<unknown> }
  ready: Promise<void>
  initialized: boolean
  tail: Promise<void>
  controller: AbortController
  close: () => Promise<void>
  browser?: BrowserSession
}

/** rc.2 emits agent/created synchronously; gate prompt assembly instead. */
export function mountSessionMcp(ctx: Context, options: Options): { frame(sessionId: string): Promise<BrowserFrame> } {
  const connections = new Map<Agent, Connection>()
  const prefix = `mcp__${options.name}__`
  let stopping = false

  function connectionFor(agent: Agent): Connection {
    if (stopping || ctx.agents.get(agent.id) !== agent) throw new Error('background-browser: session is not active')
    const existing = connections.get(agent)
    if (existing) return existing
    // Inherit the host's scope tag. Minting one with our own dsh-scope copy
    // can use a different Symbol under pnpm and register tools globally.
    const scope = agent.ctx.plugin(() => {})
    const controller = new AbortController()
    let closing: Promise<void> | undefined
    const entry: Connection = {
      scope, controller, initialized: false, tail: Promise.resolve(), ready: Promise.resolve(),
      close() {
        return closing ??= (async () => {
          controller.abort(new Error('background-browser: session closed'))
          await scope.dispose()
          await entry.ready.catch(() => {})
          await entry.tail
          await entry.browser?.close()
          connections.delete(agent)
        })()
      },
    }
    connections.set(agent, entry)
    agent.ctx.effect(() => entry.close, 'background-browser.session')
    entry.ready = (async () => {
      try {
        entry.browser = await BrowserSession.open(options.executablePath)
        controller.signal.throwIfAborted()
        await scope.ctx.plugin(McpClient, McpClient.Config({
          transport: 'stdio', serverName: options.name,
          command: options.command, args: [...options.args, '--cdp-endpoint', entry.browser.endpoint], env: options.env,
          cwd: agent.session.header.cwd ?? process.cwd(),
          toolCallTimeoutMs: options.toolCallTimeoutMs,
          failOnStartupError: true, reconnect: { enabled: false },
        })).await()
        controller.signal.throwIfAborted()
        entry.initialized = true
      } catch (error) {
        await scope.dispose()
        await entry.browser?.close()
        throw error
      }
    })()
    return entry
  }

  ctx.effect(() => async () => {
    stopping = true
    await Promise.all([...connections.values()].map(entry => entry.close()))
  }, 'background-browser.connections')

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    if (!context.agent) return next()
    const entry = connectionFor(context.agent)
    if (entry.initialized) return next()
    await entry.ready
    context.signal?.throwIfAborted()
    // The original assembly predates MCP registration. Reassemble once so
    // the first model request includes the newly discovered tools and guidance.
    return ctx.systemPrompt.assemble(context)
  }, { prepend: true })

  ctx.on('tools/execute', async (exec, next) => {
    const resource = ['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource'].includes(exec.name)
      && typeof exec.arguments === 'object' && exec.arguments !== null
      && (exec.arguments as { server?: unknown }).server === options.name
    if (!exec.name.startsWith(prefix) && !resource) return next()
    const entry = exec.agent && connections.get(exec.agent)
    if (!entry || !entry.initialized || stopping) throw new Error('background-browser: tool belongs to another session')
    const original = exec.signal
    const signal = AbortSignal.any([original, entry.controller.signal])
    const task = entry.tail.then(async () => {
      signal.throwIfAborted()
      exec.signal = signal
      try { return await next() } finally { exec.signal = original }
    })
    entry.tail = task.then(() => {}, () => {})
    return task
  })
  return {
    async frame(sessionId) {
      const entry = [...connections].find(([agent]) => agent.session.id === sessionId)?.[1]
      if (!entry?.initialized || stopping || entry.controller.signal.aborted) return { status: 'idle', tabs: [], selected: -1 }
      return entry.browser!.frame()
    },
  }
}
