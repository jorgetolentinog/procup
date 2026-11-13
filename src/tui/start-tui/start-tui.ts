import type { Env, SetInterval } from '../../types/node.ts'
import type { TuiState } from '../state.ts'

const PAD_Y = 1
const PANE_PAD_X = 3
const SPIN_MS = 80

export type StartTuiDeps = {
  procup: {
    listProcesses(): { name: string }[]
    resizeProcesses(cols: number, rows: number): unknown
    startProject(): unknown
  }
  stdout: { columns: number; rows: number; write(data: string): unknown }
  stdin: { setRawMode?(mode: boolean): unknown; setEncoding(encoding: 'utf8'): unknown; resume(): unknown }
  nodeProcess: Env
  nodeTimers: SetInterval
  renderFrame: () => void
  scheduleFrame: () => unknown
}

export type StartTuiCtx = { state: TuiState }

export type StartTuiResult = { ok: true }

export function startTui(deps: StartTuiDeps, ctx: StartTuiCtx): StartTuiResult {
  const { state } = ctx
  state.names = deps.procup.listProcesses().map(p => p.name)
  state.noColor = 'NO_COLOR' in deps.nodeProcess.env
  state.active = 0

  const maxNameLen = Math.max(0, ...state.names.map(n => n.length))
  state.sidebarWidth = Math.min(34, Math.max(18, maxNameLen + 6))
  state.paneX = state.sidebarWidth + 1 + PANE_PAD_X
  state.width = deps.stdout.columns
  state.height = deps.stdout.rows
  state.paneRows = Math.max(0, state.height - PAD_Y * 2)
  state.termCols = Math.max(40, state.width - state.paneX - PANE_PAD_X)
  state.termRows = Math.max(5, state.height - PAD_Y * 2)

  deps.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J\x1b[?1000h\x1b[?1002h\x1b[?1006h')
  deps.stdin.setRawMode?.(true)
  deps.stdin.setEncoding('utf8')
  deps.stdin.resume()

  state.spinTimer = deps.nodeTimers.setInterval(() => {
    if (!state.spinning) return
    state.spinFrame++
    deps.scheduleFrame()
  }, SPIN_MS)

  deps.procup.resizeProcesses(state.termCols, state.termRows)
  deps.procup.startProject()
  deps.renderFrame()
  return { ok: true }
}
