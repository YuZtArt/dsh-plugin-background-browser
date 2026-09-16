/** Serial browser actions, with agent calls ahead of waiting user input. */
export class InteractionQueue {
  private agent: (() => Promise<void>)[] = []
  private user: (() => Promise<void>)[] = []
  private running = false
  private waiters: (() => void)[] = []

  run<T>(owner: 'agent' | 'user', action: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this[owner].push(async () => { try { resolve(await action()) } catch (error) { reject(error) } })
      void this.drain()
    })
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      let action
      while ((action = this.agent.shift() ?? this.user.shift())) await action()
    } finally {
      this.running = false
      for (const resolve of this.waiters.splice(0)) resolve()
    }
  }

  idle(): Promise<void> {
    return this.running ? new Promise(resolve => this.waiters.push(resolve)) : Promise.resolve()
  }
}
