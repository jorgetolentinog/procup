import type { ProcessEvent } from '../events.ts'
import type { ProcessState, ProcessStatus } from '../state.ts'

export type HandleExitInput = { name: string; exitCode: number; signal: number }

export type HandleExitDeps = {
  emit: (event: ProcessEvent) => void
}

export type HandleExitCtx = { state: ProcessState }

export type HandleExitResult = { ok: true; status: ProcessStatus } | { ok: false; error: 'not_found' }

export function handleExit(deps: HandleExitDeps, ctx: HandleExitCtx, input: HandleExitInput): HandleExitResult {
  let row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }

  ctx.state.ptys.delete(row.name)
  ctx.state.readyBuffers.delete(row.name)

  const code = input.signal > 0 ? null : input.exitCode

  if (row.readyText === undefined && code === 0 && !ctx.state.readied.has(row.name)) {
    ctx.state.readied.add(row.name)
    row = { ...row, status: 'ready' }
    ctx.state.rows.set(row.name, row)
    deps.emit({ type: 'status', name: row.name, status: 'ready' })
  }

  if (code === 127 || code === 126) {
    const hint = code === 127 ? 'command not found' : 'permission denied'
    deps.emit({ type: 'output', name: row.name, chunk: `\r\n\x1b[31m[procup] exit ${code}: ${hint}\x1b[0m\r\n` })
  }

  if (ctx.state.restarting.has(row.name)) {
    return { ok: true, status: row.status }
  }

  const wasStopping = ctx.state.stopping.delete(row.name)
  const status = exitStatus(wasStopping, code)

  if (code !== null && code !== 0 && code !== 127 && code !== 126) {
    deps.emit({ type: 'output', name: row.name, chunk: `\r\n\x1b[31m[procup] exit ${code}\x1b[0m\r\n` })
  }

  ctx.state.rows.set(row.name, { ...row, status, pid: undefined, exitCode: code })
  deps.emit({ type: 'status', name: row.name, status })
  deps.emit({ type: 'exited', name: row.name, exitCode: code })

  return { ok: true, status }
}

function exitStatus(wasStopping: boolean, code: number | null): ProcessStatus {
  if (wasStopping) return 'stopped'
  return code === 0 ? 'finished' : 'failed'
}
