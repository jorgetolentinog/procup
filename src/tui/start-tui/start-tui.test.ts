import { expect, test } from 'vitest'
import type { TuiState } from '../state.ts'
import { startTui } from './start-tui.ts'

test('it sizes the layout from the terminal and the process names', () => {
  const state: TuiState = {
    names: [],
    noColor: false,
    active: 3,
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

  startTui(
    {
      procup: {
        listProcesses: () => [{ name: 'web' }, { name: 'api' }],
        resizeProcesses: () => true,
        startProject: () => true,
      },
      stdout: { columns: 100, rows: 30, write: () => true },
      stdin: { setRawMode: () => true, setEncoding: () => true, resume: () => true },
      renderFrame: () => true,
      scheduleFrame: () => true,
      nodeProcess: { env: {} },
      nodeTimers: { setInterval: () => true },
    },
    { state },
  )

  expect({
    names: state.names,
    active: state.active,
    width: state.width,
    height: state.height,
    sidebarWidth: state.sidebarWidth,
    paneX: state.paneX,
    paneRows: state.paneRows,
    termCols: state.termCols,
    termRows: state.termRows,
  }).toStrictEqual({
    names: ['web', 'api'],
    active: 0,
    width: 100,
    height: 30,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 28,
    termCols: 75,
    termRows: 28,
  })
})

test('the sidebar grows with long names, up to 34 columns', () => {
  const widths = [12, 20, 40].map(length => {
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
    startTui(
      {
        procup: {
          listProcesses: () => [{ name: 'x'.repeat(length) }],
          resizeProcesses: () => true,
          startProject: () => true,
        },
        stdout: { columns: 120, rows: 30, write: () => true },
        stdin: { setRawMode: () => true, setEncoding: () => true, resume: () => true },
        renderFrame: () => true,
        scheduleFrame: () => true,
        nodeProcess: { env: {} },
        nodeTimers: { setInterval: () => true },
      },
      { state },
    )
    return [state.sidebarWidth, state.paneX]
  })

  expect(widths).toStrictEqual([
    [18, 22],
    [26, 30],
    [34, 38],
  ])
})

test('a small terminal keeps a minimum size for the processes', () => {
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
  const resized: number[][] = []

  startTui(
    {
      procup: {
        listProcesses: () => [{ name: 'web' }],
        resizeProcesses: (cols: number, rows: number) => resized.push([cols, rows]),
        startProject: () => true,
      },
      stdout: { columns: 50, rows: 6, write: () => true },
      stdin: { setRawMode: () => true, setEncoding: () => true, resume: () => true },
      renderFrame: () => true,
      scheduleFrame: () => true,
      nodeProcess: { env: {} },
      nodeTimers: { setInterval: () => true },
    },
    { state },
  )

  expect([state.paneRows, state.termCols, state.termRows]).toStrictEqual([4, 40, 5])
  expect(resized).toStrictEqual([[40, 5]])
})

test('it takes over the terminal, sizes the processes, starts the project and draws', () => {
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
  const calls: string[] = []

  const result = startTui(
    {
      procup: {
        listProcesses: () => [{ name: 'web' }],
        resizeProcesses: (cols: number, rows: number) => calls.push(`resize ${cols}x${rows}`),
        startProject: () => calls.push('startProject'),
      },
      stdout: { columns: 100, rows: 30, write: (data: string) => calls.push(`write ${JSON.stringify(data)}`) },
      stdin: {
        setRawMode: (mode: boolean) => calls.push(`raw ${mode}`),
        setEncoding: (encoding: string) => calls.push(`encoding ${encoding}`),
        resume: () => calls.push('resume'),
      },
      renderFrame: () => calls.push('render'),
      scheduleFrame: () => calls.push('schedule'),
      nodeProcess: { env: {} },
      nodeTimers: { setInterval: () => true },
    },
    { state },
  )

  expect(result).toStrictEqual({ ok: true })
  expect(calls).toStrictEqual([
    `write ${JSON.stringify('\x1b[?1049h\x1b[?25l\x1b[2J\x1b[?1000h\x1b[?1002h\x1b[?1006h')}`,
    'raw true',
    'encoding utf8',
    'resume',
    'resize 75x28',
    'startProject',
    'render',
  ])
})

test('NO_COLOR in the environment turns the colors off', () => {
  const noColor = [{}, { NO_COLOR: '1' }, { NO_COLOR: '' }].map(env => {
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
    startTui(
      {
        procup: { listProcesses: () => [{ name: 'web' }], resizeProcesses: () => true, startProject: () => true },
        stdout: { columns: 100, rows: 30, write: () => true },
        stdin: { setRawMode: () => true, setEncoding: () => true, resume: () => true },
        renderFrame: () => true,
        scheduleFrame: () => true,
        nodeProcess: { env },
        nodeTimers: { setInterval: () => true },
      },
      { state },
    )
    return state.noColor
  })

  expect(noColor).toStrictEqual([false, true, true])
})

test('the spinner advances a frame every 80ms only while one is visible', () => {
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
  let frames = 0
  const intervals: { callback: () => void; ms: number }[] = []

  startTui(
    {
      procup: { listProcesses: () => [{ name: 'web' }], resizeProcesses: () => true, startProject: () => true },
      stdout: { columns: 100, rows: 30, write: () => true },
      stdin: { setRawMode: () => true, setEncoding: () => true, resume: () => true },
      renderFrame: () => true,
      scheduleFrame: () => frames++,
      nodeProcess: { env: {} },
      nodeTimers: { setInterval: (callback: () => void, ms: number) => intervals.push({ callback, ms }) },
    },
    { state },
  )
  const tick = () => {
    for (const interval of intervals) interval.callback()
  }
  tick()
  tick()
  const idle = [frames, state.spinFrame]
  state.spinning = true
  tick()
  tick()
  tick()

  expect(intervals.map(i => i.ms)).toStrictEqual([80])
  expect(idle).toStrictEqual([0, 0])
  expect(frames).toBe(3)
  expect(state.spinFrame).toBe(3)
})
