import type { ProcessState } from '../state.ts'

export type ResizeProcessesInput = { cols: number; rows: number }

export type ResizeProcessesDeps = {
  terminal: { resizeScreens(input: { cols: number; rows: number }): unknown }
}

export type ResizeProcessesCtx = { state: ProcessState }

export type ResizeProcessesResult = { ok: true } | { ok: false; error: 'invalid_size' }

export function resizeProcesses(
  deps: ResizeProcessesDeps,
  ctx: ResizeProcessesCtx,
  input: ResizeProcessesInput,
): ResizeProcessesResult {
  const { cols, rows } = input
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    return { ok: false, error: 'invalid_size' }
  }

  ctx.state.size = { cols, rows }

  for (const pty of ctx.state.ptys.values()) {
    try {
      pty.resize(cols, rows)
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('EBADF'))) throw err
    }
  }

  deps.terminal.resizeScreens({ cols, rows })
  return { ok: true }
}
