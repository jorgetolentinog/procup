import type { TerminalState } from '../state.ts'

export type ResizeScreensInput = { cols: number; rows: number }

export type ResizeScreensCtx = { state: TerminalState }

export type ResizeScreensResult = { ok: true } | { ok: false; error: 'invalid_size' }

export function resizeScreens(ctx: ResizeScreensCtx, input: ResizeScreensInput): ResizeScreensResult {
  const { cols, rows } = input
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    return { ok: false, error: 'invalid_size' }
  }

  ctx.state.size = { cols, rows }
  for (const screen of ctx.state.screens.values()) screen.resize(cols, rows)

  return { ok: true }
}
