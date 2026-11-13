import { expect, test } from 'vitest'
import type { TuiState } from '../state.ts'
import { handleResize } from './handle-resize.ts'

test('the layout follows the new size right away and the whole screen is redrawn', () => {
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
    prevLines: ['old frame'],
    frameTimer: null,
    resizeTimer: null,
    spinning: false,
    spinFrame: 0,
    spinTimer: null,
    destroyed: false,
  }
  let frames = 0
  const resized: number[][] = []
  const timers: { callback: () => void; ms: number }[] = []
  const cleared: unknown[] = []

  handleResize(
    {
      stdout: { columns: 120, rows: 40 },
      procup: { resizeProcesses: (cols: number, rows: number) => resized.push([cols, rows]) },
      nodeTimers: {
        setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }),
        clearTimeout: (timer: unknown) => cleared.push(timer),
      },
      scheduleFrame: () => frames++,
    },
    { state },
  )

  expect([state.width, state.height, state.paneRows, state.termCols, state.termRows]).toStrictEqual([
    120, 40, 38, 95, 38,
  ])
  expect(state.prevLines).toStrictEqual([])
  expect(frames).toBe(1)
  expect(resized).toStrictEqual([])
  expect(timers.map(t => t.ms)).toStrictEqual([50])
  expect(cleared).toStrictEqual([])
})

test('the processes are resized once, 50ms after the last change', () => {
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
  let frames = 0
  const resized: number[][] = []
  const stdout = { columns: 110, rows: 30 }
  const timers: { callback: () => void; ms: number }[] = []
  const cleared: unknown[] = []
  const deps = {
    stdout,
    procup: { resizeProcesses: (cols: number, rows: number) => resized.push([cols, rows]) },
    nodeTimers: {
      setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }),
      clearTimeout: (timer: unknown) => cleared.push(timer),
    },
    scheduleFrame: () => frames++,
  }

  handleResize(deps, { state })
  stdout.columns = 120
  handleResize(deps, { state })
  stdout.columns = 130
  stdout.rows = 32
  handleResize(deps, { state })
  const early = resized.length
  timers.at(-1)?.callback()

  expect(early).toBe(0)
  expect(timers.map(t => t.ms)).toStrictEqual([50, 50, 50])
  expect(cleared).toStrictEqual([1, 2])
  expect(resized).toStrictEqual([[105, 30]])
  expect(frames).toBe(4)
  expect(state.resizeTimer).toBe(null)
})

test('a small terminal keeps a minimum size for the processes', () => {
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
  const resized: number[][] = []
  const timers: { callback: () => void; ms: number }[] = []
  const cleared: unknown[] = []

  handleResize(
    {
      stdout: { columns: 30, rows: 4 },
      procup: { resizeProcesses: (cols: number, rows: number) => resized.push([cols, rows]) },
      nodeTimers: {
        setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }),
        clearTimeout: (timer: unknown) => cleared.push(timer),
      },
      scheduleFrame: () => true,
    },
    { state },
  )
  for (const timer of timers) timer.callback()

  expect([state.paneRows, state.termCols, state.termRows]).toStrictEqual([2, 40, 5])
  expect(resized).toStrictEqual([[40, 5]])
})

test('nothing changes after shutdown', () => {
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
    prevLines: ['frame'],
    frameTimer: null,
    resizeTimer: null,
    spinning: false,
    spinFrame: 0,
    spinTimer: null,
    destroyed: true,
  }
  let calls = 0
  const timers: { callback: () => void; ms: number }[] = []
  const cleared: unknown[] = []

  handleResize(
    {
      stdout: { columns: 120, rows: 40 },
      procup: { resizeProcesses: () => calls++ },
      nodeTimers: {
        setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }),
        clearTimeout: (timer: unknown) => cleared.push(timer),
      },
      scheduleFrame: () => calls++,
    },
    { state },
  )

  expect([state.width, state.height, state.prevLines]).toStrictEqual([100, 30, ['frame']])
  expect(calls).toBe(0)
  expect(timers).toStrictEqual([])
})
