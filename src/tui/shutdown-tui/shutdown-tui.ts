import type { ClearInterval, ClearTimeout } from '../../types/node.ts'
import type { TuiState } from '../state.ts'

export type ShutdownTuiDeps = {
  procup: {
    stopProject(): Promise<unknown>
    listProcesses(): { status: string }[]
  }
  stdout: { write(data: string): unknown }
  stdin: { setRawMode?(mode: boolean): unknown; pause(): unknown }
  nodeTimers: ClearTimeout & ClearInterval
}

export type ShutdownTuiCtx = { state: TuiState }

export type ShutdownTuiResult = { ok: true; exitCode: number; immediate: boolean }

export async function shutdownTui(deps: ShutdownTuiDeps, ctx: ShutdownTuiCtx): Promise<ShutdownTuiResult> {
  const { state } = ctx

  if (state.destroyed) {
    restoreTerminal(deps)
    const exitCode = deps.procup.listProcesses().some(p => p.status === 'failed') ? 1 : 0
    return { ok: true, exitCode, immediate: true }
  }

  state.destroyed = true
  if (state.frameTimer !== null) deps.nodeTimers.clearTimeout(state.frameTimer)
  if (state.resizeTimer !== null) deps.nodeTimers.clearTimeout(state.resizeTimer)
  if (state.tempTimer !== null) deps.nodeTimers.clearTimeout(state.tempTimer)
  if (state.autoScroll !== null) deps.nodeTimers.clearInterval(state.autoScroll.timer)
  if (state.spinTimer !== null) deps.nodeTimers.clearInterval(state.spinTimer)
  state.spinTimer = null
  state.frameTimer = null
  state.resizeTimer = null
  state.tempTimer = null
  state.autoScroll = null

  await deps.procup.stopProject()
  restoreTerminal(deps)

  const exitCode = deps.procup.listProcesses().some(p => p.status === 'failed') ? 1 : 0
  return { ok: true, exitCode, immediate: false }
}

function restoreTerminal(deps: ShutdownTuiDeps) {
  deps.stdout.write('\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[0m\x1b[?25h\x1b[?1049l')
  deps.stdin.setRawMode?.(false)
  deps.stdin.pause()
}
