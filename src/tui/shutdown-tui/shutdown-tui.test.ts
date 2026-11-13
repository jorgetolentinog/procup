import { expect, test } from 'vitest'
import type { TuiState } from '../state.ts'
import { shutdownTui } from './shutdown-tui.ts'

test('it stops the project, then gives the terminal back and exits with 0', async () => {
  const state: TuiState = {
    names: ['web'],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: false,
    width: 100,
    height: 30,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 28,
    termCols: 75,
    termRows: 28,
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
  const calls: string[] = []

  const result = await shutdownTui(
    {
      procup: {
        stopProject: () => Promise.resolve(calls.push('stopProject')),
        listProcesses: () => [{ status: 'stopped' }, { status: 'finished' }],
      },
      stdout: { write: (data: string) => calls.push(`write ${JSON.stringify(data)}`) },
      stdin: { setRawMode: (mode: boolean) => calls.push(`raw ${mode}`), pause: () => calls.push('pause') },
      nodeTimers: { clearTimeout: () => true, clearInterval: () => true },
    },
    { state },
  )

  expect(result).toStrictEqual({ ok: true, exitCode: 0, immediate: false })
  expect(state.destroyed).toBe(true)
  expect(calls).toStrictEqual([
    'stopProject',
    `write ${JSON.stringify('\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[0m\x1b[?25h\x1b[?1049l')}`,
    'raw false',
    'pause',
  ])
})

test('it exits with 1 when a process failed', async () => {
  const state: TuiState = {
    names: ['web', 'boom'],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: false,
    width: 100,
    height: 30,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 28,
    termCols: 75,
    termRows: 28,
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

  const result = await shutdownTui(
    {
      procup: {
        stopProject: () => Promise.resolve(),
        listProcesses: () => [{ status: 'stopped' }, { status: 'failed' }],
      },
      stdout: { write: () => true },
      stdin: { setRawMode: () => true, pause: () => true },
      nodeTimers: { clearTimeout: () => true, clearInterval: () => true },
    },
    { state },
  )

  expect(result.exitCode).toBe(1)
})

test('pending timers are cancelled so the UI freezes', async () => {
  const cleared: string[][] = []
  const state: TuiState = {
    names: ['web'],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: false,
    width: 100,
    height: 30,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 28,
    termCols: 75,
    termRows: 28,
    scroll: new Map(),
    selection: null,
    pressedButtons: new Set(),
    pointer: { x: 0, y: 0 },
    scrollbarDrag: null,
    autoScroll: { timer: 'autoScroll', y: 0 },
    tempMessage: 'Copied!',
    tempTimer: 'temp',
    prevLines: [],
    frameTimer: 'frame',
    resizeTimer: 'resize',
    spinning: true,
    spinFrame: 0,
    spinTimer: 'spin',
    destroyed: false,
  }

  await shutdownTui(
    {
      procup: { stopProject: () => Promise.resolve(), listProcesses: () => [] },
      stdout: { write: () => true },
      stdin: { setRawMode: () => true, pause: () => true },
      nodeTimers: {
        clearTimeout: (timer: unknown) => cleared.push(['timeout', String(timer)]),
        clearInterval: (timer: unknown) => cleared.push(['interval', String(timer)]),
      },
    },
    { state },
  )

  expect(cleared).toStrictEqual([
    ['timeout', 'frame'],
    ['timeout', 'resize'],
    ['timeout', 'temp'],
    ['interval', 'autoScroll'],
    ['interval', 'spin'],
  ])
  expect([state.autoScroll, state.tempTimer, state.frameTimer, state.resizeTimer, state.spinTimer]).toStrictEqual([
    null,
    null,
    null,
    null,
    null,
  ])
})

test('a second shutdown while stopping exits right away without stopping again', async () => {
  const state: TuiState = {
    names: ['web'],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: false,
    width: 100,
    height: 30,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 28,
    termCols: 75,
    termRows: 28,
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
  let stops = 0
  let restores = 0
  const stopping: (() => void)[] = []
  const deps = {
    procup: {
      stopProject: () =>
        new Promise<void>(resolve => {
          stops++
          stopping.push(resolve)
        }),
      listProcesses: () => [{ status: 'failed' }],
    },
    stdout: { write: () => restores++ },
    stdin: { setRawMode: () => true, pause: () => true },
    nodeTimers: { clearTimeout: () => true, clearInterval: () => true },
  }

  const first = shutdownTui(deps, { state })
  const second = await shutdownTui(deps, { state })
  for (const finish of stopping) finish()
  const firstResult = await first

  expect(second).toStrictEqual({ ok: true, exitCode: 1, immediate: true })
  expect(firstResult).toStrictEqual({ ok: true, exitCode: 1, immediate: false })
  expect(stops).toBe(1)
  expect(restores).toBe(2)
})
