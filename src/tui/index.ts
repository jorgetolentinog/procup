import { type HandleKeyDeps, type HandleKeyInput, handleKey } from './handle-key/handle-key.ts'
import { type HandleMouseDeps, type HandleMouseInput, handleMouse } from './handle-mouse/handle-mouse.ts'
import { type HandleResizeDeps, handleResize } from './handle-resize/handle-resize.ts'
import { type RenderFrameDeps, renderFrame } from './render-frame/render-frame.ts'
import { type ScheduleFrameDeps, scheduleFrame } from './schedule-frame/schedule-frame.ts'
import { type ShutdownTuiDeps, shutdownTui } from './shutdown-tui/shutdown-tui.ts'
import { type StartTuiDeps, startTui } from './start-tui/start-tui.ts'
import type { TuiState } from './state.ts'

export type CreateTuiDeps = {
  procup: StartTuiDeps['procup'] &
    RenderFrameDeps['procup'] &
    HandleKeyDeps['procup'] &
    HandleMouseDeps['procup'] &
    HandleResizeDeps['procup'] &
    ShutdownTuiDeps['procup']
  stdout: StartTuiDeps['stdout'] & HandleResizeDeps['stdout']
  stdin: StartTuiDeps['stdin'] & ShutdownTuiDeps['stdin']
  nodeChildProcess: HandleMouseDeps['nodeChildProcess']
  nodeProcess: StartTuiDeps['nodeProcess'] & HandleMouseDeps['nodeProcess']
  nodeTimers: ScheduleFrameDeps['nodeTimers'] &
    StartTuiDeps['nodeTimers'] &
    ShutdownTuiDeps['nodeTimers'] &
    HandleResizeDeps['nodeTimers'] &
    HandleMouseDeps['nodeTimers']
  quit: HandleKeyDeps['quit']
}

export function createTui(deps: CreateTuiDeps) {
  const state: TuiState = {
    names: [],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: false,
    width: 0,
    height: 0,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 0,
    termCols: 40,
    termRows: 5,
    scroll: new Map(),
    selection: null,
    pressedButtons: new Set(),
    pointer: { x: 0, y: 0 },
    scrollbarDrag: null,
    autoScroll: null,
    tempMessage: null,
    tempTimer: null,
    prevLines: [],
    frameTimer: null,
    resizeTimer: null,
    spinning: false,
    spinFrame: 0,
    spinTimer: null,
    destroyed: false,
  }
  const { procup, stdout, stdin } = deps

  const render = () => renderFrame({ procup, stdout }, { state })
  const { nodeTimers } = deps
  const schedule = () => scheduleFrame({ nodeTimers, renderFrame: render }, { state })
  const mouse = (input: HandleMouseInput) =>
    handleMouse(
      {
        procup,
        nodeChildProcess: deps.nodeChildProcess,
        nodeProcess: deps.nodeProcess,
        nodeTimers,
        scheduleFrame: schedule,
      },
      { state },
      input,
    )

  return {
    startTui: () =>
      startTui(
        {
          procup,
          stdout,
          stdin,
          nodeProcess: deps.nodeProcess,
          nodeTimers,
          renderFrame: render,
          scheduleFrame: schedule,
        },
        { state },
      ),
    scheduleFrame: schedule,
    handleKey: (input: HandleKeyInput) =>
      handleKey({ procup, handleMouse: mouse, scheduleFrame: schedule, quit: deps.quit }, { state }, input),
    handleResize: () => handleResize({ stdout, procup, nodeTimers, scheduleFrame: schedule }, { state }),
    shutdownTui: () => shutdownTui({ procup, stdout, stdin, nodeTimers }, { state }),
  }
}
