import { expect, test } from 'vitest'
import xtermHeadless from '@xterm/headless'
import type { TuiState } from '../state.ts'
import { renderFrame } from './render-frame.ts'

test('each process shows an icon whose color says what to do, and no status word', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
  const state: TuiState = {
    names: ['web', 'worker', 'job', 'boom', 'later', 'off', 'skip'],
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [
          { name: 'web', status: 'ready' },
          { name: 'worker', status: 'running' },
          { name: 'job', status: 'finished' },
          { name: 'boom', status: 'failed' },
          { name: 'later', status: 'pending' },
          { name: 'off', status: 'stopped' },
          { name: 'skip', status: 'skipped' },
        ],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const icon = (y: number) => {
    const cell = term.buffer.active.getLine(y)?.getCell(1)
    return [cell?.getChars(), cell?.getFgColor(), cell?.isDim() !== 0]
  }
  const screen = Array.from({ length: 30 }, (_, y) => term.buffer.active.getLine(y)?.translateToString(true)).join('\n')

  expect([1, 2, 3, 4, 5, 6, 7].map(y => icon(y))).toStrictEqual([
    ['●', 2, false],
    ['●', 2, false],
    ['✓', 2, false],
    ['✖', 1, false],
    ['○', -1, true],
    ['■', -1, true],
    ['⊘', -1, true],
  ])
  expect(screen).not.toMatch(/ready|running|finished|failed|pending|stopped|skipped/)
})

test('the active process is bold orange, only bold in input mode', async () => {
  const colors = await Promise.all(
    [false, true].map(async inputMode => {
      const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
      const state: TuiState = {
        names: ['web', 'api'],
        noColor: false,
        active: 1,
        inputMode,
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
      const output: string[] = []
      renderFrame(
        {
          procup: {
            listProcesses: () => [
              { name: 'web', status: 'ready' },
              { name: 'api', status: 'ready' },
            ],
            readScreen: () => ({ total: 0, lines: [], cursor: null }),
          },
          stdout: { write: (data: string) => output.push(data) },
        },
        { state },
      )
      await new Promise<void>(resolve => term.write(output.join(''), resolve))
      const active = term.buffer.active.getLine(2)?.getCell(3)
      const other = term.buffer.active.getLine(1)?.getCell(3)
      return [active?.isBold() !== 0, active?.getFgColor(), other?.isBold() !== 0, other?.getFgColor()]
    }),
  )

  expect(colors).toStrictEqual([
    [true, 214, false, -1],
    [true, -1, false, -1],
  ])
})

test('names are dim when the process is not running, except a failed one', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
  const state: TuiState = {
    names: ['main', 'web', 'boom', 'later', 'off', 'job', 'skip'],
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [
          { name: 'main', status: 'ready' },
          { name: 'web', status: 'running' },
          { name: 'boom', status: 'failed' },
          { name: 'later', status: 'pending' },
          { name: 'off', status: 'stopped' },
          { name: 'job', status: 'finished' },
          { name: 'skip', status: 'skipped' },
        ],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))

  expect([2, 3, 4, 5, 6, 7].map(y => term.buffer.active.getLine(y)?.getCell(3)?.isDim() !== 0)).toStrictEqual([
    false,
    false,
    true,
    true,
    true,
    true,
  ])
})

test('a process waiting for its readyPattern spins in yellow and advances with the spinner frame', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
  const state: TuiState = {
    names: ['db', 'web'],
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
  const output: string[] = []
  const deps = {
    procup: {
      listProcesses: () => [
        { name: 'db', status: 'running', readyPattern: /ready/ },
        { name: 'web', status: 'running' },
      ],
      readScreen: () => ({ total: 0, lines: [], cursor: null }),
    },
    stdout: { write: (data: string) => output.push(data) },
  }

  renderFrame(deps, { state })
  await new Promise<void>(resolve => term.write(output.splice(0).join(''), resolve))
  const first = term.buffer.active.getLine(1)?.getCell(1)
  const before = [first?.getChars(), first?.getFgColor(), state.spinning]
  state.spinFrame++
  renderFrame(deps, { state })
  await new Promise<void>(resolve => term.write(output.splice(0).join(''), resolve))

  expect(before).toStrictEqual(['⠋', 3, true])
  expect(term.buffer.active.getLine(1)?.getCell(1)?.getChars()).toBe('⠙')
  expect(term.buffer.active.getLine(2)?.getCell(1)?.getChars()).toBe('●')
})

test('a stopping process spins dim, and without spinners no frames are asked', async () => {
  const spinning = await Promise.all(
    ['stopping', 'running'].map(async status => {
      const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
        spinning: true,
        spinFrame: 0,
        spinTimer: null,
        destroyed: false,
      }
      const output: string[] = []
      renderFrame(
        {
          procup: {
            listProcesses: () => [{ name: 'web', status }],
            readScreen: () => ({ total: 0, lines: [], cursor: null }),
          },
          stdout: { write: (data: string) => output.push(data) },
        },
        { state },
      )
      await new Promise<void>(resolve => term.write(output.join(''), resolve))
      const cell = term.buffer.active.getLine(1)?.getCell(1)
      return [cell?.getChars(), cell?.isDim() !== 0, state.spinning]
    }),
  )

  expect(spinning).toStrictEqual([
    ['⠋', true, true],
    ['●', false, false],
  ])
})

test('the sidebar lists the shortcuts, and s says start for a stopped process', async () => {
  const hints = await Promise.all(
    ['running', 'stopped'].map(async status => {
      const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
      const output: string[] = []
      renderFrame(
        {
          procup: {
            listProcesses: () => [{ name: 'web', status }],
            readScreen: () => ({ total: 0, lines: [], cursor: null }),
          },
          stdout: { write: (data: string) => output.push(data) },
        },
        { state },
      )
      await new Promise<void>(resolve => term.write(output.join(''), resolve))
      return [24, 25, 26, 27, 28].map(y => term.buffer.active.getLine(y)?.translateToString(true).slice(0, 18).trim())
    }),
  )

  expect(hints).toStrictEqual([
    ['←/→        tabs', 'enter     input', 's          stop', 'r       restart', 'h          help'],
    ['←/→        tabs', 'enter     input', 's         start', 'r       restart', 'h          help'],
  ])
})

test('a scrolled pane adds G bottom to the shortcuts', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
    scroll: new Map([['web', { top: 10, manual: true, total: 100, rows: 28 }]]),
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: (_name: string, start: number, count: number) => ({
          total: 100,
          lines: Array.from({ length: 100 }, (_, i) => [{ text: `line-${i + 1}`, attrs: '', fg: '', bg: '' }]).slice(
            start,
            start + count,
          ),
          cursor: null,
        }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))

  expect(term.buffer.active.getLine(28)?.translateToString(true).slice(0, 18).trim()).toBe('G        bottom')
  expect(term.buffer.active.getLine(1)?.translateToString(true).slice(22)).toMatch(/^line-11\s/)
})

test('input mode shows INPUT in yellow, how to leave it, and the cursor of the process', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'repl', status: 'running' }],
        readScreen: () => ({
          total: 1,
          lines: [[{ text: '> ls', attrs: '', fg: '', bg: '' }]],
          cursor: { x: 4, line: 0 },
        }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const input = term.buffer.active.getLine(27)?.getCell(1)

  expect(term.buffer.active.getLine(27)?.translateToString(true).slice(0, 18).trim()).toBe('INPUT')
  expect([input?.isBold() !== 0, input?.getFgColor()]).toStrictEqual([true, 3])
  expect(term.buffer.active.getLine(28)?.translateToString(true).slice(0, 18).trim()).toBe('esc  exit input')
  expect([term.buffer.active.cursorX, term.buffer.active.cursorY]).toStrictEqual([26, 1])
  expect(output.join('').includes('\x1b[?25h')).toBe(true)
})

test('a temporary message replaces the shortcuts', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
    tempMessage: 'Copied!',
    tempTimer: null,
    prevLines: [],
    frameTimer: null,
    resizeTimer: null,
    spinning: false,
    spinFrame: 0,
    spinTimer: null,
    destroyed: false,
  }
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const sidebar = Array.from({ length: 30 }, (_, y) =>
    term.buffer.active.getLine(y)?.translateToString(true).slice(0, 18).trim(),
  )

  expect(sidebar[28]).toBe('Copied!')
  expect(term.buffer.active.getLine(28)?.getCell(1)?.getFgColor()).toBe(6)
  expect(sidebar.some(line => line?.includes('restart') === true)).toBe(false)
})

test('the pane shows the end of the output and a scrollbar with the thumb at the bottom', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: (_name: string, start: number, count: number) => ({
          total: 100,
          lines: Array.from({ length: 100 }, (_, i) => [{ text: `line-${i + 1}`, attrs: '', fg: '', bg: '' }]).slice(
            start,
            start + count,
          ),
          cursor: null,
        }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const line = (y: number) => term.buffer.active.getLine(y)?.translateToString(true)

  expect([line(1)?.slice(22, 29), line(28)?.slice(22, 30)]).toStrictEqual(['line-73', 'line-100'])
  expect([line(1)?.[18], line(1)?.slice(19, 22)]).toStrictEqual(['│', '   '])
  expect([line(1)?.[98], term.buffer.active.getLine(1)?.getCell(98)?.isDim() !== 0]).toStrictEqual(['│', true])
  expect(line(28)?.[98]).toBe('┃')
  expect(state.scroll.get('web')).toStrictEqual({ top: 72, manual: false, total: 100, rows: 28 })
})

test('a scrolled pane stays put while output grows and follows again near the bottom', () => {
  const tops = [10, 72].map(top => {
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
      scroll: new Map([['web', { top, manual: true, total: 100, rows: 28 }]]),
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
    renderFrame(
      {
        procup: {
          listProcesses: () => [{ name: 'web', status: 'running' }],
          readScreen: () => ({ total: 101, lines: [], cursor: null }),
        },
        stdout: { write: () => true },
      },
      { state },
    )
    return state.scroll.get('web')
  })

  expect(tops).toStrictEqual([
    { top: 10, manual: true, total: 101, rows: 28 },
    { top: 73, manual: false, total: 101, rows: 28 },
  ])
})

test('a short terminal keeps the processes visible and counts the hidden ones', async () => {
  const sidebars = await Promise.all(
    [0, 4].map(async active => {
      const term = new xtermHeadless.Terminal({ cols: 100, rows: 8, allowProposedApi: true })
      const state: TuiState = {
        names: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
        noColor: false,
        active,
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
      const output: string[] = []
      renderFrame(
        {
          procup: {
            listProcesses: () => state.names.map(name => ({ name, status: 'ready' })),
            readScreen: () => ({ total: 0, lines: [], cursor: null }),
          },
          stdout: { write: (data: string) => output.push(data) },
        },
        { state },
      )
      await new Promise<void>(resolve => term.write(output.join(''), resolve))
      return Array.from({ length: 8 }, (_, y) =>
        term.buffer.active.getLine(y)?.translateToString(true).slice(0, 18).trim(),
      )
    }),
  )

  expect(sidebars).toStrictEqual([
    ['', '● p1', '● p2', '● p3', '↓ 5 more', '', 'h          help', ''],
    ['', '↑ 3 more', '● p4', '● p5', '↓ 3 more', '', 'h          help', ''],
  ])
})

test('the help shows the shortcuts by group next to the icon legend', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
  const state: TuiState = {
    names: ['web'],
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const lines = Array.from({ length: 30 }, (_, y) => term.buffer.active.getLine(y)?.translateToString(true))
  const row = (pattern: RegExp) => lines.findIndex(line => line?.match(pattern))
  const cells = (y: number) => Array.from({ length: 100 }, (_, x) => term.buffer.active.getLine(y)?.getCell(x))
  const navigate = row(/Navigate/)
  const title = cells(navigate).find(cell => cell?.getChars() === 'N')
  const failed = row(/✖ {2}failed/)

  expect(lines[navigate]).toMatch(/Navigate +Status/)
  expect([title?.isBold() !== 0, title?.getFgColor()]).toStrictEqual([true, 214])
  expect(
    [
      '←/→ 1-9 +switch process',
      'pgup/pgdn +scroll page',
      'enter +input mode',
      'r +restart',
      'ctrl\\+c quit +esc close',
    ].filter(text => row(new RegExp(text)) === -1),
  ).toStrictEqual([])
  expect(
    ['pending', 'starting', 'running', 'finished', 'failed', 'stopping', 'stopped', 'skipped'].map(
      label => row(new RegExp(` ${label}`)) > navigate,
    ),
  ).toStrictEqual([true, true, true, true, true, true, true, true])
  expect(
    cells(failed)
      .find(cell => cell?.getChars() === '✖')
      ?.getFgColor(),
  ).toBe(1)
  expect(lines.join('\n')).not.toMatch(/web/)
})

test('a narrow help stacks the legend under the shortcuts', async () => {
  const term = new xtermHeadless.Terminal({ cols: 50, rows: 34, allowProposedApi: true })
  const state: TuiState = {
    names: ['web'],
    noColor: false,
    active: 0,
    inputMode: false,
    helpVisible: true,
    width: 50,
    height: 34,
    sidebarWidth: 18,
    paneX: 22,
    paneRows: 32,
    termCols: 40,
    termRows: 32,
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const lines = Array.from({ length: 34 }, (_, y) => term.buffer.active.getLine(y)?.translateToString(true))
  const row = (pattern: RegExp) => lines.findIndex(line => line?.match(pattern))

  expect(lines[row(/Navigate/)]).not.toMatch(/Status/)
  expect(row(/Status/)).toBeGreaterThan(row(/r +restart/))
})

test('NO_COLOR drops the colors and keeps bold and dim', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
  const state: TuiState = {
    names: ['web', 'later'],
    noColor: true,
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [
          { name: 'web', status: 'ready' },
          { name: 'later', status: 'pending' },
        ],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))
  const cell = (x: number, y: number) => term.buffer.active.getLine(y)?.getCell(x)

  expect([
    cell(1, 1)?.getFgColor(),
    cell(3, 1)?.getFgColor(),
    cell(3, 1)?.isBold() !== 0,
    cell(1, 2)?.isDim() !== 0,
  ]).toStrictEqual([-1, -1, true, true])
})

test('only the lines that changed are written again', () => {
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
  const statuses = { web: 'running', api: 'running' }
  const output: string[] = []
  const deps = {
    procup: {
      listProcesses: () => [
        { name: 'web', status: statuses.web },
        { name: 'api', status: statuses.api },
      ],
      readScreen: () => ({ total: 0, lines: [], cursor: null }),
    },
    stdout: { write: (data: string) => output.push(data) },
  }

  const first = renderFrame(deps, { state })
  const same = renderFrame(deps, { state })
  statuses.api = 'failed'
  const changed = renderFrame(deps, { state })

  expect([first.changedLines, same.changedLines, changed.changedLines]).toStrictEqual([30, 0, 1])
  expect(output.map(frame => frame.includes('\x1b[2J'))).toStrictEqual([true, false, false])
})

test('selected text is drawn inverted', async () => {
  const term = new xtermHeadless.Terminal({ cols: 100, rows: 30, allowProposedApi: true })
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
  const output: string[] = []
  renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: () => ({ total: 1, lines: [[{ text: 'hello', attrs: '', fg: '', bg: '' }]], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )
  await new Promise<void>(resolve => term.write(output.join(''), resolve))

  expect([22, 23, 24, 25, 26].map(x => term.buffer.active.getLine(1)?.getCell(x)?.isInverse() !== 0)).toStrictEqual([
    true,
    true,
    true,
    false,
    false,
  ])
})

test('nothing is drawn after shutdown', () => {
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
  const output: string[] = []

  const result = renderFrame(
    {
      procup: {
        listProcesses: () => [{ name: 'web', status: 'running' }],
        readScreen: () => ({ total: 0, lines: [], cursor: null }),
      },
      stdout: { write: (data: string) => output.push(data) },
    },
    { state },
  )

  expect(result).toStrictEqual({ ok: true, changedLines: 0 })
  expect(output).toStrictEqual([])
})
