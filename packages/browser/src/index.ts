import { access } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { mountSessionMcp } from './session-mcp.js'
import { registerPreview } from './preview-http.js'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const name = 'dsh-background-browser'
export const inject = ['agents', 'tools', 'systemPrompt']

export interface Config {
  executablePath?: string
  toolCallTimeoutMs: number
}

export const Config: Schema<Config> = Schema.object({
  executablePath: Schema.string().pattern(/\S/u),
  toolCallTimeoutMs: Schema.number().min(1).default(60000),
})

const guidance = [
  'A managed background browser is available through mcp__playwright-mcp__ browser tools.',
  'For tasks that need web interaction, use these tools directly; the browser starts headlessly without a user opening a window.',
  'After navigation or page changes, call browser_snapshot without a filename for inline page content and fresh element references, then click or fill using those references.',
  'Keep related work in this session: tabs and login state persist across turns while the session is active.',
  'Other sessions have separate browser state. Restarting or restoring a session does not restore cookies or tabs.',
  'If the user needs to log in, ask them to take control in the browser sidebar, complete login, then return control and tell you to continue. Do not request their password in chat.',
  'Use normal user authorization rules for actions. If login, CAPTCHA, or another human step blocks progress, explain the specific blocker.',
].join('\n')

/** Use DSH's session lifecycle with Playwright's dedicated headless engine. */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const cli = fileURLToPath(new URL('cli.js', import.meta.resolve('@playwright/mcp/package.json')))
  const args = [cli, '--config', fileURLToPath(new URL('../playwright.config.json', import.meta.url)), '--headless']
  if (config.executablePath !== undefined) {
    if (!isAbsolute(config.executablePath)) {
      throw new Error('background-browser: executablePath must be an absolute path')
    }
    await access(config.executablePath)
  }
  // Mirror the official provider: inherited MCP options must not attach to a
  // user's browser, change headless mode, or import an unrelated profile.
  const env = Object.fromEntries(Object.keys(process.env)
    .filter(key => key.toUpperCase().startsWith('PLAYWRIGHT_MCP_'))
    .map(key => [key, '']))
  const sessions = mountSessionMcp(ctx, {
    name: 'playwright-mcp',
    command: process.execPath,
    args,
    // Desktop may clear this from its parent env while execPath still points
    // to Electron. Explicit MCP env is merged after the subprocess scrub.
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    toolCallTimeoutMs: config.toolCallTimeoutMs,
    executablePath: config.executablePath,
  })
  ctx.inject(['webServer'], webCtx => { registerPreview(webCtx, id => sessions.frame(id), (id, action) => sessions.action(id, action)) })
  ctx.systemPrompt.section({
    name: 'dshplugins:background-browser',
    order: ctx.systemPrompt.getSectionOrder('TOOLS_SDK') - 1,
    text: ({ agent }) => agent && ctx.tools.schemas(agent).some(tool => tool.name.startsWith('mcp__playwright-mcp__'))
      ? guidance
      : '',
  })
}
