import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'

export type SkipProcessInput = { name: string }

export type SkipProcessDeps = {
  emit: (event: ProcessEvent) => void
}

export type SkipProcessCtx = { state: ProcessState }

export type SkipProcessResult = { ok: true } | { ok: false; error: 'not_found' | 'already_started' }

export function skipProcess(deps: SkipProcessDeps, ctx: SkipProcessCtx, input: SkipProcessInput): SkipProcessResult {
  const row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status !== 'pending') return { ok: false, error: 'already_started' }

  ctx.state.rows.set(row.name, { ...row, status: 'skipped' })
  deps.emit({ type: 'status', name: row.name, status: 'skipped' })
  return { ok: true }
}
