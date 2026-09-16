import { Service, type Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-plugin-starter'

export interface Config {
  greeting: string
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    dshStarter: StarterService
  }
}

export class StarterService extends Service {
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'dshStarter')
  }

  greet(who: string): string {
    return `${this.config.greeting}, ${who}!`
  }
}

export function apply(ctx: Context, config: Config): void {
  ctx.plugin(StarterService, config)
}
