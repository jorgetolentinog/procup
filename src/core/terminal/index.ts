import { type FeedScreenDeps, type FeedScreenInput, feedScreen } from './feed-screen/feed-screen.ts'
import { type ReadScreenInput, readScreen } from './read-screen/read-screen.ts'
import { type ResizeScreensInput, resizeScreens } from './resize-screens/resize-screens.ts'
import type { TerminalState } from './state.ts'

export type CreateTerminalDeps = {
  xtermHeadless: FeedScreenDeps['xtermHeadless']
}

export function createTerminal(deps: CreateTerminalDeps) {
  const state: TerminalState = {
    size: { cols: 80, rows: 24 },
    scrollback: 1500,
    screens: new Map(),
  }

  return {
    feedScreen: (input: FeedScreenInput) => feedScreen({ xtermHeadless: deps.xtermHeadless }, { state }, input),
    resizeScreens: (input: ResizeScreensInput) => resizeScreens({ state }, input),
    readScreen: (input: ReadScreenInput) => readScreen({ state }, input),
  }
}
