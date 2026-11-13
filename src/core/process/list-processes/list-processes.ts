import type { ProcessRow, ProcessState } from '../state.ts'

export type ListProcessesCtx = { state: ProcessState }

export function listProcesses(ctx: ListProcessesCtx): ProcessRow[] {
  return Array.from(ctx.state.rows.values(), row => ({ ...row }))
}
