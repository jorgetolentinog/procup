import type { ContentPos, PaneScroll, TuiState } from '../state.ts'

const PAD_Y = 1
const HINT_ROWS = 7
const COMPACT_HINT_ROWS = 2
const HELP_PAD = 3
const HELP_GAP = 6
const BOLD = '1'
const DIM = '2'
const INVERSE = '7'
const ACCENT = '38;5;214'
const GREEN = '32'
const YELLOW = '33'
const RED = '31'
const CYAN = '36'
const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const NOT_RUNNING = new Set(['pending', 'stopped', 'finished', 'skipped'])
const STARTABLE = new Set(['stopped', 'finished', 'failed'])

const HELP_KEYS: [title: string, keys: [key: string, desc: string][]][] = [
  [
    'Navigate',
    [
      ['←/→ 1-9', 'switch process'],
      ['↑/↓', 'scroll'],
      ['pgup/pgdn', 'scroll page'],
      ['g/G', 'top · bottom'],
    ],
  ],
  [
    'Process',
    [
      ['enter', 'input mode'],
      ['esc', 'exit input mode'],
      ['s', 'stop · start'],
      ['r', 'restart'],
    ],
  ],
]
const HELP_LEGEND: [status: string, label: string][] = [
  ['pending', 'pending'],
  ['starting', 'starting'],
  ['ready', 'running'],
  ['finished', 'finished'],
  ['failed', 'failed'],
  ['stopping', 'stopping'],
  ['stopped', 'stopped'],
  ['skipped', 'skipped'],
]

type StyledRun = { text: string; attrs: string; fg: string; bg: string }
type ProcessView = { name: string; status: string; readyText?: string }
type Cursor = { x: number; y: number }
type Frame = { lines: string[]; cursor: Cursor | null }
type Tint = (code: string) => string
type Cell = { w: number; s: string }
type Selection = { start: ContentPos; end: ContentPos }
type Pane = {
  total: number
  scroll: { top: number; manual: boolean }
  read: { lines: StyledRun[][]; cursor: { x: number; line: number } | null }
  selection: Selection | null
}
type SidebarLayout = { compact: boolean; listRows: number; offset: number; above: number; below: number }
type Sidebar = { layout: SidebarLayout; tabs: string[]; hints: string[]; rows: number; inner: number; width: number }
type Scrollbar = { show: boolean; thumbStart: number; thumbSize: number }

const EMPTY_PANE: Pane = {
  total: 0,
  scroll: { top: 0, manual: false },
  read: { lines: [], cursor: null },
  selection: null,
}

export type RenderFrameDeps = {
  procup: {
    listProcesses(): ProcessView[]
    readScreen(
      name: string,
      start: number,
      count: number,
    ): {
      total: number
      lines: StyledRun[][]
      cursor: { x: number; line: number } | null
    }
  }
  stdout: { write(data: string): unknown }
}

export type RenderFrameCtx = { state: TuiState }

export function renderFrame(deps: RenderFrameDeps, ctx: RenderFrameCtx): { ok: true; changedLines: number } {
  const { state } = ctx
  if (state.destroyed) return { ok: true, changedLines: 0 }

  state.spinning = false
  const frame = state.helpVisible ? helpFrame(state) : mainFrame(deps, state)
  return flush(deps, state, frame)
}

function flush(deps: RenderFrameDeps, state: TuiState, frame: Frame): { ok: true; changedLines: number } {
  const full = state.prevLines.length === 0
  let out = '\x1b[?2026h\x1b[?7l' + (full ? '\x1b[2J' : '')
  let changedLines = 0
  frame.lines.forEach((line, y) => {
    if (!full && state.prevLines[y] === line) return
    out += `\x1b[${y + 1};1H${line}\x1b[0m`
    changedLines++
  })

  out +=
    frame.cursor !== null && !state.helpVisible
      ? `\x1b[${frame.cursor.y + 1};${frame.cursor.x + 1}H\x1b[?25h`
      : '\x1b[?25l'
  out += '\x1b[?7h\x1b[?2026l'

  state.prevLines = frame.lines
  deps.stdout.write(out)
  return { ok: true, changedLines }
}

function helpFrame(state: TuiState): Frame {
  const tint = tintOf(state)
  const { width, height } = state
  const box = helpBox(helpBody(helpShortcuts(tint), helpLegend(tint), width))
  const top = Math.max(0, Math.floor((height - box.rows.length) / 2))
  const marginLeft = Math.max(0, Math.floor((width - box.inner - 2) / 2))
  const marginRight = Math.max(0, width - marginLeft - box.inner - 2)
  const blank = paint(' '.repeat(width))
  const lines = Array.from({ length: height }, (_, y) => {
    const line = box.rows[y - top]
    return line === undefined ? blank : paint(' '.repeat(marginLeft)) + line + paint(' '.repeat(marginRight))
  })
  return { lines, cursor: null }
}

function helpShortcuts(tint: Tint): Cell[] {
  const keyWidth = Math.max(...HELP_KEYS.flatMap(([, keys]) => keys.map(([key]) => len(key)))) + 3
  const cells: Cell[] = []
  for (const [title, keys] of HELP_KEYS) {
    if (cells.length > 0) cells.push(cell())
    cells.push(cell([title, BOLD, tint(ACCENT)]))
    for (const [key, desc] of keys) cells.push(cell([fit(key, keyWidth), BOLD], [desc]))
  }
  return cells
}

function helpLegend(tint: Tint): Cell[] {
  const legend = HELP_LEGEND.map(([status, label]) => {
    const icon = statusIcon(status, false, SPINNER.charAt(0))
    return cell([icon.glyph, icon.dim ? DIM : '', tint(icon.fg)], [`  ${label}`])
  })
  return [cell(['Status', BOLD, tint(ACCENT)]), ...legend]
}

function helpBody(left: Cell[], right: Cell[], width: number): Cell[] {
  const leftWidth = Math.max(...left.map(c => c.w))
  const rightWidth = Math.max(...right.map(c => c.w))
  if (HELP_PAD + leftWidth + HELP_GAP + rightWidth + HELP_PAD + 2 > width) return [...left, cell(), ...right]
  return Array.from({ length: Math.max(left.length, right.length) }, (_, i) => {
    const l = left[i] ?? cell()
    const r = right[i] ?? cell()
    return { w: leftWidth + HELP_GAP + r.w, s: l.s + paint(' '.repeat(leftWidth - l.w + HELP_GAP)) + r.s }
  })
}

function helpBox(body: Cell[]): { rows: string[]; inner: number } {
  const quit = cell(['ctrl+c', BOLD, DIM], [' quit', DIM])
  const close = cell(['esc', BOLD, DIM], [' close', DIM])
  const contentWidth = Math.max(...body.map(c => c.w), quit.w + HELP_GAP + close.w)
  const footer = { w: contentWidth, s: quit.s + paint(' '.repeat(contentWidth - quit.w - close.w)) + close.s }
  const inner = HELP_PAD + contentWidth + HELP_PAD
  const row = (c: Cell) =>
    paint('│', DIM) +
    paint(' '.repeat(HELP_PAD)) +
    c.s +
    paint(' '.repeat(contentWidth - c.w + HELP_PAD)) +
    paint('│', DIM)
  return {
    inner,
    rows: [
      paint(`╭${'─'.repeat(inner)}╮`, DIM),
      row(cell()),
      ...body.map(row),
      row(cell()),
      row(footer),
      row(cell()),
      paint(`╰${'─'.repeat(inner)}╯`, DIM),
    ],
  }
}

function mainFrame(deps: RenderFrameDeps, state: TuiState): Frame {
  const { width, height, paneRows: rows } = state
  const processes = new Map(deps.procup.listProcesses().map(p => [p.name, p]))
  const activeName = state.names[state.active]
  const inner = state.sidebarWidth - 2
  const textWidth = Math.max(0, width - state.paneX - 3)
  const pane = activeName === undefined ? EMPTY_PANE : readPane(deps, state, activeName)
  const layout = sidebarLayout(state)
  const sidebar: Sidebar = {
    layout,
    rows,
    inner,
    width: state.sidebarWidth,
    tabs: renderTabs(state, processes, inner),
    hints: renderHints(state, {
      compact: layout.compact,
      current: activeName === undefined ? undefined : processes.get(activeName),
      manual: pane.scroll.manual,
      inner,
    }),
  }
  const bar = scrollbarOf(pane, rows, textWidth)
  const limit = Math.min(textWidth, state.termCols)
  const blank = paint(' '.repeat(width))
  const divider = paint('│', DIM)
  const panePad = paint(' '.repeat(Math.max(0, state.paneX - state.sidebarWidth - 1)))

  const lines: string[] = height > 0 ? [blank] : []
  for (let y = 0; y < rows; y++) {
    const content = paneText(pane, y, limit)
    const paneCell = `${content.text}\x1b[0m${' '.repeat(Math.max(0, textWidth - content.used))} `
    lines.push(sideCell(y, sidebar) + divider + panePad + paneCell + barCell(y, bar) + paint(' '))
  }
  if (height > 1) lines.push(blank)

  return { lines, cursor: cursorOf(pane, state, textWidth) }
}

function readPane(deps: RenderFrameDeps, state: TuiState, name: string): Pane {
  const rows = state.paneRows
  const total = deps.procup.readScreen(name, 0, 0).total
  const scroll = recalculateScroll(state, name, { total, rows })
  const read = deps.procup.readScreen(name, scroll.top, rows)
  const selection = selectionRange(state, { name, total, width: line => widthOf(deps, name, line) })
  return { total, scroll, read, selection }
}

function sidebarLayout(state: TuiState): SidebarLayout {
  const rows = state.paneRows
  const count = state.names.length
  const compact = count + HINT_ROWS > rows
  const listRows = Math.max(1, rows - (compact ? COMPACT_HINT_ROWS : HINT_ROWS))
  const offset = Math.max(0, Math.min(state.active - Math.floor(listRows / 2), count - listRows))
  const above = listRows >= 3 && offset > 0 ? offset + 1 : 0
  const below = listRows >= 3 && offset + listRows < count ? count - (offset + listRows - 1) : 0
  return { compact, listRows, offset, above, below }
}

function renderTabs(state: TuiState, processes: Map<string, ProcessView>, inner: number): string[] {
  const tint = tintOf(state)
  const spin = SPINNER.charAt(state.spinFrame % SPINNER.length)
  return state.names.map((name, i) => {
    const p = processes.get(name)
    const status = p?.status ?? 'pending'
    const icon = statusIcon(status, status === 'running' && p?.readyText !== undefined, spin)
    if (icon.glyph === spin) state.spinning = true
    const nameStyle =
      i === state.active ? [BOLD, state.inputMode ? '' : tint(ACCENT)] : [NOT_RUNNING.has(status) ? DIM : '']
    return (
      paint(' ') +
      paint(icon.glyph, icon.dim ? DIM : '', tint(icon.fg)) +
      paint(' ') +
      paint(fit(name, inner - 3), ...nameStyle) +
      paint('  ')
    )
  })
}

function renderHints(
  state: TuiState,
  view: { compact: boolean; current: ProcessView | undefined; manual: boolean; inner: number },
): string[] {
  const tint = tintOf(state)
  const { inner } = view
  const hint = (key: string, label: string) =>
    paint(' ') +
    paint(key, BOLD, DIM) +
    paint(`${' '.repeat(Math.max(1, inner - 1 - len(key) - len(label)))}${label}`, DIM) +
    paint('  ')

  if (state.tempMessage !== null)
    return [paint(' ') + paint(fit(state.tempMessage, inner - 1), tint(CYAN)) + paint('  ')]
  if (state.inputMode) {
    const input = paint(' ') + paint(fit('INPUT', inner - 1), BOLD, tint(YELLOW)) + paint('  ')
    return view.compact ? [input] : [input, hint('esc', 'exit input')]
  }
  if (view.compact) return [hint('h', 'help')]

  const startable = view.current !== undefined && STARTABLE.has(view.current.status)
  const hints = [
    hint('←/→', 'tabs'),
    hint('enter', 'input'),
    hint('s', startable ? 'start' : 'stop'),
    hint('r', 'restart'),
    hint('h', 'help'),
  ]
  return view.manual ? [...hints, hint('G', 'bottom')] : hints
}

function sideCell(y: number, sidebar: Sidebar): string {
  const { layout, inner } = sidebar
  if (y === 0 && layout.above > 0) return more(`↑ ${layout.above} more`, inner)
  if (y === layout.listRows - 1 && layout.below > 0) return more(`↓ ${layout.below} more`, inner)
  const tab = sidebar.tabs[layout.offset + y]
  if (y < layout.listRows && tab !== undefined) return tab
  return sidebar.hints[y - (sidebar.rows - sidebar.hints.length)] ?? paint(' '.repeat(sidebar.width))
}

function more(text: string, inner: number): string {
  return paint(' ') + paint(fit(text, inner - 1), DIM) + paint('  ')
}

function paneText(pane: Pane, y: number, limit: number): { text: string; used: number } {
  const lineIndex = pane.scroll.top + y
  if (lineIndex >= pane.total) return { text: '', used: 0 }
  const raw = pane.read.lines[y] ?? []
  const runs = raw.length > 0 ? raw : [{ text: ' ', attrs: '', fg: '', bg: '' }]
  const lineWidth = runs.reduce((n, r) => n + graphemes(r.text).length, 0)
  return paintRuns(runs, selectedColumns(pane.selection, lineIndex, lineWidth), limit)
}

function selectedColumns(selection: Selection | null, line: number, lineWidth: number): { from: number; to: number } {
  if (!selection || line < selection.start.line || line > selection.end.line) return { from: -1, to: -1 }
  const from = line === selection.start.line ? selection.start.col : 0
  const to = Math.min(line === selection.end.line ? selection.end.col : lineWidth, lineWidth)
  return { from, to }
}

function paintRuns(
  runs: StyledRun[],
  selected: { from: number; to: number },
  limit: number,
): { text: string; used: number } {
  let text = ''
  let used = 0
  let style = ''
  for (const run of runs) {
    for (const char of graphemes(run.text)) {
      if (used >= limit) break
      const next = used >= selected.from && used < selected.to ? selectedStyle(run) : normalStyle(run)
      if (next !== style) text += next
      style = next
      text += char
      used++
    }
  }
  return { text, used }
}

function scrollbarOf(pane: Pane, rows: number, textWidth: number): Scrollbar {
  const track = rows * 2
  const range = Math.max(0, pane.total - rows)
  const thumbSize =
    range === 0
      ? track
      : Math.max(1, Math.min(Math.floor((track * Math.max(1, rows)) / (range + Math.max(1, rows))), track))
  const thumbStart = range === 0 ? 0 : Math.round((pane.scroll.top / range) * (track - thumbSize))
  return { show: pane.total > rows && textWidth > 0, thumbStart, thumbSize }
}

function barCell(y: number, bar: Scrollbar): string {
  if (!bar.show) return paint(' ')
  const cellStart = y * 2
  const start = Math.max(bar.thumbStart, cellStart)
  const coverage = Math.min(bar.thumbStart + bar.thumbSize, cellStart + 2) - start
  if (coverage >= 2) return paint('┃')
  if (coverage > 0) return paint(start === cellStart ? '╿' : '╽')
  return paint('│', DIM)
}

function cursorOf(pane: Pane, state: TuiState, textWidth: number): Cursor | null {
  const cursor = pane.read.cursor
  if (!cursor || !state.inputMode) return null
  const y = cursor.line - pane.scroll.top
  if (y < 0 || y >= state.paneRows || cursor.x >= textWidth) return null
  return { x: state.paneX + cursor.x, y: PAD_Y + y }
}

function statusIcon(status: string, booting: boolean, spin: string): { glyph: string; dim: boolean; fg: string } {
  if (status === 'starting' || booting) return { glyph: spin, dim: false, fg: YELLOW }
  if (status === 'running' || status === 'ready') return { glyph: '●', dim: false, fg: GREEN }
  if (status === 'stopping') return { glyph: spin, dim: true, fg: '' }
  if (status === 'stopped') return { glyph: '■', dim: true, fg: '' }
  if (status === 'finished') return { glyph: '✓', dim: false, fg: GREEN }
  if (status === 'failed') return { glyph: '✖', dim: false, fg: RED }
  if (status === 'skipped') return { glyph: '⊘', dim: true, fg: '' }
  return { glyph: '○', dim: true, fg: '' }
}

function recalculateScroll(state: TuiState, name: string, size: { total: number; rows: number }): PaneScroll {
  const { total, rows } = size
  const entry = state.scroll.get(name) ?? { top: 0, manual: false, total: -1, rows: -1 }
  if (entry.total !== total || entry.rows !== rows) {
    const max = Math.max(0, total - rows)
    if (!entry.manual) entry.top = max
    else if (max > 0 && entry.top >= max - 1) {
      entry.manual = false
      entry.top = max
    } else entry.top = Math.min(Math.max(0, entry.top), max)
    entry.total = total
    entry.rows = rows
  }
  state.scroll.set(name, entry)
  return entry
}

function widthOf(deps: RenderFrameDeps, name: string, line: number): number {
  const runs = deps.procup.readScreen(name, line, 1).lines[0] ?? []
  return Math.max(
    1,
    runs.reduce((n, r) => n + graphemes(r.text).length, 0),
  )
}

function selectionRange(
  state: TuiState,
  query: { name: string; total: number; width: (line: number) => number },
): Selection | null {
  const sel = state.selection
  const { total, width } = query
  if (!sel || sel.name !== query.name || total === 0) return null

  const end: ContentPos = { line: total - 1, col: width(total - 1) }
  const resolve = (pos: ContentPos): ContentPos => {
    if (pos.line < 0) return { line: 0, col: 0 }
    if (pos.line >= total) return end
    return { line: pos.line, col: Math.min(Math.max(0, pos.col), width(pos.line)) }
  }
  const anchor = resolve(sel.anchor)
  const focus = resolve(sel.focus)
  const before = focus.line < anchor.line || (focus.line === anchor.line && focus.col < anchor.col)
  if (!before) return { start: anchor, end: focus }
  if (anchor.col < width(anchor.line)) return { start: focus, end: { line: anchor.line, col: anchor.col + 1 } }
  if (anchor.line + 1 < total) return { start: focus, end: { line: anchor.line + 1, col: 0 } }
  return { start: focus, end }
}

function tintOf(state: TuiState): Tint {
  return code => (state.noColor ? '' : code)
}

function cell(...parts: [text: string, ...sgr: string[]][]): Cell {
  return {
    w: parts.reduce((n, [text]) => n + len(text), 0),
    s: parts.map(([text, ...sgr]) => paint(text, ...sgr)).join(''),
  }
}

function normalStyle(run: StyledRun): string {
  return `\x1b[0;${[run.fg, run.attrs, run.bg].filter(Boolean).join(';')}m`
}

function selectedStyle(run: StyledRun): string {
  const attrs = run.attrs.split(';').filter(Boolean)
  const toggled = attrs.includes(INVERSE) ? attrs.filter(a => a !== INVERSE) : [...attrs, INVERSE]
  return `\x1b[0;${[run.fg, ...toggled, run.bg].filter(Boolean).join(';')}m`
}

function paint(text: string, ...sgr: string[]): string {
  return `\x1b[0;${sgr.filter(Boolean).join(';')}m${text}`
}

function len(text: string): number {
  return graphemes(text).length
}

function fit(text: string, width: number): string {
  const chars = graphemes(text)
  return chars.length >= width ? chars.slice(0, width).join('') : text + ' '.repeat(width - chars.length)
}

const GRAPHEMES = new Intl.Segmenter()

function graphemes(text: string): string[] {
  return Array.from(GRAPHEMES.segment(text), part => part.segment)
}
