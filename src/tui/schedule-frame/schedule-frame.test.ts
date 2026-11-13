import { expect, test } from 'vitest'
import type { TuiState } from '../state.ts'
import { scheduleFrame } from './schedule-frame.ts'

test('many requests in a row draw a single frame after 16ms', () => {
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
  const timers: { callback: () => void; ms: number }[] = []
  let frames = 0
  const deps = {
    nodeTimers: { setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }) },
    renderFrame: () => frames++,
  }

  const results = [scheduleFrame(deps, { state }), scheduleFrame(deps, { state }), scheduleFrame(deps, { state })]
  const before = frames
  for (const timer of timers) timer.callback()

  expect(results.map(r => r.scheduled)).toStrictEqual([true, false, false])
  expect(timers.map(t => t.ms)).toStrictEqual([16])
  expect(before).toBe(0)
  expect(frames).toBe(1)
  expect(state.frameTimer).toBe(null)
})

test('after a frame is drawn the next request schedules another one', () => {
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
  const timers: { callback: () => void; ms: number }[] = []
  let frames = 0
  const deps = {
    nodeTimers: { setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }) },
    renderFrame: () => frames++,
  }

  scheduleFrame(deps, { state })
  timers.shift()?.callback()
  const again = scheduleFrame(deps, { state })
  timers.shift()?.callback()

  expect(again.scheduled).toBe(true)
  expect(frames).toBe(2)
})

test('nothing is drawn once the UI is shut down', () => {
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
    destroyed: true,
  }
  const timers: { callback: () => void; ms: number }[] = []
  let frames = 0
  const deps = {
    nodeTimers: { setTimeout: (callback: () => void, ms: number) => timers.push({ callback, ms }) },
    renderFrame: () => frames++,
  }

  const result = scheduleFrame(deps, { state })

  expect(result.scheduled).toBe(false)
  expect(timers).toStrictEqual([])
  expect(frames).toBe(0)
})
