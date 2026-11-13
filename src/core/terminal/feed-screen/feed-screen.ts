import type { TerminalState, XtermTerminal } from '../state.ts'

export type FeedScreenInput = { name: string; chunk: string }

export type FeedScreenDeps = {
  xtermHeadless: {
    Terminal: new (options: {
      cols: number
      rows: number
      scrollback: number
      allowProposedApi: boolean
    }) => XtermTerminal
  }
}

export type FeedScreenCtx = { state: TerminalState }

export type FeedScreenResult = { ok: true; created: boolean }

export function feedScreen(deps: FeedScreenDeps, ctx: FeedScreenCtx, input: FeedScreenInput): FeedScreenResult {
  let screen = ctx.state.screens.get(input.name)
  const created = screen === undefined

  if (!screen) {
    screen = new deps.xtermHeadless.Terminal({
      cols: ctx.state.size.cols,
      rows: ctx.state.size.rows,
      scrollback: ctx.state.scrollback,
      allowProposedApi: true,
    })
    ctx.state.screens.set(input.name, screen)
  }

  screen.write(input.chunk)
  return { ok: true, created }
}
