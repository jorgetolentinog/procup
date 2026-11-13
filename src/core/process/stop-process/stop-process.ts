import type { ClearTimeout, Kill, SetTimeout } from '../../../types/node.ts'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'

const STOP_TIMEOUT_MS = 5000

export type StopProcessInput = { name: string; onlyIfAlive?: boolean }

export type StopProcessDeps = {
  emit: (event: ProcessEvent) => void
  nodeTimers: SetTimeout & ClearTimeout
  nodeProcess: Kill
}

export type StopProcessCtx = { state: ProcessState }

export type StopProcessResult = { ok: true } | { ok: false; error: 'not_found' }

export async function stopProcess(
  deps: StopProcessDeps,
  ctx: StopProcessCtx,
  input: StopProcessInput,
): Promise<StopProcessResult> {
  const row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }

  if (
    row.status === 'pending' ||
    row.status === 'stopped' ||
    row.status === 'finished' ||
    row.status === 'stopping' ||
    row.status === 'skipped'
  ) {
    return { ok: true }
  }

  const pty = ctx.state.ptys.get(row.name)
  if (!pty && input.onlyIfAlive === true) return { ok: true }
  if (pty) {
    const exited = new Promise<void>(resolve => pty.onExit(() => resolve()))

    ctx.state.stopping.add(row.name)
    ctx.state.rows.set(row.name, { ...row, status: 'stopping' })
    deps.emit({ type: 'status', name: row.name, status: 'stopping' })

    kill(deps.nodeProcess, pty.pid, 'SIGTERM')
    const forceKill = deps.nodeTimers.setTimeout(() => kill(deps.nodeProcess, pty.pid, 'SIGKILL'), STOP_TIMEOUT_MS)
    await exited
    deps.nodeTimers.clearTimeout(forceKill)
  }

  const current = ctx.state.rows.get(row.name)
  if (current && current.status !== 'stopped') {
    ctx.state.stopping.delete(row.name)
    ctx.state.rows.set(row.name, { ...current, status: 'stopped' })
    deps.emit({ type: 'status', name: row.name, status: 'stopped' })
  }
  return { ok: true }
}

function kill(nodeProcess: StopProcessDeps['nodeProcess'], pid: number, signal: 'SIGTERM' | 'SIGKILL') {
  try {
    nodeProcess.kill(-pid, signal)
  } catch (err) {
    if (!(err instanceof Error && 'code' in err && err.code === 'ESRCH')) throw err
  }
}
