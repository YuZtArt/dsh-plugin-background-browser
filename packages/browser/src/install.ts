#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('cli.js', import.meta.resolve('playwright/package.json')))
const result = spawnSync(process.execPath, [cli, 'install', 'chromium-headless-shell'], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
