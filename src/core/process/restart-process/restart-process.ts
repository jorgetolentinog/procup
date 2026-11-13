import type { ClearTimeout, Kill, SetTimeout } from '../../../types/node.ts'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'

const RESTART_KILL_TIMEOUT_MS = 2000

export type RestartProcessInput = { name: string }

export type RestartProcessDeps = {
  emit: (event: ProcessEvent) => void
  spawnProcess: (input: { name: string }) => { ok: true } | { ok: false; error: string; message?: string }
  nodeTimers: SetTimeout & ClearTimeout
  nodeProcess: Kill
}

export type RestartProcessCtx = { state: ProcessState }

export type RestartProcessResult = { ok: true } | { ok: false; error: string; message?: string }

export async function restartProcess(
  deps: RestartProcessDeps,
  ctx: RestartProcessCtx,
  input: RestartProcessInput,
): Promise<RestartProcessResult> {
  const row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status === 'pending' || row.status === 'stopping' || row.status === 'skipped') {
    return { ok: false, error: 'not_restartable' }
  }

  ctx.state.rows.set(row.name, { ...row, exitCode: undefined })

  const pty = ctx.state.ptys.get(row.name)
  if (pty) {
    const exited = new Promise<void>(resolve => pty.onExit(() => resolve()))

    ctx.state.restarting.add(row.name)
    const current = ctx.state.rows.get(row.name)
    if (current) ctx.state.rows.set(row.name, { ...current, status: 'stopping' })
    deps.emit({ type: 'status', name: row.name, status: 'stopping' })

    kill(deps.nodeProcess, pty.pid, 'SIGTERM')
    const forceKill = deps.nodeTimers.setTimeout(
      () => kill(deps.nodeProcess, pty.pid, 'SIGKILL'),
      RESTART_KILL_TIMEOUT_MS,
    )
    await exited
    deps.nodeTimers.clearTimeout(forceKill)
    ctx.state.restarting.delete(row.name)
  }

  const current = ctx.state.rows.get(row.name)
  if (current) ctx.state.rows.set(row.name, { ...current, status: 'stopped', pid: undefined })
  return deps.spawnProcess({ name: row.name })
}

function kill(nodeProcess: RestartProcessDeps['nodeProcess'], pid: number, signal: 'SIGTERM' | 'SIGKILL') {
  try {
    nodeProcess.kill(-pid, signal)
  } catch (err) {
    if (!(err instanceof Error && 'code' in err && err.code === 'ESRCH')) throw err
  }
}
