import type { ProcessState } from '../state.ts'

export type StartProcessInput = { name: string }

export type StartProcessDeps = {
  spawnProcess: (input: { name: string }) => { ok: true } | { ok: false; error: string; message?: string }
}

export type StartProcessCtx = { state: ProcessState }

export type StartProcessResult = { ok: true } | { ok: false; error: string; message?: string }

export function startProcess(
  deps: StartProcessDeps,
  ctx: StartProcessCtx,
  input: StartProcessInput,
): StartProcessResult {
  const row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status !== 'stopped' && row.status !== 'finished' && row.status !== 'failed') {
    return { ok: false, error: 'not_startable' }
  }

  ctx.state.rows.set(row.name, { ...row, exitCode: undefined })

  return deps.spawnProcess({ name: row.name })
}
