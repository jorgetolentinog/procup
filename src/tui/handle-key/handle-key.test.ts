import { expect, test } from 'vitest'
import type { TuiState } from '../state.ts'
import { handleKey } from './handle-key.ts'

test('left and right arrows switch process, wrapping around', () => {
  const state: TuiState = {
    names: ['web', 'api', 'db'],
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
    procup: {
      listProcesses: () => [
        { name: 'web', status: 'running' },
        { name: 'api', status: 'running' },
        { name: 'db', status: 'running' },
      ],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: () => true,
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }

  handleKey(deps, { state }, { data: '\x1b[C' })
  const afterRight = state.active
  handleKey(deps, { state }, { data: '\x1b[D\x1b[D' })
  const afterTwoLefts = state.active
  handleKey(deps, { state }, { data: '\x1bOC' })

  expect([afterRight, afterTwoLefts, state.active]).toStrictEqual([1, 2, 0])
})

test('number keys jump to that process and ignore numbers past the list', () => {
  const state: TuiState = {
    names: ['web', 'api', 'db'],
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
    procup: {
      listProcesses: () => [
        { name: 'web', status: 'running' },
        { name: 'api', status: 'running' },
        { name: 'db', status: 'running' },
      ],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: () => true,
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }

  handleKey(deps, { state }, { data: '3' })
  const afterThree = state.active
  handleKey(deps, { state }, { data: '9' })

  expect([afterThree, state.active]).toStrictEqual([2, 2])
})

test('enter sends every key to the process until a lone esc', () => {
  const state: TuiState = {
    names: ['repl'],
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
  const written: string[] = []
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'repl', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: (name: string, data: string) => written.push(`${name}:${data}`),
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }

  handleKey(deps, { state }, { data: '\r' })
  const inInput = state.inputMode
  handleKey(deps, { state }, { data: 'ls\rr\x04' })
  handleKey(deps, { state }, { data: '\x1b' })

  expect(inInput).toBe(true)
  expect(written).toStrictEqual(['repl:l', 'repl:s', 'repl:\r', 'repl:r', 'repl:\x04'])
  expect(state.inputMode).toBe(false)
})

test('escape sequences, alt keys and multi-byte characters reach the process whole', () => {
  const state: TuiState = {
    names: ['repl'],
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
  const written: string[] = []
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'repl', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: (_name: string, data: string) => written.push(data),
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }

  handleKey(deps, { state }, { data: '\x1b[A\x1bOB\x1b[1;2C\x1bb😀é\x1b\x1b' })

  expect(written).toStrictEqual(['\x1b[A', '\x1bOB', '\x1b[1;2C', '\x1bb', '😀', 'é', '\x1b\x1b'])
  expect(state.inputMode).toBe(true)
})

test('a sequence cut at the end of the input is still sent as one key', () => {
  const state: TuiState = {
    names: ['repl'],
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
  const written: string[] = []
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'repl', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: (_name: string, data: string) => written.push(data),
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }

  handleKey(deps, { state }, { data: '\x1b[1;2' })

  expect(written).toStrictEqual(['\x1b[1;2'])
})

test('SGR mouse reports go to the mouse handler and never to the process', () => {
  const state: TuiState = {
    names: ['repl'],
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
  const written: string[] = []
  const mice: { code: number; x: number; y: number; final: 'M' | 'm' }[] = []
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'repl', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: (_name: string, data: string) => written.push(data),
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: (input: { code: number; x: number; y: number; final: 'M' | 'm' }) => mice.push(input),
    scheduleFrame: () => true,
    quit: () => true,
  }

  const result = handleKey(deps, { state }, { data: '\x1b[<0;10;5M\x1b[<64;30;12M\x1b[<0;10;5m' })

  expect(mice).toStrictEqual([
    { code: 0, x: 10, y: 5, final: 'M' },
    { code: 64, x: 30, y: 12, final: 'M' },
    { code: 0, x: 10, y: 5, final: 'm' },
  ])
  expect(written).toStrictEqual([])
  expect(result.keys).toBe(0)
})

test('r restarts the active process and shift+r does nothing', () => {
  const state: TuiState = {
    names: ['web', 'api'],
    noColor: false,
    active: 1,
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
  const deps = {
    procup: {
      listProcesses: () => [
        { name: 'web', status: 'running' },
        { name: 'api', status: 'running' },
      ],
      restartProcess: (name: string) => calls.push(`restart ${name}`),
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: () => true,
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => calls.push('frame'),
    quit: () => true,
  }

  handleKey(deps, { state }, { data: 'R' })
  handleKey(deps, { state }, { data: 'r' })

  expect(calls).toStrictEqual(['restart api', 'frame'])
})

test('s stops a live process and starts any other', () => {
  const actions = ['pending', 'starting', 'running', 'ready', 'stopped', 'finished', 'failed', 'skipped'].map(
    status => {
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
      handleKey(
        {
          procup: {
            listProcesses: () => [{ name: 'web', status }],
            restartProcess: () => true,
            startProcess: (name: string) => calls.push(`start ${name}`),
            stopProcess: (name: string) => calls.push(`stop ${name}`),
            writeProcess: () => true,
            readScreen: () => ({ total: 0 }),
          },
          handleMouse: () => true,
          scheduleFrame: () => true,
          quit: () => true,
        },
        { state },
        { data: 's' },
      )
      return `${status}: ${calls.join(',')}`
    },
  )

  expect(actions).toStrictEqual([
    'pending: start web',
    'starting: stop web',
    'running: stop web',
    'ready: stop web',
    'stopped: start web',
    'finished: start web',
    'failed: start web',
    'skipped: start web',
  ])
})

test('h and ? toggle the help, and while it is open other keys do nothing', () => {
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
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'web', status: 'running' }],
      restartProcess: (name: string) => calls.push(`restart ${name}`),
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: () => true,
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }
  const visible: boolean[] = []

  handleKey(deps, { state }, { data: 'h' })
  visible.push(state.helpVisible)
  handleKey(deps, { state }, { data: 'r\r' })
  visible.push(state.helpVisible, state.inputMode)
  handleKey(deps, { state }, { data: '\x1b' })
  visible.push(state.helpVisible)
  handleKey(deps, { state }, { data: '?' })
  visible.push(state.helpVisible)
  handleKey(deps, { state }, { data: '?' })
  visible.push(state.helpVisible)

  expect(visible).toStrictEqual([true, true, false, false, true, false])
  expect(calls).toStrictEqual([])
})

test('ctrl+c closes the help first, then leaves input mode, then quits', () => {
  const state: TuiState = {
    names: ['web'],
    noColor: false,
    active: 0,
    inputMode: true,
    helpVisible: true,
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
  const written: string[] = []
  let quits = 0
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'web', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: (_name: string, data: string) => written.push(data),
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => quits++,
  }
  const steps: string[] = []

  for (const _ of [1, 2, 3]) {
    handleKey(deps, { state }, { data: '\x03' })
    steps.push(`help=${state.helpVisible} input=${state.inputMode} quits=${quits}`)
  }

  expect(steps).toStrictEqual([
    'help=false input=true quits=0',
    'help=false input=false quits=0',
    'help=false input=false quits=1',
  ])
  expect(written).toStrictEqual([])
})

test('arrows scroll a line, page keys a page, g and G jump to the top and the bottom', () => {
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
    procup: {
      listProcesses: () => [{ name: 'web', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: () => true,
      readScreen: () => ({ total: 100 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => true,
    quit: () => true,
  }
  const positions: [number | undefined, boolean | undefined][] = []

  for (const data of ['\x1b[A', '\x1b[5~', 'g', '\x1b[A', '\x1b[6~', '\x1b[B', 'G', '\x1b[B']) {
    handleKey(deps, { state }, { data })
    const scroll = state.scroll.get('web')
    positions.push([scroll?.top, scroll?.manual])
  }

  expect(positions).toStrictEqual([
    [71, true],
    [45, true],
    [0, true],
    [0, true],
    [26, true],
    [27, true],
    [72, false],
    [72, false],
  ])
})

test('unbound keys are ignored without redrawing', () => {
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
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'web', status: 'running' }],
      restartProcess: () => true,
      startProcess: () => true,
      stopProcess: () => true,
      writeProcess: () => true,
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => true,
    scheduleFrame: () => frames++,
    quit: () => true,
  }

  const result = handleKey(deps, { state }, { data: 'xz\x1b[3~' })

  expect(result.keys).toBe(3)
  expect(frames).toBe(0)
})

test('keys are ignored after shutdown', () => {
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
  let calls = 0
  const deps = {
    procup: {
      listProcesses: () => [{ name: 'web', status: 'running' }],
      restartProcess: () => calls++,
      startProcess: () => calls++,
      stopProcess: () => calls++,
      writeProcess: () => calls++,
      readScreen: () => ({ total: 0 }),
    },
    handleMouse: () => calls++,
    scheduleFrame: () => calls++,
    quit: () => calls++,
  }

  const result = handleKey(deps, { state }, { data: 'r\x03\x1b[<0;1;1M' })

  expect(result).toStrictEqual({ ok: true, keys: 0 })
  expect(calls).toBe(0)
})
