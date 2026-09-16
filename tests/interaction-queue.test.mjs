import assert from 'node:assert/strict'
import test from 'node:test'
import { InteractionQueue } from '../packages/browser/dist/interaction-queue.js'

test('AI overtakes waiting user input without interrupting an active action', async () => {
  const queue = new InteractionQueue()
  const order = []
  let finish
  const active = queue.run('user', async () => {
    order.push('user started')
    await new Promise(resolve => { finish = resolve })
    order.push('user finished')
  })
  const waiting = queue.run('user', async () => { order.push('waiting user') })
  const agent = queue.run('agent', async () => { order.push('agent') })
  finish()
  await Promise.all([active, waiting, agent, queue.idle()])
  assert.deepEqual(order, ['user started', 'user finished', 'agent', 'waiting user'])
})

test('a failed action does not block later shared browser input', async () => {
  const queue = new InteractionQueue()
  const failed = queue.run('agent', async () => { throw new Error('cancelled') })
  const user = queue.run('user', async () => 'typed')
  await assert.rejects(failed, /cancelled/)
  assert.equal(await user, 'typed')
  await queue.idle()
})
