import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { parse } from 'yaml'
import * as starter from 'dsh-plugin-starter'

test('real Cordis activation, configuration and service cleanup', async () => {
  const ctx = new Context()
  const fiber = ctx.plugin(starter, { greeting: '你好' })
  try {
    await fiber.await()
    assert.equal(ctx.dshStarter.greet('DeepSeek'), '你好, DeepSeek!')
  } finally {
    await fiber.dispose()
  }
  assert.equal(ctx.get('dshStarter'), undefined)
})

test('Cordis applies schema defaults', async () => {
  const ctx = new Context()
  const fiber = ctx.plugin(starter, {})
  try {
    await fiber.await()
    assert.equal(ctx.dshStarter.greet('world'), 'Hello, world!')
  } finally {
    await fiber.dispose()
  }
})

test('bundle manifest resolves the shipped plugin entry', async () => {
  const root = new URL('../packages/starter/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
  const patch = parse(await readFile(new URL(manifest.dsh.bundle.patch, root), 'utf8'))
  const row = patch[0].insert[0]
  assert.equal(row.name, manifest.name)
  const plugin = await import(row.name)
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(plugin.Config(row.config).greeting, 'Hello')
})
