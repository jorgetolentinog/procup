import type { ClearInterval, ClearTimeout, Env, Platform, SetInterval, SetTimeout } from '../../types/node.ts'
import type { ContentPos, TuiState } from '../state.ts'

const COPIED_MESSAGE = 'Copied!'
const TEMP_MESSAGE_MS = 2000
const AUTO_SCROLL_THRESHOLD = 3
const AUTO_SCROLL_LINES_PER_SECOND = 36
const PAD_Y = 1
const HINT_ROWS = 7
const COMPACT_HINT_ROWS = 2

export type HandleMouseInput = { code: number; x: number; y: number; final: 'M' | 'm' }

type StyledRun = { text: string }

type Child = {
  on(event: 'error', listener: (error: Error) => void): unknown
  stdin: { on(event: 'error', listener: (error: Error) => void): unknown; end(data: string): unknown }
}

export type HandleMouseDeps = {
  procup: { readScreen(name: string, start: number, count: number): { total: number; lines: StyledRun[][] } }
  nodeChildProcess: {
    spawn(command: string, args: string[], options: { stdio: ['pipe', 'ignore', 'ignore'] }): Child
  }
  nodeTimers: SetTimeout & ClearTimeout & SetInterval & ClearInterval
  nodeProcess: Platform & Env
  scheduleFrame: () => unknown
}

export type HandleMouseCtx = { state: TuiState }

type MouseType = 'down' | 'up' | 'drag' | 'move' | 'scroll'

export type HandleMouseResult = { ok: true; type: MouseType | 'ignored' }

type Hit = {
  type: MouseType
  button: number
  left: boolean
  shift: boolean
  x: number
  ry: number
  active: string | undefined
  total: number
  top: number
  inPane: boolean
  onBar: boolean
  onText: boolean
  onTabs: boolean
  listRows: number
}

const WHEEL: Record<number, number> = { 0: -1, 1: 1 }

export function handleMouse(deps: HandleMouseDeps, ctx: HandleMouseCtx, input: HandleMouseInput): HandleMouseResult {
  const { state } = ctx
  if (state.destroyed) return { ok: true, type: 'ignored' }

  const type = eventType(state, input)
  state.pointer = { x: input.x - 1, y: input.y - 1 }
  if (type === 'move') return { ok: true, type }

  const hit = locate(deps, state, { input, type })
  if (type === 'scroll') wheel(deps, ctx, hit)
  else if (state.helpVisible) clickUnderHelp(deps, state, type)
  else point(deps, ctx, hit)
  return { ok: true, type }
}

function eventType(state: TuiState, input: HandleMouseInput): MouseType {
  const button = input.code & 3
  if ((input.code & 32) !== 0) return button !== 3 && state.pressedButtons.size > 0 ? 'drag' : 'move'
  if ((input.code & 64) !== 0 && input.final === 'M') return 'scroll'
  if (input.final === 'M') {
    if (button !== 3) state.pressedButtons.add(button)
    return 'down'
  }
  state.pressedButtons.clear()
  return 'up'
}

function locate(deps: HandleMouseDeps, state: TuiState, event: { input: HandleMouseInput; type: MouseType }): Hit {
  const button = event.input.code & 3
  const x = event.input.x - 1
  const ry = event.input.y - 1 - PAD_Y
  const rows = state.paneRows
  const inRows = ry >= 0 && ry < rows
  const textWidth = Math.max(0, state.width - state.paneX - 3)
  const active = state.names[state.active]
  const total = active === undefined ? 0 : deps.procup.readScreen(active, 0, 0).total
  const top = active === undefined ? 0 : (state.scroll.get(active)?.top ?? 0)
  const listRows = Math.max(1, rows - (state.names.length + HINT_ROWS > rows ? COMPACT_HINT_ROWS : HINT_ROWS))
  return {
    type: event.type,
    button,
    left: button === 0 || button === 3,
    shift: (event.input.code & 4) !== 0,
    x,
    ry,
    active,
    total,
    top,
    inPane: inRows && x > state.sidebarWidth && x < state.width,
    onBar: inRows && total > rows && textWidth > 0 && x === state.width - 2,
    onText: inRows && x >= state.paneX && x < state.paneX + Math.min(state.termCols, textWidth) && top + ry < total,
    onTabs: inRows && x < state.sidebarWidth && ry < listRows,
    listRows,
  }
}

function wheel(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): void {
  if (ctx.state.helpVisible || !hit.inPane || hit.active === undefined || hit.shift) return
  const direction = WHEEL[hit.button] ?? 0
  if (direction === 0) return
  setTop(deps, ctx, { name: hit.active, value: hit.top + direction })
  deps.scheduleFrame()
}

function clickUnderHelp(deps: HandleMouseDeps, state: TuiState, type: MouseType): void {
  if (type !== 'down' || state.selection === null) return
  state.selection = null
  deps.scheduleFrame()
}

function point(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): void {
  if (startSelection(deps, ctx, hit) || dragSelection(deps, ctx, hit) || finishSelection(deps, ctx, hit)) return
  if (dragScrollbar(deps, ctx, hit) || hit.type !== 'down') return
  if (pressScrollbar(deps, ctx, hit)) return
  clickTab(ctx.state, hit)
  ctx.state.selection = null
  deps.scheduleFrame()
}

function startSelection(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): boolean {
  const { state } = ctx
  if (hit.type !== 'down' || !hit.left || !hit.onText || hit.active === undefined) return false
  if (state.selection?.dragging === true) return false
  const at = { line: hit.top + hit.ry, col: hit.x - state.paneX }
  state.selection = { name: hit.active, anchor: at, focus: at, dragging: true }
  deps.scheduleFrame()
  return true
}

function dragSelection(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): boolean {
  if (hit.type !== 'drag' || ctx.state.selection?.dragging !== true) return false
  updateFocus(ctx)
  if (hit.inPane) updateAutoScroll(deps, ctx, hit.ry)
  deps.scheduleFrame()
  return true
}

function finishSelection(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): boolean {
  const { state } = ctx
  const selection = state.selection
  if (hit.type !== 'up' || selection?.dragging !== true) return false
  selection.dragging = false
  stopAutoScroll(deps, state)
  const text = selectedText(deps, ctx, selection.name)
  if (text === '') {
    state.selection = null
  } else {
    copyToClipboard(deps, text)
    showTemporaryMessage(deps, ctx, COPIED_MESSAGE)
  }
  deps.scheduleFrame()
  return true
}

function dragScrollbar(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): boolean {
  const { state } = ctx
  const drag = state.scrollbarDrag
  if (drag === null || hit.active === undefined || (hit.type !== 'drag' && hit.type !== 'up')) return false
  const value = sliderValue({ y: hit.ry, rows: state.paneRows, total: hit.total, offset: drag.offset })
  setTop(deps, ctx, { name: hit.active, value })
  if (hit.type === 'up') state.scrollbarDrag = null
  deps.scheduleFrame()
  return true
}

function pressScrollbar(deps: HandleMouseDeps, ctx: HandleMouseCtx, hit: Hit): boolean {
  const { state } = ctx
  if (!hit.onBar || !hit.left || hit.active === undefined) return false
  const rows = state.paneRows
  const thumb = thumbOf(hit.top, rows, hit.total)
  const realStart = Math.floor(thumb.start / 2)
  const realSize = Math.max(1, Math.ceil((thumb.start + thumb.size) / 2) - realStart)
  const onThumb = hit.ry >= realStart && hit.ry < realStart + realSize
  const current = onThumb ? hit.top : setTop(deps, ctx, { name: hit.active, value: jumpValue(hit.ry, rows, hit.total) })
  const moved = thumbOf(current, rows, hit.total)
  const virtualMouse = Math.max(0, Math.min(rows * 2, hit.ry * 2))
  state.scrollbarDrag = { offset: Math.max(0, Math.min(moved.size, virtualMouse - moved.start)) }
  deps.scheduleFrame()
  return true
}

function jumpValue(ry: number, rows: number, total: number): number {
  const ratio = rows === 0 ? 0 : Math.max(0, Math.min(rows, ry)) / rows
  return ratio * Math.max(0, total - rows)
}

function clickTab(state: TuiState, hit: Hit): void {
  if (!hit.onTabs || !hit.left) return
  const count = state.names.length
  const { listRows, ry } = hit
  const offset = Math.max(0, Math.min(state.active - Math.floor(listRows / 2), count - listRows))
  const onMore = listRows >= 3 && ((ry === 0 && offset > 0) || (ry === listRows - 1 && offset + listRows < count))
  const index = offset + ry
  if (onMore || index < 0 || index >= count || index === state.active) return
  state.active = index
  state.inputMode = false
}

function setTop(deps: HandleMouseDeps, ctx: HandleMouseCtx, target: { name: string; value: number }): number {
  const total = deps.procup.readScreen(target.name, 0, 0).total
  const max = Math.max(0, total - ctx.state.paneRows)
  const entry = ctx.state.scroll.get(target.name) ?? { top: 0, manual: false, total: -1, rows: -1 }
  entry.top = Math.round(Math.min(Math.max(0, target.value), max))
  entry.manual = max > 1 && entry.top < max
  ctx.state.scroll.set(target.name, entry)
  return entry.top
}

function updateFocus(ctx: HandleMouseCtx) {
  const { state } = ctx
  const selection = state.selection
  if (selection === null) return
  const top = state.scroll.get(selection.name)?.top ?? 0
  selection.focus = { line: top + state.pointer.y - PAD_Y, col: state.pointer.x - state.paneX }
}

function thumbOf(top: number, rows: number, total: number): { start: number; size: number } {
  const track = rows * 2
  const range = Math.max(0, total - rows)
  if (range === 0) return { start: 0, size: track }
  const viewport = Math.max(1, rows)
  const size = Math.max(1, Math.min(Math.floor((track * viewport) / (range + viewport)), track))
  return { start: Math.round((top / range) * (track - size)), size }
}

function sliderValue(drag: { y: number; rows: number; total: number; offset: number }): number {
  const range = Math.max(0, drag.total - drag.rows)
  const size = thumbOf(0, drag.rows, drag.total).size
  const maxStart = Math.max(0, drag.rows * 2 - size)
  const mouse = Math.max(0, Math.min(drag.rows, drag.y)) * 2
  const start = Math.max(0, Math.min(maxStart, mouse - drag.offset))
  return maxStart === 0 ? 0 : (start / maxStart) * range
}

function updateAutoScroll(deps: HandleMouseDeps, ctx: HandleMouseCtx, y: number) {
  const { state } = ctx
  if (autoScrollDirection(deps, ctx, y) === 0) {
    stopAutoScroll(deps, state)
    return
  }
  if (state.autoScroll) {
    state.autoScroll.y = y
    return
  }
  const timer = deps.nodeTimers.setInterval(() => tickAutoScroll(deps, ctx), 1000 / AUTO_SCROLL_LINES_PER_SECOND)
  state.autoScroll = { timer, y }
}

function tickAutoScroll(deps: HandleMouseDeps, ctx: HandleMouseCtx) {
  const { state } = ctx
  const auto = state.autoScroll
  const selection = state.selection
  if (auto === null || selection?.dragging !== true || state.destroyed) {
    stopAutoScroll(deps, state)
    return
  }
  const direction = autoScrollDirection(deps, ctx, auto.y)
  if (direction === 0) {
    stopAutoScroll(deps, state)
    return
  }
  const top = state.scroll.get(selection.name)?.top ?? 0
  setTop(deps, ctx, { name: selection.name, value: top + direction })
  updateFocus(ctx)
  deps.scheduleFrame()
}

function autoScrollDirection(deps: HandleMouseDeps, ctx: HandleMouseCtx, y: number): number {
  const { state } = ctx
  const name = state.selection?.name
  if (name === undefined) return 0
  const rows = state.paneRows
  const max = Math.max(0, deps.procup.readScreen(name, 0, 0).total - rows)
  const top = state.scroll.get(name)?.top ?? 0
  if (y <= AUTO_SCROLL_THRESHOLD) return top > 0 ? -1 : 0
  if (rows - y <= AUTO_SCROLL_THRESHOLD) return top < max ? 1 : 0
  return 0
}

function stopAutoScroll(deps: HandleMouseDeps, state: TuiState) {
  if (state.autoScroll !== null) deps.nodeTimers.clearInterval(state.autoScroll.timer)
  state.autoScroll = null
}

function selectedText(deps: HandleMouseDeps, ctx: HandleMouseCtx, name: string): string {
  const selection = ctx.state.selection
  const total = deps.procup.readScreen(name, 0, 0).total
  if (selection === null || total === 0) return ''

  const textOf = (line: number): string[] => {
    const runs = deps.procup.readScreen(name, line, 1).lines[0] ?? []
    const chars = graphemes(runs.map(r => r.text).join(''))
    return chars.length > 0 ? chars : [' ']
  }
  const width = (line: number) => textOf(line).length
  const end: ContentPos = { line: total - 1, col: width(total - 1) }
  const resolve = (pos: ContentPos): ContentPos => {
    if (pos.line < 0) return { line: 0, col: 0 }
    if (pos.line >= total) return end
    return { line: pos.line, col: Math.min(Math.max(0, pos.col), width(pos.line)) }
  }
  const anchor = resolve(selection.anchor)
  const focus = resolve(selection.focus)
  const afterAnchor = (): ContentPos => {
    if (anchor.col < width(anchor.line)) return { line: anchor.line, col: anchor.col + 1 }
    if (anchor.line + 1 < total) return { line: anchor.line + 1, col: 0 }
    return end
  }
  const before = focus.line < anchor.line || (focus.line === anchor.line && focus.col < anchor.col)
  const start = before ? focus : anchor
  const stop = before ? afterAnchor() : focus

  const pieces: string[] = []
  for (let line = start.line; line <= Math.min(stop.line, total - 1); line++) {
    const chars = textOf(line)
    const from = line === start.line ? start.col : 0
    const to = line === stop.line ? stop.col : chars.length
    pieces.push(chars.slice(from, to).join(''))
  }
  return pieces.join('\n')
}

function copyToClipboard(deps: HandleMouseDeps, text: string) {
  const [command, args] = clipboardCommand(deps.nodeProcess)
  const child = deps.nodeChildProcess.spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] })
  child.on('error', () => {})
  child.stdin.on('error', () => {})
  child.stdin.end(text)
}

function showTemporaryMessage(deps: HandleMouseDeps, ctx: HandleMouseCtx, message: string) {
  const { state } = ctx
  if (state.tempTimer !== null) deps.nodeTimers.clearTimeout(state.tempTimer)
  state.tempMessage = message
  state.tempTimer = deps.nodeTimers.setTimeout(() => {
    state.tempMessage = null
    state.tempTimer = null
    deps.scheduleFrame()
  }, TEMP_MESSAGE_MS)
}

const GRAPHEMES = new Intl.Segmenter()

function graphemes(text: string): string[] {
  return Array.from(GRAPHEMES.segment(text), part => part.segment)
}

function clipboardCommand(nodeProcess: Platform & Env): [command: string, args: string[]] {
  if (nodeProcess.platform === 'darwin') return ['pbcopy', []]
  if (nodeProcess.env.WAYLAND_DISPLAY !== undefined) return ['wl-copy', []]
  return ['xclip', ['-selection', 'clipboard']]
}
