import type { ProcessState } from '../state.ts'

export type WriteProcessInput = { name: string; data: string }

export type WriteProcessCtx = { state: ProcessState }

export type WriteProcessResult = { ok: true } | { ok: false; error: 'not_found' | 'not_running' }

export function writeProcess(ctx: WriteProcessCtx, input: WriteProcessInput): WriteProcessResult {
  if (!ctx.state.rows.has(input.name)) return { ok: false, error: 'not_found' }

  const pty = ctx.state.ptys.get(input.name)
  if (!pty) return { ok: false, error: 'not_running' }

  pty.write(input.data)
  return { ok: true }
}
