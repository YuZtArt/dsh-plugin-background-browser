import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, mkdir, cp } from 'node:fs/promises'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import Llm, { ToolCallId } from '@deepseek-ai/dsh-llm'
import Sessions, { SessionId } from '@deepseek-ai/dsh-session'
import Agents from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import Projections from '@deepseek-ai/dsh-session-projection'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { chromium } from 'playwright'
import { build } from 'esbuild'

test('DSH tools drive a real background browser, isolate sessions and clean up', { timeout: 120000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-background-browser-'))
  // Mimic an installed plugin with its own scope module instance. A fresh
  // scope Symbol must never turn per-agent tools into global registrations.
  await mkdir(new URL('../.dsh/', import.meta.url), { recursive: true })
  const installed = await mkdtemp(fileURLToPath(new URL('../.dsh/installed-browser-', import.meta.url)))
  const originalSpawn = childProcess.spawn
  const mcpEnvironments = []
  const mcpCli = fileURLToPath(new URL('cli.js', import.meta.resolve('@playwright/mcp/package.json')))
  childProcess.spawn = function(command, args, options) {
    if (args?.includes(mcpCli)) mcpEnvironments.push(options.env)
    return originalSpawn.apply(this, arguments)
  }
  syncBuiltinESMExports()
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ url: req.url, cookie: req.headers.cookie ?? '' })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    if (req.url === '/login') {
      res.end('<!doctype html><title>Login</title><form action="/authenticated" method="post"><input type="password" name="password" aria-label="Password" style="position:absolute;left:100px;top:100px;width:200px;height:40px"><button style="position:absolute;left:100px;top:200px;width:200px;height:40px">Sign in</button></form>')
    } else if (req.url === '/authenticated') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        if (new URLSearchParams(body).get('password') === '测试-password') {
          res.setHeader('Set-Cookie', 'dsh_login=ok; SameSite=Lax; Path=/')
          res.end('<!doctype html><title>Signed in</title><body style="height:2400px"><h1>Signed in</h1></body>')
        } else { res.statusCode = 401; res.end('Wrong password') }
      })
    } else if (req.url === '/form') {
      res.setHeader('Set-Cookie', 'dsh_test=first; SameSite=Lax; Path=/')
      res.end('<!doctype html><title>Background browser test</title><form action="/submit"><label>Name <input name="name"></label><button>Submit</button></form>')
    } else if (req.url.startsWith('/submit')) {
      res.end('<!doctype html><title>Submitted</title><h1>Form received</h1>')
    } else {
      res.end('<!doctype html><title>Cookie state</title><h1>' + (req.headers.cookie ?? 'no-cookie') + '</h1>')
    }
  })
  const ctx = new Context()
  let first
  let second
  let child
  let browser
  let viewer
  try {
    for (const name of ['dist', 'package.json', 'playwright.config.json']) {
      await cp(new URL('../packages/browser/' + name, import.meta.url), join(installed, name), { recursive: true })
    }
    await cp(new URL('../node_modules/@deepseek-ai/dsh-scope/', import.meta.url), join(installed, 'node_modules/@deepseek-ai/dsh-scope'), { recursive: true })
    const Browser = await import(pathToFileURL(join(installed, 'dist/index.js')).href)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const url = 'http://127.0.0.1:' + server.address().port
    for (const plugin of [SystemPrompt, Tools, Llm, Sessions, Agents, Projections]) {
      await ctx.plugin(plugin).await()
    }
    await ctx.plugin(AgentLoop, { agents: [] }).await()
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 }).await()
    const previewOrigin = `http://127.0.0.1:${ctx.webServer.port}`
    const previewHeaders = { 'X-DSH-Browser-Preview': '1' }
    async function preview(sessionId, headers = previewHeaders) {
      return fetch(`${previewOrigin}/api/dsh-background-browser/frame?sessionId=${sessionId}`, { headers })
    }
    browser = ctx.plugin(Browser, {})
    await browser.await()
    assert.equal((await preview('absent', {})).status, 403)
    assert.equal((await preview('absent', { ...previewHeaders, Origin: 'https://untrusted.example' })).status, 403)
    assert.equal((await (await preview('absent')).json()).status, 'idle')
    first = await ctx.agents.create({ sessionId: SessionId('background-first'), meta: { cwd: root } })
    await first.agent.whenIdle()
    const prompt = await ctx.systemPrompt.assemble({ agent: first.agent, scope: first.agent })
    const tools = ctx.tools.schemas(first.agent).map(tool => tool.name)
    for (const name of ['browser_navigate', 'browser_snapshot', 'browser_type', 'browser_click', 'browser_tabs', 'browser_take_screenshot']) {
      assert.ok(tools.includes('mcp__playwright-mcp__' + name), name)
    }
    assert.ok(prompt.tools.some(tool => tool.name === 'mcp__playwright-mcp__browser_navigate'))
    assert.ok(prompt.sections.some(section => section.name === 'dshplugins:background-browser' && section.text.includes('headlessly')))
    assert.equal(ctx.tools.schemas().filter(tool => tool.name.startsWith('mcp__playwright-mcp__')).length, 0, 'browser tools must not leak into the global registry')
    let call = 0
    async function run(owner, name, args = {}) {
      const result = await ctx.tools.execute({
        agent: owner.agent, name: 'mcp__playwright-mcp__' + name, arguments: args,
        callId: ToolCallId('browser-test-' + ++call), signal: AbortSignal.timeout(30000),
      })
      assert.equal(result.isError, false, JSON.stringify(result.content))
      return result.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
    }
    await run(first, 'browser_navigate', { url: url + '/form' })
    const snapshot = await run(first, 'browser_snapshot')
    const frame = await (await preview('background-first')).json()
    assert.equal(frame.tabs[frame.selected].url, url + '/form')
    assert.ok(frame.image.startsWith('data:image/jpeg;base64,'))
    const textbox = snapshot.match(/textbox "Name" \[ref=(e\d+)\]/)
    assert.ok(textbox, snapshot)
    await run(first, 'browser_type', { target: textbox[1], text: 'DeepSeek' })
    const fresh = await run(first, 'browser_snapshot')
    const button = fresh.match(/button "Submit" \[ref=(e\d+)\]/)
    assert.ok(button, fresh)
    await run(first, 'browser_click', { target: button[1] })
    const result = await run(first, 'browser_snapshot')
    assert.match(result, /Form received/)
    assert.ok(requests.some(req => req.url === '/submit?name=DeepSeek' && req.cookie.includes('dsh_test=first')))
    const agent = await run(first, 'browser_evaluate', { function: '() => navigator.userAgent' })
    assert.match(agent, /HeadlessChrome/)
    const screenshot = join(root, 'browser.png')
    await run(first, 'browser_take_screenshot', { type: 'png', filename: screenshot })
    assert.equal((await readFile(screenshot)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a')

    const uiFixture = await build({
      stdin: { contents: `import React from 'react'; import * as jsx from 'react/jsx-runtime'; import {createRoot} from 'react-dom/client';
        window.__ModuleLoader__ = { load({factory}) {
          const plugin = factory(name => name === 'react' ? React : name === 'react/jsx-runtime' ? jsx : (()=>{throw new Error(name)})());
          const ctx = { effect: fn => fn(), sidebarRightTabs: {register: def => {window.browserTab = def; return ()=>{}}},
            slots: {inject: (name,fn) => fn(), register: (options,component) => {window.renderPanel = component; return ()=>{}}} };
          plugin.apply(ctx);
          const root = createRoot(document.getElementById('root'));
          window.showSession = sessionId => root.render(React.createElement(window.renderPanel, {browserSessionId: sessionId}));
          window.showSession('background-first');
        }};`, resolveDir: process.cwd(), loader: 'js' },
      bundle: true, write: false, platform: 'browser', format: 'iife',
      define: { 'process.env.NODE_ENV': '"production"' },
    })
    const clientBundle = await readFile(new URL('../packages/browser/dist/client.cjs', import.meta.url), 'utf8')
    ctx.webServer.register({ kind: 'exact', path: '/preview-test', handler(_req, res) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<!doctype html><style>html,body,#root{height:100%;margin:0}button{cursor:pointer;border:1px solid #ffffff30;background:#ffffff12;color:inherit;border-radius:6px;padding:4px 8px}</style><div id="root"></div><script>' + uiFixture.outputFiles[0].text + '</script><script>' + clientBundle + '</script>')
    } })
    viewer = await chromium.launch({ headless: true })
    const ui = await viewer.newPage({ viewport: { width: 460, height: 760 } })
    const errors = []
    ui.on('pageerror', error => errors.push(error.message))
    await ui.goto(previewOrigin + '/preview-test')
    await ui.getByRole('img', { name: '网页预览：Submitted' }).waitFor()
    assert.equal(await ui.evaluate(() => window.browserTab.kind), 'dsh-background-browser')
    await mkdir(new URL('../.dsh/', import.meta.url), { recursive: true })
    await ui.screenshot({ path: new URL('../.dsh/browser-panel-preview.png', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '') })
    await ui.getByRole('button', { name: '暂停预览' }).click()
    await ui.getByRole('button', { name: '继续预览' }).click()
    await run(first, 'browser_navigate', { url: url + '/login' })
    await ui.getByRole('img', { name: '网页预览：Login', exact: true }).waitFor()
    async function uiAction(action) {
      const response = ui.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/api/dsh-background-browser/frame'))
      await action()
      assert.equal((await response).status(), 200)
    }
    await uiAction(() => ui.getByRole('button', { name: '接管浏览器', exact: true }).click())
    await ui.getByRole('button', { name: '交还助手', exact: true }).waitFor()
    await ui.screenshot({ path: fileURLToPath(new URL('../.dsh/browser-manual-control.png', import.meta.url)) })
    const blocked = await ctx.tools.execute({ agent: first.agent, name: 'mcp__playwright-mcp__browser_navigate', arguments: { url: url + '/inspect' }, callId: ToolCallId('blocked-manual'), signal: AbortSignal.timeout(30000) }).catch(error => ({ message: error.message }))
    assert.match(JSON.stringify(blocked), /User is controlling the browser/)
    async function imageClick(x, y) {
      const picture = ui.getByRole('img')
      const box = await picture.boundingBox()
      await uiAction(() => picture.click({ position: { x: box.width * x / 1280, y: box.height * y / 800 } }))
    }
    await imageClick(150, 120)
    await ui.getByLabel('输入到网页').fill('wrong')
    await uiAction(() => ui.getByRole('button', { name: '输入', exact: true }).click())
    await imageClick(150, 120)
    await uiAction(() => ui.getByRole('img').press('Control+a'))
    await ui.getByLabel('输入到网页').fill('测试-password')
    await uiAction(() => ui.getByRole('button', { name: '输入', exact: true }).click())
    assert.equal(await ui.getByLabel('输入到网页').inputValue(), '')
    await imageClick(150, 220)
    await ui.getByRole('img', { name: '网页预览：Signed in', exact: true }).waitFor()
    await uiAction(() => ui.getByRole('img').dispatchEvent('wheel', { deltaX: 0, deltaY: 400 }))
    await uiAction(() => ui.getByRole('button', { name: '交还助手', exact: true }).click())
    await ui.getByRole('button', { name: '接管浏览器', exact: true }).waitFor()
    assert.match(await run(first, 'browser_snapshot'), /Signed in/)
    assert.match(await run(first, 'browser_evaluate', { function: '() => window.scrollY > 0' }), /true/)
    await run(first, 'browser_navigate', { url: url + '/inspect' })
    assert.match(await run(first, 'browser_snapshot'), /dsh_login=ok/)
    const rejectedInput = await fetch(`${previewOrigin}/api/dsh-background-browser/frame?sessionId=background-first`, {
      method: 'POST', headers: { ...previewHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'text', pageId: '1', text: 'should not type' }),
    })
    assert.equal(rejectedInput.status, 503)
    await ui.evaluate(() => window.showSession('unrelated-session'))
    await ui.getByText('让助手打开网页后，画面会显示在这里。').waitFor()
    assert.equal(await ui.getByRole('img').count(), 0)
    assert.deepEqual(errors, [])
    second = await ctx.agents.create({ sessionId: SessionId('background-second'), meta: { cwd: root } })
    child = await ctx.agents.create({ sessionId: SessionId('background-child'), parentAgent: first.agent, meta: { cwd: root } })
    await second.agent.whenIdle()
    await child.agent.whenIdle()
    const prompts = await Promise.all([second, child].map(owner => ctx.systemPrompt.assemble({ agent: owner.agent, scope: owner.agent })))
    for (const assembled of prompts) assert.ok(assembled.tools.some(tool => tool.name === 'mcp__playwright-mcp__browser_navigate'))
    assert.equal(mcpEnvironments.length, 3)
    for (const env of mcpEnvironments) assert.equal(env.ELECTRON_RUN_AS_NODE, '1')
    assert.equal(ctx.tools.schemas().filter(tool => tool.name.startsWith('mcp__playwright-mcp__')).length, 0)
    await run(child, 'browser_navigate', { url: url + '/inspect' })
    assert.match(await run(child, 'browser_snapshot'), /no-cookie/)
    await child.dispose()
    await run(second, 'browser_navigate', { url: url + '/inspect' })
    assert.match(await run(second, 'browser_snapshot'), /no-cookie/)
    await run(first, 'browser_navigate', { url: url + '/inspect' })
    assert.match(await run(first, 'browser_snapshot'), /dsh_test=first/)
    await first.dispose()
    assert.equal((await (await preview('background-first')).json()).status, 'idle')
    assert.equal(ctx.tools.schemas(first.agent).filter(tool => tool.name.startsWith('mcp__playwright-mcp__')).length, 0)
    assert.match(await run(second, 'browser_snapshot'), /no-cookie/)
    await browser.dispose()
    assert.notEqual((await preview('background-second')).status, 200)
    assert.equal(ctx.tools.schemas(second.agent).filter(tool => tool.name.startsWith('mcp__playwright-mcp__')).length, 0)
    await second.dispose()
    assert.ok(!(await ctx.systemPrompt.assemble()).sections.some(section => section.name === 'dshplugins:background-browser'))
  } finally {
    childProcess.spawn = originalSpawn
    syncBuiltinESMExports()
    await viewer?.close()
    await ctx.fiber.dispose()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
    await rm(installed, { recursive: true, force: true })
  }
})
