import { expect, test } from 'vitest'
import type { TuiState } from '../state.ts'
import { handleMouse } from './handle-mouse.ts'

test('clicking a process in the sidebar makes it active and leaves input mode', () => {
  const state: TuiState = {
    names: ['web', 'api', 'db'],
    noColor: false,
    active: 0,
    inputMode: true,
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
  const deps = {
    procup: { readScreen: () => ({ total: 0, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 4, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 4, y: 3, final: 'm' })

  expect(state.active).toBe(1)
  expect(state.inputMode).toBe(false)
  expect(state.pressedButtons.size).toBe(0)
})

test('only the left button selects a process', () => {
  const state: TuiState = {
    names: ['web', 'api'],
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
  const deps = {
    procup: { readScreen: () => ({ total: 0, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 2, x: 4, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 1, x: 4, y: 3, final: 'M' })

  expect(state.active).toBe(0)
})

test('the ↑ and ↓ more rows of a short sidebar are not clickable', () => {
  const state: TuiState = {
    names: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
    noColor: false,
    active: 4,
    inputMode: false,
    helpVisible: false,
    width: 100,
    height: 8,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 6,
    termCols: 75,
    termRows: 6,
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
  const deps = {
    procup: { readScreen: () => ({ total: 0, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 4, y: 2, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 4, y: 2, final: 'm' })
  const afterMore = state.active
  handleMouse(deps, { state }, { code: 0, x: 4, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 4, y: 3, final: 'm' })

  expect([afterMore, state.active]).toStrictEqual([4, 3])
})

test('the wheel over the pane scrolls one line and stops at both ends', () => {
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
    scroll: new Map([['web', { top: 12, manual: false, total: 40, rows: 28 }]]),
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
  const deps = {
    procup: { readScreen: () => ({ total: 40, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }
  const positions: [number | undefined, boolean | undefined][] = []

  for (const input of [
    { code: 64, x: 31, y: 11 },
    { code: 65, x: 31, y: 11 },
    { code: 65, x: 31, y: 11 },
    { code: 64, x: 6, y: 11 },
    { code: 68, x: 31, y: 11 },
  ]) {
    handleMouse(deps, { state }, { ...input, final: 'M' })
    const scroll = state.scroll.get('web')
    positions.push([scroll?.top, scroll?.manual])
  }

  expect(positions).toStrictEqual([
    [11, true],
    [12, false],
    [12, false],
    [12, false],
    [12, false],
  ])
})

test('dragging over the text copies it on release and shows Copied! for 2 seconds', () => {
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
    scroll: new Map([['web', { top: 12, manual: false, total: 40, rows: 28 }]]),
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
  const spawned: string[] = []
  const copied: string[] = []
  const timeouts: { callback: () => void; ms: number }[] = []
  let frames = 0
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 40,
        lines: Array.from({ length: 40 }, (_, i) => [{ text: `line-${i + 1}` }]).slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: {
      spawn: (command: string, args: string[]) => {
        spawned.push([command, ...args].join(' '))
        return { on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }
      },
    },
    nodeTimers: {
      setTimeout: (callback: () => void, ms: number) => timeouts.push({ callback, ms }),
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => frames++,
  }

  handleMouse(deps, { state }, { code: 0, x: 23, y: 6, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 26, y: 7, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 26, y: 7, final: 'm' })
  const message = state.tempMessage
  const framesBefore = frames
  for (const timeout of timeouts) timeout.callback()

  expect(spawned).toStrictEqual(['pbcopy'])
  expect(copied).toStrictEqual(['line-17\nlin'])
  expect(message).toBe('Copied!')
  expect(timeouts.map(t => t.ms)).toStrictEqual([2000])
  expect(state.tempMessage).toBe(null)
  expect(frames).toBe(framesBefore + 1)
  expect(state.selection?.dragging).toBe(false)
})

test('on Linux with Wayland it copies with wl-copy', () => {
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
    scroll: new Map([['web', { top: 12, manual: false, total: 40, rows: 28 }]]),
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
  const spawned: string[] = []
  const copied: string[] = []
  const timeouts: { callback: () => void; ms: number }[] = []
  let frames = 0
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 40,
        lines: Array.from({ length: 40 }, (_, i) => [{ text: `line-${i + 1}` }]).slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-0' } },
    nodeChildProcess: {
      spawn: (command: string, args: string[]) => {
        spawned.push([command, ...args].join(' '))
        return { on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }
      },
    },
    nodeTimers: {
      setTimeout: (callback: () => void, ms: number) => timeouts.push({ callback, ms }),
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => frames++,
  }

  handleMouse(deps, { state }, { code: 0, x: 23, y: 6, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 26, y: 7, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 26, y: 7, final: 'm' })
  const message = state.tempMessage
  const framesBefore = frames
  for (const timeout of timeouts) timeout.callback()

  expect(spawned).toStrictEqual(['wl-copy'])
  expect(copied).toStrictEqual(['line-17\nlin'])
  expect(message).toBe('Copied!')
  expect(timeouts.map(t => t.ms)).toStrictEqual([2000])
  expect(state.tempMessage).toBe(null)
  expect(frames).toBe(framesBefore + 1)
  expect(state.selection?.dragging).toBe(false)
})

test('on Linux without Wayland it copies with xclip to the clipboard', () => {
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
    scroll: new Map([['web', { top: 12, manual: false, total: 40, rows: 28 }]]),
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
  const spawned: string[] = []
  const copied: string[] = []
  const timeouts: { callback: () => void; ms: number }[] = []
  let frames = 0
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 40,
        lines: Array.from({ length: 40 }, (_, i) => [{ text: `line-${i + 1}` }]).slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'linux', env: {} },
    nodeChildProcess: {
      spawn: (command: string, args: string[]) => {
        spawned.push([command, ...args].join(' '))
        return { on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }
      },
    },
    nodeTimers: {
      setTimeout: (callback: () => void, ms: number) => timeouts.push({ callback, ms }),
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => frames++,
  }

  handleMouse(deps, { state }, { code: 0, x: 23, y: 6, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 26, y: 7, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 26, y: 7, final: 'm' })
  const message = state.tempMessage
  const framesBefore = frames
  for (const timeout of timeouts) timeout.callback()

  expect(spawned).toStrictEqual(['xclip -selection clipboard'])
  expect(copied).toStrictEqual(['line-17\nlin'])
  expect(message).toBe('Copied!')
  expect(timeouts.map(t => t.ms)).toStrictEqual([2000])
  expect(state.tempMessage).toBe(null)
  expect(frames).toBe(framesBefore + 1)
  expect(state.selection?.dragging).toBe(false)
})

test('dragging backwards includes the character where the drag started', () => {
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
  const copied: string[] = []
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 3,
        lines: [[{ text: 'alpha' }], [{ text: 'bravo' }], [{ text: 'charlie' }]].slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: {
      spawn: () => ({ on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }),
    },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 26, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 23, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 23, y: 3, final: 'm' })

  expect(copied).toStrictEqual(['brav'])
})

test('dragging into the sidebar selects from the start of that line', () => {
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
  const copied: string[] = []
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 3,
        lines: [[{ text: 'alpha' }], [{ text: 'bravo' }], [{ text: 'charlie' }]].slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: {
      spawn: () => ({ on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }),
    },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 25, y: 2, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 6, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 6, y: 3, final: 'm' })

  expect(copied).toStrictEqual(['pha\n'])
})

test('dragging below the output selects up to its end', () => {
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
  const copied: string[] = []
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 3,
        lines: [[{ text: 'alpha' }], [{ text: 'bravo' }], [{ text: 'charlie' }]].slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: {
      spawn: () => ({ on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }),
    },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 25, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 40, y: 12, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 40, y: 12, final: 'm' })

  expect(copied).toStrictEqual(['avo\ncharlie'])
})

test('a click without dragging copies nothing and clears the selection', () => {
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
  const copied: string[] = []
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 3,
        lines: [[{ text: 'alpha' }], [{ text: 'bravo' }], [{ text: 'charlie' }]].slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: {
      spawn: () => ({ on: () => true, stdin: { on: () => true, end: (text: string) => copied.push(text) } }),
    },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 25, y: 3, final: 'M' })
  handleMouse(deps, { state }, { code: 0, x: 25, y: 3, final: 'm' })

  expect(copied).toStrictEqual([])
  expect(state.selection).toBe(null)
  expect(state.tempMessage).toBe(null)
})

test('dragging near the bottom edge keeps scrolling until the end of the output', () => {
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
    scroll: new Map([['web', { top: 0, manual: true, total: 40, rows: 28 }]]),
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
  const intervals: { callback: () => void; ms: number }[] = []
  const cleared: unknown[] = []
  const deps = {
    procup: {
      readScreen: (_name: string, start: number, count: number) => ({
        total: 40,
        lines: Array.from({ length: 40 }, (_, i) => [{ text: `line-${i + 1}` }]).slice(start, start + count),
      }),
    },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: (callback: () => void, ms: number) => intervals.push({ callback, ms }),
      clearInterval: (timer: unknown) => cleared.push(timer),
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 23, y: 6, final: 'M' })
  handleMouse(deps, { state }, { code: 32, x: 23, y: 29, final: 'M' })
  const tick = () => {
    for (const interval of intervals) interval.callback()
  }
  tick()
  const firstStep = state.scroll.get('web')?.top
  for (const _ of Array.from({ length: 30 })) tick()

  expect(intervals.map(i => i.ms)).toStrictEqual([1000 / 36])
  expect(cleared).toStrictEqual([1])
  expect(firstStep).toBe(1)
  expect(state.scroll.get('web')?.top).toBe(12)
  expect(state.autoScroll).toBe(null)
  expect(state.selection?.focus).toStrictEqual({ line: 39, col: 0 })
})

test('clicking the scrollbar track jumps there and dragging the thumb scrolls', () => {
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
    scroll: new Map([['web', { top: 72, manual: false, total: 100, rows: 28 }]]),
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
  const deps = {
    procup: { readScreen: () => ({ total: 100, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 99, y: 2, final: 'M' })
  const afterClick = state.scroll.get('web')?.top
  handleMouse(deps, { state }, { code: 32, x: 99, y: 29, final: 'M' })
  const afterDrag = state.scroll.get('web')?.top
  handleMouse(deps, { state }, { code: 0, x: 99, y: 29, final: 'm' })

  expect([afterClick, afterDrag]).toStrictEqual([0, 72])
  expect(state.scrollbarDrag).toBe(null)
})

test('while the help is open a click only clears the selection', () => {
  const state: TuiState = {
    names: ['web', 'api'],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: true,
    width: 100,
    height: 30,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 28,
    termCols: 75,
    termRows: 28,
    scroll: new Map(),
    selection: { name: 'web', anchor: { line: 0, col: 0 }, focus: { line: 0, col: 3 }, dragging: false },
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
  const deps = {
    procup: { readScreen: () => ({ total: 0, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  handleMouse(deps, { state }, { code: 0, x: 4, y: 3, final: 'M' })

  expect(state.active).toBe(0)
  expect(state.selection).toBe(null)
})

test('motion without a pressed button only moves the pointer', () => {
  const state: TuiState = {
    names: ['web', 'api'],
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
  const deps = {
    procup: { readScreen: () => ({ total: 0, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => frames++,
  }

  const result = handleMouse(deps, { state }, { code: 35, x: 4, y: 3, final: 'M' })

  expect(result.type).toBe('move')
  expect(state.pointer).toStrictEqual({ x: 3, y: 2 })
  expect(state.active).toBe(0)
  expect(frames).toBe(0)
})

test('the mouse is ignored after shutdown', () => {
  const state: TuiState = {
    names: ['web', 'api'],
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
  const deps = {
    procup: { readScreen: () => ({ total: 0, lines: [] }) },
    nodeProcess: { platform: 'darwin', env: {} },
    nodeChildProcess: { spawn: () => ({ on: () => true, stdin: { on: () => true, end: () => true } }) },
    nodeTimers: {
      setTimeout: () => true,
      clearTimeout: () => true,
      setInterval: () => true,
      clearInterval: () => true,
    },
    scheduleFrame: () => true,
  }

  const result = handleMouse(deps, { state }, { code: 0, x: 4, y: 3, final: 'M' })

  expect(result).toStrictEqual({ ok: true, type: 'ignored' })
  expect(state.active).toBe(0)
})
