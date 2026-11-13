import type { ClearTimeout, SetTimeout } from '../../types/node.ts'
import type { TuiState } from '../state.ts'

const RESIZE_DEBOUNCE_MS = 50
const PAD_Y = 1
const PANE_PAD_X = 3

export type HandleResizeDeps = {
  stdout: { columns: number; rows: number }
  procup: { resizeProcesses(cols: number, rows: number): unknown }
  nodeTimers: SetTimeout & ClearTimeout
  scheduleFrame: () => unknown
}

export type HandleResizeCtx = { state: TuiState }

export function handleResize(deps: HandleResizeDeps, ctx: HandleResizeCtx): { ok: true } {
  const { state } = ctx
  if (state.destroyed) return { ok: true }

  state.width = deps.stdout.columns
  state.height = deps.stdout.rows
  state.paneRows = Math.max(0, state.height - PAD_Y * 2)
  state.termCols = Math.max(40, state.width - state.paneX - PANE_PAD_X)
  state.termRows = Math.max(5, state.height - PAD_Y * 2)
  state.prevLines = []

  if (state.resizeTimer !== null) deps.nodeTimers.clearTimeout(state.resizeTimer)
  state.resizeTimer = deps.nodeTimers.setTimeout(() => {
    state.resizeTimer = null
    deps.procup.resizeProcesses(state.termCols, state.termRows)
    deps.scheduleFrame()
  }, RESIZE_DEBOUNCE_MS)

  deps.scheduleFrame()
  return { ok: true }
}
