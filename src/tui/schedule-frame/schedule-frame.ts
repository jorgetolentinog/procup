import type { SetTimeout } from '../../types/node.ts'
import type { TuiState } from '../state.ts'

const FRAME_MS = 16

export type ScheduleFrameDeps = {
  nodeTimers: SetTimeout
  renderFrame: () => void
}

export type ScheduleFrameCtx = { state: TuiState }

export function scheduleFrame(deps: ScheduleFrameDeps, ctx: ScheduleFrameCtx): { ok: true; scheduled: boolean } {
  if (ctx.state.destroyed || ctx.state.frameTimer !== null) return { ok: true, scheduled: false }

  ctx.state.frameTimer = deps.nodeTimers.setTimeout(() => {
    ctx.state.frameTimer = null
    deps.renderFrame()
  }, FRAME_MS)
  return { ok: true, scheduled: true }
}
