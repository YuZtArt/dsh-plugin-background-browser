import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createRequire } from 'node:module'
import { parse } from 'yaml'
import * as Browser from 'dsh-plugin-background-browser'

test('desktop client discovery can resolve the package manifest through public exports', async () => {
  // rc.2 client-modules uses this fallback when loader.internal.resolveSync
  // is unavailable; an unexported manifest silently hides the client half.
  const require = createRequire(import.meta.url)
  const path = require.resolve('dsh-plugin-background-browser/package.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(manifest.name, 'dsh-plugin-background-browser')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'))
  const bundle = await readFile(require.resolve('dsh-plugin-background-browser/client'), 'utf8')
  assert.match(bundle, /window\.__ModuleLoader__\.load/)
})

test('browser bundle ships a loadable plugin and dedicated headless configuration', async () => {
  const root = new URL('../packages/browser/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
  const patch = parse(await readFile(new URL(manifest.dsh.bundle.patch, root), 'utf8'))
  for (const row of patch[0].insert) {
    const plugin = await import(row.name)
    assert.ok(typeof plugin.apply === 'function' || typeof plugin.default === 'function')
  }
  const runtime = JSON.parse(await readFile(new URL('playwright.config.json', root), 'utf8'))
  assert.equal(runtime.browser.launchOptions.headless, true)
  assert.equal(runtime.browser.launchOptions.channel, 'chromium-headless-shell')
  assert.equal(runtime.browser.isolated, true)
  assert.ok(manifest.files.includes('playwright.config.json'))
  await readFile(new URL(manifest.bin['dsh-browser-install'], root))
})

test('bad browser executable configuration fails before acquiring DSH resources', async () => {
  await assert.rejects(Browser.apply({}, Browser.Config({ executablePath: 'relative/chrome.exe' })), /absolute path/)
  await assert.rejects(Browser.apply({}, Browser.Config({ executablePath: new URL('./not-installed/chrome.exe', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '') })), /ENOENT/)
})
